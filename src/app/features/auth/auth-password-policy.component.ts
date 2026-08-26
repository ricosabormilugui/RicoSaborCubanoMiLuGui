import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getPasswordPolicyChecks } from '../../core/config/password-policy.config';

@Component({
  selector: 'app-auth-password-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="auth-policy">
      @for (check of checks(); track check.id) {
        <li [class.is-met]="check.met">
          <span class="auth-policy-mark" aria-hidden="true">{{ check.met ? '✓' : '·' }}</span>
          {{ check.label }}
        </li>
      }
    </ul>
  `,
  styles: [`
    :host { display: block; }
    .auth-policy {
      display: grid;
      gap: 0.18rem;
      margin: 0.15rem 0 0;
      padding: 0;
      list-style: none;
      color: var(--text-soft);
      font-size: 0.76rem;
      line-height: 1.35;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.38rem;
      transition: color 180ms ease;
    }
    li.is-met { color: var(--ok-text); }
    .auth-policy-mark {
      display: grid;
      place-items: center;
      width: 0.9rem;
      font-weight: 800;
    }
    @media (prefers-reduced-motion: reduce) {
      li { transition: none; }
    }
  `]
})
export class AuthPasswordPolicyComponent {
  readonly password = input('');
  readonly checks = computed(() => getPasswordPolicyChecks(this.password()));
}
