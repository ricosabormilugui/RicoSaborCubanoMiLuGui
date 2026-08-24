# Hardening de producción de MIXSABOR

## Objetivo

Esta capa mejora diagnóstico, disponibilidad y seguridad operativa sin introducir servicios externos ni cambiar reglas comerciales. No añade SSR, Redis, colas, Sentry, Prometheus ni una CSP que pueda romper Angular o los recursos de imágenes actuales.

## Health y readiness

- `GET /api/health`: liveness. Confirma que Express responde, sin depender de Mongo.
- `GET /api/ready`: readiness. Ejecuta `ping` contra Mongo; responde `200` con `database: "ok"` o `503` con `database: "unavailable"`.
- `GET /health`: compatibilidad para proveedores de hosting; redirige con `307` a `/api/health`.

Las respuestas incluyen `status`, `service`, `timestamp`, una versión pública corta y `X-Request-Id`. Nunca incluyen URI, host, credenciales ni mensajes de Mongo.

## Request ID y logs

Se acepta `X-Request-Id` únicamente con 8–128 caracteres seguros (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`). Si falta o es inválido se genera UUID. El identificador aparece en la respuesta, en errores y en logs.

Cada petición API terminada genera JSON de una sola línea:

```json
{"timestamp":"...","level":"info","event":"http.request.completed","requestId":"...","method":"GET","path":"/api/products","statusCode":200,"durationMs":42}
```

Las query strings y bodies no se registran. Claves sensibles se redactan; email y teléfono se enmascaran si algún evento los incluye. Los errores internos conservan nombre, mensaje y stack solo en logs. Una petición que supera `SLOW_REQUEST_THRESHOLD_MS` genera `warn`, no un error.

## Respuestas de error

Las rutas API desconocidas devuelven JSON `404`. Todos los errores incluyen `requestId`. Los `500/502/503/504` emitidos en JSON se normalizan para no exponer stack, URI interna o mensaje de driver. Los códigos funcionales existentes `400`, `401`, `403`, `404`, `409` y `429` se conservan junto con sus datos útiles.

El middleware global es la última capa de Express. Los controladores antiguos que ya traducen errores siguen funcionando; cualquier excepción que alcance Express termina en el mismo formato seguro.

## MongoDB

- Se reutiliza una sola conexión y una sola promesa de conexión concurrente.
- Una conexión fallida se elimina para permitir reconexión posterior; no queda un cliente roto cacheado.
- `serverSelectionTimeoutMS`, `connectTimeoutMS` y tamaño máximo del pool son configurables.
- Readiness usa `ping` con `maxTimeMS`.
- SIGTERM/SIGINT cierran primero el servidor HTTP y luego Mongo.
- Los índices existentes siguen creándose de forma idempotente y sus conflictos conocidos se registran como warning.

## Startup y variables

El proceso valida antes de escuchar:

- `MONGODB_URI` (o alias `MONGO_URI`) y ausencia de placeholders;
- `AUTH_TOKEN_SECRET`/`AUTH_JWT_SECRET`, mínimo 32 caracteres;
- `FRONTEND_URL` si se configura;
- `CORS_ORIGIN` o `FRONTEND_URL` obligatorio en producción, nunca `*`;
- grupo Resend completo si el email está habilitado;
- límites y timeouts numéricos válidos.

El log de startup muestra entorno, puerto, nombre lógico de base, email habilitado, límite JSON y si CORS está configurado. No muestra valores secretos. Los defaults y variables opcionales están en `.env.example` y `Backend/.env.example`.

## CORS y headers

En producción solo se aceptan los orígenes separados por coma de `CORS_ORIGIN` (o `FRONTEND_URL`). Desarrollo puede usar wildcard. Se permiten `Authorization`, `X-Request-Id` e `Idempotency-Key`; se exponen `X-Request-Id` y `Retry-After`.

Headers aplicados:

- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` sin cámara, micrófono ni geolocalización;
- HSTS durante HTTPS en producción;
- `X-Powered-By` deshabilitado.

CSP queda pendiente de una medición completa de Angular, Cloudinary, imágenes externas y Netlify; no se aplica una política incompleta.

## Payloads, rate limits y timeouts

- JSON: `1mb` por defecto, configurable mediante `JSON_BODY_LIMIT`. No existen uploads binarios en esta API.
- Login cliente/admin: 10 intentos por 15 minutos por combinación IP/identidad hash.
- Contacto: 10 por 15 minutos.
- Newsletter: 10 por 15 minutos.
- Password reset mantiene sus límites por email/IP y su respuesta genérica `202` para evitar enumeración.
- Catálogo, Home, health y sitemap no tienen rate limit agresivo.

Los `429` incluyen `Retry-After` y un mensaje público estable. Los buckets son en memoria, acotados a 10.000 entradas y se reinician con cada instancia; para el volumen actual evitan una dependencia nueva, pero no coordinan múltiples réplicas.

Resend aborta a los 8 s por defecto. Netlify aborta el backend a los 10 s y diferencia timeout (`504`) de backend inaccesible (`502`). El proxy conserva cuerpo y content type, incluido XML del sitemap, y propaga 4xx/5xx, cache, `Retry-After` y request ID sin revelar la URL interna.

## Pedidos y correo

El flujo efectivo es:

1. validar y recalcular pedido en backend;
2. persistir pedido;
3. aplicar efectos posteriores existentes (cupón/stock);
4. intentar Resend;
5. registrar auditoría de notificación;
6. responder `201` aunque el email falle, con `email-not-sent`.

Un fallo de Resend no borra el pedido ni produce un falso fallo de creación. Password reset conserva la política distinta: si falla su email, elimina el token pendiente.

El checkout solo vacía carrito después de una respuesta de éxito. En red, timeout o 5xx conserva carrito/formulario y permite reintento. El riesgo de doble pedido continúa: el botón se deshabilita durante la petición y no hay retry automático, pero no existe todavía idempotencia transaccional. Añadir `Idempotency-Key` de forma correcta requiere coordinar inserción, cupón y stock en una transacción o un estado de operación; el proxy ya está preparado para propagar el header, pero el backend no lo consume aún.

## Frontend y estados de error

La capa común genera `X-Request-Id`, aplica timeout y distingue:

- red/offline;
- timeout;
- `401` sesión expirada;
- `403` permisos;
- `404` recurso;
- `409` conflicto;
- `429` demasiados intentos;
- `5xx` servicio temporalmente no disponible.

Restaurar sesión solo elimina auth con `401/403`; una caída o `5xx` no cierra una sesión válida. Catálogo conserva cache/fallback, muestra que no pudo actualizar y ofrece reintento, evitando presentar una lista vacía como catálogo real.

## Shutdown y errores de proceso

SIGTERM/SIGINT dejan de aceptar conexiones, esperan las requests activas hasta `SHUTDOWN_TIMEOUT_MS`, cierran Mongo y terminan. `unhandledRejection` y `uncaughtException` se registran y provocan shutdown con código 1; el proceso no continúa en estado potencialmente corrupto.

## Cache

- Productos/categorías frontend: 5 minutos; el usuario puede forzar reintento.
- Sitemap backend: 10 minutos.
- Si refrescar sitemap falla y hay cache, se sirve la versión stale con `Warning: 110`, cache corto de 60 s y `stale-if-error=3600`.
- Sin cache inicial y con Mongo caído, sitemap responde `503` sin exponer la dependencia.

## Diagnóstico básico

```bash
curl -i https://api.example.com/api/health
curl -i https://api.example.com/api/ready
curl -i -H "X-Request-Id: incident-2026-001" https://api.example.com/api/products
```

Para investigar una incidencia: copiar `X-Request-Id` de la respuesta, buscarlo en logs estructurados y revisar el evento `http.request.completed`/`http.request.failed` asociado.

## Deuda pendiente

- Idempotencia transaccional de pedidos y consistencia atómica de pedido/cupón/stock.
- Rate limiting compartido si se ejecutan varias réplicas o el volumen crece.
- CSP tras inventariar todos los orígenes efectivos en producción.
- Monitor externo de `/api/health` y `/api/ready`; no se incorpora proveedor desde el código.
- Métricas agregadas y alertas pueden añadirse más adelante consumiendo los logs JSON, sin cambiar su formato.
