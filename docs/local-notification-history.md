# Campana y actividad local del dispositivo · Entrega

26/08/2026. Ampliación del centro privado existente; no sustituye MongoDB, los endpoints ni los toasts.

## 1. Comportamiento anterior

La campana se renderizaba solo con sesión. Panel, contador e historial usaban exclusivamente `UserNotificationsService` y la API privada. Los toasts no dejaban actividad consultable después de desaparecer.

## 2. Cambios para invitados

La campana se muestra también sin cuenta. En modo invitado se titula **Actividad reciente**, usa una fuente local y ofrece los últimos cinco avisos. `/mis-notificaciones` reutiliza el historial para mostrar actividad del navegador sin exigir login. Conserva `noindex,nofollow` y su exclusión de robots. La eliminación del guard de esa ruta solo permite abrir la interfaz local: la API privada mantiene su autorización intacta.

Con sesión, el panel y el historial ofrecen **Actividad** y **Mi cuenta**, con contadores y acciones independientes. Iniciar sesión conserva la actividad del dispositivo y añade la fuente privada; nunca sustituye una por otra. La corrección y sus verificaciones se detallan en `docs/notification-sources-correction.md`.

## 3. Persistencia

Clave centralizada: `mixsabor.notifications`, dentro del localStorage del origen actual. Formato versionado `{ version: 1, items: [...] }`. Vive en `NotificationHistoryService`, sin strings de almacenamiento repartidos por componentes.

Cambiar de navegador, dominio o puerto cambia ese almacenamiento. No se envía al servidor. Si el navegador bloquea el acceso o se agota la cuota, las acciones siguen funcionando en memoria y la interfaz avisa de que no se garantiza su conservación tras recarga. Los cambios no guardados no se reemplazan con una copia antigua al volver a abrir el panel.

## 4. Modelo local

```ts
interface LocalNotification {
  source: 'local';
  id: string; // prefijo local-, separado de IDs Mongo
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  action: { label: string; url: string } | null;
}
```

`message` corresponde a la descripción opcional y puede ser vacío. Solo se serializa esta lista explícita de campos. No se copian objetos del toast, handlers, pedidos, perfiles, JWT, emails, teléfonos, direcciones ni datos de pago.

Por defecto **no se copia la descripción del toast**. Las integraciones nuevas usan títulos constantes y solo un mensaje adicional revisado para explicar la preaplicación de cupones. Los nombres/personalizaciones de productos, el ID del pedido y los mensajes dinámicos de error permanecen únicamente en el toast.

Se validan esquema, tamaño, fechas, IDs y tipos al recuperar los datos. Se descartan propiedades extra y texto con patrones comunes de datos sensibles/HTML. Este filtro no es un detector universal de datos personales: las futuras integraciones deben seguir usando copy de presentación revisada, nunca campos libres del formulario.

## 5. Límite

Máximo **50 avisos**, ordenados por fecha descendente; se eliminan los más antiguos. El historial muestra 20 inicialmente y permite cargar más. El badge siempre cuenta todo el historial local, no solo la página visible.

## 6. Caducidad

**30 días**, configurados junto a la clave y el límite en `local-notification.types.ts`. Se purgan al cargar/abrir el historial y al añadir actividad. No se instala un temporizador de fondo. Las fechas futuras y los registros mal formados se descartan.

## 7. Deduplicación

Mismo tipo, título y mensaje normalizados dentro de **10 segundos**: se conserva una sola entrada, incluso tras recarga. No se vuelve a marcar como no leída una repetición de una entrada ya leída. Al guardar textos genéricos, varias adiciones rápidas de productos pueden quedar agrupadas como una única actividad «Producto añadido al carrito».

## 8. Toasts que se guardan

Para invitados y usuarios autenticados, mediante `saveToHistory: true`:

| Acción | Aviso local |
| --- | --- |
| Añadir desde Home, catálogo o ficha | Producto añadido al carrito; acción Ver carrito |
| Quitar un producto | Producto eliminado del carrito; acción Ver carrito |
| Aplicar cupón reconocido en la vista previa | Cupón preaplicado; se aclara que falta validación del servidor |
| Aplicar cupón no reconocido | Cupón rechazado; acción Revisar pedido |
| Pedido aceptado por backend/Netlify | Pedido recibido, sin ID ni contenido del pedido; se omite la copia local si el backend ya genera el aviso equivalente de la cuenta autenticada |
| Fallo al enviar el pedido | No se pudo enviar el pedido; acción Revisar pedido |

El modo de desarrollo que guarda un borrador local no genera actividad de pedido aceptado. No se modificó ese mecanismo preexistente.

## 9. Toasts que siguen siendo temporales

Loading, cantidades, filtros, validación de campos, carrito vacío, cambios de menú, cookies, sesión iniciada/cerrada, errores de login, registro y recuperación de contraseña, newsletter, contacto y operaciones administrativas. No se guardan intentos de acceso ni otros indicios de actividad de cuenta en un navegador compartido. Los flujos administrativos ocurren con sesión y mantienen su comportamiento actual.

Se revisaron cupones, pagos y favoritos. No se añadió una función de favoritos inexistente ni se inventaron eventos de una pasarela de pago: los pagos actuales son manuales. La validación automática del cupón no genera avisos; solo el botón **Aplicar** emite feedback e historial. No se cambian cálculos ni reglas.

## 10. Badge y fuentes

Mantiene `localUnreadCount` y `accountUnreadCount`; `totalUnreadCount` suma ambos con sesión y solo el local sin sesión. Cero oculta el badge, pero no la campana. Se mantiene el formato 1–99 y `99+`; el nombre accesible informa del total real. Se actualiza al guardar, leer, borrar y limpiar sin recargar. Cada selector muestra los pendientes de su fuente, no solo los de la página visible.

## 11. Lectura

Marcar leída y **Marcar actividad como leída** actualizan el estado y localStorage con o sin sesión. **Marcar notificaciones como leídas** solo actualiza la cuenta mediante PATCH. Una acción de navegación marca leída antes de abrir su destino. No se marcan automáticamente todos los avisos por abrir el panel.

## 12. Eliminación

El botón Eliminar retira la entrada local, persiste el resultado y actualiza el badge. Para una entrada privada se conserva DELETE con autorización del backend. Un ID local nunca se envía como operación sobre Mongo ni una entrada privada se guarda en la fuente local.

## 13. Limpiar actividad

Disponible en la sección **Actividad** del historial completo, con o sin sesión, mediante el `ConfirmDialogService` existente. Cancelar no modifica datos; confirmar limpia únicamente esta clave. Se comprueba que la sesión no haya cambiado durante la confirmación. No se usa `window.confirm` ni se añade borrado masivo de la cuenta. La acción se sitúa en la página completa para no apilar dos diálogos modales.

## 14. Login

La actividad local permanece visible y disponible. Aparece el selector **Mi cuenta**, se carga su contador y los listados privados se solicitan al seleccionarlos. No se copia ni migra actividad a Mongo. La UI identifica la actividad como perteneciente al dispositivo, nunca a la cuenta.

## 15. Logout

Solo se elimina el estado privado: listas, contador y caché. Se conserva toda la actividad local. Una selección privada vuelve inmediatamente a Actividad. Se mantiene el descarte de respuestas tardías del servicio privado existente. El panel abierto se cierra al cambiar de sesión y la página adapta título, filtros y lista. Si después entra B, conserva la misma actividad del dispositivo y ve exclusivamente los avisos privados de B.

## 16. Separación local/privado

`NotificationCenterService` actúa como adaptador de UI. Mantiene ambas fuentes disponibles y permite seleccionar cuál consultar, sin concatenarlas ni mezclar su persistencia. Usa el discriminante `source` para dirigir cada acción al servicio correcto. La sesión solo condiciona el acceso a cuenta, no a local. Las confirmaciones y la navegación comprueban que no se haya cambiado de sesión durante la espera.

En invitado, cargar listado y contador no llama endpoints privados. Las pruebas mantienen también los controles originales de JWT, IDOR y A/B. No se ha modificado ningún archivo de Backend en esta fase.

## 17. Evitar duplicados autenticados

`NotificationService` graba actividad local con o sin sesión cuando se solicita `saveToHistory: true`. Solo el éxito de un pedido aceptado por el backend usa `history.accountEquivalent: true`: ese mismo evento crea una notificación transaccional de la cuenta, por lo que se omite su copia local autenticada. Un invitado sí conserva su aviso local; Netlify no activa esta excepción. No se deduplican fuentes distintas por mera coincidencia de texto ni se oculta actividad previa.

El guardado local se carga de forma diferida y comprueba otra vez la versión de sesión antes de persistir. El envío asíncrono del pedido captura esa versión al empezar, evitando que una respuesta de una sesión anterior se guarde como actividad del invitado tras logout.

Ejemplo de API compatible:

```ts
notifications.success('Producto añadido al carrito', descripcionTemporal, {
  saveToHistory: true,
  history: { action: { label: 'Ver carrito', url: '/carrito' } }
});

// Para operaciones asíncronas, capturar antes del await:
const sessionVersion = notifications.historySession();
// ... operación ...
notifications.error('No se pudo enviar el pedido', errorTemporal, {
  saveToHistory: true,
  history: { sessionVersion }
});
```

Sin opt-in, el comportamiento anterior no cambia. Los handlers del toast no se serializan. Las URLs locales admitidas son `/carrito`, `/checkout` y `/contacto`, sin parámetros; las acciones privadas conservan su allowlist anterior.

## 18. Componentes reutilizados

Se adaptan `NotificationBellComponent`, `UserNotificationListComponent` y `MyNotificationsPageComponent`; no hay un segundo panel ni una segunda página duplicada. Se conservan Lucide, estilos, temas, safe areas, diálogo nativo, foco inicial, Escape y recorrido de teclado.

Para mantener el presupuesto de carga inicial, el diálogo de confirmación global se monta con `@defer (on immediate)`, igual que la campana. Sigue siendo una única instancia y usa el mismo estado de confirmación.

## 19. Pruebas añadidas

16 pruebas en `test/local-notifications.test.mjs` y una prueba de cupón en `test/notifications.test.mjs`. Cubren guardar/recargar, lecturas, borrado/limpieza, límite, caducidad, deduplicación, evento storage de otra pestaña, JSON corrupto, cuota/bloqueo, esquema y datos sensibles, ausencia de API en invitado, coexistencia local/cuenta, 2 + 3 = 5 pendientes, acciones autenticadas por origen, separación A/B/logout con el servicio privado real, confirmación interrumpida por login, paginación, opt-in autenticado, equivalencia explícita y respuesta asíncrona obsoleta.

La revisión de navegador utilizó los componentes y servicios reales en una instancia aislada, autenticación/backend ficticios y localStorage real de ese origen. La corrección verificó ambos selectores en panel e historial, 2 + 3 = 5, guardado local autenticado, lectura individual/masiva por fuente, eliminación local, cancelar/confirmar limpieza sin alterar cuenta, cero llamadas privadas en invitado y A/logout/B. Se revisaron temas claro/oscuro. En 320×740, panel de 296 px entre márgenes de 12 px, scroll interior y sin desbordamiento horizontal; Escape devuelve el foco a la campana. No hubo errores de consola en esta revisión.

La instancia y los archivos de QA se retiraron antes del build final. No se usaron credenciales, cuentas ni pedidos reales.

## 20. Total de pruebas

- Frontend: **108/108**, incluidas todas las pruebas anteriores.
- Backend: **97/97**, sin modificaciones en esta fase.
- Total: **205 pruebas correctas**.

## 21. Build

`npm run build` correcto, sin nuevas advertencias relevantes. Bundle inicial aproximadamente **493,5 kB**, por debajo del presupuesto existente de 500 kB, sin aumentarlo. No se añadieron dependencias. Backend no tiene un script build; se ejecutó su suite de Node. `git diff --check` correcto.

## 22. Archivos nuevos

- `src/app/core/notifications/local-notification.types.ts`
- `src/app/core/services/notification-history.service.ts`
- `src/app/core/services/notification-center.service.ts`
- `test/local-notifications.test.mjs`
- `docs/local-notification-history.md`
- `src/app/shared/ui/notification-source-selector.component.ts`
- `docs/notification-sources-correction.md`

## 23. Archivos modificados

- `src/app/app.component.ts` y `src/app/app.routes.ts`
- `src/app/core/notifications/notification.types.ts`
- `src/app/core/services/notification.service.ts`
- `src/app/shared/ui/notification-bell.component.ts`
- `src/app/shared/ui/notification-bell.component.scss`
- `src/app/shared/ui/user-notification-list.component.ts`
- `src/app/features/account/my-notifications-page.component.ts`
- `src/app/features/home/home-page.component.ts`
- `src/app/features/catalog/catalog-page.component.ts`
- `src/app/features/catalog/product-detail-page.component.ts`
- `src/app/features/cart/cart-page.component.ts`
- `src/app/features/checkout/checkout-page.component.ts`, solo feedback/opt-in de actividad
- `test/notifications.test.mjs`
- `docs/notifications.md` y `docs/persistent-notifications.md`, referencias a esta ampliación

No se modificaron backend, contratos, autorización JWT, stock, precios, shipping, cobros ni reglas de pedido. No se hicieron commits ni despliegues.

## 24. Límites y deuda técnica

La actividad pertenece al navegador compartido, no a una persona, y no se sincroniza entre dispositivos. El evento `storage` refleja cambios entre pestañas; localStorage no ofrece transacciones, por lo que escrituras simultáneas pueden seguir la política de última escritura. No se añadió infraestructura de sincronización ni un registro privado local de usuarios autenticados.

Si el navegador deniega guardar, solo hay respaldo en memoria y un aviso visible; no se puede garantizar persistencia ni borrado duradero frente a una cuota o permisos bloqueados. La política de copy segura exige revisar futuras integraciones. El backend conserva las limitaciones de validación sobre Mongo real documentadas en la fase anterior; aquí se reejecutaron sus pruebas, sin desplegar ni escribir en una base real.
