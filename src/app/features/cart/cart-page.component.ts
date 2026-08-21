import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent {
  constructor(public readonly cart: CartService) {}
}
