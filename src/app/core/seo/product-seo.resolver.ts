import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { productPathFromIdentifier } from './seo-page-rules';
import { BRAND_CONFIG } from '../config/brand.config';
import { SeoService } from '../services/seo.service';

export const productSeoResolver: ResolveFn<string> = (route) => {
  const seo = inject(SeoService);
  const path = productPathFromIdentifier(route.paramMap.get('slug') ?? '');
  if (!path) return '';

  seo.setPageMeta({
    title: 'Producto',
    description: `Consulta este producto del catálogo de ${BRAND_CONFIG.name}.`,
    path,
    canonicalPath: path,
    robots: 'index,follow'
  });
  return path;
};
