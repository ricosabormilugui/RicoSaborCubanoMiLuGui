import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'app-auth-password-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      position: absolute;
      top: 50%;
      right: 0.28rem;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      transform: translateY(-50%);
    }
    button {
      position: relative;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      padding: 0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--text-soft);
      cursor: pointer;
      transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
    }
    button:hover,
    button:focus-visible {
      color: var(--text-main);
      background: var(--hover-surface);
    }
    button:active { transform: scale(0.96); }
    button:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--accent-green) 60%, transparent);
      outline-offset: 1px;
    }
    :host-context(.auth-field:focus-within) button { color: var(--accent-green); }
    .icon {
      grid-area: 1 / 1;
      display: grid;
      opacity: 0;
      transition: opacity 160ms ease;
    }
    .icon.is-on { opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      button, .icon { transition: none; }
      button:active { transform: none; }
    }
  `],
  template: `
    <button
      type="button"
      (click)="visible.set(!visible())"
      [attr.aria-pressed]="visible()"
      [attr.aria-label]="visible() ? hideLabel() : showLabel()"
      [attr.title]="visible() ? hideLabel() : showLabel()">
      <span class="icon" [class.is-on]="!visible()" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span class="icon" [class.is-on]="visible()" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.546 1 1 0 0 1 0 .752 10.722 10.722 0 0 1-1.444 2.49" />
          <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.752 10.75 10.75 0 0 1 4.446-5.143" />
          <path d="m2 2 20 20" />
        </svg>
      </span>
    </button>
  `
})
export class AuthPasswordToggleComponent {
  readonly visible = model(false);
  readonly showLabel = input('Mostrar contraseña');
  readonly hideLabel = input('Ocultar contraseña');
}
