# MIXSABOR · Sabores que se encuentran

Proyecto base para una tienda web en **Angular + TypeScript** con backend serverless en **Netlify** y backend **Node/Express desplegado en Render**.

---

# Funcionalidades incluidas

- Catálogo de productos con búsqueda y filtro por categoría.
- Carrito con suma automática y control de cantidades.
- Checkout sin pago online (captura datos de cliente + entrega + notas).
- Envío de pedido configurable: local, Netlify o backend API.
- Envío de notificaciones automáticas por **email**.
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

netlify/functions/submit-order.ts

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

La función **Netlify** `netlify/functions/submit-order.ts`:

1. Valida el payload del pedido.
2. Envía notificación por email (Resend).
3. Devuelve `orderId` para mostrar confirmación en checkout.

---

# Variables de entorno (Netlify)

## Email (Resend)

```
RESEND_API_KEY
NOTIFY_EMAIL_FROM
NOTIFY_EMAIL_TO
```

Ejemplo:

```
NOTIFY_EMAIL_FROM="Pedidos MIXSABOR <pedidos@tudominio.com>"
NOTIFY_EMAIL_TO=ventas@tudominio.com
```

---

# Diagnóstico de notificaciones

Si el checkout confirma pedido pero no llegan notificaciones:

1. Abre **DevTools → Network**
2. Revisa la respuesta de:

```
POST /.netlify/functions/submit-order
```

Ejemplo de respuesta:

```json
{
 "notifications": [
   { "channel": "email", "sent": true }
 ]
}
```

Esto permite ver el resultado del email automático.

---

# Modos de envío de pedidos

Configurable en:

```
src/app/core/config/order.config.ts
```

---

## Modo local

```
ORDER_SUBMISSION_MODE = 'local'
```

Guarda pedidos en **localStorage**.

---

## Modo Netlify

```
ORDER_SUBMISSION_MODE = 'netlify'
```

Usa:

```
/.netlify/functions/submit-order
```

---

## Modo Backend API (Render)

```
ORDER_SUBMISSION_MODE = 'api'
```

Envía pedidos a:

```
https://tu-backend.onrender.com/api/orders
```

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
