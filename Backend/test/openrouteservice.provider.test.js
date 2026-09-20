import assert from "node:assert/strict";
import test from "node:test";
import { geocodeAddress, requestDrivingDistanceKm } from "../src/services/openrouteservice.provider.js";

test("OpenRouteService geocodifica y obtiene distancia de conducción mediante fetch mock", async () => {
  const previousKey = process.env.OPENROUTESERVICE_API_KEY;
  process.env.OPENROUTESERVICE_API_KEY = "test-key";
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/geocode/search")) {
      return { ok: true, async json() { return { features: [{ geometry: { coordinates: [-3.8, 40.35] } }] }; } };
    }
    return { ok: true, async json() { return { features: [{ properties: { summary: { distance: 27_400 } } }] }; } };
  };

  try {
    const destination = await geocodeAddress("Calle Mayor 1, Madrid", { fetchImpl });
    const distance = await requestDrivingDistanceKm([-3.82, 40.34], destination, { fetchImpl });
    assert.deepEqual(destination, [-3.8, 40.35]);
    assert.equal(distance, 27.4);
    assert.match(calls[0].url, /boundary.country=ES/);
    assert.equal(calls[1].options.headers.Authorization, "test-key");
    assert.deepEqual(JSON.parse(calls[1].options.body).coordinates, [[-3.82, 40.34], [-3.8, 40.35]]);
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
    else process.env.OPENROUTESERVICE_API_KEY = previousKey;
  }
});
