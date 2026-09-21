import assert from "node:assert/strict";
import test from "node:test";
import { createNominatimProvider } from "../src/services/nominatim.provider.js";
import { buildDeliveryGeocodeQuery } from "../src/services/shipping.service.js";

const liverpool = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 6", postalCode: "28922" });

function candidate({ road = "Calle Liverpool", city = "Alcorcón", postcode = "28922", country = "España", countryCode = "es", houseNumber, lon = "-3.8418233", lat = "40.3438385", addressType = "road" } = {}) {
  return {
    display_name: `${road}, ${city}, Comunidad de Madrid, ${postcode}, ${country}`,
    name: road,
    lon,
    lat,
    addresstype: addressType,
    address: { road, city, postcode, country, country_code: countryCode, house_number: houseNumber, state: "Comunidad de Madrid" }
  };
}

function response(results) {
  return { ok: true, async json() { return results; } };
}

test("Liverpool: Nominatim valida CP y localidad y devuelve provider, precision y [lon, lat]", async () => {
  let request;
  const provider = createNominatimProvider({ fetchImpl: async (url, options) => {
    request = { url, options };
    return response([candidate()]);
  } });
  const location = await provider.geocode(liverpool);
  assert.deepEqual(location, { coordinates: [-3.8418233, 40.3438385], provider: "nominatim", precision: "street" });
  assert.equal(request.url.searchParams.get("q"), liverpool.text);
  assert.equal(request.url.searchParams.get("countrycodes"), "es");
  assert.match(request.options.headers["User-Agent"], /MIXSABOR/);
});

test("resultado de otra localidad se rechaza", async () => {
  const provider = createNominatimProvider({ fetchImpl: async () => response([candidate({ city: "Móstoles" })]) });
  await assert.rejects(() => provider.geocode(liverpool), (error) => error.code === "ADDRESS_NOT_FOUND");
});

test("resultado de otra calle se rechaza", async () => {
  const provider = createNominatimProvider({ fetchImpl: async () => response([candidate({ road: "Calle Atenas" })]) });
  await assert.rejects(() => provider.geocode(liverpool), (error) => error.code === "ADDRESS_NOT_FOUND");
});

test("resultado con CP incompatible se rechaza", async () => {
  const provider = createNominatimProvider({ fetchImpl: async () => response([candidate({ postcode: "28921" })]) });
  await assert.rejects(() => provider.geocode(liverpool), (error) => error.code === "ADDRESS_NOT_FOUND");
});

test("calle válida sin housenumber se acepta con precision street", async () => {
  const provider = createNominatimProvider({ fetchImpl: async () => response([candidate()]) });
  assert.equal((await provider.geocode(liverpool)).precision, "street");
});

test("locality-only no se acepta", async () => {
  const localityOnly = candidate({ road: "", addressType: "city" });
  localityOnly.address.road = undefined;
  localityOnly.name = "Liverpool";
  const provider = createNominatimProvider({ fetchImpl: async () => response([localityOnly]) });
  await assert.rejects(() => provider.geocode(liverpool), (error) => error.code === "ADDRESS_NOT_FOUND");
});

test("limita las solicitudes a una por segundo, incluidas las concurrentes", async () => {
  let clock = 0;
  const starts = [];
  const waits = [];
  const provider = createNominatimProvider({
    now: () => clock,
    wait: async (milliseconds) => { waits.push(milliseconds); clock += milliseconds; },
    fetchImpl: async () => { starts.push(clock); return response([candidate()]); }
  });
  const other = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 7", postalCode: "28922" });
  await Promise.all([provider.geocode(liverpool), provider.geocode(other)]);
  assert.deepEqual(starts, [0, 1_000]);
  assert.deepEqual(waits, [1_000]);
});

test("cachea solo resultados validados", async () => {
  let calls = 0;
  const provider = createNominatimProvider({ fetchImpl: async () => {
    calls++;
    return response(calls === 1 ? [candidate({ road: "Otra calle" })] : [candidate()]);
  }, wait: async () => {} });
  await assert.rejects(() => provider.geocode(liverpool), (error) => error.code === "ADDRESS_NOT_FOUND");
  const valid = await provider.geocode(liverpool);
  assert.equal(valid.provider, "nominatim");
  assert.deepEqual(await provider.geocode(liverpool), valid);
  assert.equal(calls, 2);
});
