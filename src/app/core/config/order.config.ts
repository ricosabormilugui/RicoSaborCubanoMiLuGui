/**
 * Canonical order creation is always POST /api/orders (via `/api` → api-proxy → Express).
 * Local drafts and Netlify Function business logic are not used in any environment.
 */
export const ORDER_SUBMISSION_MODE = 'api' as const;
