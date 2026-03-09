# Rico Sabor Cubano · Tienda en Angular (sin pasarela de pago)

Proyecto base para una tienda web en Angular + TypeScript con despliegue en Netlify.

## Funcionalidades incluidas

- Catálogo de productos con búsqueda y filtro por categoría.
- Carrito con suma automática y control de cantidades.
- Checkout sin pago online (captura datos de cliente + entrega + notas).
- Envío de pedido configurable: por defecto guarda localmente (modo desarrollo) y opcionalmente puede enviar a Netlify Function.
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

## Envío de pedidos en esta fase (sin despliegue aún)

- La app está configurada por defecto en modo **local** (`ORDER_SUBMISSION_MODE = 'local'`).
- En ese modo, el checkout guarda pedidos en `localStorage` con IDs `LOCAL-...` (clave: `ricosabor-local-orders`).
- Esto evita errores mientras todavía no has desplegado en Netlify.

### Cuando quieras activar Netlify

1. Cambia `src/app/core/config/order.config.ts` a `ORDER_SUBMISSION_MODE = 'netlify'`.
2. Prueba con `netlify dev` en local o despliega en Netlify.
3. A partir de ahí, el checkout enviará al endpoint `/.netlify/functions/submit-order`.
