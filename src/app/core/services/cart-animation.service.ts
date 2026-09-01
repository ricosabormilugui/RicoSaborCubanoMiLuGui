import { Injectable, isDevMode } from '@angular/core';

export interface CartFlyAnimationInput {
  sourceElement?: Element | EventTarget | null;
  imageUrl?: string | null;
}

export const FLY_DURATION_MS = 740;
export const FLY_Z_INDEX = 9999;
export const PULSE_DURATION_MS = 240;
const FLY_SIZE_DESKTOP = 76;
const FLY_SIZE_MOBILE = 68;
const FLY_EASING = 'cubic-bezier(0.22, 0.68, 0.2, 1)';
const CLEANUP_SAFETY_MS = FLY_DURATION_MS + 500;

function asAnimatableElement(value: CartFlyAnimationInput['sourceElement']): Element | null {
  if (!value || typeof value !== 'object') return null;
  const node = value as Element;
  return typeof node.getBoundingClientRect === 'function' ? node : null;
}

function asImageElement(value: unknown): HTMLImageElement | null {
  if (!value || typeof value !== 'object') return null;
  const node = value as HTMLImageElement;
  if (String(node.tagName || '').toLowerCase() === 'img') return node;
  if (typeof (node as Element).querySelector === 'function') {
    return (node as Element).querySelector('img');
  }
  return null;
}

export function resolveFlyImageUrl(source: Element | null, fallback?: string | null): string {
  const image = asImageElement(source);
  return String(image?.currentSrc || image?.src || fallback || '').trim();
}

export function flyCloneSize(): number {
  const width = Number(globalThis.innerWidth) || 1024;
  return width < 768 ? FLY_SIZE_MOBILE : FLY_SIZE_DESKTOP;
}

export function isVisibleCartTarget(element: HTMLElement | null | undefined): boolean {
  if (!element || typeof element.getBoundingClientRect !== 'function') return false;
  const rect = element.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return false;
  if (typeof element.getClientRects === 'function' && element.getClientRects().length === 0) return false;
  const style = globalThis.getComputedStyle?.(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return true;
}

@Injectable({ providedIn: 'root' })
export class CartAnimationService {
  private readonly targets = new Set<HTMLElement>();

  registerTarget(element: HTMLElement): void {
    this.targets.add(element);
  }

  unregisterTarget(element: HTMLElement): void {
    this.targets.delete(element);
  }

  visibleTarget(): HTMLElement | null {
    for (const element of this.targets) {
      if (isVisibleCartTarget(element)) return element;
    }
    return null;
  }

  animateAddToCart(input: CartFlyAnimationInput): void {
    let clone: HTMLImageElement | null = null;
    try {
      const reducedMotion = this.prefersReducedMotion();
      const source = asAnimatableElement(input.sourceElement);
      const target = this.visibleTarget();
      const imageUrl = resolveFlyImageUrl(source, input.imageUrl);
      this.devLog('add-valid', {
        reducedMotion,
        hasSource: Boolean(source),
        hasTarget: Boolean(target),
        imageUrl
      });
      if (reducedMotion) return;
      if (!source || !target || !imageUrl) return;

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (!sourceRect.width && !sourceRect.height) {
        this.devLog('source-rect-empty', sourceRect);
        return;
      }

      const size = flyCloneSize();
      const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
      const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
      const endX = targetRect.left + targetRect.width / 2 - size / 2;
      const endY = targetRect.top + targetRect.height / 2 - size / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      this.devLog('rects', { sourceRect, targetRect, startX, startY, endX, endY, size });

      const doc = globalThis.document;
      if (!doc?.body) return;

      clone = doc.createElement('img');
      clone.src = imageUrl;
      clone.alt = '';
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('data-cart-fly-clone', '');
      clone.removeAttribute('srcset');
      clone.removeAttribute('sizes');
      clone.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'display:block',
        'visibility:visible',
        'opacity:1',
        `width:${size}px`,
        `height:${size}px`,
        'max-width:none',
        'max-height:none',
        'margin:0',
        'padding:0',
        'object-fit:contain',
        'object-position:center',
        'pointer-events:none',
        `z-index:${FLY_Z_INDEX}`,
        'border:0',
        'border-radius:12px',
        'background:var(--surface-0)',
        'box-shadow:0 10px 22px color-mix(in srgb, var(--shadow-soft) 55%, transparent)',
        'transform-origin:center center',
        `transform:translate(${startX}px, ${startY}px) scale(1)`,
        'will-change:transform,opacity'
      ].join(';');
      doc.body.appendChild(clone);
      this.devLog('clone-created', { inBody: clone.parentNode === doc.body, src: clone.src });

      const cleanup = (): void => {
        clone?.remove();
        clone = null;
      };

      if (typeof clone.animate !== 'function') {
        this.pulseTarget(target);
        cleanup();
        return;
      }

      const animation = clone.animate(
        [
          { offset: 0, transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1 },
          { offset: 0.35, transform: `translate(${startX + dx * 0.35}px, ${startY + dy * 0.20 - 40}px) scale(0.95)`, opacity: 1 },
          { offset: 0.70, transform: `translate(${startX + dx * 0.70}px, ${startY + dy * 0.62 - 24}px) scale(0.68)`, opacity: 1 },
          { offset: 0.75, transform: `translate(${startX + dx * 0.75}px, ${startY + dy * 0.70 - 20}px) scale(0.65)`, opacity: 1 },
          { offset: 0.90, transform: `translate(${startX + dx * 0.92}px, ${startY + dy * 0.88 - 8}px) scale(0.38)`, opacity: 0.85 },
          { offset: 1, transform: `translate(${endX}px, ${endY}px) scale(0.28)`, opacity: 0 }
        ],
        { duration: FLY_DURATION_MS, easing: FLY_EASING, fill: 'forwards' }
      );
      this.devLog('animation-started', { duration: FLY_DURATION_MS });

      let cleaned = false;
      const finish = (pulse: boolean): void => {
        if (cleaned) return;
        cleaned = true;
        if (pulse) this.pulseTarget(target);
        cleanup();
        this.devLog('animation-finished');
      };

      const finished = animation.finished;
      if (finished && typeof finished.then === 'function') {
        finished.then(() => finish(true)).catch(() => finish(false));
      } else {
        globalThis.setTimeout(() => finish(true), FLY_DURATION_MS);
      }
      globalThis.setTimeout(() => finish(false), CLEANUP_SAFETY_MS);
    } catch {
      clone?.remove();
      this.devLog('animation-error');
    }
  }

  private pulseTarget(target: HTMLElement | null): void {
    try {
      if (!target || this.prefersReducedMotion()) return;
      if (typeof target.animate !== 'function') return;
      target.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.16)' },
          { transform: 'scale(1)' }
        ],
        { duration: PULSE_DURATION_MS, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' }
      );
    } catch {
      return;
    }
  }

  private prefersReducedMotion(): boolean {
    return typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private devLog(event: string, payload?: unknown): void {
    try {
      if (!isDevMode()) return;
      console.info('[cart-fly]', event, payload ?? '');
    } catch {
      return;
    }
  }
}
