# Rico Sabor Cubano · Tienda Web (Angular + TypeScript + Netlify)

Este repositorio contiene la propuesta inicial para construir una tienda web **sin pasarela de pago** en esta primera etapa, enfocada en:

- Mostrar productos por categorías.
- Gestionar carrito de compras.
- Permitir checkout y enviar pedido automáticamente.
- Recibir solicitudes de información de clientes.
- Mantener una operación interna fluida (pedidos, estados y atención).

## Objetivo de Fase 1

Lanzar una versión funcional (MVP) para captar pedidos y consultas:

1. El cliente agrega productos al carrito.
2. Completa checkout (datos de contacto, entrega, notas).
3. El pedido se envía automáticamente.
4. El equipo recibe pedido + notificación y lo gestiona internamente.

> En esta fase no se procesa pago online; se puede cerrar por transferencia, efectivo o pago contra entrega.

## Stack recomendado

- **Frontend:** Angular (standalone + routing) + TypeScript
- **Estilos:** SCSS + diseño responsive mobile-first
- **Hosting:** Netlify
- **Automatización de pedidos:** Netlify Forms o Netlify Functions
- **Notificaciones:** Email (Netlify notifications / integración con Zapier o Make)
- **Analítica:** Plausible o GA4

## Módulos funcionales

### 1) Catálogo
- Listado por categorías (ej: combos, bebidas, extras).
- Filtro por nombre/categoría.
- Ficha de producto (foto, descripción, precio, disponibilidad).

### 2) Carrito
- Agregar/eliminar productos.
- Modificar cantidades.
- Cálculo de subtotal y total.

### 3) Checkout (sin pago)
- Datos del cliente: nombre, teléfono, email.
- Datos de entrega: dirección, referencia, horario.
- Método de entrega: domicilio / recoger.
- Notas del pedido.
- Confirmación final.

### 4) Solicitud de información
- Formulario independiente de contacto.
- Captura motivo de consulta.
- Confirmación de envío al usuario.

### 5) Gestión interna
- Estructura de estado del pedido:
  - `nuevo`
  - `confirmado`
  - `en preparación`
  - `enviado`
  - `entregado`
  - `cancelado`

## Ideas de flujo operativo (recomendación)

- Al enviar checkout:
  - Guardar pedido en backend liviano (Netlify Function -> base de datos externa en fase 2, o email/hoja de cálculo en fase 1).
  - Disparar email automático al equipo.
  - Mostrar al cliente un número de pedido.

- Para atención fluida:
  - Definir SLA de confirmación (ej: &lt; 10 min).
  - Plantillas para WhatsApp/email.
  - Etiquetado por zona de entrega.

## Roadmap sugerido

1. **Sprint 1 (MVP visual):** catálogo + carrito + checkout UI.
2. **Sprint 2 (automatización):** envío de pedido y solicitudes de info por Netlify.
3. **Sprint 3 (operación):** panel interno básico o integración con Airtable/Sheets.
4. **Sprint 4 (optimización):** cupones, stock, métricas de conversión.

## Despliegue en Netlify (propuesta)

1. Conectar repositorio a Netlify.
2. Configurar build de Angular:
   - Build command: `npm run build`
   - Publish directory: `dist/ricosabor-tienda/browser`
3. Añadir redirección SPA (`/* -> /index.html`).
4. Configurar forms/functions según estrategia de pedidos.

Ver archivos en `docs/` para arquitectura y flujos detallados.
