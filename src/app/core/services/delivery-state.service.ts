import { Injectable, signal } from '@angular/core';
import { DeliveryType } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class DeliveryStateService {
  readonly date = signal<string | null>(null);
  readonly slot = signal<string | null>(null);
  readonly type = signal<DeliveryType>('delivery');

  setDeliveryState({ date, slot, type }: { date: string; slot: string; type: DeliveryType }): void {
    this.date.set(date);
    this.slot.set(slot);
    this.type.set(type);
  }

  clear(): void {
    this.date.set(null);
    this.slot.set(null);
    this.type.set('delivery');
  }
}
