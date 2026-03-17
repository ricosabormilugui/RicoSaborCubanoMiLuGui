export interface CartItem {
  productId: string;
  name: string;
  description?: string;
  unitPrice: number;
  quantity: number;
}

export type DeliveryType = 'delivery' | 'pickup';

export interface CheckoutFormData {
  fullName: string;
  phone: string;
  email?: string;
  deliveryType: DeliveryType;
  deliveryDate: string;
  deliverySlot: string;
  address?: string;
  reference?: string;
  notes?: string;
}

export interface OrderPayload {
  customer: {
    fullName: string;
    phone: string;
    email?: string;
  };
  deliveryDate: string;
  deliverySlot: string;
  deliveryType: DeliveryType;
  delivery: {
    date: string;
    slot: string;
    type: DeliveryType;
    address?: string;
    reference?: string;
  };
  notes?: string;
  items: CartItem[];
  subtotal: number;
  taxAmount?: number;
  taxRate?: number;
  total: number;
}
