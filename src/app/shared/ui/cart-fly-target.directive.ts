import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CartAnimationService } from '../../core/services/cart-animation.service';

@Directive({
  selector: '[appCartFlyTarget]',
  standalone: true,
  host: {
    'data-cart-target': ''
  }
})
export class CartFlyTargetDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cartAnimation = inject(CartAnimationService);

  ngOnInit(): void {
    this.cartAnimation.registerTarget(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.cartAnimation.unregisterTarget(this.host.nativeElement);
  }
}
