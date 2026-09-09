import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { resolveCatalogSeo } from './seo-page-rules';
import { BRAND_CONFIG } from '../config/brand.config';
import { SeoService } from '../services/seo.service';

export const catalogSeoResolver: ResolveFn<string> = (route) => {
  const seo = inject(SeoService);
  const resolved = resolveCatalogSeo({
    routeCategory: route.paramMap.get('category'),
    categoriesReady: !route.paramMap.get('category')
  });

  seo.setPageMeta({
    title: resolved.path === '/productos'
      ? 'Productos, tartas y comida casera por encargo'
      : `Categoría del catálogo de ${BRAND_CONFIG.name}`,
    description: resolved.path === '/productos'
      ? `Explora el catálogo completo de ${BRAND_CONFIG.name}: tartas, platos cubanos y españoles, dulces y encargos con entrega o recogida.`
      : `Compra productos de ${BRAND_CONFIG.name} con pedido manual, entrega local o recogida y confirmación por el equipo.`,
    path: resolved.path,
    canonicalPath: resolved.canonicalPath,
    robots: resolved.robots,
    type: 'website'
  });
  return resolved.canonicalPath;
};
