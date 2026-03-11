export type OrderSubmissionMode = 'local' | 'netlify' | 'api';

/**
 * Cambia a 'api' para enviar pedidos al backend Express (Render),
 * 'netlify' para usar la Function y 'local' para guardar en navegador.
 */
export const ORDER_SUBMISSION_MODE: OrderSubmissionMode = 'api';

/**
 * URL base del backend Express. En producción usa la URL pública de Render.
 * Ejemplo: https://ricosaborcubanomilugui.onrender.com
 */
export const BACKEND_API_BASE_URL = 'https://ricosaborcubanomilugui.onrender.com';
