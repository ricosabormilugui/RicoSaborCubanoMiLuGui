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
   - idempotencia en creación de pedido
   - colas para notificaciones (email/whatsapp) y reintentos
