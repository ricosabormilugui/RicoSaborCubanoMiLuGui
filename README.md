# Rico Sabor Cubano · Tienda en Angular (sin pasarela de pago)

Proyecto base para una tienda web en Angular + TypeScript con backend serverless en Netlify.

## Funcionalidades incluidas

- Catálogo de productos con búsqueda y filtro por categoría.
- Carrito con suma automática y control de cantidades.
- Checkout sin pago online (captura datos de cliente + entrega + notas).
- Envío de pedido configurable: por defecto guarda localmente (modo desarrollo) y opcionalmente envía al backend serverless.
- Formulario de solicitud de información.

## Estructura

- `src/app/features/catalog`: catálogo y agregar al carrito.
- `src/app/features/cart`: resumen del carrito.
- `src/app/features/checkout`: checkout y envío de pedidos.
- `src/app/features/contact`: formulario de contacto.
- `src/app/core/services`: servicios de catálogo, carrito y pedidos.
- `src/app/core/config/order.config.ts`: modo de envío (`local` o `netlify`).
- `netlify/functions/submit-order.ts`: endpoint backend para persistencia y notificaciones.

## Ejecutar localmente

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Backend con MongoDB Atlas + notificaciones

La función `netlify/functions/submit-order.ts` ahora hace lo siguiente:

1. Valida el payload del pedido.
2. Guarda pedido en MongoDB Atlas (`orders` por defecto).
3. Envía notificaciones opcionales por email y/o SMS.
4. Devuelve `orderId` para mostrar confirmación en checkout.

### Variables de entorno (Netlify)

#### MongoDB Atlas (obligatorias)

- `MONGODB_URI` → URI de conexión de Atlas.
- `MONGODB_DB_NAME` → nombre de la base de datos.
- `MONGODB_ORDERS_COLLECTION` → opcional, por defecto `orders`.

#### Email (opcional, Resend)

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_FROM` (ej: `Pedidos <pedidos@tudominio.com>`)
- `NOTIFY_EMAIL_TO` (correo que recibe alertas)

#### SMS (opcional, Twilio)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `NOTIFY_SMS_TO`

> Si no configuras email/SMS, el pedido se guarda igual en MongoDB sin notificación.

## Envío de pedidos en esta fase (sin despliegue aún)

- La app está configurada por defecto en modo **local** (`ORDER_SUBMISSION_MODE = 'local'`).
- En ese modo, el checkout guarda pedidos en `localStorage` con IDs `LOCAL-...` (clave: `ricosabor-local-orders`).
- Esto evita errores mientras todavía no has desplegado en Netlify.

### Cuando quieras activar backend real

1. Cambia `src/app/core/config/order.config.ts` a `ORDER_SUBMISSION_MODE = 'netlify'`.
2. Configura las variables de entorno en Netlify.
3. Prueba con `netlify dev` o despliega en Netlify.
4. A partir de ahí, el checkout enviará al endpoint `/.netlify/functions/submit-order`.
