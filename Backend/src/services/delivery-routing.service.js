import {
  geocodeLocation as geocodeWithOpenRouteService,
  requestDrivingDistanceKm,
  RoutingProviderError
} from "./openrouteservice.provider.js";
import { geocodeWithNominatim } from "./nominatim.provider.js";

async function resolveLocation(query, {
  orsGeocode = geocodeWithOpenRouteService,
  nominatimGeocode = geocodeWithNominatim,
  onDiagnostic
} = {}) {
  try {
    return await orsGeocode(query, { onDiagnostic });
  } catch (error) {
    if (!(error instanceof RoutingProviderError) || error.code !== "ADDRESS_NOT_FOUND") throw error;
    onDiagnostic?.({ stage: "geocode.fallback", from: "openrouteservice", to: "nominatim" });
    try {
      return await nominatimGeocode(query, { onDiagnostic });
    } catch {
      throw new RoutingProviderError("ADDRESS_NOT_FOUND", "No se pudo localizar la dirección indicada.", 422);
    }
  }
}

export async function getDeliveryDistanceKm(originQuery, destinationQuery, {
  orsGeocode = geocodeWithOpenRouteService,
  nominatimGeocode = geocodeWithNominatim,
  directions = requestDrivingDistanceKm,
  onDiagnostic
} = {}) {
  const [origin, destination] = await Promise.all([
    resolveLocation(originQuery, { orsGeocode, nominatimGeocode, onDiagnostic }),
    resolveLocation(destinationQuery, { orsGeocode, nominatimGeocode, onDiagnostic })
  ]);
  return directions(origin.coordinates, destination.coordinates, { onDiagnostic });
}
