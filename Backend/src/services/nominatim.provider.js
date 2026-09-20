const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_USER_AGENT = "MIXSABOR/1.0 (delivery-geocoder)";
const CACHE_TTL_MS = 10 * 60_000;
const MIN_REQUEST_INTERVAL_MS = 1_000;

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

function cacheKey(query) {
  return JSON.stringify({
    text: normalizeText(query?.text),
    street: normalizeText(query?.street),
    houseNumber: normalizeText(query?.houseNumber),
    postalCode: String(query?.postalCode ?? "").replace(/\D/g, "").slice(0, 5),
    locality: normalizeText(query?.locality),
    region: normalizeText(query?.region),
    country: normalizeText(query?.country)
  });
}

function candidateFromResult(result) {
  const address = result?.address ?? {};
  const longitude = Number(result?.lon);
  const latitude = Number(result?.lat);
  const street = String(address.road ?? address.pedestrian ?? address.residential ?? result?.name ?? "");
  const houseNumber = String(address.house_number ?? "");
  const locality = String(address.city ?? address.town ?? address.municipality ?? address.village ?? address.county ?? "");
  return {
    displayName: String(result?.display_name ?? ""),
    street,
    houseNumber,
    postalCode: String(address.postcode ?? "").replace(/\s/g, ""),
    locality,
    region: String(address.state ?? address.region ?? ""),
    country: String(address.country ?? ""),
    countryCode: String(address.country_code ?? "").toLowerCase(),
    category: String(result?.category ?? result?.class ?? ""),
    type: String(result?.type ?? ""),
    addressType: String(result?.addresstype ?? ""),
    importance: Number.isFinite(Number(result?.importance)) ? Number(result.importance) : 0,
    longitude,
    latitude
  };
}

function scoreCandidate(candidate, query) {
  if (!Number.isFinite(candidate.longitude) || !Number.isFinite(candidate.latitude)) return null;
  const countryMatches = candidate.countryCode === "es" || ["espana", "spain"].includes(normalizeText(candidate.country));
  if (!countryMatches) return null;
  if (query.postalCode && candidate.postalCode && candidate.postalCode !== query.postalCode) return null;

  const requestedStreet = normalizeText(query.street);
  const candidateStreet = normalizeText(candidate.street);
  if (!requestedStreet || !candidateStreet || (!candidateStreet.includes(requestedStreet) && !requestedStreet.includes(candidateStreet))) return null;

  const requestedLocality = normalizeText(query.locality);
  const localityEvidence = normalizeText([candidate.locality, candidate.displayName].join(" "));
  if (requestedLocality && !localityEvidence.includes(requestedLocality)) return null;

  const requestedNumber = normalizeText(query.houseNumber);
  const candidateNumber = normalizeText(candidate.houseNumber);
  if (requestedNumber && candidateNumber && requestedNumber !== candidateNumber) return null;

  let score = 2 + 5 + candidate.importance;
  if (requestedLocality) score += 5;
  if (query.postalCode && candidate.postalCode === query.postalCode) score += 5;
  if (requestedNumber && candidateNumber === requestedNumber) score += 4;
  if (query.region && normalizeText([candidate.region, candidate.displayName].join(" ")).includes(normalizeText(query.region))) score += 1;
  if (["house", "building", "address"].includes(candidate.addressType)) score += 1;
  return score;
}

function selectCandidate(results, query) {
  const candidates = (Array.isArray(results) ? results : [])
    .map(candidateFromResult)
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, query) }))
    .filter(({ score }) => score !== null && score >= 10)
    .sort((left, right) => right.score - left.score);
  return candidates[0]?.candidate ?? null;
}

export function createNominatimProvider({
  fetchImpl = fetch,
  now = () => Date.now(),
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
} = {}) {
  const cache = new Map();
  let queue = Promise.resolve();
  let lastRequestStartedAt = 0;

  async function scheduleRequest(task) {
    const scheduled = queue.then(async () => {
      const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now() - lastRequestStartedAt));
      if (delay > 0) await wait(delay);
      lastRequestStartedAt = now();
      return task();
    });
    queue = scheduled.catch(() => undefined);
    return scheduled;
  }

  return {
    async geocode(query, { onDiagnostic } = {}) {
      const key = cacheKey(query);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now()) {
        onDiagnostic?.({ stage: "nominatim.cache_hit", provider: "nominatim", precision: cached.value.precision });
        return cached.value;
      }

      return scheduleRequest(async () => {
        const url = new URL("/search", process.env.NOMINATIM_BASE_URL || DEFAULT_BASE_URL);
        url.searchParams.set("q", String(query?.text ?? "").trim());
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "5");
        url.searchParams.set("countrycodes", "es");
        const contactEmail = String(process.env.NOMINATIM_CONTACT_EMAIL ?? "").trim();
        if (contactEmail) url.searchParams.set("email", contactEmail);

        onDiagnostic?.({ stage: "nominatim.request", query: query.text });
        const startedAt = now();
        let response;
        try {
          response = await fetchImpl(url, {
            headers: {
              "User-Agent": process.env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT,
              "Accept-Language": "es"
            },
            signal: AbortSignal.timeout(10_000)
          });
        } catch {
          throw Object.assign(new Error("No se pudo consultar la geocodificación alternativa."), { code: "ADDRESS_NOT_FOUND", status: 422 });
        }
        if (!response.ok) throw Object.assign(new Error("No se pudo consultar la geocodificación alternativa."), { code: "ADDRESS_NOT_FOUND", status: 422 });
        const data = await response.json();
        onDiagnostic?.({ stage: "nominatim.results", elapsedMs: now() - startedAt, resultCount: Array.isArray(data) ? data.length : 0 });
        const selected = selectCandidate(data, query);
        if (!selected) throw Object.assign(new Error("No se pudo localizar la dirección indicada."), { code: "ADDRESS_NOT_FOUND", status: 422 });

        const precision = selected.houseNumber ? "address" : "street";
        const value = {
          coordinates: [selected.longitude, selected.latitude],
          provider: "nominatim",
          precision
        };
        cache.set(key, { value, expiresAt: now() + CACHE_TTL_MS });
        onDiagnostic?.({ stage: "nominatim.selected", ...value });
        return value;
      });
    }
  };
}

const nominatimProvider = createNominatimProvider();

export function geocodeWithNominatim(query, options) {
  return nominatimProvider.geocode(query, options);
}
