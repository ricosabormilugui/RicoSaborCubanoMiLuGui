export interface CartCustomizationSelection {
  label: string;
  value: string;
  price?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  description?: string;
  unitPrice: number;
  quantity: number;
  minimumQuantity?: number;
  unitLabel?: string;
  baseProductId?: string;
  customization?: CartCustomizationSelection[];
}

export type DeliveryType = 'delivery' | 'pickup';
export type PaymentMethod = 'bizum' | 'bank_transfer' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface ShippingDetails {
  zoneId?: string;
  zoneName?: string;
  postalCode?: string;
  cost: number;
  minimumOrder?: number;
  freeShippingFrom?: number;
  freeShippingApplied: boolean;
}

export interface CheckoutFormData {
  fullName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email?: string;
  deliveryType: DeliveryType;
  deliveryDate: string;
  deliverySlot: string;
  address?: string;
  postalCode?: string;
  reference?: string;
  notes?: string;
  marketingConsent: boolean;
  legalConsent: boolean;
  couponCode?: string;
  paymentMethod: PaymentMethod;
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
    postalCode?: string;
    reference?: string;
  };
  notes?: string;
  marketingConsent?: boolean;
  legalConsent?: boolean;
  couponCode?: string | null;
  discountAmount?: number;
  discountType?: 'percent' | string | null;
  discountPercent?: number;
  promotions?: {
    firstOrderDiscount?: {
      code: string;
      percent: number;
      status: string;
      discountAmount?: number;
      usedAt?: string;
      orderId?: string;
    };
  };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    instructions: string;
  };
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipping: ShippingDetails;
  shippingCost: number;
  items: CartItem[];
  subtotal: number;
  taxAmount?: number;
  taxRate?: number;
  total: number;
  requiresAdvancePayment?: boolean;
}
