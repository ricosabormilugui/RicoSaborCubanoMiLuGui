import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="hero">
      <h1>¿Qué quieres comer hoy?</h1>
      <p>Cocina cubana y platos caseros listos para pedir.</p>

      <div class="quick-categories">
        <button class="cat-pill" type="button" (click)="category = ''">Todos</button>
        <button class="cat-pill" type="button" (click)="category = 'combos'">Combos</button>
        <button class="cat-pill" type="button" (click)="category = 'platos'">Platos</button>
        <button class="cat-pill" type="button" (click)="category = 'bebidas'">Bebidas</button>
        <button class="cat-pill" type="button" (click)="category = 'extras'">Extras</button>
      </div>

      <div class="filters">
        <input [(ngModel)]="query" placeholder="Buscar plato..." />
        <select [(ngModel)]="category">
          <option value="">Todas las categorías</option>
          <option value="combos">Combos</option>
          <option value="platos">Platos</option>
          <option value="bebidas">Bebidas</option>
          <option value="extras">Extras</option>
        </select>
      </div>
    </section>

    <section class="products-wrap">
      <h2 class="section-title">Más vendidos</h2>
      <div class="grid">
        <article class="product" *ngFor="let product of filteredProducts()">
          <img [src]="product.imageUrl" [alt]="product.name" />
          <div class="content">
            <strong>{{ product.price | currency:'EUR' }}</strong>
            <h3>{{ product.name }}</h3>
            <p>{{ product.description }}</p>
            <button class="btn btn-primary" (click)="cart.add(product)">+ Añadir</button>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `.hero{padding:2rem 0 1.5rem;text-align:center}`,
    `.hero h1{margin:0;color:var(--accent-green);font-size:clamp(2rem,5vw,3rem)}`,
    `.hero p{color:var(--text-soft);margin:.4rem 0 1rem}`,
    `.quick-categories{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center;margin-bottom:.9rem}`,
    `.cat-pill{border:1px solid var(--border-soft);border-radius:999px;padding:.45rem .92rem;font-weight:700;background:var(--surface-1);color:var(--text-main);cursor:pointer}`,
    `.cat-pill:hover{background:var(--surface-2)}`,
    `.filters{display:flex;gap:.8rem;flex-wrap:wrap;justify-content:center}`,
    `.filters input,.filters select{min-width:230px}`,
    `.products-wrap{padding-bottom:2rem}`,
    `.section-title{color:var(--accent-red);font-size:2rem;margin:.4rem 0 1rem}`,
    `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.9rem}`,
    `.product{background:var(--surface-0);border:1px solid var(--border-soft);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}`,
    `img{width:100%;height:155px;object-fit:cover}`,
    `.content{padding:.72rem;display:grid;gap:.42rem}`,
    `strong{font-size:1.2rem;color:var(--accent-green)}`,
    `h3{margin:0;font-size:1.02rem}`,
    `p{margin:0;color:var(--text-soft);min-height:38px}`
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
