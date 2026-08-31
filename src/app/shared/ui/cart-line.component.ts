import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CartItem } from '../../core/models/order.model';
import { CartService } from '../../core/services/cart.service';
import { compactCustomizationSummary, isLineOverStock, isLineOutOfStock } from '../../core/utils/cart-stock';
import { optimizedImageUrl } from '../../core/utils/responsive-image';
import { IconComponent } from './icon.component';

export type CartLineMode = 'cart' | 'summary';

@Component({
  selector: 'app-cart-line',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, IconComponent],
  template: `
    <article class="line" [class.is-summary]="isSummary()" [class.is-blocked]="blocked()">
      @if (thumb()) {
        <img class="thumb" [src]="thumb()" [alt]="item().name" width="88" height="88" loading="lazy" decoding="async" />
      }
      <div class="body">
        <div class="title-row">
          <strong class="name">{{ item().name }}</strong>
          @if (!isSummary()) {
            <strong class="price">{{ lineTotal() | currency:'EUR' }}</strong>
          }
        </div>
        @if (!isSummary() && (item().unitLabel || (item().minimumQuantity ?? 1) > 1)) {
          <p class="meta">
            @if (item().unitLabel) { Venta por {{ item().unitLabel }} }
            @if (item().unitLabel && (item().minimumQuantity ?? 1) > 1) { · }
            @if ((item().minimumQuantity ?? 1) > 1) { Mínimo {{ item().minimumQuantity }} }
          </p>
        }
        @if (item().customization?.length) {
          @if (isSummary()) {
            <p class="custom-compact">{{ compactSummary() }}</p>
          } @else {
            <dl class="custom">
              @for (option of item().customization; track option.label + option.value) {
                <div class="custom-row">
                  <dt>{{ option.label }}</dt>
                  <dd>{{ option.value }}@if (option.priceModifier) { · +{{ option.priceModifier | currency:'EUR' }} }</dd>
                </div>
              }
            </dl>
          }
        }
        @if (isSummary()) {
          <p class="qty-readout" [attr.aria-label]="'Cantidad: ' + item().quantity">{{ item().quantity }} × {{ item().unitPrice | currency:'EUR' }}</p>
        } @else {
          <div class="actions">
            <div class="qty" [attr.aria-label]="'Cantidad de ' + item().name">
              <button
                type="button"
                class="qty-btn"
                [disabled]="!cart.canDecrement(item())"
                [attr.aria-label]="'Reducir cantidad de ' + item().name"
                (click)="decrement()">−</button>
              <span class="qty-value" aria-live="polite">{{ item().quantity }}</span>
              <button
                type="button"
                class="qty-btn"
                [disabled]="!cart.canIncrement(item())"
                [attr.aria-label]="'Aumentar cantidad de ' + item().name"
                (click)="increment()">+</button>
            </div>
            <button
              type="button"
              class="remove"
              (click)="remove()"
              aria-label="Eliminar producto"
              title="Eliminar producto">
              <app-icon name="trash" [size]="17" />
            </button>
          </div>
        }
        @if (hint()) {
          <p class="stock" [class.is-out]="hintKind() === 'out'" [class.is-conflict]="hintKind() === 'conflict' || hintKind() === 'max'" aria-live="polite">
            {{ hint() }}
            @if (canAdjust()) {
              <button type="button" class="adjust" (click)="adjust()">Ajustar a {{ cart.maxQuantity(item()) }}</button>
            }
          </p>
        }
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .line {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: .75rem;
      align-items: start;
      padding: 1.05rem 0;
      border: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--border-soft) 58%, transparent);
      background: transparent;
      box-shadow: none;
    }
    .line:last-child { border-bottom: 0; padding-bottom: 0; }
    .thumb {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
      background: color-mix(in srgb, var(--surface-1) 70%, transparent);
    }
    .body { display: grid; gap: .28rem; min-width: 0; }
    .title-row { display: flex; justify-content: space-between; gap: .85rem; align-items: flex-start; }
    .name { color: var(--text-main); font-size: .98rem; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
    .price { color: var(--text-main); font-variant-numeric: tabular-nums; white-space: nowrap; font-size: .98rem; font-weight: 700; }
    .meta, .qty-readout, .custom-compact { margin: 0; color: var(--text-soft); font-size: .8rem; line-height: 1.4; overflow-wrap: anywhere; }
    .custom { margin: .15rem 0 .05rem; display: grid; gap: .38rem; }
    .custom-row { display: grid; gap: .08rem; min-width: 0; }
    .custom dt {
      margin: 0;
      color: var(--text-soft);
      font-size: .68rem;
      font-weight: 650;
      letter-spacing: .04em;
    }
    .custom dd {
      margin: 0;
      color: var(--text-main);
      font-size: .84rem;
      font-weight: 500;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .65rem;
      margin-top: .2rem;
    }
    .qty {
      display: inline-flex;
      align-items: center;
      height: 32px;
      border: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
      border-radius: 8px;
      background: transparent;
    }
    .qty-btn {
      width: 44px;
      height: 44px;
      margin-block: -6px;
      border: 0;
      background: transparent;
      color: var(--text-main);
      font-size: 1rem;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      transition: background .15s ease, color .15s ease;
    }
    .qty-btn:hover:not(:disabled) { background: var(--hover-surface); }
    .qty-btn:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--accent-green) 80%, var(--text-main) 20%);
      outline-offset: -2px;
    }
    .qty-btn:disabled { opacity: .38; cursor: not-allowed; }
    .qty-value {
      min-width: 1.5rem;
      padding: 0 .1rem;
      text-align: center;
      font-size: .88rem;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
    .remove {
      display: inline-flex;
      flex: 0 0 44px;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--text-soft);
      cursor: pointer;
      border-radius: 8px;
      transition: color .15s ease, background .15s ease;
    }
    .remove:hover {
      color: var(--error-text);
      background: color-mix(in srgb, var(--error-bg) 55%, transparent);
    }
    .remove:focus-visible {
      color: var(--error-text);
      outline: 2px solid color-mix(in srgb, var(--accent-green) 80%, var(--text-main) 20%);
      outline-offset: 2px;
    }
    .remove:active { background: color-mix(in srgb, var(--error-bg) 80%, transparent); }
    .stock { margin: .1rem 0 0; color: var(--text-soft); font-size: .78rem; font-weight: 500; line-height: 1.4; }
    .stock.is-out, .stock.is-conflict { color: var(--error-text); font-weight: 650; }
    .adjust {
      display: inline;
      margin-left: .4rem;
      border: 0;
      background: transparent;
      color: var(--accent-green);
      font: inherit;
      font-weight: 650;
      cursor: pointer;
    }
    .adjust:hover, .adjust:focus-visible { text-decoration: underline; }
    .is-summary { padding: .7rem 0; gap: .6rem; }
    .is-summary .thumb { width: 48px; height: 48px; }
    .is-summary .name { font-size: .9rem; font-weight: 650; }
    @media (min-width: 720px) {
      .thumb { width: 80px; height: 80px; }
      .is-summary .thumb { width: 48px; height: 48px; }
      .custom-row {
        grid-template-columns: 6.5rem minmax(0, 1fr);
        gap: .75rem;
        align-items: baseline;
      }
    }
    @media (max-width: 420px) {
      .line { gap: .6rem; padding: .9rem 0; }
      .thumb { width: 60px; height: 60px; }
      .title-row { flex-wrap: wrap; gap: .15rem .7rem; }
      .price { font-size: .92rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .qty-btn, .remove { transition: none; }
    }
  `]
})
export class CartLineComponent {
  readonly cart = inject(CartService);
  readonly item = input.required<CartItem>();
  readonly mode = input<CartLineMode>('cart');
  readonly removed = output<CartItem>();

  readonly incrementBlocked = signal(false);

  isSummary(): boolean {
    return this.mode() === 'summary';
  }

  thumb(): string | null {
    const url = String(this.item().imageUrl ?? '').trim();
    return url ? optimizedImageUrl(url, 176) : null;
  }

  lineTotal(): number {
    return this.item().unitPrice * this.item().quantity;
  }

  compactSummary(): string {
    return compactCustomizationSummary(this.item());
  }

  blocked(): boolean {
    const item = this.item();
    const lines = this.cart.items();
    return isLineOutOfStock(item, lines) || isLineOverStock(item, lines);
  }

  hint(): string {
    const item = this.item();
    const kind = this.hintKind();
    if (this.isSummary()) {
      if (kind === 'out') return 'Producto agotado';
      if (kind === 'conflict') {
        const available = this.cart.maxQuantity(item);
        return `Solo quedan ${available} ${available === 1 ? 'unidad' : 'unidades'}.`;
      }
      return '';
    }
    return this.cart.stockHint(item, this.incrementBlocked()).message;
  }

  hintKind() {
    return this.cart.stockHint(this.item(), this.incrementBlocked()).kind;
  }

  canAdjust(): boolean {
    return isLineOverStock(this.item(), this.cart.items());
  }

  increment(): void {
    const result = this.cart.increment(this.item().productId);
    this.incrementBlocked.set(!result.applied);
  }

  decrement(): void {
    this.incrementBlocked.set(false);
    this.cart.decrement(this.item().productId);
  }

  adjust(): void {
    this.incrementBlocked.set(false);
    this.cart.adjustToAvailable(this.item().productId);
  }

  remove(): void {
    const item = this.item();
    this.cart.remove(item.productId);
    this.removed.emit(item);
  }
}
