# MIXSABOR: alertas, notificaciones y confirmaciones

Fecha de verificación: 26 de agosto de 2026.

## 1. Auditoría del sistema anterior

La aplicación ya tenía un `NotificationService` con un array Signal, cuatro tipos y temporizadores propios, y un único `NotificationsComponent` en la raíz. No había loading persistente, actualización por ID, acciones ni deduplicación.

Se encontraron **tres llamadas a `globalThis.confirm`**, ninguna llamada funcional a `alert` o `prompt`, y un diálogo local de eliminación de categorías. La búsqueda inicial incluyó los mensajes en Signals, no solo asignaciones `errorMessage`/`successMessage`.

| Clasificación | Ejemplos encontrados | Tratamiento |
| --- | --- | --- |
| Notificaciones transitorias | Resultado de guardar, borrar, copiar, responder, suscribirse, autenticar y añadir al carrito | Servicio global; retirados los banners de resultado duplicados |
| Validación contextual | Campos de checkout/contacto, pasos del producto, nombre de categoría, email y política de contraseñas | Se conserva inline |
| Información persistente | Número de pedido e instrucciones de pago, borrador local, recuperación de contraseña enviada, token inválido | Se conserva en la página |
| Errores persistentes de carga | Catálogo, historial, tablas administrativas, panel de cocina | Se conservan inline y se normaliza el texto; no generar toasts en cada sondeo |
| Confirmaciones | Producto, pedido, reversión del pago y categoría | ConfirmDialog global |
| Estado ocupado | Carga de tablas y botones de formularios | Se conserva; operaciones principales añaden loading → resultado con el mismo ID |

## 2. Librería instalada

**ngx-sonner 3.1.0**, fijada en `package.json` y `package-lock.json`.

Antes de instalar se consultaron sus peer dependencies con `npm view`: `@angular/common >=19.0.0`, `@angular/core >=19.0.0`. Son compatibles con Angular 20.3 del proyecto. El build y la prueba en navegador verifican la integración efectiva.

Fuentes del proveedor: [repositorio y documentación](https://github.com/tutkli/ngx-sonner), [paquete npm](https://www.npmjs.com/package/ngx-sonner).

## 3. Motivo de elección

Cumple la preferencia solicitada y proporciona iconos, carga, acciones, cierre, apilado, actualización, anuncios live y gestión de temporizadores. No fue necesario adoptar otra librería ni instalar Angular CDK. El diálogo usa `<dialog>.showModal()` para la capa modal e inactividad del fondo, además del control de teclado y scroll del componente.

## 4. Arquitectura y uso

Se reutiliza la ruta original del servicio para evitar imports de proveedor en las páginas:

```text
Páginas → core/services/notification.service.ts → ngx-sonner (carga diferida)
Raíz → shared/ui/notifications.component.ts → un único NgxSonnerToaster
Páginas → core/services/confirm-dialog.service.ts → un único ConfirmDialogComponent
```

Los tipos y duraciones se centralizan en `core/notifications`. Sonner se importa dinámicamente y su contenedor usa `@defer (on immediate)`, sin perder llamadas anteriores a su carga ni cambiar la API síncrona de IDs.

```ts
const id = this.notifications.loading('Guardando producto…', undefined, { key: 'product-save' });
try {
  await guardar();
  this.notifications.updateSuccess(id, 'Producto guardado');
} catch (error) {
  this.notifications.updateError(id, 'No se pudo guardar', getUserFriendlyError(error));
}

this.notifications.success('Producto añadido', producto.name, {
  key: `cart-add:${producto.id}`,
  action: { label: 'Ver carrito', handler: () => this.router.navigateByUrl('/carrito') }
});

const confirmed = await this.confirmDialog.open({
  title: 'Eliminar producto',
  message: 'Esta acción no se puede deshacer.',
  confirmText: 'Eliminar',
  variant: 'danger'
});
if (!confirmed) return;
```

API: `success`, `error`, `warning`, `info`, `loading`, `updateSuccess`, `updateError`, `dismiss` y `dismissAll`. `NotificationOptions` admite `id`, `key`, `duration` y `action: { label, handler }`. El handler admite resultados asíncronos y sus rechazos se normalizan.

Duraciones: success 3500 ms; info 4000 ms; warning 5500 ms; error 7000 ms; loading infinito, sin cierre manual. Se pueden sobrescribir con `duration`.

Deduplicación: ID explícito, clave de operación o combinación tipo/título/descripción. No se mantiene un segundo historial de notificaciones. Las actualizaciones limpian las acciones previas cuando no se proporciona otra. Un loading repetido no reinicia un temporizador infinito de Sonner 3.1.

El diálogo devuelve `Promise<boolean>`. Una segunda solicitud mientras existe un diálogo abierto devuelve false; no se encolan acciones destructivas. Escape es configurable y navegar cancela la confirmación pendiente.

## 5. Archivos nuevos

- `src/app/core/notifications/notification.types.ts`
- `src/app/core/notifications/notification.config.ts`
- `src/app/core/notifications/notifications.scss`
- `src/app/core/services/confirm-dialog.service.ts`
- `src/app/core/utils/user-friendly-error.ts`
- `src/app/shared/ui/confirm-dialog.component.ts`
- `src/app/shared/ui/confirm-dialog.component.html`
- `src/app/shared/ui/confirm-dialog.component.scss`
- `test/notifications.test.mjs`
- `docs/notifications.md`

## 6. Archivos modificados

Dependencias y raíz: `package.json`, `package-lock.json`, `src/styles.scss`, `src/app/app.component.ts`.

Infraestructura: `src/app/core/services/{notification,catalog,customer-auth}.service.ts`, `src/app/core/utils/api-client.ts`, `src/app/shared/ui/notifications.component.ts`.

Páginas, bajo `src/app/features/`:

- `account/my-orders-page.component.ts`
- `admin/admin-contacts-page.component.ts`
- `admin/admin-customers-page.component.ts`
- `admin/admin-dashboard-page.component.ts`
- `admin/admin-home-page.component.{ts,html}`
- `admin/admin-kitchen-page.component.ts`
- `admin/admin-page.component.ts`
- `admin/admin-products-page.component.{ts,html,css}`
- `auth/{forgot-password,login,register,reset-password}-page.component.ts`
- `cart/cart-page.component.{ts,html}`
- `catalog/{catalog,product-detail}-page.component.ts`
- `checkout/checkout-page.component.ts`
- `contact/contact-page.component.ts`
- `home/home-page.component.ts`

Pruebas existentes adaptadas: `test/performance-accessibility.test.mjs` y `test/production-hardening.test.mjs`.

La ruta y el componente de QA temporal se retiraron. No se modifican rutas públicas ni archivos del backend.

## 7. Alertas y prompts eliminados

No había llamadas funcionales a `alert`, `window.alert`, `prompt` o `window.prompt`. La búsqueda final en `src` y `public` no encuentra usos funcionales de las seis APIs nativas ni sus variantes `globalThis`.

## 8. Confirmaciones nativas eliminadas

| Archivo | Operación |
| --- | --- |
| `admin-products-page.component.ts` | `removeProduct`: eliminar producto |
| `admin-page.component.ts` | `togglePayment`: volver a pendiente de pago |
| `admin-page.component.ts` | `deleteOrder`: eliminar pedido |

También se retiraron el template, estado, listeners y CSS del diálogo local de categorías.

## 9. Operaciones que usan toast

Creación/edición/eliminación de productos y categorías; publicación y disponibilidad; actualización/cancelación/anulación de pedidos; pago; eliminación de pedidos; guardar portada; responder contactos; copiar datos de clientes; añadir y quitar productos del carrito; crear pedido y errores generales de checkout; contacto y reintento; newsletter; login, registro, logout de cliente, recuperación/actualización de contraseña y caducidad detectada al restaurar sesión.

Los cambios menores de cantidad siguen siendo silenciosos. El stock se valida según las reglas existentes y sus errores legibles llegan al usuario sin introducir una nueva regla local. No se implementó Deshacer sobre borrados permanentes porque no existe una operación inversa; la API sí admite acciones, utilizadas por Ver carrito y Reintentar.

## 10. Operaciones que usan ConfirmDialog

Eliminar producto, eliminar categoría vacía, eliminar pedido, cancelar/anular pedido y retirar confirmación de pago. La protección de categorías con productos permanece intacta. El checkbox de pago conserva el valor real mientras se espera confirmación o respuesta del servidor.

El módulo de clientes inspeccionado permite consultar y copiar datos; no contiene eliminación de clientes. No se inventaron controles ni endpoints para esa operación.

## 11. Temas y accesibilidad

Un único sistema usa `ThemeService.mode()` y los tokens existentes: surface, text, border, shadow, overlay, error, info, warning y ok. Se actualiza al cambiar de tema; no hay versiones independientes light/dark.

Sonner proporciona iconos distintos y spinner. El host localiza los botones de cierre y el nombre de la región al español; los avisos normales usan `role=status`/`aria-live=polite`, y los errores `role=alert`/`aria-live=assertive`. El atajo Alt+T da acceso al contenedor y los botones tienen focus visible.

El diálogo tiene título/descripción vinculados, `aria-modal`, overlay, foco inicial en Cancelar, contención Tab/Shift+Tab, Escape, restauración del foco y de los estilos anteriores de scroll. `showModal()` hace inactivo el fondo. No se cierra por un clic accidental fuera del diálogo.

## 12. Responsive

Escritorio: esquina superior derecha, ancho 380 px, debajo de la cabecera. Móvil hasta 760 px: centrado arriba, márgenes laterales de 12 px y ancho de viewport disponible. No ocupa los controles inferiores de checkout ni el banner de cookies. Texto multilínea y botones de al menos 44 px; diálogo con botones de 48 px. Safe areas laterales/superior/inferior y límite de altura con scroll para textos largos.

QA visual local: escritorio aproximadamente 1280×720, móvil 375×812 y 320×640. Comprobados light/dark, ausencia de overflow horizontal, tamaño táctil de 44 px, cabecera libre una vez termina la animación, acción de toast, ocho llamadas con un solo aviso, loading persistente y transición al resultado. Confirmados Tab, Shift+Tab, Escape, Cancelar, Confirmar, foco restaurado y scroll desbloqueado. No se ejecutaron borrados ni pedidos reales.

## 13. Errores HTTP

`getUserFriendlyError` reutilizado por `api-client` y los consumidores visuales. Distingue red/timeout, 401, 403, 404, 409, 429 y 5xx. Conserva mensajes de negocio legibles (por ejemplo unidades disponibles o email existente). Filtra mensajes de transporte, bases de datos, HTML, trazas, códigos técnicos y URLs de errores. Los errores 5xx no muestran detalles internos.

No se cambia autenticación, persistencia de sesión ni contratos: únicamente se añade el aviso en el límite de caducidad que ya existía. En checkout se conserva la validación contextual y el carrito/intención de pedido ante un fallo; la confirmación persistente del pedido y las instrucciones de pago siguen visibles.

## 14. Pruebas añadidas y adaptadas

28 pruebas nuevas en `notifications.test.mjs`: cinco tipos y duraciones, prioridad, deduplicación, acciones/rechazos, dismiss, updates, carga diferida ordenada, loading repetido, apertura/confirmación/cancelación/Escape, exclusión de solicitudes simultáneas, foco/scroll, errores HTTP, protección de categorías, producto guardado fallido, eliminación cancelada, pedido fallido, cancelación de pedido, checkbox y fallo de checkout.

Se ejecutan métodos reales de TypeScript con las dependencias externas de página sustituidas, Signals reales y el estado real de Sonner. El DOM modal se prueba con dobles en Node y también se comprobó manualmente en navegador sobre los componentes Angular reales. Dos pruebas existentes se adaptaron a las nuevas ubicaciones del diálogo y del normalizador. Una prueba protege contra la reintroducción de APIs nativas/imports del proveedor en páginas.

## 15. Resultado de tests

`npm test`: **78/78 correctos**, 0 fallos, 0 omitidos.

## 16. Resultado de build

`npm run build`: **correcto**, sin errores TypeScript/Angular ni avisos de presupuesto. Initial total: **495.06 kB**, transferencia estimada **127.02 kB**, conservando el límite de 500 kB. `git diff --check`: sin errores de espacios.

## 17. Incidencias y deuda pendiente

- `npm audit` informa de **6 vulnerabilidades de herramientas existentes**: 3 altas y 3 moderadas en la cadena de `@angular-devkit/build-angular` (image-size, less, sockjs, uuid y webpack-dev-server). La propuesta automática exige Angular build tooling 22.1.5, un salto mayor ajeno a esta tarea. No se ejecutó `npm audit fix --force`. El lockfile solo añade ngx-sonner; el informe no atribuye avisos a esa librería.
- Sonner 3.1 no expone inputs para traducir sus etiquetas ni configurar el role por tipo. La pequeña adaptación DOM queda aislada en el host y debe revisarse al actualizar el proveedor.
- Se verificó UI local y comportamiento con servicios sustituidos en pruebas; no se validaron operaciones administrativas o checkout contra un backend autenticado real ni con un lector de pantalla externo.
- La carga inicial queda cerca del presupuesto existente; futuras dependencias de la raíz deben mantener carga diferida cuando proceda.
- Sin despliegue ni cambios en precios, stock, estructura de pedidos, reglas de checkout o contratos del backend.
# Actividad local opcional

El servicio de toasts admite `saveToHistory: true` con una política exclusiva para invitados. No copia por defecto la descripción del toast. La API existente y los toasts temporales se conservan. Ver `docs/local-notification-history.md` para la política, componentes reutilizados, privacidad, pruebas y ejemplos.
