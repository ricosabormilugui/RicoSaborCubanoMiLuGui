import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="hero soft-wave card">
      <h1 class="catalog-title">Catálogo</h1>

      <div class="quick-categories">
        <button class="cat-pill neutral" type="button" (click)="category = ''">Todo</button>
        <button class="cat-pill blue" type="button" (click)="category = 'combos'">Combos</button>
        <button class="cat-pill red" type="button" (click)="category = 'platos'">Platos</button>
        <button class="cat-pill" type="button" (click)="category = 'bebidas'">Bebidas</button>
        <button class="cat-pill" type="button" (click)="category = 'extras'">Extras</button>
      </div>

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

      <p class="notice">
        Los pedidos deben realizarse con al menos <strong>24h de antelación</strong>.
        Para personalizados recomendamos <strong>72h</strong>.
      </p>
    </section>

    <section class="grid">
      <article class="card product" *ngFor="let product of filteredProducts()">
        <img [src]="product.imageUrl" [alt]="product.name" />
        <h3>{{ product.name }}</h3>
        <p>{{ product.description }}</p>
        <strong>{{ product.price | currency:'EUR' }}</strong>
        <button class="btn btn-primary" (click)="cart.add(product)">Agregar</button>
      </article>
    </section>
  `,
  styles: [
    `.hero{padding:1.2rem 1rem 2rem;margin-bottom:1rem}`,
    `.catalog-title{font-size:clamp(2.2rem,6vw,3.4rem);margin:.2rem 0 1rem;text-align:center;color:#c71f26;font-weight:900}`,
    `.quick-categories{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;margin-bottom:.9rem}`,
    `.cat-pill{border:0;border-radius:999px;padding:.5rem 1rem;font-weight:800;background:#2f8a2c;color:#fff;cursor:pointer}`,
    `.cat-pill.neutral{background:#eceef2;color:#111}`,
    `.cat-pill.blue{background:#1f4f8f}`,
    `.cat-pill.red{background:#c71f26}`,
    `.filters{display:flex;gap:.8rem;flex-wrap:wrap;justify-content:center}`,
    `input,select{padding:.55rem .7rem;border:1px solid #cfd8e3;border-radius:8px;min-width:220px}`,
    `.notice{text-align:center;max-width:760px;margin:.8rem auto 0;color:#1a1a1a;font-size:1.03rem}`,
    `.grid{margin-top:1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:1rem}`,
    `.product{display:flex;flex-direction:column}`,
    `img{width:100%;height:150px;object-fit:cover;border-radius:10px}`,
    `h3{margin:.65rem 0 .35rem}`,
    `p{min-height:40px;color:#353f4f}`,
    `strong{display:block;margin-bottom:.7rem;font-size:1.1rem}`
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

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService) {
    void this.catalog.loadProducts();
  }
}
