import { Injectable, signal } from '@angular/core';
import { ConfirmDialogOptions } from '../notifications/notification.types';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly state = signal<ConfirmDialogOptions | null>(null);
  readonly current = this.state.asReadonly();
  private resolve: ((confirmed: boolean) => void) | null = null;

  open(options: ConfirmDialogOptions): Promise<boolean> {
    // Do not queue destructive actions or replace an unanswered confirmation.
    if (this.current()) return Promise.resolve(false);
    return new Promise(resolve => {
      this.resolve = resolve;
      this.state.set({ confirmText: 'Continuar', cancelText: 'Cancelar', variant: 'default', closeOnEscape: true, ...options });
    });
  }

  close(confirmed = false): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.state.set(null);
    resolve?.(confirmed);
  }
}
