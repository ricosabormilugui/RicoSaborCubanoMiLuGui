import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AllergenId, getAllergenColor } from '../../core/config/allergens.config';

@Component({
  selector: 'app-allergen-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="disc" [style.width.px]="size()" [style.height.px]="size()" [style.background]="discColor()">
      <svg
        [attr.width]="glyphSize()"
        [attr.height]="glyphSize()"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        @switch (name()) {
          @case ('gluten') {
            <path d="M12 21.2 8.1 6.8" />
            <path d="M8.1 8c-1.6-1.5-2.8-2-3.7-1.7.8 1.4 2 2.6 3.8 3.4" />
            <path d="M8.5 10.6c-1.5-1.3-2.6-1.8-3.4-1.5.7 1.3 1.9 2.4 3.5 3.1" />
            <path d="M9 13.2c-1.3-1.1-2.3-1.5-3.1-1.3.6 1.1 1.7 2.1 3.1 2.7" />
            <path d="M8.1 8c1.5-1.4 2.5-1.8 3.3-1.4-.6 1.3-1.6 2.5-3.3 3.4" />
            <path d="M12 21.2V5.4" />
            <path d="M12 7c-1.6-1.6-2.8-2.2-3.7-2 .8 1.5 2.1 2.8 3.7 3.6" />
            <path d="M12 9.8c-1.5-1.4-2.7-1.9-3.5-1.6.8 1.3 2 2.5 3.5 3.2" />
            <path d="M12 12.6c-1.4-1.2-2.4-1.6-3.2-1.4.7 1.2 1.8 2.2 3.2 2.9" />
            <path d="M12 7c1.6-1.6 2.8-2.2 3.7-2-.8 1.5-2.1 2.8-3.7 3.6" />
            <path d="M12 9.8c1.5-1.4 2.7-1.9 3.5-1.6-.8 1.3-2 2.5-3.5 3.2" />
            <path d="M12 21.2 15.9 6.8" />
            <path d="M15.9 8c1.6-1.5 2.8-2 3.7-1.7-.8 1.4-2 2.6-3.8 3.4" />
            <path d="M15.5 10.6c1.5-1.3 2.6-1.8 3.4-1.5-.7 1.3-1.9 2.4-3.5 3.1" />
            <path d="M15 13.2c1.3-1.1 2.3-1.5 3.1-1.3-.6 1.1-1.7 2.1-3.1 2.7" />
            <path d="M15.9 8c-1.5-1.4-2.5-1.8-3.3-1.4.6 1.3 1.6 2.5 3.3 3.4" />
          }
          @case ('crustaceans') {
            <ellipse cx="12" cy="13.4" rx="3.8" ry="3.2" />
            <path d="M8.4 11.4C5.2 8.6 3.2 8.4 2.6 10c1.7.2 3.2 1.2 4.2 2.6" />
            <path d="M6.4 10.2 4.6 8.2" />
            <path d="M7.2 9.2 6.2 7.2" />
            <path d="M15.6 11.4c3.2-2.8 5.2-3 5.8-1.4-1.7.2-3.2 1.2-4.2 2.6" />
            <path d="M17.6 10.2 19.4 8.2" />
            <path d="M16.8 9.2 17.8 7.2" />
            <path d="M8.6 14.4 5.2 15.6" />
            <path d="M8.4 15.8 5.4 18" />
            <path d="M9.2 16.8 7 19.6" />
            <path d="M15.4 14.4 18.8 15.6" />
            <path d="M15.6 15.8 18.6 18" />
            <path d="M14.8 16.8 17 19.6" />
            <circle cx="10.6" cy="12.2" r=".55" fill="currentColor" stroke="none" />
            <circle cx="13.4" cy="12.2" r=".55" fill="currentColor" stroke="none" />
          }
          @case ('eggs') {
            <path d="M8.2 8.2c.6-2.6 2.2-4.4 3.8-4.4s3.2 1.8 3.8 4.4" />
            <path d="M8.2 8.2 9.6 6.4 11 8.1 12 5.8 13.1 8.1 14.4 6.4 15.8 8.2" />
            <path d="M6.6 12.2c-.6-1.4 1.2-2.8 3.1-2.6 1.2-1.2 3.6-1.3 5.2-.2 1.8.4 3.1 2 2.7 3.8-.4 2.2-1.8 4.4-4.4 4.8-2.4.4-4.8-.8-5.8-2.6-.8-1.2-.9-2.2-.8-3.2z" />
            <circle cx="12.1" cy="14.1" r="2.15" />
          }
          @case ('fish') {
            <path d="M4.2 12c2.2-4.4 7-6.2 11.6-4.6 2.2.8 4 2.2 5.2 4.6-1.2 2.4-3 3.8-5.2 4.6C11.2 18.2 6.4 16.4 4.2 12z" />
            <path d="M4.2 12 1.6 8.8v6.4z" />
            <path d="M13.4 11.2v2.8" />
            <circle cx="16.6" cy="10.6" r=".7" fill="currentColor" stroke="none" />
          }
          @case ('peanuts') {
            <path d="M7.6 8.6c0-2.1 1.5-3.8 3.4-3.8 1.8 0 3.2 1.4 3.2 3.2 0 1.1-.5 2-1.4 2.5 1.1.6 1.8 1.8 1.8 3.2 0 2.1-1.6 3.8-3.6 3.8s-3.6-1.7-3.6-3.8c0-1.3.7-2.5 1.8-3.1-.8-.6-1.6-1.5-1.6-2z" />
            <path d="M10.4 12.6c.5.3 1.3.3 1.8 0" />
            <path d="M11.8 6.8c0-1.8 1.3-3.2 3-3.2 1.6 0 2.8 1.2 2.8 2.8 0 1-.5 1.8-1.2 2.2 1 .6 1.6 1.6 1.6 2.8 0 1.8-1.4 3.3-3.2 3.3s-3.2-1.5-3.2-3.3c0-1.2.6-2.2 1.6-2.8-.7-.5-1.4-1.3-1.4-1.8z" />
            <path d="M14.2 10.4c.5.3 1.1.3 1.6 0" />
          }
          @case ('nuts') {
            <path d="M12 3.4c-3.4 0-6.4 3.1-6.4 7.6 0 4.8 2.6 9.6 6.4 9.6s6.4-4.8 6.4-9.6c0-4.5-3-7.6-6.4-7.6z" />
            <path d="M12 3.8v16.6" />
            <path d="M12 8.4c-2.4.6-3.8 2.2-4.4 4.2" />
            <path d="M12 8.4c2.4.6 3.8 2.2 4.4 4.2" />
            <path d="M8.4 15.6c1.2 2 2.4 3.2 3.6 3.8" />
            <path d="M15.6 15.6c-1.2 2-2.4 3.2-3.6 3.8" />
            <path d="M9.2 11.6c.8 1.4 1.6 2 2.8 2.4" />
            <path d="M14.8 11.6c-.8 1.4-1.6 2-2.8 2.4" />
          }
          @case ('soy') {
            <path d="M5 15.2c1.4-5.4 6.2-9.6 12.2-10.4 1.2 4.6.2 9.8-3.8 13.4-4.2 1.2-8.2-.4-8.4-3z" />
            <circle cx="9.2" cy="13.4" r="1.45" />
            <circle cx="12.4" cy="10.8" r="1.45" />
            <circle cx="15.4" cy="8.2" r="1.45" />
          }
          @case ('milk') {
            <path d="M4.8 10.2 6.8 6.6h4.2l2 3.6V20.2H4.8z" />
            <path d="M4.8 10.2h8.2" />
            <path d="M6.8 6.6 8.9 4.6 11 6.6" />
            <path d="M14.4 12.2 21 19.4H14.4z" />
            <circle cx="16.4" cy="16.6" r=".45" fill="currentColor" stroke="none" />
            <circle cx="17.8" cy="17.6" r=".4" fill="currentColor" stroke="none" />
            <path d="M15.2 6.4h4.2l-.7 5.2h-2.8z" />
            <path d="M15.6 9h3.4" />
          }
          @case ('molluscs') {
            <path d="M4.8 13.6c.8-5.2 4.6-8.4 8.8-8.2 3.4.2 5.8 2.8 6.2 6.4-2.6-1.4-5.8-1.8-9.4-1.2-2.2.4-4.2 1.4-5.6 3z" />
            <path d="M4.8 13.6c.6 4.6 4.2 7.6 8.4 7.6 3.6 0 6.4-2.6 6.6-6.2-2.8 1.2-6 1.6-9.6 1-2 .4-3.8-.2-5.4-2.4z" />
            <path d="M4.8 13.6c2.6-.4 5.4-.4 8.2.2" />
          }
          @case ('celery') {
            <path d="M9.2 21V10.4" />
            <path d="M12 21V8.6" />
            <path d="M14.8 21V10.4" />
            <path d="M8.2 21h7.6" />
            <path d="M9.2 10.4C7 7.2 5.6 4.6 6.2 3.2" />
            <path d="M12 8.6c-1.6-2.8-2.8-4.8-2.2-6" />
            <path d="M12 8.6c1.6-2.8 2.8-4.8 2.2-6" />
            <path d="M14.8 10.4c2.2-3.2 3.6-5.8 3-7.2" />
            <path d="M9.2 12.6C7.4 10.4 6.4 8.8 6.8 7.8" />
            <path d="M14.8 12.6c1.8-2.2 2.8-3.8 2.4-4.8" />
          }
          @case ('mustard') {
            <path d="M11 3.2h2v2.4h-2z" />
            <path d="M10.2 5.6h3.6v2.4H10.2z" />
            <path d="M8.2 8h7.6l.8 12.2c.1 1.1-.8 1.8-1.8 1.8H9.2c-1 0-1.9-.7-1.8-1.8z" />
            <rect x="10.1" y="12.2" width="3.8" height="5.2" rx=".5" />
            <path d="M10.8 13.8h2.4" />
            <path d="M10.8 15.2h2.4" />
            <path d="M10.8 16.6h2.4" />
          }
          @case ('sesame') {
            <ellipse cx="8.4" cy="8.8" rx="1.45" ry="2.25" transform="rotate(-32 8.4 8.8)" />
            <ellipse cx="12.6" cy="6.8" rx="1.4" ry="2.15" transform="rotate(12 12.6 6.8)" />
            <ellipse cx="16.6" cy="9.4" rx="1.4" ry="2.15" transform="rotate(-8 16.6 9.4)" />
            <ellipse cx="7.6" cy="14.2" rx="1.45" ry="2.2" transform="rotate(18 7.6 14.2)" />
            <ellipse cx="12" cy="12.6" rx="1.4" ry="2.15" transform="rotate(-16 12 12.6)" />
            <ellipse cx="16.4" cy="14.6" rx="1.35" ry="2.1" transform="rotate(28 16.4 14.6)" />
            <ellipse cx="11.4" cy="17.8" rx="1.35" ry="2.05" transform="rotate(-6 11.4 17.8)" />
          }
          @case ('lupin') {
            <ellipse cx="8.4" cy="13.6" rx="3.15" ry="2.55" transform="rotate(-28 8.4 13.6)" />
            <path d="M7.2 12.4c.6.8 1.4 1.4 2.4 1.6" />
            <ellipse cx="15.6" cy="13.6" rx="3.15" ry="2.55" transform="rotate(28 15.6 13.6)" />
            <path d="M16.8 12.4c-.6.8-1.4 1.4-2.4 1.6" />
            <ellipse cx="12" cy="9.2" rx="3.05" ry="2.45" />
            <path d="M12 7.6v2.4" />
          }
          @case ('sulphites') {
            <rect x="3.6" y="6.4" width="16.8" height="11.2" rx="2.4" />
            <text
              x="12"
              y="14.4"
              text-anchor="middle"
              fill="currentColor"
              stroke="none"
              font-size="6.6"
              font-weight="800"
              font-family="ui-sans-serif, system-ui, sans-serif">SO₂</text>
          }
        }
      </svg>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      line-height: 0;
      color: #fff;
      pointer-events: none;
    }

    .disc {
      display: grid;
      place-items: center;
      border-radius: 50%;
      overflow: hidden;
    }

    svg {
      display: block;
      overflow: visible;
    }
  `],
  host: {
    'aria-hidden': 'true'
  }
})
export class AllergenIconComponent {
  readonly name = input.required<AllergenId>();
  readonly size = input(36);
  readonly color = input<string | undefined>(undefined);

  readonly discColor = computed(() => this.color() || getAllergenColor(this.name()));
  readonly glyphSize = computed(() => Math.max(12, Math.round(Number(this.size()) * 0.58)));
}
