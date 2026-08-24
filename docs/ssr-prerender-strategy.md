# Estrategia de renderizado y sitemap de MIXSABOR

## Auditoría (24 de agosto de 2026)

- Angular Core está fijado en `20.3.17`; CLI y builder están en `20.3.19` según `package-lock.json`.
- El builder es `@angular-devkit/build-angular:application`, con entrada exclusiva de navegador (`src/main.ts`).
- No están instalados `@angular/ssr` ni `@angular/platform-server`, no hay entrada server ni rutas server.
- Netlify publica `dist/ricosabor-tienda/browser` y su última regla reescribe `/*` a `/index.html` con estado 200.
- `dist/ricosabor-tienda/prerendered-routes.json` está vacío. El estado inicial es, por tanto, una SPA CSR pura, sin prerender ni SSR.
- Los productos se cargan desde `GET /api/products`. El repositorio público usa `{ published: true, available: true }`.
- Las categorías se cargan desde `GET /api/categories` y tienen una landing estable en `/categoria/:category`.
- Las fichas usan `/producto/:slug`; `getProductRoute` usa un slug ya almacenado y, si no existe, conserva el ID.
- `SeoService` modifica title, description, robots, canonical, Open Graph, Twitter y JSON-LD después del bootstrap.

## Decisión obligatoria: A

Se mantiene **SPA + sitemap dinámico por ahora**. Es el cambio con mejor relación beneficio/riesgo para mejorar descubrimiento e indexación sin alterar auth, checkout, carrito, tema ni admin.

Angular 20 permite añadir renderizado híbrido mediante `@angular/ssr`, pero en este repositorio no es un cambio de configuración aislado. Antes habría que adaptar y verificar:

- `localStorage` en carrito (incluido el schema v3), catálogo, consentimiento y auth;
- `DOCUMENT`, foco y bloqueo de scroll en catálogo y SEO;
- `matchMedia`, `defaultView` y almacenamiento del tema;
- `window.setInterval` en cocina;
- `navigator.clipboard` en clientes admin;
- manipulación de DOM y temporizadores en componentes compartidos.

Prerenderizar productos durante el build tampoco es la fuente definitiva: un producto creado después de desplegar no obtendría HTML estático hasta el siguiente deploy. No se añade hidratación porque no hay HTML renderizado en servidor que hidratar.

## Comparación del sitemap

### Endpoint backend (seleccionado)

- Reutiliza directamente `listPublicProducts` y `listCategories`, por lo que la fuente y las reglas públicas siguen siendo autoritativas.
- Se actualiza al vencer la caché, sin redeploy.
- Mantiene MongoDB fuera del frontend y de Netlify.
- Su disponibilidad depende del backend, una dependencia que ya tiene todo el catálogo.

### Netlify Function generadora

- Daría una URL natural en el dominio público, pero tendría que consultar endpoints del backend y repetir validaciones, serialización y caché.
- Añadiría invocaciones y una segunda implementación del criterio de indexabilidad.
- No se implementa. La Function existente se limita a transportar la respuesta del backend.

### Generación durante build/deploy

- Es sencilla para páginas estáticas y no consulta MongoDB en cada request.
- Queda obsoleta cada vez que cambia el catálogo y hace depender el deploy de la disponibilidad del backend.
- No se implementa porque no existe una estrategia automática de redeploy por cambios de producto.

## Implementación definitiva

- Endpoint autoritativo: `GET /api/sitemap.xml` en el backend.
- URL pública: `GET /sitemap.xml` en Netlify, reescrita internamente a la Function `api-proxy` y de ahí al endpoint backend.
- `robots.txt` conserva una única referencia a `https://ricosaborcubano.com/sitemap.xml`; la URL ya era la correcta y ahora resuelve al XML dinámico.
- Se retiró `public/sitemap.xml` para que no sobreviva una copia estática susceptible de quedar obsoleta.
- La caché en memoria dura 10 minutos y la respuesta publica `Cache-Control: public, max-age=600, stale-if-error=3600`.
- El endpoint responde `application/xml; charset=utf-8`.
- Se incluyen Home, catálogo, contacto, legales, categorías públicas completas y productos completos que cumplen simultáneamente `published: true` y `available: true`.
- Los productos usan el slug almacenado cuando existe; de lo contrario usan `_id`. Nunca se genera un slug a partir del nombre.
- `lastmod` solo aparece si el producto contiene un `updatedAt` válido. No hay `changefreq` ni `priority`.
- Las URLs se hacen absolutas con `FRONTEND_URL`; si esa variable no existe se usa el dominio de producción ya configurado como fallback. No hay variables nuevas.
- Se eliminan duplicados y se escapan los cinco caracteres reservados de XML.

Un único sitemap es suficiente mientras permanezca por debajo de 50.000 URLs y 50 MB sin comprimir. Al alcanzar cualquiera de esos límites habrá que separar sitemaps (por ejemplo, estáticas/categorías/productos) y publicar un sitemap index.

## SEO y estados HTTP actuales

- Google puede rastrear el app shell, ejecutar JavaScript y posteriormente indexar el DOM y la metadata resultantes. El sitemap mejora el descubrimiento, pero no elimina la cola de renderizado ni el coste de ejecutar JavaScript.
- Antes de ejecutar JavaScript, cualquier URL pública recibe el `index.html` global: título, descripción, canonical y Open Graph de Home, y un `<app-root>` vacío.
- Por ello, un scraper social que no ejecute JavaScript recibe la tarjeta global al compartir `/producto/...`, no la metadata específica del producto. La metadata dinámica sigue siendo correcta tras el bootstrap en navegadores y crawlers con renderizado JS.
- No se adopta prerender dinámico según user-agent: añade infraestructura y una respuesta distinta por bot. La solución recomendada para una fase posterior es renderizado híbrido oficial de Angular, empezando por páginas estáticas y resolviendo después productos bajo demanda; como alternativa acotada puede evaluarse la extensión Prerender de Netlify con pruebas de caché y paridad de contenido.
- Una ruta Angular inexistente ahora muestra una página 404 real de UX, aplica `noindex,follow` y la navegación limpia JSON-LD anterior.
- Un producto eliminado, inactivo o no publicado no aparece en el catálogo público; su ficha muestra “Producto no encontrado”, aplica `noindex,follow` y elimina JSON-LD de producto y breadcrumb.
- Debido a la reescritura SPA, ambos casos todavía reciben HTTP 200 desde Netlify. Un estado HTTP 404 por ruta requiere SSR/edge o reglas generadas en deploy; queda explícitamente pendiente.
- Home canoniza a `/`; catálogo a `/productos`; categorías a `/categoria/:category`; productos a su ruta pública. Búsqueda, precio y ordenación no se incorporan al canonical. No existe paginación real.
- El JSON-LD Product conserva precio base, EUR, disponibilidad, imágenes y vendedor. Los scripts usan IDs únicos y se retiran al navegar.

## Netlify y despliegue

- El comando sigue siendo `npm run build`.
- El directorio publicado sigue siendo `dist/ricosabor-tienda/browser`.
- No hay adapter, comando SSR/prerender ni variable nueva.
- `BACKEND_API_URL` debe seguir apuntando al backend, como ya exige el proxy actual.
- La regla específica de `/sitemap.xml` está antes de `/api/*` y del catch-all SPA; no altera `/reset-password` ni las demás rutas.

## Pendientes recomendados

1. Validar el sitemap desplegado tras cada cambio de infraestructura y monitorizar la disponibilidad del backend.
2. Medir indexación y Core Web Vitals antes de justificar una migración de renderizado.
3. En una fase separada, hacer SSR-safe las APIs de navegador y probar prerender estático de Home, catálogo, contacto y legales.
4. Resolver las tarjetas sociales de producto con renderizado híbrido/estático real, manteniendo fallback CSR para rutas dinámicas nuevas.
5. Sustituir la imagen social global y el favicon cuando existan assets definitivos; no se generan en esta fase.
