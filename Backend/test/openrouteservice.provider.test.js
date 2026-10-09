import assert from "node:assert/strict";
import test from "node:test";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  requestDrivingDistanceKm,
  RoutingProviderError
} from "../src/services/openrouteservice.provider.js";
import { buildDeliveryAddress, buildDeliveryGeocodeQuery, splitStreetAndNumber } from "../src/services/shipping.service.js";
import { createShippingQuoteController } from "../src/controllers/shipping.controller.js";

const previousKey = process.env.OPENROUTESERVICE_API_KEY;
test.before(() => { process.env.OPENROUTESERVICE_API_KEY = "test-key"; });
test.after(() => {
  if (previousKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
  else process.env.OPENROUTESERVICE_API_KEY = previousKey;
});

function response(body) {
  return { ok: true, async json() { return body; } };
}

function feature({ label, name, locality, localadmin = "Alcorcón", county, region = "Madrid", postalCode, country = "Spain", countryA = "ESP", street = "Calle Liverpool", houseNumber, coordinates = [-3.827, 40.349], confidence = 0.9, layer = "address" }) {
  return {
    geometry: { coordinates },
    properties: { label, name, locality, localadmin, county, region, postalcode: postalCode, country, country_a: countryA, street, housenumber: houseNumber, confidence, layer }
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
        return response({ features: [feature({ label: "Paseo Miguel de Cervantes, 2, 28922 Alcorcón, Madrid, España", street: "Paseo Miguel de Cervantes", houseNumber: "2", postalCode: "28922", coordinates: [-3.828, 40.35] })] });
      }
      return response({ features: [
        feature({ label: "Liverpool, Reino Unido", locality: "Liverpool", localadmin: "Liverpool", postalCode: "L1", country: "Reino Unido", countryA: "GBR", coordinates: [-2.98, 53.4], confidence: 0.99 }),
        feature({ label: "Calle Liverpool, 6, 28922 Alcorcón, Madrid, España", postalCode: "28922", houseNumber: "6", coordinates: [-3.827, 40.349], confidence: 0.85 })
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
    country: "Spain",
    longitude: -3.827,
    latitude: 40.349
  });
  assert.equal(diagnostics.find((event) => event.stage === "route.result")?.distanceKm, 1.25);
});

test("una dirección válida completa devuelve sus coordenadas", async () => {
  const coordinates = await geocodeAddress(liverpoolQuery, {
    fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, 6, 28922 Alcorcón, Madrid, España", postalCode: "28922", houseNumber: "6" })] })
  });
  assert.deepEqual(coordinates, [-3.827, 40.349]);
});

test("una dirección sin número acepta un resultado de calle coherente", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool", postalCode: "28922" });
  const coordinates = await geocodeAddress(query, {
    fetchImpl: async () => response({ features: [feature({
      label: "Calle Liverpool, 28922 Alcorcón, Madrid, España",
      postalCode: "28922",
      layer: "street"
    })] })
  });
  assert.deepEqual(coordinates, [-3.827, 40.349]);
});

test("una dirección ambigua sin candidato claramente mejor devuelve ADDRESS_NOT_FOUND", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool", postalCode: "28922" });
  await assert.rejects(
    () => geocodeAddress(query, { fetchImpl: async () => response({ features: [
      feature({ label: "Calle Liverpool, Alcorcón, Madrid, España", localadmin: "Alcorcón", layer: "street", coordinates: [-3.827, 40.349] }),
      feature({ label: "Calle Liverpool, Alcorcón, Madrid, España", localadmin: "Alcorcón Norte", layer: "street", coordinates: [-3.82, 40.34] })
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

test("Avenida de Atenas sin CP en ORS se rechaza para que el fallback lo confirme", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Avenida de Atenas 1", postalCode: "28922" });
  const candidates = [
    feature({ label: "Avenida de Atenas, Alcorcón, MD, Spain", name: "Avenida de Atenas", street: "Avenida de Atenas", layer: "street", confidence: 0.8, coordinates: [-3.841179, 40.348704] }),
    feature({ label: "Avenida de Atenas, Alcorcón, MD, Spain", name: "Avenida de Atenas", street: "Avenida de Atenas", locality: "Alcorcón", layer: "street", confidence: 0.8, coordinates: [-3.837454, 40.345819] })
  ];
  await assert.rejects(
    () => geocodeAddress(query, { fetchImpl: async () => response({ features: candidates }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
  );
});

test("calle abreviada, localadmin y Comunidad de Madrid aportan evidencia equivalente", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Avenida de Atenas 1", postalCode: "28922" });
  const coordinates = await geocodeAddress(query, { fetchImpl: async () => response({ features: [feature({
    label: "Av. de Atenas, Alcorcón, Community of Madrid, Spain",
    name: "Av. de Atenas",
    street: "Av. de Atenas",
    postalCode: "28922",
    region: "Comunidad de Madrid",
    layer: "street",
    confidence: 0.8
  })] }) });
  assert.deepEqual(coordinates, [-3.827, 40.349]);
});

test("un número explícitamente distinto no coincide", async () => {
  await assert.rejects(
    () => geocodeAddress(liverpoolQuery, { fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, 8, 28922 Alcorcón, Madrid, España", postalCode: "28922", houseNumber: "8" })] }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
  );
});

test("un candidato de otra ciudad no supera el matching", async () => {
  await assert.rejects(
    () => geocodeAddress(liverpoolQuery, { fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, Móstoles, Madrid, España", locality: "Móstoles", localadmin: "Móstoles", street: "Calle Liverpool" })] }) }),
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

test("conserva piso y puerta para la entrega pero los excluye de la consulta geográfica", () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 6, 2º A", postalCode: "28922" });
  assert.equal(query.text, "Calle Liverpool 6, 28922, Alcorcón, Madrid, España");
  assert.equal(buildDeliveryAddress({ address: "Calle Liverpool 6, 2º A", postalCode: "28922" }), "Calle Liverpool 6, 2º A, 28922, Alcorcón, Madrid, España");
  assert.deepEqual(splitStreetAndNumber("Calle Liverpool 6, 2º A"), { street: "Calle Liverpool", houseNumber: "6" });
  assert.equal(query.street, "Calle Liverpool");
  assert.equal(query.houseNumber, "6");
});

test("Calle Jose Maria Peman usa localidad declarada para resolver calles homónimas", async () => {
  const query = buildDeliveryGeocodeQuery({
    address: "Calle Jose Maria Peman 47",
    postalCode: "28019",
    city: "Madrid",
    province: "Madrid",
    country: "España"
  });
  const coordinates = await geocodeAddress(query, { fetchImpl: async () => response({ features: [
    feature({ label: "Calle José María Pemán, Algete, MD, Spain", street: "Calle José María Pemán", locality: "Algete", localadmin: "Algete", postalCode: "28110", layer: "street", coordinates: [-3.507988, 40.600196], confidence: 0.8 }),
    feature({ label: "Calle José María Pemán, Madrid, Spain", street: "Calle José María Pemán", locality: "Madrid", localadmin: "", postalCode: "28019", layer: "street", coordinates: [-3.735108, 40.395395], confidence: 0.8 })
  ] }) });
  assert.equal(query.text, "Calle Jose Maria Peman 47, 28019, Madrid, España");
  assert.deepEqual(coordinates, [-3.735108, 40.395395]);
});

test("una provincia explícitamente incompatible se rechaza", async () => {
  const query = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 6", postalCode: "28922", city: "Alcorcón", province: "Toledo" });
  await assert.rejects(
    () => geocodeAddress(query, { fetchImpl: async () => response({ features: [feature({ label: "Calle Liverpool, Alcorcón, Madrid, España", region: "Madrid" })] }) }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
  );
});

test("un fallo del proveedor ORS se distingue de una dirección no encontrada", async () => {
  await assert.rejects(
    () => geocodeAddress(liverpoolQuery, { fetchImpl: async () => { throw new Error("offline"); } }),
    (error) => error instanceof RoutingProviderError && error.code === "GEOCODING_UNAVAILABLE" && error.status === 503
  );
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

test("el controller conserva 422 y reason ADDRESS_NOT_FOUND", async () => {
  const controller = createShippingQuoteController({ quoteService: async () => { throw new RoutingProviderError("ADDRESS_NOT_FOUND", "Dirección no confirmada.", 422); } });
  const responseState = { statusCode: 200, body: null };
  const res = {
    status(code) { responseState.statusCode = code; return this; },
    json(body) { responseState.body = body; return this; }
  };
  await controller({ body: {} }, res);
  assert.equal(responseState.statusCode, 422);
  assert.equal(responseState.body.reason, "ADDRESS_NOT_FOUND");
});
