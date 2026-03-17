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
    unitPrice: number;
    quantity: number;
  }>;
  deliveryDate?: string;
  deliverySlot?: string;
  deliveryType?: "delivery" | "pickup";
  notes?: string;
  subtotal?: number;
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
    type: 'whatsapp' | 'email';
    status: 'sent' | 'failed';
    date: string;
    error?: string | null;
  }>;
}
