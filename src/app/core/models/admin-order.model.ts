export type AdminPaymentMethod = 'bizum' | 'bank_transfer' | 'cash';
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'rejected' | 'refunded';

export type AdminOrderStatus = 'nuevo' | 'confirmado' | 'preparando' | 'listo' | 'enviado' | 'entregado' | 'cancelado' | 'anulado';

export interface AdminOrder {
  orderId: string;
  status: AdminOrderStatus;
  createdAt: string;
  updatedAt?: string;
  accountMode?: 'guest' | 'registered';
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  items?: Array<{
    productId: string;
    name: string;
    description?: string;
    basePrice?: number;
    unitPrice: number;
    quantity: number;
    customization?: Array<{
      groupKey?: string;
      optionId?: string;
      label: string;
      value: string;
      priceModifier?: number;
    }>;
  }>;
  deliveryDate?: string;
  deliverySlot?: string;
  deliveryType?: "delivery" | "pickup";
  shipping?: {
    zoneId?: string;
    zoneName?: string;
    postalCode?: string;
    cost?: number;
    minimumOrder?: number;
    freeShippingFrom?: number;
    freeShippingApplied?: boolean;
  };
  shippingCost?: number;
  payment?: {
    method?: AdminPaymentMethod;
    status?: AdminPaymentStatus;
    instructions?: string;
  };
  paymentMethod?: AdminPaymentMethod;
  paymentStatus?: AdminPaymentStatus;
  requiresAdvancePayment?: boolean;
  paymentConfirmedAt?: string;
  notes?: string;
  subtotal?: number;
  couponCode?: string | null;
  discountAmount?: number;
  discountType?: string | null;
  discountPercent?: number;
  taxAmount?: number;
  taxRate?: number;
  total?: number;
  statusHistory?: Array<{
    status: AdminOrderStatus;
    at: string;
    note?: string | null;
    signature?: string | null;
  }>;
  notifications?: Array<{
    type: 'email';
    status: 'sent' | 'failed';
    date: string;
    error?: string | null;
  }>;
}
