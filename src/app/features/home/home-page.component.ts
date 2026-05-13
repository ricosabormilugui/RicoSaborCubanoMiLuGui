import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel } from '../../core/config/product-categories.config';
import { SeoService } from '../../core/services/seo.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="home-page">
      <section class="hero-section hero-cakes" aria-labelledby="home-hero-title">
        <div class="hero-copy">
          <span class="eyebrow">Tartas bajo encargo</span>
          <h1 id="home-hero-title">Tartas personalizadas para cumpleaños, eventos y celebraciones</h1>
          <p>
            Diseñamos tartas por encargo con sabores caseros, acabados cuidados y coordinación directa
            para que tu celebración tenga un toque especial de Rico Sabor Cubano.
          </p>
          <div class="cta-row">
            <a class="btn btn-primary" routerLink="/productos" [queryParams]="{ category: 'tartas' }">Ver tartas</a>
            <a class="btn btn-secondary" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>
          </div>
        </div>

        <div class="hero-card card" aria-label="Pedido personalizado">
          <span class="card-kicker">Encargos especiales</span>
          <strong>Tartas con nombre, temática y tamaño a medida</strong>
          <p>Cuéntanos fecha, personas, sabor favorito y estilo. Te confirmamos disponibilidad antes de preparar el pedido.</p>
        </div>
      </section>

      <section class="feature-section cuban-food" aria-labelledby="cuban-food-title">
        <div>
          <span class="eyebrow">Comida cubana</span>
          <h2 id="cuban-food-title">Comida cubana casera y tradicional</h2>
          <p>
            Platos con sabor familiar: combos, arroz moro, ropa vieja, dulces y opciones pensadas para comer bien en casa,
            celebraciones o pedidos de grupo.
          </p>
        </div>
        <a class="btn btn-secondary" routerLink="/productos" [queryParams]="{ q: 'cubano' }">Ver comida cubana</a>
      </section>

      <section class="feature-section spanish-food" aria-labelledby="spanish-food-title">
        <div>
          <span class="eyebrow">Comida española</span>
          <h2 id="spanish-food-title">Platos españoles y opciones para pedidos</h2>
          <p>
            Propuestas caseras de inspiración española para reuniones, comidas familiares y encargos especiales con atención directa.
          </p>
        </div>
        <a class="btn btn-secondary" routerLink="/productos" [queryParams]="{ q: 'española' }">Ver comida española</a>
      </section>

      <section class="best-sellers" *ngIf="bestSellers().length" aria-labelledby="best-sellers-title">
        <div class="best-sellers-head">
          <div>
            <span class="eyebrow">Favoritos</span>
            <h2 id="best-sellers-title">Más vendidos</h2>
          </div>
          <a routerLink="/productos">Ver todos los productos</a>
        </div>

        <div class="mini-grid">
          <article class="mini-product" *ngFor="let product of bestSellers()">
            <a class="mini-image" [routerLink]="productRoute(product)" [attr.aria-label]="'Ver detalle de ' + product.name">
              <img [src]="product.imageUrl || fallbackImage" [alt]="productImageAlt(product)" width="160" height="160" loading="lazy" decoding="async" />
            </a>
            <div class="mini-content">
              <span class="mini-tag" *ngIf="product.category">{{ categoryLabel(product.category) }}</span>
              <a class="mini-name" [routerLink]="productRoute(product)">{{ product.name }}</a>
              <strong>{{ product.price | currency:'EUR' }}</strong>
              <button class="btn btn-secondary" type="button" (click)="addToCart(product)">Añadir</button>
            </div>
          </article>
        </div>
      </section>
    </section>
  `,
  styles: [
    `.home-page{display:grid;gap:clamp(1rem,3vw,1.7rem);width:100%;min-width:0;max-width:100%;padding:.35rem 0 2.4rem;overflow-x:clip}`,
    `.hero-section,.feature-section,.best-sellers{min-width:0;max-width:100%;border:1px solid color-mix(in srgb,var(--border-soft) 75%,transparent);box-shadow:0 10px 28px var(--shadow-soft)}`,
    `.hero-section{position:relative;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.72fr);gap:clamp(1rem,3vw,2rem);align-items:center;border-radius:24px;padding:clamp(1.1rem,4vw,2.4rem);overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--surface-0) 82%,var(--bg-elevated) 18%),color-mix(in srgb,var(--surface-1) 72%,var(--surface-0) 28%))}`,
    `.hero-section::before{content:"";position:absolute;inset:auto -12% -38% 38%;height:70%;background:radial-gradient(circle,color-mix(in srgb,var(--accent-red) 26%,transparent),transparent 68%);pointer-events:none}`,
    `.hero-copy,.hero-card{position:relative;z-index:1;min-width:0}`,
    `.eyebrow{display:inline-flex;width:max-content;max-width:100%;margin-bottom:.45rem;border:1px solid color-mix(in srgb,var(--accent-green) 42%,var(--border-soft));border-radius:999px;padding:.24rem .68rem;color:var(--accent-green);font-size:.78rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase;background:color-mix(in srgb,var(--surface-2) 34%,transparent)}`,
    `h1,h2{margin:0;color:var(--text-main);line-height:1.05;overflow-wrap:anywhere}`,
    `h1{font-size:clamp(2.05rem,7vw,4.4rem);max-width:920px}`,
    `h2{font-size:clamp(1.5rem,4.5vw,2.65rem)}`,
    `.hero-copy p,.feature-section p,.hero-card p{color:var(--text-soft);line-height:1.62;margin:.75rem 0 0;overflow-wrap:anywhere}`,
    `.cta-row{display:flex;flex-wrap:wrap;gap:.72rem;margin-top:1.1rem}`,
    `.cta-row .btn,.feature-section .btn{min-height:44px;display:inline-grid;place-items:center;text-decoration:none;text-align:center;white-space:normal;line-height:1.15}`,
    `.hero-card{display:grid;gap:.45rem;background:linear-gradient(180deg,color-mix(in srgb,var(--surface-1) 78%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent));border-color:color-mix(in srgb,var(--accent-green) 30%,var(--border-soft));padding:clamp(1rem,3vw,1.35rem)}`,
    `.hero-card strong{color:var(--accent-red);font-size:clamp(1.35rem,3vw,2rem);line-height:1.1;overflow-wrap:anywhere}`,
    `.card-kicker{color:var(--text-soft);font-weight:900;text-transform:uppercase;font-size:.8rem;letter-spacing:.05em}`,
    `.feature-section{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:center;border-radius:20px;padding:clamp(1rem,3vw,1.6rem);background:linear-gradient(135deg,color-mix(in srgb,var(--surface-0) 88%,var(--bg-elevated) 12%),color-mix(in srgb,var(--surface-1) 52%,var(--surface-0) 48%))}`,
    `.feature-section.cuban-food{border-color:color-mix(in srgb,var(--accent-green) 30%,var(--border-soft))}`,
    `.feature-section.spanish-food{border-color:color-mix(in srgb,var(--accent-red) 24%,var(--border-soft))}`,
    `.best-sellers{display:grid;gap:1rem;border-radius:20px;padding:clamp(1rem,3vw,1.5rem);background:color-mix(in srgb,var(--surface-0) 88%,var(--bg-elevated) 12%)}`,
    `.best-sellers-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;min-width:0}`,
    `.best-sellers-head h2{color:var(--accent-red)}`,
    `.best-sellers-head a{color:var(--accent-green);font-weight:900;text-decoration:none}`,
    `.best-sellers-head a:hover,.best-sellers-head a:focus-visible{text-decoration:underline;outline:2px solid color-mix(in srgb,var(--accent-green) 40%,transparent);outline-offset:3px;border-radius:6px}`,
    `.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:.8rem;width:100%;min-width:0;max-width:100%;overflow:hidden}`,
    `.mini-product{display:grid;grid-template-columns:82px minmax(0,1fr);gap:.72rem;align-items:center;width:100%;min-width:0;max-width:100%;overflow:hidden;border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);border-radius:16px;padding:.68rem;background:linear-gradient(180deg,color-mix(in srgb,var(--surface-1) 45%,var(--surface-0) 55%),var(--surface-0));box-shadow:0 7px 16px var(--shadow-soft)}`,
    `.mini-image{display:block;width:82px;height:82px;border-radius:13px;overflow:hidden;background:var(--surface-1);min-width:0}`,
    `.mini-image img{width:100%;height:100%;display:block;object-fit:cover}`,
    `.mini-content{display:grid;gap:.22rem;align-content:center;min-width:0;max-width:100%}`,
    `.mini-tag{min-width:0;max-width:100%;color:var(--text-soft);font-size:.75rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.mini-name{min-width:0;max-width:100%;color:var(--text-main);font-weight:900;line-height:1.2;text-decoration:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}`,
    `.mini-name:hover,.mini-name:focus-visible{color:var(--accent-green);outline:none}`,
    `.mini-product strong{color:var(--accent-green);line-height:1.1}`,
    `.mini-product .btn{justify-self:start;min-height:34px;padding:.38rem .58rem;font-size:.84rem;white-space:normal;line-height:1.1}`,
    `@media(max-width:760px){.hero-section,.feature-section{grid-template-columns:1fr}.feature-section .btn{justify-self:start}.hero-card{padding:1rem}.cta-row .btn{flex:1 1 180px}}`,
    `@media(max-width:520px){.home-page{gap:.9rem}.hero-section,.feature-section,.best-sellers{border-radius:18px}.hero-section{padding:1rem}.feature-section,.best-sellers{padding:.9rem}.cta-row{display:grid;grid-template-columns:1fr}.feature-section .btn{width:100%}.mini-grid{display:flex;gap:.72rem;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:0 .05rem .5rem}.mini-product{flex:0 0 min(84vw,280px);width:min(84vw,280px);max-width:280px;grid-template-columns:72px minmax(0,1fr);padding:.62rem;scroll-snap-align:start;scroll-snap-stop:always}.mini-image{width:72px;height:72px}.mini-product .btn{width:max-content;max-width:100%;justify-self:start}}`
  ]
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly seo = inject(SeoService);

  readonly whatsappUrl = buildWhatsAppContactUrl('Hola, quiero pedir información sobre una tarta personalizada o un pedido bajo encargo.');
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=700';
  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));

  constructor() {
    void this.catalog.loadProducts();
    effect(() => this.updateSeo());
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  categoryLabel(value: string): string {
    return getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en Rico Sabor Cubano`;
  }

  addToCart(product: Product): void {
    this.cart.add(product);
    this.notifications.info('Producto añadido', `${product.name} se agregó al carrito.`);
  }

  private updateSeo(): void {
    this.seo.setPageMeta({
      title: 'Tartas personalizadas y comida casera por encargo',
      description: 'Encarga tartas personalizadas para cumpleaños, eventos y celebraciones, comida cubana tradicional y platos españoles caseros en Rico Sabor Cubano.',
      path: '/',
      canonicalPath: '/',
      type: 'website'
    });

    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([
      { name: 'Inicio', path: '/' }
    ]));
    this.seo.removeJsonLd('product');
  }
}
