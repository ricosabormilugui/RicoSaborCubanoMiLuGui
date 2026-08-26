# Centro de notificaciones persistentes · MIXSABOR

> Ampliación posterior: la campana ya admite invitados mediante una fuente local separada. Ver `docs/local-notification-history.md`. El comportamiento autenticado y el backend de este informe se mantienen; las referencias siguientes a una campana exclusivamente autenticada describen la fase original.

Implementación local del 26/08/2026. Complementa los toasts y diálogos descritos en `docs/notifications.md`.

## Uso

La campana aparece en la cabecera, junto al carrito, **solo con sesión iniciada**. Sin avisos pendientes sigue visible, sin badge. El panel muestra los cinco últimos avisos. El historial privado está en `/mis-notificaciones`, también accesible desde Cuenta y el menú lateral.

Una sesión cerrada no muestra campana, contador ni contenido anterior. No se generan avisos ficticios para rellenar un historial vacío. Los pedidos anteriores a esta implementación no se convierten automáticamente en notificaciones.

## Auditoría y decisiones

El proyecto usa Angular 20 con componentes standalone, Signals, Lucide y rutas diferidas; Express y MongoDB en el backend. Se reutilizan `requireAuth`, `req.auth.sub`, el cliente Mongo compartido, las transacciones de pedidos, los tokens de tema y el cliente HTTP con timeout.

El campo canónico del destinatario es `orders.userId`. `customerId` identifica el registro comercial, no la cuenta autenticada. La creación de pedidos tenía un spread del formulario que podía conservar un `userId` enviado por un invitado: ahora la identidad del servidor lo sobrescribe siempre con el sujeto del JWT o con `null`. La identidad empleada por el fingerprint de idempotencia coincide también para clientes y administradores autenticados.

No se modifican precios, stock, portes, cupones, reglas de entrega o pago. Los emails existentes se mantienen. Las notificaciones persistentes de pedidos sí se incorporan a la misma transacción: un fallo al escribirlas impide confirmar parcialmente esa operación.

## Modelo y almacenamiento

Colección: `notifications`, en la base configurada mediante las variables Mongo existentes.

| Campo | Uso |
| --- | --- |
| `_id` | ObjectId de Mongo, expuesto como `id` string |
| `userId` | Sujeto de la cuenta destinataria, string |
| `eventKey` | Clave interna del evento para evitar duplicados |
| `type` | `order`, `account`, `system`, `promotion`, `warning` o `info` |
| `title`, `message` | Texto plano, máximo 120 y 500 caracteres |
| `read`, `readAt` | Booleano y fecha ISO de primera lectura, o null |
| `createdAt` | Fecha UTC ISO, creada por el servidor |
| `action` | `{ label, url }` o null |
| `entity` | `{ type, id }` o null |

La respuesta pública excluye `userId` y `eventKey`. No se guardan direcciones, emails, firmas, contenidos completos del pedido, contraseñas, hashes ni tokens en los avisos. No se añade almacenamiento de notificaciones en localStorage/sessionStorage.

Índices:

1. `{ userId: 1, createdAt: -1, _id: -1 }`.
2. `{ userId: 1, read: 1, createdAt: -1, _id: -1 }`.
3. `{ userId: 1, type: 1, createdAt: -1, _id: -1 }`.
4. `{ userId: 1, eventKey: 1 }`, único.

La inicialización es idempotente, reintenta tras fallo y comprueba que el índice único existe con la configuración requerida. La preparación de la colección se realiza fuera de las transacciones de pedidos. No hay TTL ni eliminación automática por antigüedad.

## API privada

Todas las rutas usan el middleware JWT existente y exigen un `sub` no vacío. Los parámetros/body nunca seleccionan el propietario. Las respuestas autenticadas llevan `Cache-Control: private, no-store`.

| Método y ruta | Respuesta |
| --- | --- |
| `GET /api/notifications` | `{ notifications, nextCursor }` |
| `GET /api/notifications/unread-count` | `{ unreadCount }` |
| `PATCH /api/notifications/:id/read` | `{ notification }` |
| `PATCH /api/notifications/read-all` | `{ updated }` |
| `DELETE /api/notifications/:id` | 204 |

Listado: `limit` entre 1 y 50, por defecto 20; filtros opcionales `read=true/false`, `type`; `cursor` opaco con fecha y ObjectId. Se ordena por fecha e ID descendentes, con consulta por cursor y una fila adicional para detectar la siguiente página. No se usa offset ni se descarga todo el historial. Los filtros y cursores inválidos devuelven 400.

La lectura repetida conserva la primera fecha `readAt`. Marcar todas solo actualiza los avisos sin leer de esa cuenta. La eliminación es física e individual. No se implementa la eliminación masiva opcional ni un endpoint público para crear avisos.

## Aislamiento e IDOR

Cada consulta de listado, contador, lectura, lectura masiva y borrado contiene `userId`. Las operaciones por ID incluyen simultáneamente `_id` y `userId`; no se recupera primero un aviso ajeno para autorizarlo después. Un ID ajeno, inexistente o mal formado produce la misma respuesta 404. Ser administrador no permite consultar las notificaciones de otros usuarios a través de esta API.

El texto se renderiza con interpolación Angular, sin HTML. Las acciones se limitan en frontend a `/mis-pedidos`, `/mis-notificaciones` y `/contacto`; se rechazan URLs externas y esquemas ejecutables.

## Eventos conectados

| Evento real | Notificación | Persistencia |
| --- | --- | --- |
| Pedido nuevo de una cuenta | Pedido recibido | Misma transacción de pedido/stock/cupón |
| Estado `confirmado` | Pedido confirmado | Misma transacción del cambio |
| Estado `preparando` | Estamos cocinando | Misma transacción del cambio |
| Estado `listo` | Pedido listo | Misma transacción del cambio |
| Estado `enviado` | Pedido en camino | Misma transacción del cambio |
| Estado `entregado` | Pedido entregado | Misma transacción del cambio |
| Estado `cancelado` / `anulado` | Pedido cancelado / anulado | Misma transacción del cambio |
| Recuperación de contraseña completada | Contraseña actualizada | Después de cambiar la contraseña; fallo registrado sin invalidar el cambio |

Los avisos de pedidos enlazan a `/mis-pedidos`, porque no existe una ruta de detalle individual. No incluyen notas administrativas ni la firma de entrega. El aviso de contraseña ofrece Contactar y no contiene material de recuperación.

No se persisten eventos de añadir al carrito, guardar formularios, filtros, errores temporales o inicio/cierre de sesión. Los tipos system/promotion/warning/info quedan disponibles para eventos futuros, sin inventar emisores o campañas.

## Idempotencia y concurrencia

La creación idempotente existente no vuelve a ejecutar la unidad transaccional en una repetición. El evento de estado usa `order:<orderId>:status:<longitud de statusHistory>` y un upsert protegido por índice único. La actualización de estado añade el filtro `status != nextStatus`, de modo que una repetición concurrente no inserta otra entrada ni otro aviso para el mismo cambio. Un cambio que ya no se puede aplicar devuelve 409 para recargar la lista.

El aviso de contraseña usa una clave de evento aleatoria; el token de recuperación se consume mediante el mecanismo existente, por lo que repetirlo no vuelve a emitir el evento. Esta notificación de cuenta no es atómica con la actualización de contraseña: si Mongo falla después del cambio, se registra `account.notification.failed`. No se informa al usuario de que falló una contraseña que ya fue actualizada.

## Invitados y pedidos históricos

Un invitado conserva el flujo de email y no recibe un destinatario ficticio. No se busca el propietario de un aviso mediante email ni teléfono. El mecanismo preexistente de vincular pedidos invitados al registrarse se conserva, sin crear avisos retroactivos. Si después un pedido ya vinculado cambia de estado, usa el `userId` persistido de ese pedido.

La política preexistente de vinculación por email no se rediseña aquí. Cualquier endurecimiento de su verificación debe tratarse en el flujo de cuentas, no mediante búsquedas de email dentro del centro de notificaciones.

## Estado frontend y errores

`UserNotificationsService` es independiente del servicio de toasts. Mantiene Signals para los últimos cinco avisos, historial, cursor, contador, carga, error y bloqueo de acciones. Se inicializa con la sesión; refresca el contador al navegar, abrir el panel y completar acciones. No se incorporan WebSockets, polling ni otra infraestructura en tiempo real.

La clave de sesión incluye versión, usuario y token. Los computed ocultan datos de otra sesión inmediatamente, antes de que se ejecute el effect de limpieza. Las respuestas pendientes se comparan con esa clave y con secuencias por listado/contador; las obsoletas se descartan. Logout, login y una restauración tardía no pueden restaurar datos de una sesión previa.

Las mutaciones esperan confirmación del servidor; no hay estado optimista que deba revertirse. Tras el éxito se reconcilian contador y listas. Un fallo conserva el estado previo, muestra un error comprensible y permite reintentar. 401/403 de la sesión vigente la cierran; una respuesta 401 antigua no cierra una sesión nueva. Fallos de red/5xx no invalidan la cuenta.

Después de una mutación, el historial vuelve a su primera página con el filtro activo. Las páginas posteriores pueden volver a cargarse. No hay caché persistida de datos privados.

## Interfaz y accesibilidad

- Campana Lucide, controles de 44 px, badge oculto en cero y acotado visualmente a `99+`; el nombre accesible indica el total real.
- Panel basado en `<dialog>.showModal()`, foco inicial en cerrar, Tab/Shift+Tab circulares, Escape, clic exterior y retorno al disparador.
- Fondo inerte mediante el diálogo nativo, scroll de página bloqueado/restaurado y cierre al navegar o cambiar de sesión.
- Últimos cinco avisos con tipo, título, mensaje, fecha local, estado leído y acciones.
- Historial con Todas/Sin leer/Pedidos/Cuenta, carga adicional y estados vacío/cargando/error.
- El enlace de acción marca leído antes de navegar. Si la escritura falla, no navega.
- Tokens existentes de color y tema; panel con scroll interno, safe areas y ancho móvil sin desbordamiento.
- Ruta privada con guard, `noindex,nofollow`, y exclusión añadida a robots.txt; no se incorpora al sitemap.
- Campana cargada de forma diferida al autenticarse e historial lazy. No se añaden dependencias.

## Verificación realizada

| Verificación | Resultado |
| --- | --- |
| `npm test` en raíz | 91/91 |
| `npm test` en Backend | 97/97 |
| `npm run build` | Correcto, sin advertencias de presupuesto |
| Bundle inicial | 499,66 kB; transferencia estimada 127,50 kB |
| `git diff --check` | Correcto |

Las pruebas backend ejecutan Express y el middleware JWT reales sobre HTTP local con un adaptador de colección en memoria. Cubren autenticación, A/B, IDs ajenos, propietario falso en query/body, lectura idempotente, lectura masiva, borrado, contadores, paginación con fechas iguales, filtros, eventos e integración con la sesión transaccional. No constituyen una prueba contra un replica set Mongo real.

Las pruebas frontend ejecutan los servicios TypeScript con Signals reales y transporte simulado: badge, acciones seguras, cambios de cuenta, respuestas tardías, filtros, paginación, errores, endpoints de mutación, concurrencia y restauración tardía de sesión.

La revisión en navegador usó una instancia aislada en el puerto 4201 con componentes reales y datos ficticios, sin credenciales ni escrituras en el backend. Se verificaron campana en cabecera, temas claro/oscuro, panel a 320×740 sin desbordamiento, foco, Tab/Shift+Tab, Escape, lectura individual/masiva, badge cero, historial 20→25 elementos, filtros, estado vacío, cambio A→B→logout, error/reintento y navegación a Mis pedidos. La configuración y los archivos temporales de esa instancia se retiraron, y el proceso se detuvo antes del build final.

## Archivos principales de esta fase

Backend nuevos:

- `Backend/src/repositories/notifications.repository.js`
- `Backend/src/routes/notifications.routes.js`
- `Backend/src/services/user-notification.service.js`
- `Backend/src/migrations/2026-08-26-notifications-indexes.js`
- `Backend/test/notifications.test.js`

Backend integraciones:

- `Backend/src/app.js`
- `Backend/src/controllers/orders.controller.js`
- `Backend/src/repositories/orders.repository.js`
- `Backend/src/services/order-unit-of-work.service.js`
- `Backend/src/services/order-idempotency.service.js`
- `Backend/src/services/password-recovery.service.js`
- `Backend/test/password-recovery.test.js`

Frontend nuevos:

- `src/app/core/notifications/user-notification.types.ts`
- `src/app/core/services/user-notifications.service.ts`
- `src/app/core/guards/customer.guard.ts`
- `src/app/shared/ui/notification-bell.component.ts` y `.scss`
- `src/app/shared/ui/user-notification-list.component.ts`
- `src/app/features/account/my-notifications-page.component.ts`
- `test/user-notifications.test.mjs`

Frontend integraciones: `src/app/app.component.ts`, `src/app/app.routes.ts`, `src/app/core/services/customer-auth.service.ts`, `public/robots.txt`.

Los cambios de la fase anterior de toasts se conservan; no se han hecho commits ni despliegues.

## Activación y límites pendientes

1. Arrancar/reiniciar el backend con estos cambios. En desarrollo, el frontend apunta a `http://localhost:3001`; `npm run dev` en Backend vigila los archivos, mientras que `npm start` requiere reinicio manual.
2. MongoDB debe disponer del soporte transaccional ya requerido por pedidos y de permisos para crear la colección e índices. Se inicializan automáticamente al primer uso. Opcionalmente, desde Backend: `node src/migrations/2026-08-26-notifications-indexes.js` con el entorno correcto.
3. Recargar el frontend e iniciar sesión. La campana estará visible aunque el historial esté vacío. Un pedido nuevo autenticado o un cambio real de su estado generará el aviso.
4. Antes de desplegar, comprobar en staging con dos cuentas y un replica set real el alta, la persistencia tras recarga, el aislamiento y los índices activos. Esta validación de infraestructura y el despliegue no se realizaron en esta tarea.

No hay push, notificaciones del sistema operativo, tiempo real, eliminación masiva, migración de eventos históricos ni política de retención. La notificación de contraseña puede perderse si falla su escritura posterior; un outbox sería una mejora futura si se exige entrega garantizada para ese evento. El presupuesto inicial de 500 kB sigue respetándose, pero queda poco margen para incorporar más código a la carga inicial.
