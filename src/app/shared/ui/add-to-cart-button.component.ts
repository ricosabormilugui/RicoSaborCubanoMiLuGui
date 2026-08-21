import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, signal } from '@angular/core';

export type AddToCartAction = () => boolean | void | Promise<boolean | void>;
export type AddToCartButtonVariant = 'default' | 'compact' | 'large';
type AddToCartButtonState = 'idle' | 'animating' | 'success' | 'error';

@Component({
  selector: 'app-add-to-cart-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="add-cart-button"
      type="button"
      [class.add-cart-button--compact]="variant === 'compact'"
      [class.add-cart-button--large]="variant === 'large'"
      [class.is-animating]="state() === 'animating'"
      [class.is-success]="state() === 'success'"
      [class.is-error]="state() === 'error'"
      [disabled]="disabled"
      [attr.aria-busy]="state() === 'animating'"
      [attr.aria-label]="accessibleLabel"
      (click)="activate()">
      <span class="button-content idle-content" *ngIf="state() === 'idle'">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 4h2l2.15 10.1a2 2 0 0 0 1.95 1.58h7.95A2 2 0 0 0 19 14.2L20.4 8H7.1M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
        </svg>
        <span>{{ label }}</span>
      </span>

      <span class="cart-scene" *ngIf="state() === 'animating'" aria-hidden="true">
        <span class="progress-track"></span>
        <span class="dropper"></span>
        <span class="parcel"></span>
        <span class="moving-cart">
          <svg viewBox="0 0 24 24">
            <path d="M3 4h2l2.15 10.1a2 2 0 0 0 1.95 1.58h7.95A2 2 0 0 0 19 14.2L20.4 8H7.1M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
        </span>
        <span class="cart-count">+1</span>
      </span>
      <span class="visually-hidden" *ngIf="state() === 'animating'">Añadiendo al carrito</span>

      <span class="button-content success-content" *ngIf="state() === 'success'">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" /></svg>
        <span class="success-label">Añadido</span>
      </span>

      <span class="button-content error-content" *ngIf="state() === 'error'">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /></svg>
        <span>No añadido</span>
      </span>
    </button>
  `,
  styles: [`
    :host{display:block;max-width:100%}
    :host:has(.add-cart-button--compact){width:max-content;justify-self:start}
    :host:has(.add-cart-button--large){width:100%}
    .add-cart-button{position:relative;display:grid;width:100%;min-height:44px;place-items:center;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent-red) 80%,#fff 20%);border-radius:var(--radius-pill,999px);padding:.58rem .9rem;background:var(--accent-red);color:var(--on-accent);box-shadow:0 7px 16px color-mix(in srgb,var(--accent-red) 24%,transparent);font:inherit;font-size:.88rem;font-weight:850;line-height:1.1;cursor:pointer;transition:transform .16s ease,filter .18s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease}
    .add-cart-button:hover:not(:disabled):not(.is-animating){transform:translateY(-1px);filter:brightness(1.06)}
    .add-cart-button:active:not(:disabled){transform:translateY(0) scale(.985)}
    .add-cart-button:focus-visible{outline:3px solid color-mix(in srgb,var(--accent-green) 68%,transparent);outline-offset:3px}
    .add-cart-button:disabled{opacity:.58;cursor:not-allowed;box-shadow:none}
    .add-cart-button--compact{width:auto;min-width:5.75rem;max-width:100%;min-height:34px;padding:.38rem .78rem;border-radius:var(--radius-pill,999px);font-size:.82rem;justify-self:start}
    .add-cart-button--large{min-height:48px;padding:.75rem 1.15rem;border-radius:var(--radius-pill,999px);font-size:.98rem}
    .button-content{display:flex;align-items:center;justify-content:center;gap:.44rem;min-width:0;white-space:nowrap}
    svg{display:block;width:1.15rem;height:1.15rem;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
    .idle-content{animation:contentIn .18s ease both}
    .is-animating{border-color:#284b72;background:#0b1b30;cursor:wait;filter:none;box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 18px rgba(4,14,28,.28)}
    .cart-scene{position:absolute;inset:0;overflow:hidden}
    .progress-track{position:absolute;left:7%;right:7%;bottom:7px;height:7px;overflow:hidden;border:1px solid #2e4967;border-radius:3px;background:repeating-linear-gradient(90deg,#617189 0 3px,#17283d 3px 8px);opacity:0;animation:trackIn 1.9s ease both}
    .progress-track::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0 35%,rgba(153,219,255,.42) 48%,transparent 61%);transform:translateX(-130%);animation:beltScan .78s linear .5s 2}
    .dropper{position:absolute;z-index:4;left:36%;top:-2px;width:16px;height:22px;opacity:0;transform:translate(-50%,-16px);animation:dropperCycle 1.9s cubic-bezier(.2,.72,.2,1) both}
    .dropper::before{content:"";position:absolute;left:6px;top:0;width:4px;height:14px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,#8b4933,#e09055 55%,#6e3428);box-shadow:0 0 4px rgba(255,159,91,.24)}
    .dropper::after{content:"";position:absolute;left:1px;bottom:1px;width:14px;height:8px;border:2px solid #cd704a;border-top:0;border-radius:0 0 4px 4px;transform-origin:top;animation:gripperRelease 1.9s ease both}
    .moving-cart{position:absolute;z-index:2;left:112%;bottom:8px;color:#dce7f5;transform:translateX(-50%);opacity:0;animation:cartArrive 1.9s cubic-bezier(.2,.72,.2,1) both}
    .moving-cart svg{width:1.45rem;height:1.45rem;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
    .parcel{position:absolute;z-index:3;left:36%;bottom:15px;width:13px;height:11px;border:1px solid #ffcf88;border-radius:2px;background:linear-gradient(90deg,#b66c2f 0 46%,#d9954d 46% 58%,#bd7134 58%);box-shadow:0 2px 3px rgba(0,0,0,.28);opacity:0;transform:translate(-50%,-22px);animation:parcelRide 1.9s cubic-bezier(.22,.68,.24,1) both}
    .parcel::after{content:"";position:absolute;left:3px;bottom:2px;width:6px;height:3px;border-radius:1px;background:repeating-linear-gradient(90deg,#fff 0 1px,#633716 1px 2px);opacity:.9}
    .cart-count{position:absolute;z-index:5;left:78%;top:2px;min-width:22px;padding:2px 5px;border:1px solid #ffd487;border-radius:999px;background:#eca94c;color:#38210c;font-size:.62rem;font-weight:950;line-height:1;opacity:0;transform:translateX(-50%) scale(.45);box-shadow:0 2px 6px rgba(0,0,0,.28);animation:countPop 1.9s cubic-bezier(.2,.8,.2,1) both}
    .is-success{border-color:#284b72;background:#0b1b30;box-shadow:inset 0 1px rgba(255,255,255,.06),0 8px 18px rgba(4,14,28,.28)}
    .success-content{color:#eef5ff;animation:successPop .34s cubic-bezier(.2,.8,.2,1) both}
    .success-content svg{width:1.12rem;height:1.12rem;padding:2px;border:1px solid #39bda7;border-radius:50%;color:#58d4bc;stroke-width:2.7}
    .is-error{border-color:color-mix(in srgb,var(--danger-bg) 82%,#fff 18%);background:var(--danger-bg)}
    .visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    @keyframes trackIn{0%,5%{opacity:0;transform:scaleX(.65)}12%,94%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(.92)}}
    @keyframes beltScan{to{transform:translateX(170%)}}
    @keyframes dropperCycle{0%,3%{opacity:0;transform:translate(-50%,-16px)}8%,24%{opacity:1;transform:translate(-50%,0)}34%{opacity:1;transform:translate(-50%,-16px)}40%,100%{opacity:0;transform:translate(-50%,-20px)}}
    @keyframes gripperRelease{0%,19%{transform:scaleX(.7)}25%,100%{transform:scaleX(1.08)}}
    @keyframes cartArrive{0%,48%{left:112%;opacity:0}56%{opacity:1}72%{left:82%;opacity:1}80%{left:78%;opacity:1;transform:translateX(-50%) rotate(-3deg)}86%,96%{left:78%;opacity:1;transform:translateX(-50%) rotate(0)}100%{left:82%;opacity:0;transform:translateX(-50%)}}
    @keyframes parcelRide{0%,7%{left:36%;opacity:0;transform:translate(-50%,-22px)}10%,24%{left:36%;opacity:1;transform:translate(-50%,-22px)}34%{left:36%;opacity:1;transform:translate(-50%,0)}45%{left:36%;transform:translate(-50%,0)}72%{left:68%;opacity:1;transform:translate(-50%,0)}82%{left:78%;opacity:1;transform:translate(-50%,2px) scale(.82)}87%,100%{left:79%;opacity:0;transform:translate(-50%,7px) scale(.35)}}
    @keyframes countPop{0%,81%{opacity:0;transform:translateX(-50%) scale(.45)}87%,95%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-4px) scale(.86)}}
    @keyframes successPop{0%{opacity:0;transform:scale(.82)}70%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}
    @keyframes contentIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-reduced-motion:reduce){.add-cart-button{transition:none}.idle-content,.progress-track,.progress-track::after,.dropper,.dropper::after,.moving-cart,.parcel,.cart-count,.success-content{animation:none}.progress-track,.dropper,.moving-cart,.parcel,.cart-count{display:none}}
  `]
})
export class AddToCartButtonComponent implements OnDestroy {
  @Input({ required: true }) action: AddToCartAction = () => undefined;
  @Input() label = 'Añadir';
  @Input() variant: AddToCartButtonVariant = 'default';
  @Input() disabled = false;
  @Input() ariaLabel = '';

  readonly state = signal<AddToCartButtonState>('idle');

  private readonly timers = new Set<ReturnType<typeof globalThis.setTimeout>>();
  private destroyed = false;

  get accessibleLabel(): string {
    if (this.state() === 'animating') return 'Añadiendo al carrito';
    if (this.state() === 'success') return 'Producto añadido al carrito';
    if (this.state() === 'error') return 'No se pudo añadir el producto al carrito';
    return this.ariaLabel || this.label;
  }

  async activate(): Promise<void> {
    if (this.disabled || this.state() !== 'idle') return;

    this.state.set('animating');
    const animationDone = this.wait(this.prefersReducedMotion() ? 0 : 1900);
    const action = this.action;

    try {
      const completed = await action();
      if (completed === false) {
        this.state.set('idle');
        return;
      }

      await animationDone;
      if (this.destroyed) return;
      this.state.set('success');
      await this.wait(1200);
      if (!this.destroyed && this.state() === 'success') this.state.set('idle');
    } catch {
      if (this.destroyed) return;
      this.state.set('error');
      await this.wait(1200);
      if (!this.destroyed && this.state() === 'error') this.state.set('idle');
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.timers.forEach((timer) => globalThis.clearTimeout(timer));
    this.timers.clear();
  }

  private prefersReducedMotion(): boolean {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = globalThis.setTimeout(() => {
        this.timers.delete(timer);
        resolve();
      }, duration);
      this.timers.add(timer);
    });
  }
}
