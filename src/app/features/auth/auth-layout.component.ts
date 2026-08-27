import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { BRAND_CONFIG, getBrandLogo } from '../../core/config/brand.config';
import { ThemeService } from '../../core/services/theme.service';
import { AuthVisualStageComponent } from './auth-visual-stage.component';
import { AUTH_VISUAL_SUCCESS_MS, AUTH_VISUAL_SUCCESS_REDUCED_MS, AuthVisualState, AuthVisualSuccessKind } from './auth-visual.model';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, AuthVisualStageComponent],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthLayoutComponent {
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly desktopVisual = signal(false);
  private readonly parallaxEnabled = signal(false);
  private readonly reducedMotion = signal(false);
  private readonly celebrating = signal(false);
  private readonly successKindState = signal<AuthVisualSuccessKind>('welcome');
  private visualFrame = 0;
  private pendingShift: { el: HTMLElement; x: number; y: number } | null = null;
  private successTimer = 0;
  private successResolve: (() => void) | null = null;
  private alive = true;

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly brand = BRAND_CONFIG;
  readonly brandLogo = computed(() => getBrandLogo(this.theme.mode()));
  readonly engaged = signal(false);
  readonly showVisual = computed(() => this.desktopVisual());
  readonly successKind = this.successKindState.asReadonly();
  readonly stageState = computed<AuthVisualState>(() => {
    if (this.celebrating()) return 'success';
    if (this.engaged()) return 'interacting';
    return 'idle';
  });

  constructor() {
    const desktop = globalThis.matchMedia?.('(min-width: 1024px)');
    const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const finePointer = globalThis.matchMedia?.('(hover: hover) and (pointer: fine)');

    const sync = () => {
      const isDesktop = Boolean(desktop?.matches);
      this.desktopVisual.set(isDesktop);
      this.reducedMotion.set(Boolean(motion?.matches));
      this.parallaxEnabled.set(isDesktop && Boolean(finePointer?.matches) && !motion?.matches);
    };

    sync();
    desktop?.addEventListener('change', sync);
    motion?.addEventListener('change', sync);
    finePointer?.addEventListener('change', sync);
    this.destroyRef.onDestroy(() => {
      this.alive = false;
      desktop?.removeEventListener('change', sync);
      motion?.removeEventListener('change', sync);
      finePointer?.removeEventListener('change', sync);
      if (this.visualFrame) cancelAnimationFrame(this.visualFrame);
      if (this.successTimer) {
        clearTimeout(this.successTimer);
        this.successTimer = 0;
      }
      this.successResolve?.();
      this.successResolve = null;
    });
  }

  onFormFocusIn(): void {
    this.engaged.set(true);
  }

  onFormFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.engaged.set(false);
  }

  onVisualMove(event: PointerEvent): void {
    if (!this.parallaxEnabled()) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-4, Math.min(4, ((event.clientX - rect.left) / rect.width - 0.5) * 8));
    const y = Math.max(-4, Math.min(4, ((event.clientY - rect.top) / rect.height - 0.5) * 8));
    this.pendingShift = { el: target, x, y };
    if (this.visualFrame) return;
    this.visualFrame = requestAnimationFrame(() => {
      this.visualFrame = 0;
      const shift = this.pendingShift;
      if (!shift) return;
      shift.el.style.setProperty('--visual-x', `${shift.x.toFixed(2)}px`);
      shift.el.style.setProperty('--visual-y', `${shift.y.toFixed(2)}px`);
    });
  }

  onVisualLeave(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    this.pendingShift = null;
    target.style.setProperty('--visual-x', '0px');
    target.style.setProperty('--visual-y', '0px');
  }

  async playSuccess(kind: AuthVisualSuccessKind): Promise<boolean> {
    if (!this.alive) return false;
    this.successKindState.set(kind);
    if (!this.showVisual()) return true;
    if (this.celebrating()) return this.alive;
    this.celebrating.set(true);
    const ms = this.reducedMotion() ? AUTH_VISUAL_SUCCESS_REDUCED_MS : AUTH_VISUAL_SUCCESS_MS;
    await this.waitForSuccess(ms);
    return this.alive;
  }

  private waitForSuccess(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.successResolve = resolve;
      this.successTimer = globalThis.setTimeout(() => {
        this.successTimer = 0;
        this.successResolve = null;
        resolve();
      }, ms);
    });
  }
}
