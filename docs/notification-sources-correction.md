# Corrección: actividad local + notificaciones de cuenta

26/08/2026. Corrección del frontend existente, sin cambios de backend ni migraciones.

## 1. Dónde estaba la exclusión

`NotificationCenterService` elegía listas, contador y operaciones locales o privadas mediante `isAccount()`. Además, `NotificationService.record()` descartaba cualquier opt-in local si había sesión. La UI y las pruebas reproducían esa exclusión.

## 2. Corrección

Se separan la disponibilidad de cuenta (`isAccount`) y la fuente seleccionada (`source` / `isAccountSource`). Se elimina el bloqueo autenticado al registrar y gestionar actividad local. Se reutilizan la campana, la lista y el historial existentes.

## 3. Coexistencia

Los servicios de actividad y cuenta conservan su estado independiente. `localRecent` y `accountRecent` están disponibles simultáneamente; la selección determina qué lista, filtros, carga y error presenta la UI. El discriminante `source: 'local' | 'account'` dirige cada acción. No se concatenan datos ni se migra localStorage a MongoDB.

## 4. Contador

`localUnreadCount + accountUnreadCount = totalUnreadCount`. En invitado, la parte privada es cero y no se consulta la API. El badge usa el total, con límite visual `99+` y nombre accesible con el número completo. Cada sección muestra su propio contador. Caso verificado: **2 + 3 = 5**.

## 5. Distinción visual

El selector reutilizable **Actividad / Mi cuenta** aparece con sesión en panel e historial. Se indica «Actividad de este dispositivo · no se guarda en tu cuenta» o «Notificaciones privadas de tu cuenta». Invitados ven solo Actividad. Los estados vacíos son específicos de la sección; no se declara vacío todo el centro cuando hay avisos en la otra fuente.

## 6. Operaciones locales con sesión

Leer, eliminar, **Marcar actividad como leída** y **Limpiar actividad** funcionan igual con o sin sesión. Limpiar requiere el ConfirmDialog existente y nunca modifica avisos privados. Las acciones locales siguen disponibles aunque la API privada esté ocupada o falle.

## 7. Operaciones privadas

Leer, eliminar y **Marcar notificaciones como leídas** mantienen las llamadas PATCH/DELETE del servicio existente. Solo afectan a la cuenta. No hay una acción global ambigua. JWT, autorización, IDOR, consultas MongoDB y contratos backend no cambian.

## 8. Login

Conserva y muestra Actividad; añade Mi cuenta y carga su contador. Los listados privados se cargan al seleccionarlos. `saveToHistory: true` sigue registrando nuevas acciones locales mientras hay sesión.

## 9. Logout

El servicio privado existente oculta inmediatamente y limpia listas, contador y caché; descarta respuestas tardías. La actividad permanece intacta. La selección privada pertenece a la versión de sesión y vuelve a Actividad al salir. El panel se cierra al cambiar de sesión; el historial se actualiza.

## 10. Cambio A → logout → B

La misma actividad del dispositivo permanece disponible. Solo se muestran notificaciones privadas del usuario actual. Se verifica con el servicio privado real en pruebas y cuentas ficticias en navegador, incluyendo una respuesta tardía de A durante B.

## 11. Duplicados y privacidad

Se conserva la deduplicación local existente de 10 segundos. No se eliminan elementos entre fuentes solo porque coincida su texto. La única equivalencia explícita añadida es el éxito de un pedido aceptado por el backend: `history.accountEquivalent: true` evita su copia local si existe sesión, porque ese evento ya crea el aviso transaccional privado. Para invitado se guarda; para Netlify no se aplica esa excepción.

Se conservan los controles de versión de sesión para descartar resultados asíncronos obsoletos, los textos locales revisados y la exclusión de descripciones dinámicas/datos sensibles. La clave `mixsabor.notifications`, máximo 50 avisos y TTL de 30 días no cambian.

## 12. Pruebas modificadas y revisión visual

`test/local-notifications.test.mjs`: reemplazadas las expectativas de exclusión; añadidas coexistencia, suma 2+3, acciones por origen autenticadas, logout/limpieza de caché/A-B con respuesta tardía, errores/vacíos separados, opt-in autenticado y equivalencia explícita. Se mantienen las pruebas de almacenamiento, TTL, límite, dedupe y privacidad.

Navegador: componentes/servicios reales con autenticación y API ficticias en un origen aislado; sin credenciales ni pedidos reales. Verificados ambos selectores, conteos, nuevo toast autenticado, lectura local individual y masiva, lectura privada masiva, eliminación local, cancelación/confirmación de limpieza, logout/B, persistencia y estados vacíos. Temas claro/oscuro; móvil 320×740 con panel de 296 px, scroll y sin desbordamiento horizontal. Escape devuelve el foco a la campana. Sin errores de consola observados. Se retiraron la instancia y los archivos temporales de QA.

## 13. Frontend

`npm test`: **108/108 correctas**, cero fallos.

## 14. Backend

`Backend/npm test`: **97/97 correctas**, incluidas JWT e IDOR. No se cambió código backend. No se validó contra MongoDB real ni se desplegó.

## 15. Build

`npm run build`: correcto. Inicial **493,47 kB**, transferencia estimada **125,11 kB**, sin subir el presupuesto de 500 kB ni añadir dependencias. Backend no dispone de script build. `git diff --check` correcto.

## 16. Archivos de esta corrección

- `src/app/core/services/notification-center.service.ts`
- `src/app/core/services/notification.service.ts`
- `src/app/core/notifications/notification.types.ts`
- `src/app/features/checkout/checkout-page.component.ts`
- `src/app/shared/ui/notification-source-selector.component.ts` (nuevo)
- `src/app/shared/ui/notification-bell.component.ts`
- `src/app/shared/ui/notification-bell.component.scss`
- `src/app/features/account/my-notifications-page.component.ts`
- `test/local-notifications.test.mjs`
- `docs/notification-sources-correction.md` (nuevo)
- `docs/local-notification-history.md`
- `docs/notifications.md`
- `docs/persistent-notifications.md`

No se hicieron commits ni despliegues desde esta tarea.
