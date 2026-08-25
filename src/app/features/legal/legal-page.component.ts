import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LEGAL_BUSINESS_CONFIG, LEGAL_DOCUMENTS, getLegalDocument } from '../../core/config/legal.config';
import { SeoService } from '../../core/services/seo.service';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { SEO_SITE_CONFIG } from '../../core/config/seo.config';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="legal-page card" *ngIf="document(); else notFound">
      <header class="legal-hero">
        <p class="eyebrow">Información legal</p>
        <h1>{{ document()?.title }}</h1>
        <p>{{ document()?.summary }}</p>
        <small>Última actualización: {{ business.lastUpdated }}</small>
      </header>

      <nav class="legal-nav" aria-label="Páginas legales">
        <a *ngFor="let item of documents" [routerLink]="['/legal', item.slug]" [class.active]="item.slug === document()?.slug">{{ item.title }}</a>
      </nav>

      <section class="identity">
        <h2>Datos configurables del responsable</h2>
        <dl>
          <div><dt>Nombre comercial</dt><dd>{{ business.tradeName }}</dd></div>
          <div><dt>Razón social</dt><dd>{{ business.legalName }}</dd></div>
          <div><dt>CIF/NIF</dt><dd>{{ business.taxId }}</dd></div>
          <div><dt>Dirección fiscal</dt><dd>{{ business.fiscalAddress }}</dd></div>
          <div><dt>Email legal</dt><dd>{{ business.legalEmail }}</dd></div>
          <div><dt>Teléfono</dt><dd>{{ business.phone }}</dd></div>
        </dl>
      </section>

      <section class="legal-section" *ngFor="let section of document()?.sections">
        <h2>{{ section.title }}</h2>
        <p *ngFor="let paragraph of section.paragraphs">{{ paragraph }}</p>
      </section>

      <footer class="legal-disclaimer">
        <strong>Nota:</strong> estos textos son una base operativa para ecommerce España/UE y deben revisarse por asesoría legal antes de producción.
      </footer>
    </article>

    <ng-template #notFound>
      <section class="card legal-page">
        <h1>Página legal no encontrada</h1>
        <a routerLink="/legal/aviso-legal">Volver al aviso legal</a>
      </section>
    </ng-template>
  `,
  styles: [
    `.legal-page{display:grid;gap:1rem;max-width:980px;margin:0 auto;color:var(--text-main)}`,
    `.legal-hero{border-bottom:1px solid var(--border-soft);padding-bottom:1rem}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:900;text-transform:uppercase;font-size:.8rem;letter-spacing:.05em}`,
    `h1{margin:.2rem 0 .45rem;font-size:clamp(2rem,5vw,3.4rem)}`,
    `h2{margin:0 0 .45rem}`,
    `p{color:var(--text-soft);line-height:1.65}`,
    `.legal-nav{display:flex;gap:.5rem;flex-wrap:wrap}`,
    `.legal-nav a{border:1px solid var(--border-soft);border-radius:999px;padding:.45rem .75rem;color:var(--text-main);text-decoration:none;background:var(--surface-1);font-weight:800}`,
    `.legal-nav a.active,.legal-nav a:focus-visible,.legal-nav a:hover{border-color:var(--accent-green);background:color-mix(in srgb,var(--accent-green) 14%,var(--surface-1))}`,
    `.identity,.legal-section,.legal-disclaimer{border:1px solid var(--border-soft);border-radius:14px;padding:1rem;background:var(--surface-1)}`,
    `dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin:0}`,
    `dl div{border:1px solid var(--border-soft);border-radius:10px;padding:.65rem;background:var(--surface-0)}`,
    `dt{font-weight:900;color:var(--text-main)}`,
    `dd{margin:.2rem 0 0;color:var(--text-soft);overflow-wrap:anywhere}`,
    `.legal-disclaimer{color:var(--text-soft)}`,
    `@media (max-width:720px){dl{grid-template-columns:1fr}.legal-page{padding:.2rem}.legal-nav a{flex:1 1 100%}}`
  ]
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly paramMap = toSignal(this.route.paramMap);
  readonly business = LEGAL_BUSINESS_CONFIG;
  readonly documents = LEGAL_DOCUMENTS;
  readonly document = computed(() => getLegalDocument(this.paramMap()?.get('slug')));

  constructor() {
    effect(() => {
      const legalDocument = this.document();
      const documentTitle = legalDocument?.title ?? 'Página legal';
      const path = legalDocument ? `/legal/${legalDocument.slug}` : '/legal/aviso-legal';

      this.seo.setPageMeta({
        title: documentTitle,
        description: legalDocument?.summary ?? `Información legal de ${BRAND_CONFIG.name}.`,
        path,
        canonicalPath: path,
        robots: legalDocument && SEO_SITE_CONFIG.hasCompleteLegalIdentity ? 'index,follow' : 'noindex,follow'
      });
      this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([
        { name: 'Inicio', path: '/' },
        { name: 'Legal', path: '/legal/aviso-legal' },
        { name: documentTitle, path }
      ]));
      this.seo.removeJsonLd('product');
    });
  }
}

