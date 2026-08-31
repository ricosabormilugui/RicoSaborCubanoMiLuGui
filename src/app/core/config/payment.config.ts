import { PaymentMethod } from '../models/order.model';

export const PAYMENT_METHOD_META: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
}> = [
  { value: 'bizum', label: 'Bizum', description: 'Recibirás los datos de pago por email.' },
  { value: 'bank_transfer', label: 'Transferencia', description: 'Recibirás los datos bancarios por email.' },
  { value: 'cash', label: 'Efectivo', description: 'Disponible al recoger o entregar el pedido.' }
];

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_META.find((item) => item.value === method)?.label ?? 'Pago manual';
}

export function getCheckoutPaymentInstructions(method: PaymentMethod, orderId?: string): string {
  if (method === 'cash') {
    return 'Pagarás en efectivo al recoger o entregar el pedido.';
  }
  if (orderId) {
    return `Te hemos enviado por email los datos para pagar el pedido ${orderId}.`;
  }
  return 'Al confirmar el pedido te enviaremos por email los datos para pagar.';
}
