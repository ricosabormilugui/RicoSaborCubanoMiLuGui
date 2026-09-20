import { calculateShippingQuote } from "../services/shipping.service.js";
import { RoutingProviderError } from "../services/openrouteservice.provider.js";

export function createShippingQuoteController({ quoteService = calculateShippingQuote } = {}) {
  return async function getShippingQuote(req, res) {
    try {
      const quote = await quoteService(req.body ?? {});
      return res.status(quote.reason === "INVALID_ADDRESS" ? 422 : 200).json(quote);
    } catch (error) {
      if (error instanceof RoutingProviderError) {
        return res.status(error.status).json({ available: false, reason: error.code, message: error.message });
      }
      return res.status(500).json({ available: false, reason: "ROUTING_UNAVAILABLE", message: "No se pudo calcular la entrega en este momento." });
    }
  };
}

export const getShippingQuote = createShippingQuoteController();
