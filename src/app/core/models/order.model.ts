export interface CartCustomizationSelection {
  groupKey?: string;
  optionId?: string;
  label: string;
  value: string;
  priceModifier?: number;
  /** Campo legado de carritos anteriores. */
  price?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  description?: string;
  /** Miniatura resuelta al añadir desde catálogo. No implica una petición extra. */
  imageUrl?: string;
  /** Precio final por unidad: basePrice + modificadores seleccionados. */
  unitPrice: number;
  /** Precio base del producto antes de personalización. */
  basePrice?: number;
  quantity: number;
  minimumQuantity?: number;
  unitLabel?: string;
  baseProductId?: string;
  configurationId?: string;
  customization?: CartCustomizationSelection[];
  requiresAdvancePayment?: boolean;
  /** Copia de Product.trackStock. Si es false o ausente, no hay inventario limitado. */
  trackStock?: boolean;
  /** Unidades disponibles del producto base cuando trackStock es true. */
  stock?: number;
  lowStockAlert?: number;
  /** Producto ausente, despublicado o no disponible en el catálogo vivo. */
  unavailable?: boolean;
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
  distanceKm?: number;
  deliveryAddress?: string;
}

export type DeliveryQuoteReason = 'INVALID_ADDRESS' | 'ADDRESS_NOT_FOUND' | 'ROUTING_UNAVAILABLE' | 'MINIMUM_ORDER_NOT_REACHED' | 'OUTSIDE_DELIVERY_AREA';

export interface DeliveryQuote {
  available: boolean;
  deliveryType: DeliveryType;
  reason?: DeliveryQuoteReason;
  distanceKm?: number;
  deliveryFee: number;
  baseDeliveryFee?: number;
  minimumOrder?: number;
  subtotal: number;
  amountMissingForMinimum?: number;
  freeShippingThreshold?: number;
  amountMissingForFreeShipping?: number;
  zone?: string;
  deliveryAddress?: string;
  message: string;
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
