export type AdminContactStatus = 'nuevo' | 'leido' | 'respondido';

export interface AdminContactMessage {
  from: 'cliente' | 'admin';
  text: string;
  date: string;
}

export interface AdminContactNotification {
  type: 'email' | 'whatsapp';
  status: 'sent' | 'error';
  error?: string | null;
  date: string;
}

export interface AdminContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  message: string;
  status: AdminContactStatus;
  messages: AdminContactMessage[];
  notifications?: AdminContactNotification[];
  createdAt: string;
  updatedAt?: string;
}
