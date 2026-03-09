import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <h1>Menú y Catálogo</h1>
      <div class="filters">
        <input [(ngModel)]="query" placeholder="Buscar producto..." />
        <select [(ngModel)]="category">
          <option value="">Todas las categorías</option>
          <option value="combos">Combos</option>
          <option value="platos">Platos</option>
          <option value="bebidas">Bebidas</option>
          <option value="extras">Extras</option>
        </select>
      </div>
    </section>

    <section class="grid">
      <article class="card" *ngFor="let product of filteredProducts()">
        <img [src]="product.imageUrl" [alt]="product.name" />
        <h3>{{ product.name }}</h3>
        <p>{{ product.description }}</p>
        <strong>{{ product.price | currency:'USD' }}</strong>
        <button class="btn btn-primary" (click)="cart.add(product)">Agregar</button>
      </article>
    </section>
  `,
  styles: [
    `.filters{display:flex;gap:.8rem;flex-wrap:wrap}`,
    `input,select{padding:.55rem .7rem;border:1px solid #cfd8e3;border-radius:8px}`,
    `.grid{margin-top:1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}`,
    `img{width:100%;height:135px;object-fit:cover;border-radius:8px}`,
    `h3{margin:.65rem 0 .35rem}`,
    `p{min-height:40px;color:#475569}`,
    `strong{display:block;margin-bottom:.65rem}`
  ]
})
export class CatalogPageComponent {
  query = '';
  category = '';

  readonly filteredProducts = computed(() => {
    const q = this.query.trim().toLowerCase();
    const c = this.category;

    return this.catalog
      .products()
      .filter((product) => (c ? product.category === c : true))
      .filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(q));
  });

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService) {}
}
