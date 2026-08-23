import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideArrowRight,
  LucideCalendar,
  LucideGift,
  LucideMenu,
  LucideMessageCircle,
  LucideMoon,
  LucidePhone,
  LucideSearch,
  LucideShoppingBag,
  LucideSlidersHorizontal,
  LucideStore,
  LucideSun,
  LucideTruck,
  LucideUser,
  LucideUtensils,
  LucideX
} from '@lucide/angular';

export type AppIconName =
  | 'arrow'
  | 'calendar'
  | 'cart'
  | 'close'
  | 'gift'
  | 'menu'
  | 'moon'
  | 'phone'
  | 'search'
  | 'filters'
  | 'store'
  | 'sun'
  | 'truck'
  | 'user'
  | 'utensils'
  | 'whatsapp';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideArrowRight,
    LucideCalendar,
    LucideGift,
    LucideMenu,
    LucideMessageCircle,
    LucideMoon,
    LucidePhone,
    LucideSearch,
    LucideShoppingBag,
    LucideSlidersHorizontal,
    LucideStore,
    LucideSun,
    LucideTruck,
    LucideUser,
    LucideUtensils,
    LucideX
  ],
  template: `
    @switch (name()) {
      @case ('arrow') { <svg lucideArrowRight [size]="size()" /> }
      @case ('calendar') { <svg lucideCalendar [size]="size()" /> }
      @case ('cart') { <svg lucideShoppingBag [size]="size()" /> }
      @case ('close') { <svg lucideX [size]="size()" /> }
      @case ('gift') { <svg lucideGift [size]="size()" /> }
      @case ('menu') { <svg lucideMenu [size]="size()" /> }
      @case ('moon') { <svg lucideMoon [size]="size()" /> }
      @case ('phone') { <svg lucidePhone [size]="size()" /> }
      @case ('search') { <svg lucideSearch [size]="size()" /> }
      @case ('filters') { <svg lucideSlidersHorizontal [size]="size()" /> }
      @case ('store') { <svg lucideStore [size]="size()" /> }
      @case ('sun') { <svg lucideSun [size]="size()" /> }
      @case ('truck') { <svg lucideTruck [size]="size()" /> }
      @case ('user') { <svg lucideUser [size]="size()" /> }
      @case ('utensils') { <svg lucideUtensils [size]="size()" /> }
      @case ('whatsapp') { <svg lucideMessageCircle [size]="size()" /> }
    }
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
export class IconComponent {
  readonly name = input.required<AppIconName>();
  readonly size = input<number | string>(22);
}
