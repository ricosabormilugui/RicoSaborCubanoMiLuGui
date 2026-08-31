export type PaymentMethodStatus = 'configured' | 'incomplete' | 'disabled' | 'active';

export interface PaymentMethodPublicState {
  enabled: boolean;
}

export interface PublicPaymentSettings {
  bizum: PaymentMethodPublicState;
  bankTransfer: PaymentMethodPublicState;
  cash: PaymentMethodPublicState;
}

export interface AdminBizumSettings {
  enabled: boolean;
  phone: string;
  instructions: string;
  status?: PaymentMethodStatus;
}

export interface AdminBankTransferSettings {
  enabled: boolean;
  holder: string;
  iban: string;
  instructions: string;
  status?: PaymentMethodStatus;
}

export interface AdminCashSettings {
  enabled: boolean;
  instructionsPickup: string;
  instructionsDelivery: string;
  status?: PaymentMethodStatus;
}

export interface AdminPaymentSettings {
  bizum: AdminBizumSettings;
  bankTransfer: AdminBankTransferSettings;
  cash: AdminCashSettings;
}

export function emptyPublicPaymentSettings(): PublicPaymentSettings {
  return {
    bizum: { enabled: false },
    bankTransfer: { enabled: false },
    cash: { enabled: false }
  };
}

export function emptyAdminPaymentSettings(): AdminPaymentSettings {
  return {
    bizum: { enabled: false, phone: '', instructions: '', status: 'disabled' },
    bankTransfer: { enabled: false, holder: '', iban: '', instructions: '', status: 'disabled' },
    cash: {
      enabled: false,
      instructionsPickup: 'Pago en efectivo al recoger el pedido.',
      instructionsDelivery: 'Pago en efectivo en la entrega.',
      status: 'disabled'
    }
  };
}

export function formatIbanDisplay(value: string): string {
  const compact = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

export function paymentMethodStatusLabel(status: PaymentMethodStatus | undefined): string {
  if (status === 'configured') return 'Configurado';
  if (status === 'incomplete') return 'Incompleto';
  if (status === 'active') return 'Activo';
  return 'Desactivado';
}
