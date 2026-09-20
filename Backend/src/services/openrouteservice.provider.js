const ORS_BASE_URL = "https://api.openrouteservice.org";
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map();
const geocodeCache = new Map();

export class RoutingProviderError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = "RoutingProviderError";
    this.code = code;
    this.status = status;
  }
}

function apiKey() {
  const value = String(process.env.OPENROUTESERVICE_API_KEY ?? "").trim();
  if (!value) throw new RoutingProviderError("ROUTING_UNAVAILABLE", "El cálculo de distancia no está disponible en este momento.");
  return value;
}

async function requestJson(url, options = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: options.signal ?? AbortSignal.timeout(10_000) });
  } catch {
    throw new RoutingProviderError("ROUTING_UNAVAILABLE", "No se pudo consultar la ruta de entrega.");
  }
  if (!response.ok) throw new RoutingProviderError("ROUTING_UNAVAILABLE", "No se pudo consultar la ruta de entrega.");
  return response.json();
}

export async function geocodeAddress(address, { fetchImpl = fetch } = {}) {
  const query = String(address ?? "").trim();
  if (!query) throw new RoutingProviderError("ADDRESS_NOT_FOUND", "No se pudo localizar la dirección indicada.", 422);
  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (fetchImpl === fetch && cached && cached.expiresAt > Date.now()) return cached.value;
  const url = new URL(`${ORS_BASE_URL}/geocode/search`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("text", query);
  url.searchParams.set("boundary.country", "ES");
  url.searchParams.set("size", "1");
  const data = await requestJson(url, {}, fetchImpl);
  const coordinates = data?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) {
    throw new RoutingProviderError("ADDRESS_NOT_FOUND", "No se pudo localizar la dirección indicada.", 422);
  }
  if (fetchImpl === fetch) geocodeCache.set(cacheKey, { value: coordinates, expiresAt: Date.now() + CACHE_TTL_MS });
  return coordinates;
}

export async function requestDrivingDistanceKm(origin, destination, { fetchImpl = fetch } = {}) {
  const data = await requestJson(`${ORS_BASE_URL}/v2/directions/driving-car/geojson`, {
    method: "POST",
    headers: { Authorization: apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [origin, destination] })
  }, fetchImpl);
  const meters = Number(data?.features?.[0]?.properties?.summary?.distance);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new RoutingProviderError("ROUTING_UNAVAILABLE", "No se pudo calcular una ruta por carretera para la dirección indicada.");
  }
  return meters / 1000;
}

export async function getDrivingDistanceKm(originAddress, destinationAddress, options = {}) {
  const cacheKey = `${String(originAddress).trim().toLowerCase()}|${String(destinationAddress).trim().toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [origin, destination] = await Promise.all([
    geocodeAddress(originAddress, options),
    geocodeAddress(destinationAddress, options)
  ]);
  const value = await requestDrivingDistanceKm(origin, destination, options);
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
