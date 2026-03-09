import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="container nav-wrap">
        <a class="brand" routerLink="/">Rico Sabor Cubano</a>
        <nav>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Catálogo</a>
          <a routerLink="/carrito" routerLinkActive="active">Carrito ({{ cart.totalItems() }})</a>
          <a routerLink="/checkout" routerLinkActive="active">Checkout</a>
          <a routerLink="/contacto" routerLinkActive="active">Contacto</a>
        </nav>
      </div>
    </header>
    <main class="container main"><router-outlet /></main>
  `,
  styles: [
    `.header{position:sticky;top:0;background:#fff;border-bottom:1px solid #e4e8ef;z-index:10}`,
    `.nav-wrap{display:flex;justify-content:space-between;align-items:center;padding:.8rem 0}`,
    `nav{display:flex;gap:.8rem;flex-wrap:wrap}`,
    `a{color:#2c3e50;text-decoration:none;font-weight:600}`,
    `.brand{font-size:1.1rem}`,
    `.active{color:#1b74e4}`,
    `.main{padding:1rem 0 2rem}`
  ]
})
export class AppComponent {
  constructor(public readonly cart: CartService) {}
}
