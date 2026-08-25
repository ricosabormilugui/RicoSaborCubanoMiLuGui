# MIXSABOR · Production readiness checklist

Última auditoría técnica: 24/08/2026.

Estado técnico: **GO CON RIESGOS**. El código compila, las pruebas automatizadas y locales están estables, pero la validación externa E2E sigue pendiente porque no existe un staging aislado verificable.

Estado legal: **PUBLICACIÓN LEGAL DEFINITIVA PENDIENTE**. Los datos legales no se trabajan en esta fase y no bloquean la preparación ni las pruebas de staging.

## Aplicación

- [x] Home, catálogo, producto, carrito, checkout y auth cargan sin errores visibles.
- [x] Branding MIXSABOR, enlaces, footer y WhatsApp revisados.
- [x] Tema light/dark probado con los dos PNG, sin filtros CSS.
- [x] Carrito y configuraciones personalizadas persisten tras recarga.
- [x] Checkout valida campos, foco, entrega/recogida, franjas y antelación.
- [x] Responsive revisado en 360, 390, 430, 768 y 1440 px sin overflow horizontal.
- [ ] **PENDIENTE MANUAL ANTES DE PUBLICACIÓN LEGAL DEFINITIVA:** completar los seis placeholders identificados en `src/app/core/config/legal.config.ts`, sin inventar valores.
- [ ] Confirmar con la persona responsable que los datos comerciales de pago del frontend son los definitivos y coinciden con Render.

## Backend

- [x] Arranque validado con secreto temporal seguro y configuración de desarrollo.
- [x] `/api/health` responde 200 sin depender de Mongo.
- [x] `/api/ready` responde 200 con Mongo disponible y 503 sanitizado en la prueba aislada sin Mongo.
- [x] Precio normal y personalizado se recalcula desde Mongo; el precio enviado por cliente se ignora.
- [x] Pedido se persiste antes de intentar el email; un fallo devuelve `email-not-sent` sin borrar el pedido.
- [x] API 404 devuelve JSON y `requestId`.
- [x] Administración rechaza peticiones públicas sin token.
- [x] Producción falla al arrancar si faltan variables esenciales de pago.
- [ ] **Alto:** probar un pedido sintético completo contra staging y confirmar pedido, administración y cocina.
- [x] Idempotencia backend implementada con clave persistida, fingerprint SHA-256, índice único parcial y transacción cliente/cupón/stock/pedido.
- [ ] Repetir la carrera de doble POST contra Mongo staging real y conservar evidencia de un único pedido/email.

Variables obligatorias del backend en producción:

- [ ] `NODE_ENV=production`.
- [ ] `MONGODB_URI` y `MONGODB_DB_NAME` apuntan a producción.
- [ ] `AUTH_TOKEN_SECRET` aleatorio de al menos 32 caracteres.
- [ ] `FRONTEND_URL=https://mixsabor.milugui.com` en el backend de producción.
- [ ] `CORS_ORIGIN` limitado al dominio HTTPS definitivo, nunca `*`.
- [ ] `PAYMENT_BIZUM_PHONE`, `PAYMENT_BANK_IBAN`, `PAYMENT_BANK_HOLDER` y `PAYMENT_CASH_INSTRUCTIONS` configurados explícitamente.
- [ ] Si se habilita email: `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` y `NOTIFY_EMAIL_TO` configurados juntos.

## Mongo

- [x] URI, base y colecciones son configurables por entorno.
- [x] Conexión, selección de base, readiness y cierre ordenado comprobados.
- [ ] Crear usuario de producción con mínimo privilegio y contraseña exclusiva.
- [ ] Restringir red/IP en Atlas según la infraestructura elegida.
- [ ] Confirmar índices, copias de seguridad, alertas y política de retención.
- [ ] Ejecutar el pedido de staging en una base separada; no utilizar la base habitual para QA destructiva.

## Netlify

- [x] `npm run build` y directorio `dist/ricosabor-tienda/browser` coinciden con `netlify.toml`.
- [x] `/api/*` y `/sitemap.xml` apuntan a `api-proxy`.
- [x] `api-proxy` probado localmente: 200 real, 502 sin backend, 504 por timeout y propagación de `requestId`.
- [x] `submit-order` empaqueta y responde 405/400/503 de forma controlada.
- [x] El storefront usa `ORDER_SUBMISSION_MODE=api`: los pedidos pasan por `/api/orders` y `api-proxy`.
- [x] Variables presentes en los bundles finales: `api-proxy` usa `BACKEND_API_URL` y `BACKEND_TIMEOUT_MS`; `submit-order` usa `BACKEND_API_URL` y `EXTERNAL_HTTP_TIMEOUT_MS`.
- [x] Resend y `PAYMENT_*` no sobreviven en los bundles Netlify actuales; se configuran en el backend Render, que es quien envía el email.
- [x] Fallback SPA devuelve `index.html`; una ruta frontend desconocida seguirá teniendo HTTP 200.
- [ ] Configurar `BACKEND_API_URL` con la URL pública HTTPS de Render, sin barra final innecesaria.
- [ ] Revisar `BACKEND_TIMEOUT_MS` y `EXTERNAL_HTTP_TIMEOUT_MS`; si no se definen, ambos usan 10 segundos.
- [ ] Verificar en Deploy logs que no aparecen valores de entorno ni tokens.
- [ ] Hacer smoke test del deploy preview antes de promover a producción.

## Render

- [x] Blueprint usa `Backend`, `npm ci`, `npm start` y `/api/health`.
- [x] `AUTH_TOKEN_SECRET` se genera y Mongo/CORS/frontend/email/pago quedan declarados como configuración manual.
- [ ] Completar todas las variables `sync: false` de `render.yaml`.
- [ ] Confirmar `FRONTEND_URL` y `CORS_ORIGIN` con `https://mixsabor.milugui.com`.
- [ ] Confirmar `MONGODB_URI` de producción y nombres de colecciones.
- [ ] Confirmar las cuatro variables `PAYMENT_*` y compararlas con el checkout.
- [ ] Revisar los defaults de timeouts: selección Mongo 5 s, conexión Mongo 10 s, HTTP externo 8 s, Resend 8 s, request HTTP 30 s y headers 15 s.
- [ ] Verificar `/api/health`, `/api/ready`, CORS permitido/bloqueado y logs tras desplegar.
- [ ] Configurar monitor externo sobre `/api/ready` y alerta por 5xx/latencia.

## Staging

- [x] No se ha encontrado un entorno staging aislado verificable: no hay contexto/servicio dedicado, estado local de Netlify, credenciales de plataforma, variables de despliegue ni rama staging identificable.
- [x] El único `.env` disponible es local de desarrollo y no contiene `PAYMENT_*`; no se utiliza para una prueba E2E externa.
- [x] `render.yaml` declara un servicio separado `mixsabor-backend-staging`, `NODE_ENV=production`, `APP_ENV=staging`, DB `mixsabor_staging` y secretos/configuración manuales.
- [x] El backend staging rechaza una DB sin marcador staging/QA, exige Resend completo y redirige todo email a `STAGING_EMAIL_TO`.
- [x] `npm run build:staging` elimina los datos reales de pago del artefacto, aplica noindex/robots/cabecera y muestra un badge discreto `STAGING`.
- [x] Procedimiento, variables, datos sintéticos, pruebas y matriz de resultados documentados en `docs/staging-validation.md`.
- [ ] Crear realmente el servicio Render staging, con Mongo/base/usuario exclusivos y completar las variables `sync: false`.
- [ ] Crear un branch deploy o sitio Netlify de staging cuyo `BACKEND_API_URL` apunte exclusivamente al backend anterior.
- [ ] Configurar `FRONTEND_URL` y `CORS_ORIGIN` con la URL exacta de staging.
- [ ] Configurar Resend y `STAGING_EMAIL_TO` con un buzón interno QA controlado.
- [ ] Configurar las cuatro variables `PAYMENT_*` con valores de prueba explícitamente aprobados para staging. Si falta una, el backend debe rechazar el arranque.
- [ ] Ejecutar primero un pedido normal sintético y después uno personalizado, verificando persistencia, email, administración y cocina.
- [ ] Estado actual: **STAGING BLOCKED** por ausencia de recursos/credenciales externos, no por legales.

## Resend

- [x] El código aplica timeout y no registra API key, token ni contenido sensible de la petición.
- [x] El fallo de proveedor está cubierto: el pedido permanece y queda aviso `email-not-sent`.
- [x] `APP_ENV=staging` redirige todos los destinatarios, copias y `reply_to` al único `STAGING_EMAIL_TO`; los asuntos se marcan `[STAGING]`.
- [x] `APP_ENV=production` rechaza `STAGING_EMAIL_TO`, por lo que la redirección QA no puede activarse accidentalmente en producción.
- [ ] Verificar dominio remitente y DNS de Resend (SPF/DKIM).
- [ ] Configurar `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM` y `NOTIFY_EMAIL_TO` en Render.
- [ ] Enviar un pedido sintético desde staging y revisar entrega, remitente, asunto, totales e instrucciones de pago.
- [ ] Simular una clave/proveedor inválido en staging y confirmar log con `requestId` sin datos secretos.

## SEO

- [x] Home, catálogo, categoría y producto generan title, description, canonical, robots, Open Graph, Twitter y JSON-LD.
- [x] Login/admin generan `noindex,nofollow`; 404 genera `noindex,follow` y canonical `/404`.
- [x] Sitemap real devuelve XML válido, URLs absolutas, categorías, productos publicados y `lastmod`, sin rutas privadas.
- [x] `robots.txt` referencia el sitemap y bloquea rutas privadas.
- [ ] Añadir favicon y `apple-touch-icon` definitivos; no existen assets todavía.
- [ ] Sustituir la imagen Open Graph genérica por una imagen social MIXSABOR definitiva.
- [ ] Añadir `https://mixsabor.milugui.com` a Google Search Console y enviar `https://mixsabor.milugui.com/sitemap.xml`.

## Seguridad

- [x] No hay `.env`, logs, dumps, coverage ni secretos técnicos versionados.
- [x] Los ejemplos `.env.example` permanecen versionables y los `.env` reales están ignorados.
- [x] JWT exige secreto de al menos 32 caracteres; eliminado el respaldo fijo heredado.
- [x] CORS permitido y bloqueado probado; administración pública devuelve 401.
- [x] Login cliente/admin, contacto y newsletter devuelven 429 con `Retry-After`.
- [x] Recuperación limita por IP/email y conserva respuesta genérica 202 para impedir enumeración.
- [x] Dependencias de producción frontend y backend: 0 vulnerabilidades conocidas por `npm audit --omit=dev`.
- [ ] **Medio:** no exponer el servidor Angular de desarrollo a contenido no confiable; quedan 6 avisos solo en tooling de build/dev (3 altos, 3 moderados) cuya corrección exige major.
- [ ] **Medio:** el rate limit es por instancia y memoria; documentar la limitación si se escala horizontalmente.
- [ ] **Bajo:** valorar CSP en una fase posterior sin romper imágenes/servicios externos.
- [ ] Confirmar que teléfono, IBAN y titular publicados son datos comerciales autorizados, no datos personales accidentales.

## Testing

- [x] Instalación limpia raíz y backend completada con `npm ci` durante la auditoría.
- [x] Tests frontend: 40/40, incluidos lifecycle y retry idempotente.
- [x] Tests backend: 82/82, incluidos idempotencia, concurrencia, stock, cupón y email.
- [x] `npm run build`: 464,75 kB iniciales, main 49,94 kB, transferencia estimada 117,40 kB y cero warnings de build.
- [x] `npm run build:staging`: 464,75 kB iniciales, noindex/robots/cabecera/badge presentes y los cuatro valores de pago de producción ausentes del bundle.
- [x] Funciones Netlify empaquetadas con esbuild y smoke test sin mutaciones externas.
- [x] Catálogo offline conserva datos disponibles, muestra aviso y recupera con Reintentar.
- [x] Artefacto staging verificado: `robots.txt`, `_headers`, meta robots, badge y sustitución de datos reales de pago correctos.
- [ ] **Alto:** pedido/email/admin/kitchen reales pendientes por no disponer de un staging remoto confirmado como aislado.

## Pendientes técnicos

- [ ] Completar variables externas en Render y Netlify sin mostrar sus valores.
- [ ] Provisionar staging aislado y comprobar health/readiness/CORS.
- [ ] Ejecutar pedido normal E2E con precio recalculado y persistencia Mongo.
- [ ] Ejecutar pedido personalizado E2E con opciones, extras y total canónico.
- [ ] Verificar email MIXSABOR, importes e instrucciones de pago sin placeholders técnicos.
- [ ] Verificar ambos pedidos en administración y cocina.
- [x] Deuda de implementación de idempotencia cerrada; queda validación E2E concurrente en staging.

## Pendientes legales

Estos datos no se modifican ni impiden trabajar en staging. Su estado es **PENDIENTE MANUAL ANTES DE PUBLICACIÓN LEGAL DEFINITIVA**:

- [ ] `PENDIENTE_CONFIGURAR_RAZON_SOCIAL`.
- [ ] `PENDIENTE_CONFIGURAR_CIF_NIF`.
- [ ] `PENDIENTE_CONFIGURAR_DIRECCION_FISCAL`.
- [ ] `PENDIENTE_CONFIGURAR_EMAIL_LEGAL`.
- [ ] `PENDIENTE_CONFIGURAR_TELEFONO_LEGAL`.
- [ ] `PENDIENTE_CONFIGURAR_TITULAR_BANCARIO`.

## Deployment técnico

- [ ] Crear primero un deploy preview de Netlify y un backend de staging separado.
- [ ] Completar variables Netlify y Render sin copiar valores en tickets, commits o capturas.
- [ ] Ejecutar pedido sintético, fallo de email y doble envío en staging.
- [ ] Confirmar auth cliente, registro, recuperación completa y admin CRUD con cuentas de QA.
- [ ] Confirmar producto despublicado fuera de catálogo/sitemap y con `noindex` por URL.
- [ ] Promover técnicamente solo después de cerrar las validaciones externas de staging.
- [ ] Etiquetar el commit desplegado y conservar plan de rollback.

## Post-deploy

- [ ] Verificar DNS, HTTPS, redirección del dominio y ausencia de mixed content.
- [ ] Abrir Home/catálogo/producto/checkout en móvil y escritorio, light/dark.
- [ ] Consultar `/robots.txt`, `/sitemap.xml`, `/api/health` y `/api/ready` en la URL pública.
- [ ] Revisar logs de Netlify/Render con un `requestId` conocido.
- [ ] Confirmar recepción del email de pedido y recuperación de contraseña.
- [ ] Revisar pedido en administración y cocina y cambiar estado con una cuenta de QA.
- [ ] Añadir propiedad de Google Search Console y enviar el sitemap.
- [ ] Activar monitor externo y alertas operativas.
- [ ] Revisar métricas, 4xx/5xx y pedidos duplicados durante las primeras 24–48 horas.

## Riesgos técnicos abiertos

| Severidad | Riesgo | Condición de cierre |
| --- | --- | --- |
| Alto | No se ejecutó un pedido/email/admin/kitchen real porque no hay staging confirmado como aislado. | Ejecutar el guion manual anterior en staging. |
| Medio | La idempotencia transaccional pasa tests y Mongo confirma soporte, pero falta carrera E2E en staging real. | Ejecutar dos POST concurrentes y verificar un pedido, un ajuste de stock/cupón y un email. |
| Alto | Variables y servicios externos de producción no pueden verificarse desde el repositorio. | Completar y validar Netlify, Render, Mongo, Resend y DNS. |
| Medio | Seis vulnerabilidades afectan únicamente a tooling de desarrollo/build y requieren cambio major. | Actualizar Angular toolchain en una fase dedicada. |
| Medio | Rate limits en memoria no son compartidos entre instancias. | Mantener una instancia o adoptar un almacén distribuido en una fase futura. |
| Bajo | Faltan favicon, apple-touch-icon e imagen social de marca. | Incorporar assets definitivos. |
| Bajo | Rutas SPA desconocidas devuelven HTTP 200 en Netlify. | Aceptar/documentar o abordar con infraestructura SSR/edge en otra fase. |
| Bajo | El PNG dark conserva su fondo azul integrado. | Aceptado; no corregir con CSS. |

## Reevaluación

- **Staging:** STAGING BLOCKED. El repositorio queda preparado, pero no hay recursos externos aislados ni credenciales con los que ejecutar E2E.
- **Production readiness técnico:** GO CON RIESGOS. No se ha encontrado una regresión crítica, pero staging, E2E, email, administración y cocina siguen sin verificación externa.
- **Production readiness legal:** PUBLICACIÓN LEGAL DEFINITIVA PENDIENTE. Los placeholders permanecen deliberadamente sin modificar y fuera del alcance de esta fase.
