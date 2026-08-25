import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SEO_SITE_CONFIG } from '../config/seo.config';
import { BRAND_CONFIG } from '../config/brand.config';

export interface SeoMetaInput {
  title: string;
  description: string;
  path?: string;
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  robots?: string;
  price?: number;
  currency?: string;
  availability?: 'in stock' | 'out of stock';
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly site = SEO_SITE_CONFIG;

  setPageMeta(input: SeoMetaInput): string {
    const fullTitle = this.withSuffix(input.title);
    const canonical = this.absoluteUrl(input.canonicalPath ?? input.path ?? '/');
    const image = this.absoluteUrl(input.image || this.site.defaultImage);
    const type = input.type ?? 'website';

    this.title.setTitle(fullTitle);
    this.setTag('description', input.description);
    this.setTag('robots', input.robots ?? 'index,follow');
    this.setCanonical(canonical);

    this.setProperty('og:locale', this.site.locale);
    this.setProperty('og:site_name', this.site.siteName);
    this.setProperty('og:type', type);
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', input.description);
    this.setProperty('og:url', canonical);
    this.setProperty('og:image', image);

    if (type === 'product' && input.price !== undefined) {
      this.setProperty('product:price:amount', Number(input.price).toFixed(2));
      this.setProperty('product:price:currency', input.currency ?? 'EUR');
      this.setProperty('product:availability', input.availability ?? 'in stock');
    } else {
      this.meta.removeTag('property="product:price:amount"');
      this.meta.removeTag('property="product:price:currency"');
      this.meta.removeTag('property="product:availability"');
    }

    this.setTag('twitter:card', this.site.twitterCard);
    this.setTag('twitter:title', fullTitle);
    this.setTag('twitter:description', input.description);
    this.setTag('twitter:image', image);

    return canonical;
  }

  setJsonLd(id: string, data: unknown): void {
    const scriptId = `jsonld-${id}`;
    let script = this.document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }

  removeJsonLd(id: string): void {
    this.document.getElementById(`jsonld-${id}`)?.remove();
  }

  clearPageMetadata(): void {
    this.removeJsonLd('product');
    this.removeJsonLd('breadcrumb');
    this.meta.removeTag('property="product:price:amount"');
    this.meta.removeTag('property="product:price:currency"');
    this.meta.removeTag('property="product:availability"');
  }

  setOrganizationAndWebsiteSchema(): void {
    const organization: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.site.business.name,
      slogan: BRAND_CONFIG.slogan,
      url: this.absoluteUrl('/')
    };
    this.addConfiguredProperty(organization, 'legalName', this.site.business.legalName);
    this.addConfiguredProperty(organization, 'email', this.site.business.email);
    this.addConfiguredProperty(organization, 'telephone', this.site.business.phone);
    this.addConfiguredProperty(organization, 'address', this.site.business.address);

    this.setJsonLd('site', [
      organization,
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: this.site.siteName,
        url: this.absoluteUrl('/'),
        inLanguage: 'es-ES',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${this.absoluteUrl('/productos')}?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
    ]);
  }

  buildBreadcrumbSchema(items: Array<{ name: string; path: string }>): unknown {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: this.absoluteUrl(item.path)
      }))
    };
  }

  absoluteUrl(pathOrUrl: string): string {
    const base = this.resolveBaseUrl();
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const url = new URL(pathOrUrl);
      if (url.hostname === 'ricosaborcubano.netlify.app') {
        return `${base}${url.pathname}${url.search}`;
      }
      return pathOrUrl;
    }

    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${base}${path}`;
  }

  private resolveBaseUrl(): string {
    return this.site.siteUrl.replace(/\/$/, '');
  }

  private addConfiguredProperty(target: Record<string, unknown>, key: string, value: string): void {
    const normalized = String(value ?? '').trim();
    if (normalized && !normalized.startsWith('PENDIENTE_CONFIGURAR_')) target[key] = normalized;
  }

  private withSuffix(title: string): string {
    return title.includes(this.site.titleSuffix) ? title : `${title} · ${this.site.titleSuffix}`;
  }

  private setCanonical(href: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }

    link.setAttribute('href', href);
  }

  private setTag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }
}
