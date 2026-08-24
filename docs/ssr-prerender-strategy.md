# Estrategia SSR/prerender para MIXSABOR

## Estado auditado

- La aplicación Angular se ejecuta actualmente como CSR desplegado en Netlify (`dist/ricosabor-tienda/browser`).
- No hay paquete `@angular/ssr` ni `@angular/platform-server` instalado en el entorno actual, por lo que no se puede activar SSR/prerender oficial sin añadir dependencias.
- Existe SEO dinámico en runtime (`SeoService`) para title, description, canonical, Open Graph, Twitter Cards y JSON-LD.
- Existen `robots.txt` y `sitemap.xml` estáticos en `public/`.
- La app ya usa guards y lazy loading; admin, checkout, auth y cuenta no deben prerenderizarse.

## Decisión segura

Se prepara la base de rutas públicas SEO-friendly y configuración compartida, pero se mantiene el build CSR estable hasta poder instalar `@angular/ssr` con acceso al registry. No se activa `provideClientHydration()` todavía porque sin HTML renderizado por servidor solo añade coste al bundle sin beneficio real. Esto evita romper checkout/admin/localStorage/auth y mantiene Netlify/Render actuales.

## Rutas candidatas a prerender

Rutas públicas de bajo riesgo:

- `/`
- `/categoria/combos`
- `/categoria/platos`
- `/categoria/tartas`
- `/categoria/dulces-gourmet`
- `/categoria/bebidas`
- `/categoria/extras`
- `/producto/combo-cubano-clasico`
- `/producto/tarta-tres-leches`
- `/producto/dulce-gourmet-de-coco`
- `/contacto`
- `/legal/aviso-legal`
- `/legal/privacidad`
- `/legal/cookies`
- `/legal/condiciones-compra`
- `/legal/envios`
- `/legal/devoluciones-cancelaciones`

Rutas excluidas:

- `/admin/**`
- `/checkout`
- `/carrito`
- `/mis-pedidos`
- `/login`
- `/registro`

## Requisitos antes de activar prerender oficial

1. Instalar dependencias compatibles con Angular 20: `@angular/ssr` y `@angular/platform-server`.
2. Añadir entry server (`main.server.ts`), `provideClientHydration(withEventReplay())` en la configuración cliente y configuración server/prerender en `angular.json`.
3. Probar render de rutas públicas con `npm run build` y revisar HTML generado.
4. Validar que `localStorage`, `window`, `document`, `matchMedia` y listeners solo se ejecutan de forma segura en navegador o usando `DOCUMENT.defaultView`/guards.
5. Generar `routes.txt` dinámico desde productos publicados reales cuando exista endpoint estable o dump de catálogo.

## Limitaciones actuales

- Sin `@angular/ssr`, el HTML publicado sigue siendo CSR y la metadata dinámica se inyecta tras ejecutar JavaScript.
- El sitemap contiene rutas públicas conocidas/fallback, no todos los productos reales de MongoDB.
- Las URLs de categoría SEO-friendly ya existen como `/categoria/:category`, pero siguen compartiendo componente con el catálogo.
