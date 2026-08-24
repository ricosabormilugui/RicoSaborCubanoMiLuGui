# Idempotencia y atomicidad de pedidos

Última revisión: 24/08/2026.

## Flujo anterior auditado

La creación no era atómica. El orden real era:

1. Validar payload, entrega y teléfono.
2. Leer productos y recalcular precios/personalizaciones.
3. Leer cliente y pedidos anteriores para validar `PRIMER10`.
4. Generar `orderId`.
5. Ejecutar `upsertCustomerFromOrder` fuera de transacción, incrementando contador, gasto y `orderIds`.
6. Insertar el pedido.
7. Marcar el cupón como usado.
8. Leer stock línea por línea y escribir el nuevo valor sin condición; configuraciones del mismo producto no se agregaban.
9. Enviar email y registrar el resultado.

Dos POST podían crear dos `orderId`. Además, un fallo entre los pasos 5–8 podía dejar cliente/cupón/stock/pedido parcialmente actualizado y dos pedidos concurrentes podían sobrepasar stock.

`api-proxy` y `submit-order` ya reenviaban `Idempotency-Key`, pero el frontend no lo generaba y el backend no lo consumía. `submit-order` requiere `BACKEND_API_URL` y toda creación termina en `POST /api/orders`; su código de email heredado no constituye una ruta de persistencia alternativa.

## Flujo nuevo

1. El frontend obtiene una clave por intención de compra.
2. Cada POST lleva un `X-Request-Id` nuevo y el mismo `Idempotency-Key` mientras la intención no cambie.
3. El backend valida la clave y calcula el fingerprint SHA-256 sin confiar en precios cliente.
4. Busca un pedido existente por clave.
5. Si no existe, abre `session.withTransaction()` con snapshot, `w: majority` y primary.
6. Dentro de la transacción repite el lookup y ejecuta validación canónica, cliente, cupón, stock e inserción.
7. Tras el commit registra `order_created` e intenta el email fuera de la transacción.
8. Un replay devuelve el pedido persistido sin repetir ninguna operación ni email.

No existe fallback silencioso sin transacción. Si Mongo no puede confirmar la unidad atómica, el endpoint responde 503 y registra `order_transaction_aborted`; no continúa con escrituras individuales.

## Clave y lifecycle frontend

- Formato backend: 8–128 caracteres, primer carácter alfanumérico y resto limitado a letras, números, `.`, `_`, `:` y `-`.
- Generación: `order_${crypto.randomUUID()}`; `getRandomValues` actúa como fallback criptográfico.
- Nace en el primer envío del checkout.
- Se guarda en `sessionStorage` junto a un hash local no reversible de la intención, por pestaña.
- Timeout, red, 502, 504 o error de negocio conservan la clave si el payload material no cambia.
- Cambiar items, cantidades, personalizaciones, cliente, entrega, cupón, notas o pago crea una intención nueva.
- Cambiar únicamente importes enviados no crea una intención nueva: el backend siempre recalcula.
- Tras cualquier éxito, incluido replay, el checkout limpia carrito y después descarta la intención.

`X-Request-Id` no se reutiliza como clave: identifica una petición; `Idempotency-Key` identifica la compra lógica.

## Fingerprint autoritativo

El backend construye una representación estable, ordena campos/items/personalizaciones y calcula SHA-256. Incluye:

- modo guest o ID/email del usuario autenticado;
- nombre, teléfono y email normalizados;
- producto base, cantidad y opciones;
- tipo, fecha, franja, dirección, CP y referencia;
- notas, cupón y método de pago;
- consentimientos de la intención.

Excluye `unitPrice`, `basePrice`, subtotal, envío/total enviado, `requestId`, timestamps y metadatos de presentación. El usuario autenticado forma parte del fingerprint, por lo que una clave no puede reutilizar el pedido de otro usuario.

## Persistencia e índice

Cada pedido nuevo guarda opcionalmente para históricos:

- `idempotencyKey`;
- `requestFingerprint`.

Índice en `orders`:

```text
name: orders_idempotencyKey_unique
key: { idempotencyKey: 1 }
unique: true
partialFilterExpression: { idempotencyKey: { $type: "string" } }
```

El índice parcial ignora pedidos antiguos sin campo; no requiere backfill ni migración destructiva. Tras crearlo se inspecciona su definición y el backend falla si el índice crítico no es realmente único/parcial. Las claves se conservan indefinidamente junto al pedido: no se usa TTL para impedir que una compra histórica vuelva a admitirse al expirar.

## Replay y conflictos

- Primera creación: `201 Created`, `idempotentReplay: false`.
- Misma clave + mismo fingerprint: `200 OK`, `Idempotent-Replay: true`, `idempotentReplay: true` y mismo `orderId`.
- Misma clave + fingerprint distinto: `409 Conflict`, código `IDEMPOTENCY_CONFLICT`.
- Clave ausente o inválida: `400`, código `INVALID_IDEMPOTENCY_KEY`.

El header de replay se expone por CORS y se conserva tanto en `api-proxy` como en `submit-order`. No existe endpoint público de búsqueda por clave.

## Concurrencia y transacción

La colección y el índice son compartidos entre reinicios/réplicas. Dos solicitudes simultáneas pueden iniciar con lookup vacío, pero:

- los writes concurrentes de cliente/stock producen conflicto transaccional y el driver reintenta la transacción;
- el índice único impide dos inserts con la misma clave;
- tras una colisión se vuelve a leer el pedido confirmado: mismo fingerprint produce replay y distinto produce 409.

La transacción incluye:

1. lectura canónica de productos/precios/opciones;
2. validaciones finales de entrega y cupón;
3. upsert/contadores del cliente;
4. consumo condicionado del cupón;
5. decremento condicionado y agregado de stock;
6. inserción de pedido, clave y fingerprint.

Mongo configurado respondió `replicaSet=true`, sesiones lógicas disponibles y `maxWireVersion=25`, por lo que soporta transacciones. También se verificó mediante una transacción de solo lectura que la sesión entra realmente en estado transaccional. Esta comprobación no mostró URI, hosts ni secretos.

## Stock y personalizados

El identificador se resuelve con `baseProductId` o con la parte anterior a `::`; nunca se usa el ID sintético de configuración como `_id` Mongo. Antes de escribir se agregan las cantidades de todas las configuraciones del mismo producto base.

Para productos con `trackStock=true` se ejecuta un `findOneAndUpdate` condicionado por `stock >= cantidad` y un pipeline que decrementa y actualiza `available`. Stock insuficiente genera 409 y aborta toda la transacción. Los productos sin seguimiento no se decrementan.

## Cupón y cliente

La validación de `PRIMER10` lee cliente, pedidos previos y redenciones dentro de la sesión. El upsert de cliente y el cambio de cupón a `used` usan la misma sesión. El consumo está condicionado a que ninguno de los campos compatibles figure ya como usado. Si el cupón cambia concurrentemente, la transacción se reintenta o aborta; nunca queda consumido sin pedido.

Un replay no entra en la unidad de trabajo, por lo que no incrementa cliente ni consume otra vez el cupón.

## Email

El email no participa en la transacción:

```text
commit → order_created → email → historial de notificación → respuesta
```

Si Resend falla, pedido, clave, fingerprint, cupón y stock permanecen confirmados y la respuesta conserva `email-not-sent`. Un replay posterior no reenvía automáticamente el mensaje, incluso si el fallo ocurrió después del commit.

## Observabilidad

Eventos estructurados:

- `order_created` con `requestId`, `orderId` y referencia hash de la clave;
- `order_idempotent_replay` con `requestId`, `orderId` y `replay=true`;
- `order_idempotency_conflict` con `requestId` y referencia hash;
- `order_transaction_aborted` con `requestId`, referencia hash y error sanitizado.

La clave completa no se registra. La referencia es un prefijo SHA-256 irreversible.

## Pruebas

La suite cubre los 20 casos solicitados: creación, replay, conflicto, carrera simultánea, timeout, stock suficiente/insuficiente/concurrente, agregación de personalizados, cupón commit/rollback/replay, email correcto/fallido/sin reenvío y lifecycle frontend.

Las pruebas unitarias usan almacenes y sesiones controlados, sin escribir pedidos reales. En Mongo configurado se creó/verificó `orders_idempotencyKey_unique` como único y parcial por tipo string, y una transacción read-only confirmó soporte real. No se insertaron pedidos ni se modificaron productos, clientes o cupones. La carrera definitiva debe repetirse contra Mongo staging aislado y verificar un único documento, un único decremento, un único consumo y un único email.

## Limitaciones pendientes

- Falta E2E concurrente en staging real porque ese entorno externo sigue sin provisionarse.
- Si la topología se cambia en el futuro a Mongo standalone, la creación fallará de forma segura con 503 hasta restaurar replica set/Atlas; no degradará a atomicidad parcial.
- Una caída tras commit y antes del email puede dejar la notificación pendiente. El replay no reenvía por diseño; cualquier política de reenvío debe ser una operación administrativa separada.
