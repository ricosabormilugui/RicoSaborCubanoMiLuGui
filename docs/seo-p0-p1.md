# SEO P0/P1 de MIXSABOR

## Autoridad canónica

La única autoridad SEO es `https://mixsabor.milugui.com`. El valor fuente está en `shared/site.config.json` y lo consumen Angular y el backend. `src/index.html` y `public/robots.txt` contienen el literal que necesita el HTML/archivo estático; los tests comprueban que coincide con la configuración central.

`FRONTEND_URL` sigue siendo una variable operativa del backend para CORS y enlaces funcionales. No decide canonicals ni el sitemap, evitando que staging o un deploy preview se autocanonicen. Local, staging y previews generan canonicals hacia producción; el artefacto staging añade además `noindex`, `robots.txt` bloqueado y `X-Robots-Tag`.

## Sitemap y robots

- Público: `GET /sitemap.xml`, reescrito por Netlify a `GET /api/sitemap.xml`.
- Incluye `/`, `/productos`, `/contacto`, categorías existentes con al menos un producto público disponible y productos indexables con slug.
- Un producto publicado y agotado por stock sigue siendo indexable; un borrador, un producto oculto manualmente o un producto sin slug no entra.
- No incluye URLs por Mongo ID, categorías vacías, rutas privadas ni páginas legales mientras existan placeholders.
- `lastmod` solo se emite desde una fecha válida de `updatedAt`.
- `robots.txt` bloquea rutas privadas y técnicas, y apunta al sitemap del dominio canónico.

## Slugs y migración manual

Los productos nuevos reciben un slug al crearse. Se normalizan acentos, espacios y caracteres especiales; las colisiones usan sufijos `-2`, `-3`, etc. El índice Mongo `product_slug_unique` impone unicidad y los updates conservan el slug existente aunque cambie el nombre.

Antes del primer despliegue de esta versión contra la base de producción:

```powershell
cd Backend
npm run migrate:product-slugs -- --dry-run
npm run migrate:product-slugs
```

La migración es idempotente. Lee únicamente `_id`, `name` y `slug`, y solo actualiza `slug`; por tanto conserva precios, stock, imágenes, personalizaciones, reseñas, categorías, publicación y todos los demás campos. También normaliza slugs legacy inválidos y resuelve colisiones de forma determinista. No se ejecuta durante build, arranque ni despliegue.

## API y compatibilidad legacy

`GET /api/products/:identifier` acepta el slug público y, temporalmente, un Mongo ID legacy. Devuelve `200` con `product` y hasta cuatro `relatedProducts`; devuelve `404` si no existe o no es público. La ficha usa este endpoint y ya no descarga el catálogo completo para localizar el producto.

La compatibilidad por ID no equivale a una redirección. Mientras la aplicación siga siendo CSR no existe una respuesta HTTP `301` correcta para `/producto/{id}` ni un status HTTP `404` real para rutas frontend inválidas. No se ha añadido un redirect cliente que oculte esta limitación.

## Operación de despliegue

1. Ejecutar la migración de slugs sobre cada base objetivo, empezando por `--dry-run`.
2. Desplegar backend y frontend.
3. Comprobar `https://mixsabor.milugui.com/robots.txt` y `/sitemap.xml`.
4. Confirmar que un slug real devuelve `200` en `/api/products/{slug}` y carga `/producto/{slug}`.
5. Confirmar la redirección `301` desde `https://ricosaborcubano.netlify.app/{ruta}` conservando ruta y query.
6. Enviar el sitemap en Google Search Console y revisar cobertura/canonicals.

## Próxima fase: Angular hybrid rendering

La recomendación es adoptar el renderizado híbrido oficial de Angular, no migrar de framework:

- prerender para Home, catálogo, contacto y páginas informativas estables;
- SSR para producto y categoría dinámicos, resolviendo datos antes de generar HTML;
- CSR para admin, auth, carrito, checkout y cuenta.

Esa fase deberá añadir respuestas HTTP `404` reales, redirección server-side `301` de ID a slug, metadata/Open Graph en el HTML inicial y una estrategia de caché/invalidation para productos. Es un cambio arquitectónico relevante y queda deliberadamente fuera de esta implementación.
