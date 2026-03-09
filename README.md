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
- `netlify/functions/submit-order.ts`: endpoint backend para notificaciones por email y WhatsApp.

## Ejecutar localmente

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Backend con email + WhatsApp

La función `netlify/functions/submit-order.ts` hace lo siguiente:

1. Valida el payload del pedido.
2. Envía notificación por email (Resend).
3. Envía notificación por WhatsApp (Twilio).
4. Devuelve `orderId` para mostrar confirmación en checkout.

### Variables de entorno (Netlify)

#### Email (obligatorias, Resend)

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_FROM` (ej: `Pedidos <pedidos@tudominio.com>`)
- `NOTIFY_EMAIL_TO` (correo que recibe alertas)

#### WhatsApp (obligatorias, Twilio)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (solo número, ej: `+14155238886`)
- `NOTIFY_WHATSAPP_TO` (solo número destino, ej: `+34600111222`)

> Si falta una variable requerida, la función responderá error para que puedas corregir configuración en Netlify.

## Envío de pedidos en esta fase

- La app está configurada en modo **netlify** (`ORDER_SUBMISSION_MODE = 'netlify'`).
- El checkout envía pedidos al endpoint `/.netlify/functions/submit-order`.

### Cuando quieras activar backend real

1. Cambia `src/app/core/config/order.config.ts` a `ORDER_SUBMISSION_MODE = 'netlify'`.
2. Configura las variables de entorno en Netlify.
3. Prueba con `netlify dev` o despliega en Netlify.
4. A partir de ahí, el checkout enviará al endpoint `/.netlify/functions/submit-order`.

## Archivo .env

- Se incluye `.env` para desarrollo local con todas las variables del backend (Resend + Twilio WhatsApp).
- Se incluye `.env.example` como plantilla para compartir configuración sin secretos.
- En Netlify debes configurar las mismas variables en **Site settings > Environment variables**.

## Backend Node/Express (email + WhatsApp)

Se agregó un backend en `Backend/` para flujo de pedidos con persistencia en MongoDB y notificaciones:

- Guarda pedido en MongoDB.
- Envía email por Resend.
- Envía WhatsApp por `whatsapp-web.js`.

### Archivos clave

- `Backend/src/services/whatsapp.service.js`
- `Backend/src/services/email.service.js`
- `Backend/src/services/orders.repository.js`
- `Backend/src/controllers/orders.controller.js`
- `Backend/src/routes/orders.routes.js`
- `Backend/src/server.js`

### Configuración

1. Copia `Backend/.env.example` a `Backend/.env`.
2. Instala dependencias del backend:

```bash
cd Backend
npm install
```

3. Arranca backend:

```bash
npm run dev
```

4. Escanea el QR que aparece en terminal para vincular WhatsApp Business.

> Si en desarrollo ves QR en bucle, asegúrate de usar este `npm run dev` (watch limitado a `src/`) para que los cambios de `.wwebjs_auth` no reinicien el proceso.

5. Para ejecución estable (sin watch), usa:

```bash
npm start
```

> Importante: se ignoraron `.wwebjs_auth/` y `.wwebjs_cache/` en git para no versionar sesión de WhatsApp.
