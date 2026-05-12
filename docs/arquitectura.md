# Arquitectura propuesta (Fase 1)

## Frontend Angular

Capas sugeridas:

- `core/`: servicios singleton (api, storage, config)
- `features/catalog/`: catálogo y detalle
- `features/cart/`: carrito y resumen
- `features/checkout/`: formulario y confirmación
- `features/contact/`: solicitud de información
- `shared/`: componentes reutilizables

## Modelo de datos base

```ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  available: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CustomerInfo {
  fullName: string;
  phone: string;
  email?: string;
}

export interface DeliveryInfo {
  mode: 'delivery' | 'pickup';
  address?: string;
  reference?: string;
  preferredTime?: string;
}

export interface Order {
  id: string;
  customer: CustomerInfo;
  delivery: DeliveryInfo;
  items: CartItem[];
  notes?: string;
  subtotal: number;
  total: number;
  status: 'nuevo' | 'confirmado' | 'en preparación' | 'enviado' | 'entregado' | 'cancelado';
  createdAt: string;
}
```

## Envío de pedidos (sin pasarela)

### Opción A (rápida): Netlify Forms
- Pros: implementación rápida, sin backend propio.
- Contras: estructura menos flexible para lógica compleja.

### Opción B (recomendada): Netlify Functions
- Endpoint serverless para validar y registrar pedido.
- Permite integrar notificaciones y persistencia externa.

## Escalabilidad de fase 2

- Persistencia en Supabase/Firebase.
- Dashboard interno de pedidos.
- Contacto manual por WhatsApp mediante enlace wa.me, sin API automática.
- Historial de cliente y recompra.


## Backend recomendado (implementado en Netlify Function)

- Endpoint: `netlify/functions/submit-order.ts`.
- Persistencia: MongoDB Atlas (`MONGODB_URI`, `MONGODB_DB_NAME`).
- Notificaciones:
  - Email por Resend (si hay credenciales).
  - SMS por Twilio (si hay credenciales).
- Estado inicial del pedido al guardar: `nuevo`.
