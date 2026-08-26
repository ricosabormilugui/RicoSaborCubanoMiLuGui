import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { returnUrlQueryParams } from '../utils/safe-return-url';

interface ApiMessage {
  error?: string;
  message?: string;
}

export class PasswordRecoveryError extends Error {
  constructor(message: string, readonly code = 'UNKNOWN') {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class PasswordRecoveryService {
  private readonly apiBase = `${resolveApiBaseUrl()}/auth`;

  async requestReset(email: string, returnUrl?: string | null): Promise<string> {
    const response = await fetch(`${this.apiBase}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...returnUrlQueryParams(returnUrl) })
    });
    const payload = await this.readPayload(response);

    if (!response.ok) {
      throw new PasswordRecoveryError(payload.message || 'No se pudo enviar la solicitud. Inténtalo de nuevo.', payload.error);
    }

    return payload.message || 'Si existe una cuenta asociada a ese correo, recibirás un mensaje con las instrucciones para restablecer tu contraseña.';
  }

  async resetPassword(token: string, password: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const payload = await this.readPayload(response);

    if (!response.ok) {
      throw new PasswordRecoveryError(payload.message || 'No se pudo actualizar la contraseña.', payload.error);
    }

    return payload.message || 'Contraseña actualizada correctamente.';
  }

  private async readPayload(response: Response): Promise<ApiMessage> {
    try {
      return await response.json() as ApiMessage;
    } catch {
      return {};
    }
  }
}
