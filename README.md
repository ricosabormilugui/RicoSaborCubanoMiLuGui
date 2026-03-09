# Rico Sabor Cubano · Tienda en Angular (sin pasarela de pago)

Proyecto base para una tienda web en Angular + TypeScript con despliegue en Netlify.

## Funcionalidades incluidas

- Catálogo de productos con búsqueda y filtro por categoría.
- Carrito con suma automática y control de cantidades.
- Checkout sin pago online (captura datos de cliente + entrega + notas).
- Envío de pedido a función serverless de Netlify (`/.netlify/functions/submit-order`).
- Formulario de solicitud de información.

## Estructura

- `src/app/features/catalog`: catálogo y agregar al carrito.
- `src/app/features/cart`: resumen del carrito.
- `src/app/features/checkout`: checkout y envío de pedidos.
- `src/app/features/contact`: formulario de contacto.
- `src/app/core/services`: servicios de catálogo, carrito y pedidos.
- `netlify/functions/submit-order.ts`: endpoint para recibir pedidos.

## Ejecutar localmente

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Despliegue en Netlify

El archivo `netlify.toml` ya incluye:

- comando de build: `npm run build`
- publicación: `dist/ricosabor-tienda/browser`
- redirección SPA a `index.html`

## Próximos pasos sugeridos

1. Persistir pedidos en base de datos (Supabase/Firebase).
2. Enviar notificación por email/WhatsApp al crear pedido.
3. Crear panel interno de gestión de estados (`nuevo`, `confirmado`, `en preparación`, etc.).

## Envío de pedidos en desarrollo local

- En producción, el checkout envía a `/.netlify/functions/submit-order`.
- En `localhost` si esa función no está disponible (por ejemplo usando solo `ng serve`), la app aplica un fallback y guarda el pedido en `localStorage` con un ID `LOCAL-...`, para no bloquear pruebas de checkout.
- Para probar el flujo real de Netlify Functions en local, usa `netlify dev`.
