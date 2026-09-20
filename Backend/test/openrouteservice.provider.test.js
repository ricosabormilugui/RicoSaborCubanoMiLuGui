import assert from "node:assert/strict";
import test from "node:test";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  requestDrivingDistanceKm,
  RoutingProviderError
} from "../src/services/openrouteservice.provider.js";
import { buildDeliveryAddress, buildDeliveryGeocodeQuery } from "../src/services/shipping.service.js";

const previousKey = process.env.OPENROUTESERVICE_API_KEY;
test.before(() => { process.env.OPENROUTESERVICE_API_KEY = "test-key"; });
test.after(() => {
  if (previousKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
  else process.env.OPENROUTESERVICE_API_KEY = previousKey;
});

function response(body) {
  return { ok: true, async json() { return body; } };
}

function feature({ label, locality = "Alcorcón", postalCode = "28922", country = "España", street = "Calle Liverpool", houseNumber = "6", coordinates = [-3.827, 40.349], confidence = 0.9, layer = "address" }) {
  return {
    geometry: { coordinates },
    properties: { label, locality, postalcode: postalCode, country, street, housenumber: houseNumber, confidence, layer }
  };
}

const liverpoolQuery = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 6", postalCode: "28922" });

test("regresión Calle Liverpool: selecciona el candidato coherente y enruta [longitude, latitude]", async () => {
  const diagnostics = [];
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsedUrl = new URL(String(url));
    calls.push({ url: parsedUrl, options });
    if (parsedUrl.pathname.includes("/geocode/search")) {
      const query = parsedUrl.searchParams.get("text");
      if (query.includes("Miguel de Cervantes")) {
        return response({ features: [feature({ label: "Paseo Miguel de Cervantes, 2, 28922 Alcorcón, Madrid, España", street: "Paseo Miguel de Cervantes", houseNumber: "2", coordinates: [-3.828, 40.35] })] });
      }
      return response({ features: [
        feature({ label: "Liverpool, Reino Unido", locality: "Liverpool", postalCode: "L1", country: "Reino Unido", coordinates: [-2.98, 53.4], confidence: 0.99 }),
        feature({ label: "Calle Liverpool, 6, 28922 Alcorcón, Madrid, España", coordinates: [-3.827, 40.349], confidence: 0.85 })
      ] });
    }
    return response({ features: [{ properties: { summary: { distance: 1_250 } } }] });
  };

  const origin = buildDeliveryGeocodeQuery({ address: "Paseo Miguel de Cervantes 2", postalCode: "28922" });
  const distance = await getDrivingDistanceKm(origin, liverpoolQuery, { fetchImpl, onDiagnostic: (event) => diagnostics.push(event) });

  assert.equal(distance, 1.25);
  assert.equal(calls.filter(({ url }) => url.pathname.includes("/geocode/search")).length, 2);
  assert.match(calls[1].url.searchParams.get("text"), /Calle Liverpool 6, 28922, Alcorcón, Madrid, España/);
  assert.equal(calls[1].url.searchParams.get("size"), "10");
  const routeBody = JSON.parse(calls.find(({ url }) => url.pathname.includes("/directions/"))?.options.body);
  assert.deepEqual(routeBody.coordinates, [[-3.828, 40.35], [-3.827, 40.349]]);

  const selected = diagnostics.find((event) => event.stage === "geocode.selected" && event.label.includes("Liverpool"));
  assert.deepEqual(selected, {
    stage: "geocode.selected",
    query: "Calle Liverpool 6, 28922, Alcorcón, Madrid, España",
    label: "Calle Liverpool, 6, 28922 Alcorcón, Madrid, España",
    locality: "Alcorcón",
    postalCode: "28922",
    country: "España",
    longitude: -3.827,
    latitude: 40.349
  });
  assert.equal(diagnostics.find((event) => event.stage === "route.result")?.distanceKm, 1.25);
});

test("una dirección válida completa devuelve sus coordenadas", async () => {
  const coordinates = await geocodeAddress(liverpoolQuery, {
    fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, 6, 28922 Alcorcón, Madrid, España" })] })
  });
  assert.deepEqual(coordinates, [-3.827, 40.349]);
});

test("una dirección sin número acepta un resultado de calle coherente", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool", postalCode: "28922" });
  const coordinates = await geocodeAddress(query, {
    fetchImpl: async () => response({ features: [feature({
      label: "Calle Liverpool, 28922 Alcorcón, Madrid, España",
      houseNumber: "",
      layer: "street"
    })] })
  });
  assert.deepEqual(coordinates, [-3.827, 40.349]);
});

test("una dirección ambigua sin candidato claramente mejor devuelve ADDRESS_NOT_FOUND", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool", postalCode: "28922" });
  await assert.rejects(
    () => geocodeAddress(query, { fetchImpl: async () => response({ features: [
      feature({ label: "Calle Liverpool, 28922 Alcorcón, Madrid, España", houseNumber: "", layer: "street", coordinates: [-3.827, 40.349] }),
      feature({ label: "Calle Liverpool, 28922 Alcorcón, Madrid, España", houseNumber: "", layer: "street", coordinates: [-3.82, 40.34] })
    ] }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
  );
});

test("un resultado con CP incompatible devuelve ADDRESS_NOT_FOUND", async () => {
  await assert.rejects(
    () => geocodeAddress(liverpoolQuery, { fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, 6, Madrid", postalCode: "28001" })] }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
  );
});

test("sin resultados devuelve ADDRESS_NOT_FOUND", async () => {
  await assert.rejects(
    () => geocodeAddress(liverpoolQuery, { fetchImpl: async () => response({ features: [] }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND" && error.status === 422
  );
});

test("construye la dirección con calle, número, CP, Alcorcón, Madrid y España", () => {
  assert.equal(buildDeliveryAddress({ address: "Calle Liverpool 6", postalCode: "28922" }), "Calle Liverpool 6, 28922, Alcorcón, Madrid, España");
  assert.deepEqual(liverpoolQuery, {
    text: "Calle Liverpool 6, 28922, Alcorcón, Madrid, España",
    street: "Calle Liverpool",
    houseNumber: "6",
    postalCode: "28922",
    locality: "Alcorcón",
    region: "Madrid",
    country: "España"
  });
});

test("Directions conserva el orden [longitude, latitude]", async () => {
  let body;
  const distance = await requestDrivingDistanceKm([-3.828, 40.35], [-3.827, 40.349], {
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return response({ features: [{ properties: { summary: { distance: 900 } } }] });
    }
  });
  assert.deepEqual(body.coordinates, [[-3.828, 40.35], [-3.827, 40.349]]);
  assert.equal(distance, 0.9);
});
