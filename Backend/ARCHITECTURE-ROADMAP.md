# Backend refactor roadmap (cuentas + compra invitado + panel admin)

## Objetivo
Diseñar una base de backend donde convivan:
- compra como invitado
- compra con cuenta registrada
- control administrativo completo del ciclo de pedidos

## Lo implementado en esta iteración
- `POST /api/auth/register`: crea cuenta de cliente.
- `POST /api/auth/login`: login de cliente (token).
- `POST /api/auth/admin/login`: login de admin (credenciales por env).
- `POST /api/orders`: acepta pedido con o sin sesión (`accountMode: guest|registered`).
- `GET /api/admin/orders`: listado de pedidos (solo admin).
- `PATCH /api/admin/orders/:orderId/status`: cambio de estado con validación de firma en `entregado`.

## Estado de pedidos
- `nuevo`
- `enviado`
- `entregado` (requiere `deliverySignature`)
- `anulado`

Se persiste `statusHistory` para auditoría básica.

## Siguiente fase recomendada
1. **Panel admin frontend**
   - login admin
   - bandeja de pedidos (filtros por estado/fecha)
   - cambio de estado con modal de firma
2. **Modelo de datos**
   - colección `order_events` para auditoría completa (quién, cuándo, antes/después)
   - colección `sessions` (refresh tokens)
3. **Seguridad**
   - migrar admin hardcoded env a usuarios con rol admin en DB
   - rate limiting y bloqueo de intentos
   - hash de contraseñas con parámetros configurables
4. **Facturación e impuestos**
   - cálculo de IVA por línea en backend
   - snapshots de impuestos en cada pedido (tipo/tasa/base/cuota)
5. **Operación**
   - idempotencia en creación de pedido: implementada con índice único, fingerprint y transacción Mongo; pendiente validación E2E en staging
   - colas para notificaciones por email y reintentos


## Avance adicional (cliente)
- `GET /api/orders/me`: historial de pedidos del cliente autenticado (por `userId` y respaldo por email normalizado).
- `GET /api/auth/me`: validación/rehidratación de sesión de cliente en frontend.
- Vinculación automática de pedidos guest previos por email al momento de registro (`linkedOrders`).
