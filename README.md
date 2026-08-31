# MIXSABOR · Sabores que se encuentran

Proyecto base para una tienda web en **Angular + TypeScript** con backend serverless en **Netlify** y backend **Node/Express desplegado en Render**.

---

# Funcionalidades incluidas

- Catálogo de productos con búsqueda y filtro por categoría.
- Carrito con suma automática y control de cantidades.
- Checkout sin pago online (captura datos de cliente + entrega + notas).
- Envío de pedido canónico: `POST /api/orders` (Netlify `api-proxy` → backend Express).
- Envío de notificaciones automáticas por **email** desde el backend, solo tras persistir el pedido.
- Formulario de solicitud de información.

---

# Estructura del proyecto

```
src/app/features/catalog
src/app/features/cart
src/app/features/checkout
src/app/features/contact
src/app/core/services
src/app/core/config/order.config.ts

netlify/functions/api-proxy.ts

Backend/
```

---

# Ejecutar localmente

```bash
npm install
npm start
```

## Modo desarrollo local (sin Netlify/Render)

Para desarrollar sin depender de créditos ni despliegues:

- Frontend Angular en `http://localhost:4200`
- Backend Express en `http://localhost:3001`
- MongoDB Atlas como base de datos

### 1) Backend local

```bash
cd Backend
npm install
npm run dev
```

Variables mínimas sugeridas en `Backend/.env`:

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=...
MONGODB_DB_NAME=ricoSaborCubano
AUTH_TOKEN_SECRET=dev_secret
CORS_ORIGIN=http://localhost:4200
```

### 2) Frontend local

```bash
cd ..
npm install
npm start
```

El frontend en desarrollo usa `src/environments/environment.ts` con `apiUrl: 'http://localhost:3001'`, por lo que los pedidos van a `http://localhost:3001/api/orders`.

---

# Build

```bash
npm run build
```

---

# Backend con email y contacto manual por WhatsApp

Las notificaciones automáticas se envían solo por email mediante Resend.

WhatsApp no usa API, webhook ni envío automático. La web solo muestra un enlace manual `wa.me` para que el cliente abra una conversación voluntariamente:

```text
https://wa.me/34614272838?text=Hola%2C%20quiero%20hacer%20una%20consulta%20sobre%20un%20producto%20o%20pedido.
```

La ruta canónica de pedidos es:

```text
Frontend → POST /api/orders → api-proxy → Express → Mongo → email
```

`netlify.toml` reescribe `/api/*` a `api-proxy`. No existe Function `submit-order`.

---

# Variables de entorno (Netlify)

El storefront en Netlify necesita el backend público:

```
BACKEND_API_URL=https://tu-backend.onrender.com
BACKEND_TIMEOUT_MS=10000
```

Resend y `PAYMENT_*` se configuran en el **backend** (Render). `PAYMENT_*` solo sirve de bootstrap inicial si Mongo aún no tiene `payment_settings`.

---

# Diagnóstico de notificaciones

Si el checkout confirma pedido pero no llegan notificaciones:

1. Abre **DevTools → Network**
2. Revisa `POST /api/orders`.
3. Comprueba que `notifications.email.sent` es `true` en la respuesta del backend.

---

# Envío de pedidos

Única ruta autoritativa:

```
POST /api/orders
```

No hay pedidos locales en producción ni en desarrollo por defecto. Un fallo de API es un error: el carrito se conserva y no se muestra éxito.
---

# Backend Node / Express

Ubicado en:

```
Backend/
```

Funcionalidades:

- persistencia en MongoDB
- email con Resend
- Contacto manual por enlace wa.me
- autenticación
- panel admin

---

# Archivos clave backend

```
Backend/src/server.js
Backend/src/routes/orders.routes.js
Backend/src/controllers/orders.controller.js
Backend/src/services/email.service.js
Backend/src/repositories/orders.repository.js
```

---

# Endpoints backend

## Health

```
GET /health
```

---

## Pedidos

```
POST /api/orders
```

---

## Auth

```
POST /api/auth/register
POST /api/auth/login
```

---

## Admin

```
GET /api/admin/orders
PATCH /api/admin/orders/:orderId/status
```

---

# Configuración backend

### 1️⃣ Copiar variables

```
Backend/.env.example → Backend/.env
```

---

### 2️⃣ Instalar dependencias

```bash
cd Backend
npm install
```

---

### 3️⃣ Configurar MongoDB

```
MONGODB_URI
MONGODB_DB_NAME
```

---

### 4️⃣ Ejecutar backend

```bash
npm run dev
```

---

---

# Troubleshooting Netlify

## Error

```
Could not read package.json
```

Solución:

Netlify → **Build settings**

```
Base directory: .
Build command: npm run build
Publish directory: dist/ricosabor-tienda/browser
```

---

# Nota sobre ramas y despliegue

El autor del commit **no afecta al deploy**.

Lo importante es que:

- Netlify
- Render

estén desplegando **la misma rama del repositorio**.

---

# Arquitectura del sistema

```
Angular
   ↓
Netlify Function
   ↓
Backend Render
   ↓
MongoDB
   ↓
Email (Resend)
   ↓
WhatsApp manual
```

---

# Proyecto listo para

- pedidos sin pasarela de pago
- email automático
- WhatsApp manual por enlace
- panel admin
- persistencia MongoDB
- deploy Netlify + Render
