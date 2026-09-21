import assert from "node:assert/strict";
import test from "node:test";
import { getDeliveryDistanceKm } from "../src/services/delivery-routing.service.js";
import { geocodeLocation, RoutingProviderError } from "../src/services/openrouteservice.provider.js";
import { buildDeliveryGeocodeQuery } from "../src/services/shipping.service.js";

const origin = buildDeliveryGeocodeQuery({ address: "Paseo Miguel de Cervantes 2", postalCode: "28922" });
const liverpool = buildDeliveryGeocodeQuery({ address: "Calle Liverpool 6", postalCode: "28922" });
const atenas = buildDeliveryGeocodeQuery({ address: "Avenida de Atenas 1", postalCode: "28922" });
const originLocation = { coordinates: [-3.828, 40.35], provider: "openrouteservice", precision: "street" };
const atenasLocation = { coordinates: [-3.841179, 40.348704], provider: "openrouteservice", precision: "street" };
const liverpoolLocation = { coordinates: [-3.8418233, 40.3438385], provider: "nominatim", precision: "street" };

function notFound() {
  return new RoutingProviderError("ADDRESS_NOT_FOUND", "Dirección no encontrada.", 422);
}

test("Avenida de Atenas resuelta por ORS no llama a Nominatim", async () => {
  let fallbackCalls = 0;
  const distance = await getDeliveryDistanceKm(origin, atenas, {
    orsGeocode: async (query) => query.text.includes("Atenas") ? atenasLocation : originLocation,
    nominatimGeocode: async () => { fallbackCalls++; throw new Error("No debe llamarse"); },
    directions: async (from, to) => {
      assert.deepEqual(from, originLocation.coordinates);
      assert.deepEqual(to, atenasLocation.coordinates);
      return 2.1;
    }
  });
  assert.equal(distance, 2.1);
  assert.equal(fallbackCalls, 0);
});

test("ORS locality-only para Liverpool activa Nominatim y Directions recibe [lon, lat]", async () => {
  let fallbackCalls = 0;
  const distance = await getDeliveryDistanceKm(origin, liverpool, {
    orsGeocode: async (query) => {
      if (query.text.includes("Liverpool")) throw notFound();
      return originLocation;
    },
    nominatimGeocode: async (query) => {
      fallbackCalls++;
      assert.equal(query.text, liverpool.text);
      return liverpoolLocation;
    },
    directions: async (from, to) => {
      assert.deepEqual(from, [-3.828, 40.35]);
      assert.deepEqual(to, [-3.8418233, 40.3438385]);
      return 2.4;
    }
  });
  assert.equal(distance, 2.4);
  assert.equal(fallbackCalls, 1);
});

test("si ORS y Nominatim fallan devuelve ADDRESS_NOT_FOUND sin ejecutar Directions", async () => {
  let directionsCalls = 0;
  await assert.rejects(
    () => getDeliveryDistanceKm(origin, liverpool, {
      orsGeocode: async (query) => query.text.includes("Liverpool") ? Promise.reject(notFound()) : originLocation,
      nominatimGeocode: async () => { throw notFound(); },
      directions: async () => { directionsCalls++; }
    }),
    (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND" && error.status === 422
  );
  assert.equal(directionsCalls, 0);
});

test("ORS no acepta locality-only aunque su label contenga la calle", async () => {
  const previousKey = process.env.OPENROUTESERVICE_API_KEY;
  process.env.OPENROUTESERVICE_API_KEY = "test-key";
  try {
    await assert.rejects(
      () => geocodeLocation(liverpool, { fetchImpl: async () => ({ ok: true, json: async () => ({ features: [{
        geometry: { coordinates: [-3.817957, 40.344203] },
        properties: { label: "Calle Liverpool, Alcorcón, MD, Spain", name: "Alcorcón", street: "Calle Liverpool", locality: "Alcorcón", region: "Madrid", country: "Spain", country_a: "ESP", layer: "locality", confidence: 0.6 }
      }] }) }) }),
      (error) => error instanceof RoutingProviderError && error.code === "ADDRESS_NOT_FOUND"
    );
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
    else process.env.OPENROUTESERVICE_API_KEY = previousKey;
  }
});
