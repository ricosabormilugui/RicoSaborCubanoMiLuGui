import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AllergenId } from '../../core/config/allergens.config';

@Component({
  selector: 'app-allergen-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      @switch (name()) {
        @case ('gluten') {
          <path d="M12 21V8" />
          <path d="M12 8c-2-2.2-4.4-3.4-6.2-3.6 1.4 2.4 3.4 4.2 6.2 5.2" />
          <path d="M12 8c2-2.2 4.4-3.4 6.2-3.6-1.4 2.4-3.4 4.2-6.2 5.2" />
          <path d="M12 11.6c-2-1.6-4.6-2.5-6.4-2.4 1.4 2 3.5 3.5 6.4 4.3" />
          <path d="M12 11.6c2-1.6 4.6-2.5 6.4-2.4-1.4 2-3.5 3.5-6.4 4.3" />
          <path d="M12 15.4c-1.7-1.2-4-1.9-5.7-1.7 1.2 1.6 3.1 2.8 5.7 3.4" />
          <path d="M12 15.4c1.7-1.2 4-1.9 5.7-1.7-1.2 1.6-3.1 2.8-5.7 3.4" />
          <path d="M12 5.2c.2-1.6 1.1-2.8 2.2-3.4-2 .3-3.3 1.8-3 3.6" />
        }
        @case ('crustaceans') {
          <path d="M16.2 6.2c2.4.2 3.8 2 3.8 4.3 0 5.2-4.6 9.7-11.2 9.7-2.5 0-4.2-.9-5.2-2.2" />
          <path d="M8.2 16.8c1.4-1.1 2.2-2.6 2.2-4.4 0-2.6-1.7-4.4-4-4.8" />
          <path d="M10.6 7.8c.6-2 2.2-3.4 4.4-3.6" />
          <path d="M18.4 5.2 20 3.6" />
          <path d="M16.6 4.6 17.4 2.8" />
          <circle cx="17.4" cy="8.4" r=".7" fill="currentColor" stroke="none" />
        }
        @case ('eggs') {
          <path d="M12 21c4.1 0 7-3.3 7-7.4C19 8.4 15.6 3 12 3S5 8.4 5 13.6C5 17.7 7.9 21 12 21z" />
        }
        @case ('fish') {
          <path d="M3 12s2.6-6 9.2-6c5.2 0 7.6 3 8.8 6-1.2 3-3.6 6-8.8 6C5.6 18 3 12 3 12z" />
          <path d="M3 12l4.2-2.4v4.8z" />
          <circle cx="16.4" cy="10.2" r=".75" fill="currentColor" stroke="none" />
          <path d="M14.6 10.6v2.8" />
        }
        @case ('peanuts') {
          <path d="M9.8 8.2c0-2.3 1.7-4.2 3.8-4.2 2.1 0 3.6 1.6 3.6 3.6 0 1.2-.6 2.2-1.6 2.8 1.3.7 2.1 2 2.1 3.6 0 2.3-1.8 4.2-4 4.2s-4-1.9-4-4.2c0-1.5.8-2.8 2-3.5-.9-.7-1.9-1.8-1.9-3.3z" />
          <path d="M12.4 12.4c.7.4 1.6.4 2.3 0" />
        }
        @case ('milk') {
          <path d="M8 9 10.2 5h3.6L16 9v11.2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" />
          <path d="M8 9h8" />
          <path d="M10.2 5 12 3.2 13.8 5" />
          <path d="M11 14h2" />
        }
        @case ('celery') {
          <path d="M12 21V8.5" />
          <path d="M12 8.5C10 5.4 8 3.6 6.4 2.8" />
          <path d="M12 8.5c2-3.1 4-4.9 5.6-5.7" />
          <path d="M12 12c-1.8-2.4-3.6-3.8-5.2-4.4" />
          <path d="M12 12c1.8-2.4 3.6-3.8 5.2-4.4" />
          <path d="M9.2 21h5.6" />
        }
        @case ('mustard') {
          <path d="M10 8.2V5.4A2 2 0 0 1 12 3.4h0a2 2 0 0 1 2 2v2.8" />
          <path d="M9.2 8.2h5.6l.8 12a1.5 1.5 0 0 1-1.5 1.6h-4.2a1.5 1.5 0 0 1-1.5-1.6z" />
          <path d="M10.4 3h3.2" />
        }
        @case ('sulphites') {
          <text
            x="12"
            y="14.5"
            text-anchor="middle"
            fill="currentColor"
            stroke="none"
            font-size="7.2"
            font-weight="700"
            font-family="inherit">SO₂</text>
        }
        @case ('sesame') {
          <ellipse cx="8.2" cy="9.2" rx="1.55" ry="2.35" transform="rotate(-28 8.2 9.2)" />
          <ellipse cx="13.2" cy="7.4" rx="1.45" ry="2.25" transform="rotate(18 13.2 7.4)" />
          <ellipse cx="16.6" cy="12" rx="1.45" ry="2.2" transform="rotate(-8 16.6 12)" />
          <ellipse cx="10" cy="14.6" rx="1.55" ry="2.3" transform="rotate(22 10 14.6)" />
          <ellipse cx="14.8" cy="16.6" rx="1.4" ry="2.1" transform="rotate(-26 14.8 16.6)" />
        }
        @case ('molluscs') {
          <path d="M12 20.5c5.2 0 8-4.1 8-8.6C20 6.4 16.2 3.6 12 3.6S4 6.4 4 11.9c0 4.5 2.8 8.6 8 8.6z" />
          <path d="M12 20.5c-1.6-3.2-2.1-6.8-2.1-10.4" />
          <path d="M12 20.5c1.6-3.2 2.1-6.8 2.1-10.4" />
          <path d="M12 20.5c-3.2-2.6-5.7-5.7-6.6-9.2" />
          <path d="M12 20.5c3.2-2.6 5.7-5.7 6.6-9.2" />
        }
        @case ('soy') {
          <path d="M4.8 14.2c1.8-5.2 6-9.2 11.4-10.2 1.4 4.6.6 9.6-3.4 13.2-4.4 1.1-8-.6-8-3z" />
          <circle cx="9.2" cy="12.6" r="1.25" />
          <circle cx="12.1" cy="10.8" r="1.25" />
          <circle cx="15" cy="8.8" r="1.25" />
        }
        @case ('nuts') {
          <path d="M12 3.6c-3.2 0-6.2 2.9-6.2 7.4 0 4.6 2.5 9.2 6.2 9.2s6.2-4.6 6.2-9.2c0-4.5-3-7.4-6.2-7.4z" />
          <path d="M12 4v16.2" />
          <path d="M12 10.2c-2.2.5-3.8 1.7-4.4 3.3" />
          <path d="M12 10.2c2.2.5 3.8 1.7 4.4 3.3" />
        }
        @case ('lupin') {
          <ellipse cx="12" cy="18.4" rx="2.1" ry="1.55" />
          <ellipse cx="9.4" cy="15" rx="1.9" ry="1.4" />
          <ellipse cx="14.6" cy="15" rx="1.9" ry="1.4" />
          <ellipse cx="8.4" cy="11.4" rx="1.7" ry="1.3" />
          <ellipse cx="15.6" cy="11.4" rx="1.7" ry="1.3" />
          <ellipse cx="12" cy="11.8" rx="1.8" ry="1.4" />
          <ellipse cx="10.2" cy="8.2" rx="1.55" ry="1.2" />
          <ellipse cx="13.8" cy="8.2" rx="1.55" ry="1.2" />
          <ellipse cx="12" cy="5.2" rx="1.4" ry="1.15" />
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      line-height: 0;
      color: inherit;
      pointer-events: none;
    }

    :host svg {
      display: block;
    }
  `]
})
export class AllergenIconComponent {
  readonly name = input.required<AllergenId>();
  readonly size = input<number | string>(22);
}
