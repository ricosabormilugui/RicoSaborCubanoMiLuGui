export type OrderSubmissionMode = 'local' | 'netlify';

/**
 * Cambia a 'netlify' cuando ya tengas desplegada (o ejecutando con `netlify dev`) la función serverless.
 */
export const ORDER_SUBMISSION_MODE: OrderSubmissionMode = 'local';
