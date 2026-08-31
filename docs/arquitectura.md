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

## Envío de pedidos (canónico)

```text
Frontend → POST /api/orders → Netlify api-proxy → Express (Render)
  → validación + idempotencia + transacción Mongo
  → email Resend (solo si el pedido quedó persistido)
```

La Function de Netlify en este flujo es solo `api-proxy` (`/api/*` y `/sitemap.xml`).

Pagos: Mongo `payment_settings` es la fuente canónica. `PAYMENT_*` solo arranca la config si el documento aún no existe.

