import { PaymentMethod } from '../models/order.model';

export const PAYMENT_METHOD_META: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  { value: 'bizum', label: 'Bizum', description: 'Entorno de pruebas — no realizar pagos' },
  { value: 'bank_transfer', label: 'Transferencia', description: 'Entorno de pruebas — no realizar pagos' },
  { value: 'cash', label: 'Efectivo', description: 'Prueba de flujo. No entregar dinero ni realizar pagos.' }
];

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_META.find((item) => item.value === method)?.label ?? 'Pago manual';
}

export function getCheckoutPaymentInstructions(method: PaymentMethod, orderId?: string): string {
  if (method === 'cash') {
    return 'Prueba de flujo. No entregar dinero ni realizar pagos.';
  }
  if (orderId) {
    return `Entorno de pruebas — no realizar pagos. Pedido ${orderId}.`;
  }
  return 'Entorno de pruebas — no realizar pagos.';
}
