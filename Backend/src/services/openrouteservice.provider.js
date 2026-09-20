const ORS_BASE_URL = "https://api.openrouteservice.org";
const CACHE_TTL_MS = 10 * 60_000;
const GEOCODER_RESULT_LIMIT = 10;
const routeCache = new Map();
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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(calle|c|avenida|av|paseo|plaza|carretera)\b/g, " ")
    .replace(/\b(de|del|la|las|el|los)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCountry(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeGeocodeQuery(input) {
  if (typeof input === "string") {
    const text = input.trim();
    return { text, street: "", houseNumber: "", postalCode: "", locality: "", region: "", country: "España" };
  }
  const street = String(input?.street ?? "").trim();
  const houseNumber = String(input?.houseNumber ?? "").trim();
  const postalCode = String(input?.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  const locality = String(input?.locality ?? "").trim();
  const region = String(input?.region ?? "").trim();
  const country = String(input?.country ?? "España").trim();
  const text = String(input?.text ?? [street, houseNumber, postalCode, locality, region, country].filter(Boolean).join(", ")).trim();
  return { text, street, houseNumber, postalCode, locality, region, country };
}

function queryCacheKey(query) {
  return JSON.stringify(Object.fromEntries(Object.entries(query).map(([key, value]) => [key, normalizeText(value)])));
}

function candidateMetadata(feature) {
  const properties = feature?.properties ?? {};
  const coordinates = feature?.geometry?.coordinates;
  return {
    label: String(properties.label ?? ""),
    name: String(properties.name ?? ""),
    locality: String(properties.locality ?? properties.localadmin ?? ""),
    localadmin: String(properties.localadmin ?? ""),
    county: String(properties.county ?? ""),
    region: String(properties.region ?? properties.county ?? ""),
    postalCode: String(properties.postalcode ?? "").replace(/\s/g, ""),
    country: String(properties.country ?? properties.country_a ?? ""),
    countryA: String(properties.country_a ?? ""),
    street: String(properties.street ?? properties.name ?? ""),
    houseNumber: String(properties.housenumber ?? ""),
    layer: String(properties.layer ?? ""),
    confidence: Number.isFinite(Number(properties.confidence)) ? Number(properties.confidence) : 0,
    longitude: Array.isArray(coordinates) ? Number(coordinates[0]) : NaN,
    latitude: Array.isArray(coordinates) ? Number(coordinates[1]) : NaN
  };
}

function scoreCandidate(candidate, query) {
  if (!Number.isFinite(candidate.longitude) || !Number.isFinite(candidate.latitude)) return null;
  const country = normalizeCountry(candidate.countryA || candidate.country);
  const countryLabel = normalizeText(candidate.label);
  if (query.country && !["espana", "spain", "es", "esp"].includes(country) && !countryLabel.includes("espana") && !countryLabel.includes("spain")) return null;
  if (query.postalCode && candidate.postalCode && candidate.postalCode !== query.postalCode) return null;

  const requestedStreet = normalizeText(query.street);
  const candidateStreet = normalizeText([candidate.street, candidate.name, candidate.label].join(" "));
  const candidateStreetName = normalizeText(candidate.street || candidate.name);
  if (requestedStreet && !candidateStreet.includes(requestedStreet) && !(candidateStreetName && requestedStreet.includes(candidateStreetName))) return null;
  const requestedLocality = normalizeText(query.locality);
  const candidateLocality = normalizeText([candidate.locality, candidate.localadmin, candidate.county, candidate.label].join(" "));
  if (requestedLocality && !candidateLocality.includes(requestedLocality)) return null;
  const requestedRegion = normalizeText(query.region);
  const regionMatches = !requestedRegion || normalizeText([candidate.region, candidate.label].join(" ")).includes(requestedRegion);

  const requestedHouseNumber = normalizeText(query.houseNumber);
  const candidateHouseNumber = normalizeText(candidate.houseNumber);
  if (requestedHouseNumber && candidateHouseNumber && candidateHouseNumber !== requestedHouseNumber) return null;
  const numberAppearsInLabel = requestedHouseNumber && normalizeText([candidate.name, candidate.label].join(" ")).split(" ").includes(requestedHouseNumber);

  let score = candidate.confidence;
  score += 2;
  if (query.postalCode && candidate.postalCode === query.postalCode) score += 5;
  if (requestedLocality && candidateLocality.includes(requestedLocality)) score += 5;
  if (requestedStreet) score += 5;
  if (requestedHouseNumber && (candidateHouseNumber === requestedHouseNumber || numberAppearsInLabel)) score += 4;
  if (regionMatches) score += 1;
  if (candidate.layer === "address") score += 1;
  return score;
}

function candidateIdentity(candidate) {
  return [
    normalizeText(candidate.street || candidate.name),
    normalizeText(candidate.locality || candidate.localadmin || candidate.county),
    candidate.postalCode,
    normalizeCountry(candidate.countryA || candidate.country)
  ].join("|");
}

function selectGeocodeCandidate(features, query) {
  const matches = (Array.isArray(features) ? features : [])
    .map((feature) => ({ candidate: candidateMetadata(feature), feature }))
    .map((entry) => ({ ...entry, score: scoreCandidate(entry.candidate, query) }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => right.score - left.score);
  if (!matches.length || matches[0].score < 10) return null;
  const [best, second] = matches;
  if (second && best.score - second.score < 1) {
    if (candidateIdentity(best.candidate) !== candidateIdentity(second.candidate)) return null;
  }
  return best.candidate;
}

export async function geocodeAddress(input, { fetchImpl = fetch, onDiagnostic } = {}) {
  const query = normalizeGeocodeQuery(input);
  if (!query.text) throw new RoutingProviderError("ADDRESS_NOT_FOUND", "No se pudo localizar la dirección indicada.", 422);
  const cacheKey = queryCacheKey(query);
  const cached = geocodeCache.get(cacheKey);
  if (fetchImpl === fetch && cached && cached.expiresAt > Date.now()) {
    onDiagnostic?.({ stage: "geocode.cache_hit", query: query.text, ...cached.metadata });
    return cached.coordinates;
  }

  const url = new URL(`${ORS_BASE_URL}/geocode/search`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("text", query.text);
  url.searchParams.set("boundary.country", "ES");
  url.searchParams.set("size", String(GEOCODER_RESULT_LIMIT));
  onDiagnostic?.({ stage: "geocode.request", query: query.text });

  const startedAt = Date.now();
  const data = await requestJson(url, {}, fetchImpl);
  onDiagnostic?.({
    stage: "geocode.candidates",
    query: query.text,
    elapsedMs: Date.now() - startedAt,
    candidates: (Array.isArray(data?.features) ? data.features : []).map(candidateMetadata)
  });
  const selected = selectGeocodeCandidate(data?.features, query);
  if (!selected) {
    onDiagnostic?.({ stage: "geocode.rejected", query: query.text, candidateCount: Array.isArray(data?.features) ? data.features.length : 0 });
    throw new RoutingProviderError("ADDRESS_NOT_FOUND", "No se pudo confirmar que la dirección corresponda con la localidad y el código postal indicados.", 422);
  }

  const coordinates = [selected.longitude, selected.latitude];
  const metadata = {
    label: selected.label,
    locality: selected.locality,
    postalCode: selected.postalCode,
    country: selected.country,
    longitude: selected.longitude,
    latitude: selected.latitude
  };
  onDiagnostic?.({ stage: "geocode.selected", query: query.text, ...metadata });
  if (fetchImpl === fetch) geocodeCache.set(cacheKey, { coordinates, metadata, expiresAt: Date.now() + CACHE_TTL_MS });
  return coordinates;
}

export async function requestDrivingDistanceKm(origin, destination, { fetchImpl = fetch, onDiagnostic } = {}) {
  onDiagnostic?.({ stage: "route.request", origin, destination });
  const startedAt = Date.now();
  const data = await requestJson(`${ORS_BASE_URL}/v2/directions/driving-car/geojson`, {
    method: "POST",
    headers: { Authorization: apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [origin, destination] })
  }, fetchImpl);
  const meters = Number(data?.features?.[0]?.properties?.summary?.distance);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new RoutingProviderError("ROUTING_UNAVAILABLE", "No se pudo calcular una ruta por carretera para la dirección indicada.");
  }
  const distanceKm = meters / 1000;
  onDiagnostic?.({ stage: "route.result", distanceKm, elapsedMs: Date.now() - startedAt });
  return distanceKm;
}

export async function getDrivingDistanceKm(originAddress, destinationAddress, options = {}) {
  const originQuery = normalizeGeocodeQuery(originAddress);
  const destinationQuery = normalizeGeocodeQuery(destinationAddress);
  const cacheKey = `${queryCacheKey(originQuery)}|${queryCacheKey(destinationQuery)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    options.onDiagnostic?.({ stage: "route.cache_hit", distanceKm: cached.value });
    return cached.value;
  }
  const [origin, destination] = await Promise.all([
    geocodeAddress(originQuery, options),
    geocodeAddress(destinationQuery, options)
  ]);
  const value = await requestDrivingDistanceKm(origin, destination, options);
  routeCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
