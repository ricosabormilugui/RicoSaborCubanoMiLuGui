export interface CartItem {
  productId: string;
  name: string;
  description?: string;
  unitPrice: number;
  quantity: number;
}

export interface CheckoutFormData {
  fullName: string;
  phone: string;
  email?: string;
  deliveryMode: 'delivery' | 'pickup';
  address?: string;
  reference?: string;
  preferredTime?: string;
  notes?: string;
}

export interface OrderPayload {
  customer: {
    fullName: string;
    phone: string;
    email?: string;
  };
  delivery: {
    mode: 'delivery' | 'pickup';
    address?: string;
    reference?: string;
    preferredTime?: string;
  };
  notes?: string;
  items: CartItem[];
  subtotal: number;
  taxAmount?: number;
  taxRate?: number;
  total: number;
}
