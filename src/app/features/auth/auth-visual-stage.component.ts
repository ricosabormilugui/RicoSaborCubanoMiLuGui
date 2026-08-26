import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { AUTH_FLOATING_PRODUCTS, AuthVisualState, AuthVisualSuccessKind } from './auth-visual.model';

type ParticleVortex = {
  setState(state: AuthVisualState): void;
  setLogo(src: string): void;
  setDark(dark: boolean): void;
  dispose(): void;
};

@Component({
  selector: 'app-auth-visual-stage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-visual-stage.component.html',
  styleUrls: ['./auth-visual-stage.component.css']
})
export class AuthVisualStageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('gl');
  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');
  private vortex: ParticleVortex | null = null;
  private bootId = 0;

  readonly state = input<AuthVisualState>('idle');
  readonly successKind = input<AuthVisualSuccessKind>('welcome');
  readonly logoSrc = input.required<string>();
  readonly brandName = input('MIXSABOR');
  readonly products = AUTH_FLOATING_PRODUCTS;
  readonly failed = signal(false);
  readonly ready = signal(false);

  constructor() {
    afterNextRender(() => void this.boot());
    this.destroyRef.onDestroy(() => this.teardown());

    effect(() => {
      const state = this.state();
      const src = this.logoSrc();
      const vortex = this.vortex;
      if (!vortex) return;
      vortex.setState(state);
      vortex.setLogo(src);
      vortex.setDark(src.includes('_dark'));
    });
  }

  private async boot(): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    const host = this.stageRef()?.nativeElement;
    if (!canvas || !host) return;
    const id = ++this.bootId;
    try {
      const { AuthParticleVortexRenderer } = await import('./auth-particle-vortex.renderer');
      if (id !== this.bootId) return;
      const vortex = new AuthParticleVortexRenderer();
      await vortex.mount(canvas, {
        logoSrc: this.logoSrc(),
        reducedMotion: Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
        host,
        dark: this.logoSrc().includes('_dark')
      });
      if (id !== this.bootId) {
        vortex.dispose();
        return;
      }
      this.vortex = vortex;
      vortex.setState(this.state());
      this.ready.set(true);
    } catch {
      if (id === this.bootId) this.failed.set(true);
    }
  }

  private teardown(): void {
    this.bootId += 1;
    this.vortex?.dispose();
    this.vortex = null;
  }
}
