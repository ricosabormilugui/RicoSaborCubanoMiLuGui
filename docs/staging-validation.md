# Validación de staging de MIXSABOR

Última revisión: 24/08/2026.

## Estado

**STAGING BLOCKED**: el repositorio está preparado, pero no existe un entorno externo aislado que pueda verificarse desde esta sesión. No se encontraron credenciales de Render/Netlify, estado local de Netlify, URL de backend/frontend ni una rama staging. Por tanto, no se ha creado ningún recurso externo ni se marca como validada ninguna integración.

Este bloqueo no está relacionado con los placeholders legales. `legal.config.ts` no se modifica y los legales siguen como **PENDIENTE MANUAL ANTES DE PUBLICACIÓN LEGAL DEFINITIVA**.

## Arquitectura preparada

| Capa | Staging requerido | Aislamiento obligatorio | Estado real |
| --- | --- | --- | --- |
| MongoDB | Misma instancia con base separada o cluster exclusivo | Base y usuario sin acceso de escritura a producción | Pendiente de provisionar |
| Backend | Servicio Render `mixsabor-backend-staging` | Secretos, admin, CORS, email y pagos propios | Declarado en `render.yaml`; no creado |
| Frontend | Branch deploy `staging` o sitio Netlify separado | `BACKEND_API_URL` solo al backend staging | Configuración preparada; no creado |
| Email | Resend controlado | Todo destinatario se redirige a `STAGING_EMAIL_TO` | Protección implementada; entrega real no probada |
| Indexación | Artefacto `build:staging` | `noindex`, `Disallow: /`, `X-Robots-Tag` | Implementado en el artefacto; no desplegado |

Flujo previsto: navegador QA → Netlify staging → `api-proxy` → Render staging → Mongo staging/Resend QA. Producción no forma parte de este recorrido.

## Salvaguardas incluidas

- `NODE_ENV=production` conserva la validación production-like.
- `APP_ENV=staging` exige una base cuyo nombre contenga `staging`, `stage` o `qa`.
- Staging no arranca sin configuración Resend completa y `STAGING_EMAIL_TO`.
- Todo email saliente de staging —pedido, cliente, estado, contacto y recuperación— se redirige al buzón QA, elimina `cc`/`bcc`, reemplaza `reply_to` y añade `[STAGING]` al asunto.
- `APP_ENV=production` rechaza `STAGING_EMAIL_TO`, evitando activar la redirección en producción.
- El build staging sustituye los datos manuales reales del checkout por avisos de “NO REALIZAR PAGOS”. El build de producción sigue usando su configuración existente.
- El artefacto staging genera `robots.txt` con `Disallow: /`, `_headers` con `X-Robots-Tag: noindex, nofollow, noarchive`, meta robots y un badge discreto `STAGING`.

## Provisionado manual

### 1. MongoDB

1. Crear una base dedicada. El blueprint propone el nombre no secreto `mixsabor_staging`; puede usarse otro si contiene `staging`, `stage` o `qa`.
2. Crear un usuario exclusivo con lectura/escritura únicamente sobre esa base. No reutilizar el usuario de producción.
3. Configurar allowlist de red para Render staging.
4. Guardar la URI real solo en Render como `MONGODB_URI`. No copiarla en Git, tickets, capturas ni este documento.
5. Confirmar en Atlas que las escrituras aparecen en la base staging y que el usuario no puede escribir en la base de producción.

La variable explícita `MONGODB_DB_NAME` prevalece para seleccionar la base. La validación de arranque impide usar el nombre normal de producción cuando `APP_ENV=staging`.

### 2. Render

Aplicar únicamente el servicio `mixsabor-backend-staging` de `render.yaml` o crear un servicio equivalente desde la UI. Antes de desplegar, completar todas las variables marcadas `sync: false`.

| Variable | Valor que debe introducirse manualmente |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ENV` | `staging` |
| `MONGODB_URI` | URI secreta del usuario/base staging; nunca la de producción |
| `MONGODB_DB_NAME` | `mixsabor_staging` o nombre aislado con marcador staging/QA |
| `AUTH_TOKEN_SECRET` | Secreto aleatorio exclusivo de staging, mínimo 32 caracteres |
| `FRONTEND_URL` | URL HTTPS exacta de Netlify staging, sin ruta |
| `CORS_ORIGIN` | La misma URL HTTPS; opcionalmente añadir orígenes locales QA explícitos separados por coma; nunca `*` |
| `ADMIN_EMAIL` | Cuenta administrativa sintética/exclusiva de staging |
| `ADMIN_PASSWORD` | Contraseña exclusiva de staging |
| `RESEND_API_KEY` | Clave de entorno/dominio Resend autorizado para QA |
| `NOTIFY_EMAIL_FROM` | Remitente verificado para QA |
| `NOTIFY_EMAIL_TO` | Buzón operativo QA; puede coincidir con el buzón controlado |
| `STAGING_EMAIL_TO` | Único buzón QA controlado que recibirá todos los emails |
| `PAYMENT_BIZUM_PHONE` | Texto QA aprobado que no sea un teléfono Bizum real, por ejemplo un aviso inequívoco de no pagar |
| `PAYMENT_BANK_IBAN` | Texto QA aprobado que no sea un IBAN real |
| `PAYMENT_BANK_HOLDER` | Identificador de entorno de pruebas, no un titular real |
| `PAYMENT_CASH_INSTRUCTIONS` | Instrucción explícita de prueba: no entregar dinero ni realizar pagos |

Los timeouts declarados para staging son: selección Mongo 5 s, conexión Mongo 10 s, HTTP externo 8 s, Resend 8 s, petición HTTP 30 s y headers 15 s. Cambiarlos solo tras medir latencia real.

### 3. Netlify

Opción preferida: branch deploy de una rama `staging` en un sitio que mantenga producción separada. `netlify.toml` aplicará `npm run build:staging` a ese contexto. Si se crea un sitio Netlify independiente cuya rama principal sea staging, establecer manualmente `npm run build:staging`, porque Netlify lo tratará como contexto `production` de ese sitio.

Configurar en el contexto exacto de staging:

| Variable | Alcance y valor |
| --- | --- |
| `BACKEND_API_URL` | Functions; URL HTTPS exclusiva de Render staging, sin barra final innecesaria |
| `BACKEND_TIMEOUT_MS` | Functions; `10000` salvo ajuste medido |
| `EXTERNAL_HTTP_TIMEOUT_MS` | Functions; `10000` salvo ajuste medido para `submit-order` |

No configurar Resend, Mongo, JWT, admin ni `PAYMENT_*` en Netlify: el storefront usa `/api/orders` y el backend Render envía los emails. Las variables de funciones deben definirse en la UI/CLI de Netlify para el contexto `branch:staging`; no deben versionarse. Netlify permite valores por contexto y recomienda guardar secretos fuera de `netlify.toml`: [deploy contexts](https://docs.netlify.com/deploy/deploy-overview/), [variables por contexto](https://docs.netlify.com/build/environment-variables/overview/).

Tras desplegar, comprobar:

- `/api/health` y `/api/ready` pasan por `api-proxy`.
- `/sitemap.xml` pasa por `api-proxy` sin afectar el sitemap de producción.
- `/reset-password?token=valor-sintetico` conserva la ruta SPA.
- Una ruta SPA válida recargada directamente devuelve la aplicación.
- `/robots.txt` contiene exactamente `User-agent: *` y `Disallow: /`.
- Las respuestas incluyen `X-Robots-Tag: noindex, nofollow, noarchive`.
- El badge `STAGING` aparece y el checkout no muestra teléfono/IBAN reales.

## Datos sintéticos

Usar exclusivamente:

- Nombre: `Cliente Prueba MIXSABOR`.
- Prefijo: `+34`.
- Teléfono nacional: `000000000` (formato aceptado por la interfaz, número español no asignable).
- Email: el mismo buzón controlado configurado en `STAGING_EMAIL_TO` o un alias que llegue a él.
- Dirección/notas: texto claramente marcado `QA STAGING - NO ENTREGAR`.
- No usar cupón de una cuenta real ni copiar clientes, pedidos, contactos o usuarios de producción.

## Productos de prueba

Crear desde admin staging o copiar solo la estructura de dos productos hacia la base staging. No insertar estos datos en producción.

1. Producto normal: nombre prefijado `QA -`, publicado solo en staging, precio simple conocido y stock suficiente.
2. Producto personalizado: nombre prefijado `QA -`, precio base conocido; una opción obligatoria de selección única con una alternativa de incremento conocido; opcionalmente un extra múltiple con otro incremento.

Registrar en la hoja de ejecución el `_id`, slug, precio base, modificadores y total esperado. No se fijan importes en Git: la persona QA debe tomar los importes visibles de la base staging y calcular el resultado antes de pedir.

## Secuencia de validación

### Infraestructura

1. `GET <BACKEND_STAGING>/api/health`: esperar `200`.
2. `GET <BACKEND_STAGING>/api/ready`: esperar `200` y Mongo `ok`.
3. Repetir ambos desde `<FRONTEND_STAGING>/api/...` para comprobar proxy.
4. Enviar preflight con `Origin: <FRONTEND_STAGING>`: esperar origen permitido.
5. Repetir con `Origin: https://origen-no-autorizado.invalid`: esperar rechazo y nunca `Access-Control-Allow-Origin: *`.

### Pedido normal

1. Home → catálogo → producto QA normal → carrito → checkout.
2. Probar delivery o pickup con fecha/franja válidas y datos sintéticos.
3. Elegir un método manual sin efectuar ningún pago y crear el pedido.
4. Registrar status HTTP, `orderId`, `X-Request-Id`, subtotal, envío, descuento, método y total.
5. Confirmar en Mongo staging el documento y que el precio almacenado coincide con el producto canónico.

### Pedido personalizado

1. Elegir la opción obligatoria y al menos un modificador conocido.
2. Verificar precio dinámico antes de añadir, carrito y checkout.
3. Crear el pedido y comprobar en Mongo `basePrice`, personalización, modificadores, precio unitario final y total.

### Precio manipulado

Repetir una petición sintética cambiando únicamente `unitPrice`/`price` del item a `1`. Esperar que el backend ignore ese valor y recalcule desde Mongo. No manipular identificadores, stock ni datos externos.

### Email, admin y cocina

1. Confirmar que todos los mensajes llegan solo a `STAGING_EMAIL_TO` y llevan `[STAGING]`.
2. Verificar branding MIXSABOR, productos, opciones, cantidades, importes, entrega/recogida, instrucciones QA y ausencia de `PENDIENTE_CONFIGURAR`.
3. Entrar con `ADMIN_EMAIL`/`ADMIN_PASSWORD` de staging y localizar ambos pedidos.
4. Revisar los mismos datos en `/admin/cocina`, especialmente la personalización.
5. Cambiar un estado no destructivo permitido y confirmar persistencia/admin/cocina. Si genera email, debe volver al buzón QA.

### Observabilidad, duplicado y fallos

- Conservar un `X-Request-Id` conocido y buscarlo en respuesta, logs de Netlify y logs de Render. Un fallo de email del pedido debe compartir el `requestId` del backend.
- Solo después de confirmar que Resend redirige a QA, enviar dos POST idénticos casi simultáneos con la misma clave. Deben devolver el mismo `orderId`, crear un documento y producir un único email; cualquier divergencia reabre la deuda.
- Para backend inaccesible, usar un deploy efímero/contexto QA con `BACKEND_API_URL` deliberadamente no resoluble; no cambiar el sitio compartido. Confirmar error, carrito conservado y reintento disponible.
- El fallo Resend ya está cubierto por tests: pedido persistido más warning `email-not-sent`. No invalidar una clave real solo para repetirlo si no hay una ventana segura.

## Resultados de esta ejecución

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| Mongo aislado | No ejecutada | Recurso no disponible |
| Backend/health/readiness | No ejecutada | URL staging no disponible |
| Frontend/proxy/SPA/reset/sitemap | No ejecutada | Sitio staging no disponible |
| CORS real permitido/bloqueado | No ejecutada | Dominios no disponibles |
| Pedido normal | No ejecutada | Sin staging aislado |
| Pedido personalizado | No ejecutada | Sin staging aislado |
| Precio manipulado remoto | No ejecutada | Cubierto localmente por tests; falta confirmación remota |
| Resend real | No ejecutada | Clave/dominio/buzón QA no disponibles |
| Admin | No ejecutada | Credenciales staging no disponibles |
| Cocina | No ejecutada | Pedidos staging no disponibles |
| Cambio de estado | No ejecutada | Pedido staging no disponible |
| `requestId` extremo a extremo | No ejecutada | Logs externos no disponibles |
| Doble POST | No ejecutada | Implementación transaccional cubierta localmente; falta confirmación en staging |
| Fallo backend remoto | No ejecutada | No hay deploy efímero controlado |
| Fallo email | Cubierto por test local | Pedido permanece y devuelve `email-not-sent` |

## Incidencias encontradas y corregidas

- Riesgo: emails de checkout, estado y recuperación podían dirigirse al destinatario introducido. Corregido con redirección central exclusiva de staging y bloqueo inverso en producción.
- Riesgo: una base con nombre normal de producción podía usarse al declarar staging. Corregido con validación explícita del nombre de DB.
- Riesgo: el bundle staging podía mostrar datos manuales reales de pago. Corregido con reemplazo de configuración solo para el build staging.
- Riesgo: staging podía indexarse. Corregido en el artefacto staging mediante robots/meta/cabecera; falta comprobarlo desplegado.
- Validación pendiente: repetir la concurrencia real en Mongo staging; la implementación local ya consume la clave, usa índice único y transacción.

## Pasos manuales restantes

1. Provisionar base/usuario Mongo aislados.
2. Crear el servicio Render staging desde el blueprint y completar todas las variables sin reutilizar secretos de producción.
3. Crear rama/sitio Netlify staging, configurar `npm run build:staging` y `BACKEND_API_URL` por contexto.
4. Desplegar backend; después fijar su URL en Netlify y la URL Netlify en `FRONTEND_URL`/`CORS_ORIGIN` de Render; redesplegar ambos.
5. Confirmar noindex/robots/badge y ausencia de datos reales de pago antes de introducir cualquier pedido.
6. Crear usuario admin y dos productos QA solo en la base staging.
7. Ejecutar la secuencia completa y adjuntar IDs, requestIds y capturas/logs sanitizados a la tabla de resultados.
8. Cambiar el estado a **STAGING VALIDATED** únicamente cuando pedidos, email, admin y cocina tengan evidencia real.
