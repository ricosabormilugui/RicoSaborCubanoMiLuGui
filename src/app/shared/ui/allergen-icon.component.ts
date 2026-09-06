import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AllergenId, getAllergenIconPath, getAllergenLabel } from '../../core/config/allergens.config';

@Component({
  selector: 'app-allergen-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="allergen-icon-image"
      [src]="iconPath()"
      [alt]="alt()"
      [attr.width]="size()"
      [attr.height]="size()"
    />
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      line-height: 0;
      pointer-events: none;
    }

    .allergen-icon-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      flex-shrink: 0;
    }
  `],
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    'aria-hidden': 'true'
  }
})
export class AllergenIconComponent {
  readonly name = input.required<AllergenId>();
  readonly size = input(36);

  readonly iconPath = computed(() => getAllergenIconPath(this.name()));
  readonly alt = computed(() => getAllergenLabel(this.name()));
}
