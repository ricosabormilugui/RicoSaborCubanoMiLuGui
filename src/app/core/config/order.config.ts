export type OrderSubmissionMode = 'local' | 'netlify' | 'api';

/**
 * Desarrollo recomendado:
 * - 'api' para Angular -> Backend local/remote
 * - 'netlify' solo si quieres forzar la Function
 * - 'local' solo para pruebas de navegador
 */
export const ORDER_SUBMISSION_MODE: OrderSubmissionMode = 'api';
