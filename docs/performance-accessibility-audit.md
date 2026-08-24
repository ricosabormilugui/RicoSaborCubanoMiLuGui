# Auditoría de rendimiento y accesibilidad

Fecha de medición: 24 de agosto de 2026.

## Alcance y método

La medición inicial se realizó antes de cambiar código mediante `ng build --stats-json`, inspección de `stats.json`, tamaños reales de assets y navegación con Chrome en Home, Catálogo, producto, carrito y checkout. La comprobación final repitió el build de producción y la navegación real en 360, 390, 430 y 1440 px, en light y dark.

Lighthouse no está instalado en el proyecto y el navegador de pruebas no expone la API de auditoría de Lighthouse ni las métricas `PerformanceObserver`. No se ha añadido una dependencia ni se han inventado scores. Como sustitución verificable se registraron tamaños del build, recursos seleccionados por el navegador, dimensiones natural/renderizada, prioridades de carga, overflow, foco, teclado, contraste y warnings de consola.

## Resultado medible

| Medida | Antes | Después | Variación |
| --- | ---: | ---: | ---: |
| Bundle inicial, bruto | 642,06 kB | 459,21 kB | -182,85 kB (-28,48 %) |
| Bundle inicial, transferencia estimada | 157,09 kB | 115,47 kB | -41,62 kB (-26,49 %) |
| `main`, bruto | 164,91 kB | 49,92 kB | -114,99 kB (-69,73 %) |
| `main`, transferencia estimada | 37,49 kB | 11,15 kB | -26,34 kB (-70,26 %) |
| Logo light descargado | 388.979 B, 1254×1254 | 39.041 B, 256×256 | -89,96 % |
| Logo dark descargado | 433.924 B, 1254×1254 | 38.939 B, 256×256 | -91,03 % |

Los originales de los logos se conservan. Las variantes 256×256 cubren 2x la mayor presentación actual del footer (112 px) y no cambian el diseño.

## Composición del bundle

Antes, Home y Catálogo entraban de forma eager en `main`, junto con Angular Forms y Angular Animations requeridos por el shell. Después:

- Home es un chunk lazy de 29,34 kB (7,04 kB transferidos).
- Catálogo es un chunk lazy de 28,12 kB (7,23 kB transferidos).
- Forms queda en un chunk compartido lazy de 49,96 kB (9,91 kB transferidos).
- Checkout continúa lazy: 43,41 kB (10,56 kB transferidos).
- Producto continúa lazy: 25,94 kB (6,86 kB transferidos).
- Admin ya estaba separado; su mayor chunk pasa de 82,08 kB a 83,50 kB (16,63 kB transferidos) por la gestión accesible del diálogo destructivo, y no entra en el bundle público inicial.

Las dependencias más pesadas siguen siendo Angular core/router (252,84 kB brutos), Forms en rutas que lo necesitan y Lucide (58,78 kB brutos, solo 4,24 kB transferidos). Lucide ya utiliza imports de iconos individuales y queda correctamente tree-shaken; sustituirlo no se justifica. Angular Animations se retiró únicamente del shell porque la animación de ruta era prescindible y aportaba unos 63 kB brutos entre librería y utilidades.

## Budgets y CSS

El build inicial emitía un warning del bundle inicial (142,06 kB por encima de 500 kB) y cinco warnings de CSS de componente: producto (6,69 kB), catálogo (6,85 kB), Home (9,32 kB), admin productos (9,71 kB) y botón de carrito (6,55 kB), todos contra un umbral genérico de 4 kB.

El bundle ya queda por debajo de 500 kB. El límite de error inicial se endureció de 1 MB a 650 kB. Para CSS, la revisión no encontró bloques grandes claramente muertos: son estilos completos de páginas standalone, responsive, dark y estados de interacción. Por ello el warning se documenta y se fija en 10 kB, con error a 12 kB, justo por encima del máximo medido de 9,71 kB. No se eliminó CSS a ciegas ni se aumentó el límite del bundle para ocultar su tamaño. El build final queda sin warnings.

El uso de `!important` se limita a utilidades de texto visualmente oculto y reglas puntuales ya justificadas; no se detectó abuso que ocultase problemas de especificidad.

## Imágenes, LCP y estabilidad

- Las imágenes Cloudinary de Home, Catálogo y producto reciben `f_auto,q_auto,c_limit,w_*`, `srcset` y `sizes`. Cloudinary decide WebP/AVIF según navegador sin crear copias locales ni degradar el original.
- El hero de Home es el candidato LCP observado por tamaño sobre el pliegue. Conserva dimensiones, usa una fuente responsive y es la única imagen de Home con `fetchpriority="high"`.
- En móvil 390 px el hero solicita la variante `w_480`; en desktop solicita `w_1200` y se renderiza aproximadamente a 819×614.
- Chrome identificó una de las primeras tarjetas visibles como posible LCP de Catálogo. Las cuatro primeras tarjetas se cargan eager para cubrir el primer viewport desktop; solo la primera mantiene prioridad alta. El resto continúa lazy.
- Un caso con producto sin imagen propia reveló un `srcset` inválido compuesto solo por descriptores (`480w, ...`). Se corrigió el helper para devolver `null` con fuente vacía. La revisión final no encuentra imágenes rotas ni `srcset` inválidos.
- Imágenes, logos, skeletons y cards mantienen `width`/`height`, `aspect-ratio` u otra reserva estable. No se observaron saltos de layout durante la navegación, aunque CLS numérico no está disponible sin Lighthouse.

No se añadió virtual scrolling: el catálogo observado tiene cinco productos y el grid no lo justifica. Se añadieron `trackBy` a las listas principales para evitar recreación innecesaria de DOM.

## Peticiones e interacción

Productos y categorías ya compartían signals y deduplicaban peticiones concurrentes, pero volvían a consultar después de cada navegación. Se añadió una caché acotada de cinco minutos en sus servicios, conservando la deduplicación in-flight y sin retries automáticos. No se creó una caché global indiscriminada.

Los filtros, búsqueda, personalizaciones, carrito, tema y checkout no mostraron tareas síncronas pesadas que justificasen workers. Se mantuvieron signals/computed y las reglas de pedido sin cambios.

## Accesibilidad y UX técnica

- La búsqueda usa un diálogo con nombre accesible, recibe foco, contiene Tab, cierra con Escape y devuelve el foco. Los resultados dejaron de ser `div` clicables y son botones.
- El menú cerrado queda `inert` y fuera del árbol accesible. Al abrir recibe foco, contiene Tab, cierra con Escape y devuelve el foco al trigger.
- El drawer de filtros recibe foco en cerrar, cierra con Escape y devuelve foco a “Abrir filtros”.
- El diálogo destructivo de categorías recibe foco en “Cancelar”, contiene Tab, cierra con Escape y devuelve el foco al disparador o al título de la sección tras eliminar.
- Checkout enfoca y centra suavemente el primer campo inválido; en la prueba vacía el foco terminó en `fullName`. Se añadió nombre accesible explícito al número de teléfono.
- Login, registro y contacto ya no dependen solo del placeholder: todos sus controles tienen nombre accesible. Recuperación y newsletter mantienen etiquetas/semántica existentes.
- Se añadió un foco visible global de baja especificidad. Los focos específicos existentes se conservaron, incluido dark.
- Los controles móviles principales miden 40×40 px y el filtro 46×46 px; superan el mínimo WCAG 2.2 de 24×24. En desktop los iconos del header son 34×34.
- Header, main, footer, nav, headings, enlaces y botones mantienen semántica nativa; no se añadió ARIA donde HTML era suficiente.
- Las animaciones del shell, catálogo, botón de carrito y Home respetan `prefers-reduced-motion`; la animación de ruta se eliminó.

## Contraste y tema

El rojo oficial `--brand-red: #ed1b34` se conserva. Para superficies con texto blanco se usa una variante UI mínima `#e51a32` (4,64:1), y para texto rojo se usa `#d71930` en light y `#ff7583` en dark. Esto evita usar un único tono en combinaciones incompatibles.

Ratios comprobados en el navegador:

| Par | Light | Dark |
| --- | ---: | ---: |
| Texto principal / surface | 11,17:1 | 14,16:1 |
| Texto secundario / surface | 6,67:1 | 9,95:1 |
| Blanco / rojo de acción | 4,64:1 | 4,64:1 |
| Rojo de texto / surface | 5,16:1 | 5,73:1 |
| Rojo de texto / fondo | 4,73:1 | 6,86:1 |
| Azul de enlace / surface | 5,92:1 | 8,88:1 |

Un script inline mínimo aplica el tema persistido antes de cargar Angular/CSS de aplicación, reduciendo el flash claro inicial. Light/dark, persistencia, iconos y selección de logo se verificaron tras recarga. No hay service worker/PWA que pueda retener assets antiguos.

## Responsive verificado

En 360, 390 y 430 px: Home y Catálogo no generan overflow horizontal; header 51 px, logo 46×46, footer 88×88, controles principales 40×40 y filtro 46×46. En 1440 px: header 69 px, logo 64×64, footer 112×112, sin overflow. Producto, carrito, checkout, login, registro y contacto también se verificaron sin overflow en móvil.

El PNG dark conserva el fondo azul integrado conocido. Se ve como un cuadrado azul en superficies cuyo azul no coincida exactamente; no se aplicaron filtros, recoloreado ni hacks.

## Validación

- Tests frontend/branding/SEO/performance: 25/25.
- Tests backend, incluida no regresión del sitemap: 52/52.
- Build de producción con estadísticas: correcto, sin errores ni warnings.
- SEO técnico no se modificó; sus tests de canonical, robots, noindex, metadata, JSON-LD y sitemap continúan pasando.

## Deuda técnica pendiente

- Ejecutar Lighthouse/Core Web Vitals en un despliegue production-like con backend y red reales para obtener LCP, CLS e INP numéricos; no extrapolar los del servidor de desarrollo.
- Sustituir el logo dark solo cuando exista un asset oficial sin fondo integrado; esta fase no debe editarlo.
- Un pipeline CDN homogéneo para URLs externas que no sean Cloudinary permitiría variantes responsive también para esos proveedores. Las imágenes Unsplash actuales ya limitan su ancho por query, pero no pasan por el helper Cloudinary.
- Si el catálogo crece de forma material, volver a medir coste de filtros/render y considerar paginación antes que virtual scrolling.
