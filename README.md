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
3. Envía notificación por WhatsApp vía webhook a tu backend Node/Express.
4. Devuelve `orderId` para mostrar confirmación en checkout.

### Variables de entorno (Netlify)

#### Email (Resend)

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_FROM` (ej: `Pedidos <pedidos@tudominio.com>`)
- `NOTIFY_EMAIL_TO` (correo que recibe alertas)

#### WhatsApp (webhook a backend propio, sin Twilio)

- `WHATSAPP_WEBHOOK_URL` (ej: `https://tu-backend.com:3001/api/whatsapp/notify`)
- `BACKEND_API_URL` (alternativa, ej: `https://tu-backend.com:3001`; la función añade `/api/whatsapp/notify`)
- `WHATSAPP_WEBHOOK_TOKEN` (opcional, recomendado)

> La función acepta el pedido aunque un canal no esté configurado. En la respuesta JSON (`notifications`) verás el detalle por canal para diagnosticar fallos de email/WhatsApp.

## Envío de pedidos en esta fase

- La app está configurada en modo **netlify** (`ORDER_SUBMISSION_MODE = 'netlify'`).
- El checkout envía pedidos al endpoint `/.netlify/functions/submit-order`.

### Cuando quieras activar backend real

1. Cambia `src/app/core/config/order.config.ts` a `ORDER_SUBMISSION_MODE = 'netlify'`.
2. Configura las variables de entorno en Netlify.
3. Prueba con `netlify dev` o despliega en Netlify.
4. A partir de ahí, el checkout enviará al endpoint `/.netlify/functions/submit-order`.

## Archivo .env

- Se incluye `.env` para desarrollo local con todas las variables del backend (Resend + webhook de WhatsApp).
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



### Deploy backend en Render (recomendado)

Este repo ya incluye `render.yaml` en la raíz para desplegar `Backend/` como servicio web Node.

1. En Render: **New + → Blueprint** y conecta este repositorio.
2. Render detectará `render.yaml` y creará el servicio `ricosabor-backend`.
3. Completa variables pendientes (`sync: false`) en Render:
   - `MONGODB_URI`
   - `RESEND_API_KEY`
   - `NOTIFY_EMAIL_FROM`
   - `NOTIFY_EMAIL_TO`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
4. Espera a que el deploy termine y copia la URL pública (ejemplo: `https://ricosabor-backend.onrender.com`).

### Conectar Netlify con backend Render

En Netlify agrega variable de entorno:

- `BACKEND_API_URL=https://ricosabor-backend.onrender.com`

> Sin `BACKEND_API_URL`, la función `/.netlify/functions/api-proxy/*` responderá `Missing BACKEND_API_URL` y registro/login fallarán con 500.

### Troubleshooting Netlify: `Could not read package.json`

Si el log muestra `ENOENT: no such file or directory, open '/opt/build/repo/package.json'`:

1. En Netlify ve a **Site settings → Build & deploy → Build settings**.
2. Deja **Base directory** vacío (o `.`) para usar la raíz del repo.
3. Build command: `npm run build`.
4. Publish directory: `dist/ricosabor-tienda/browser`.
5. Si tenías valores en la UI que pisan `netlify.toml`, pulsa **Clear** para que use el archivo del repo.

Este proyecto define esos valores en `netlify.toml` en la raíz.


### Troubleshooting notificaciones (email/WhatsApp)

Si el checkout confirma pedido pero no llega nada por email/WhatsApp:

1. Revisa la respuesta del `POST /.netlify/functions/submit-order` en DevTools (Network).
2. En `notifications` verás el error exacto de cada canal (`Resend ...` o `WhatsApp webhook ...`).
3. Verifica variables en Netlify (Production context):
   - `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`
   - `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_TOKEN`
4. Verifica en tu backend que `/api/whatsapp/notify` esté expuesto y que el token coincida (si lo configuraste).
5. Si aún aparece un error que menciona `TWILIO_*`, tu deploy de Netlify está usando una función vieja: fuerza un redeploy del último commit (Clear cache and deploy site).

> Nota: el envío real de WhatsApp lo hace tu backend con `whatsapp-web.js`; Netlify solo reenvía el mensaje al webhook.
