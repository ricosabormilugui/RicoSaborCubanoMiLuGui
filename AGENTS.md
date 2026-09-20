# MIXSABOR — reglas para Codex

## Stack

### Frontend
- Angular
- TypeScript
- HTML / CSS
- RxJS
- Aplicación SPA responsive
- Mobile-first

### Backend
- Node.js
- Express
- JavaScript
- MongoDB
- API REST

### Infraestructura
- Frontend desplegable en Netlify
- Backend separado del frontend
- Variables de entorno mediante `.env`
- No exponer secretos ni credenciales

---

## Arquitectura

### Frontend
- `src/app/` — aplicación Angular
- `src/assets/` — imágenes y recursos
- `src/environments/` — configuración por entorno
- `shared/` — componentes/utilidades reutilizables cuando exista el patrón
- servicios Angular para estado, API y lógica compartida

### Backend
- `Backend/src/`
- controllers — entrada HTTP
- services — lógica de negocio
- utils — utilidades
- rutas/modelos/middlewares según estructura existente

Antes de crear un archivo o patrón nuevo, comprobar si ya existe uno equivalente.

---

## Dominios principales

La aplicación es un ecommerce gastronómico.

Áreas sensibles:

- catálogo de productos
- ficha de producto
- personalizaciones
- cálculo de precios
- carrito
- checkout
- pedidos
- stock
- cupones
- autenticación
- perfil de usuario
- direcciones
- notificaciones
- administración
- favoritos cuando existan
- consentimiento de cookies
- almacenamiento guest/user
- imágenes de productos
- SEO
- responsive/mobile

No modificar estas áreas indirectamente salvo necesidad explícita de la tarea.

---

## Fuente de verdad

### Backend
El backend es autoritativo para:

- creación de pedidos
- precios finales que deban validarse en servidor
- stock
- cupones
- datos privados del usuario
- pedidos
- notificaciones privadas
- reglas persistentes de negocio

No confiar exclusivamente en datos enviados por frontend para operaciones críticas.

### Frontend
El frontend puede:

- presentar datos
- gestionar estado visual
- calcular previews cuando ya exista esa lógica
- validar UX
- consumir la API

No mover reglas críticas de negocio al frontend.

---

## Personalización y precios

No modificar la lógica de personalización o precios salvo petición explícita.

Mantener el flujo existente:

producto
→ opciones de personalización
→ cálculo de precio
→ selección de carrito
→ carrito
→ checkout
→ validación backend
→ pedido

Si existe una función compartida para calcular precios, reutilizarla.

No duplicar cálculos de:

- precio base
- extras
- personalizaciones
- descuentos
- total de línea
- total de pedido

---

## Carrito y sesión

Distinguir claramente:

### GLOBAL
Configuración que puede compartirse entre usuarios, por ejemplo:

- tema
- consentimiento de cookies
- caché pública del catálogo

### GUEST / USER
Estado que debe estar aislado por usuario:

- carrito
- shipping
- intención de pedido
- actividad personal persistida localmente

### BACKEND / JWT
Datos privados:

- perfil
- direcciones
- pedidos
- notificaciones
- información privada de cuenta

No convertir accidentalmente estado personal en estado global.

No romper el flujo guest → login → usuario.

---

## Pedidos

La creación de pedidos debe permanecer:

- autoritativa en backend
- idempotente
- consistente
- protegida frente a peticiones duplicadas

No degradar transacciones, idempotencia o validaciones existentes.

No enviar emails ni ejecutar efectos externos antes de que la operación principal haya quedado confirmada según el flujo existente.

---

## UX/UI

Prioridad:

**MOBILE FIRST**

La mayoría de mejoras visuales deben revisarse primero en móvil.

Mantener:

- navegación clara
- componentes compactos
- cards proporcionadas
- controles táctiles accesibles
- ausencia de overflow horizontal
- textos legibles
- imágenes proporcionadas
- layouts responsive

No rediseñar otras pantallas solo porque resulte posible.

Si la tarea pide cambiar un componente concreto, limitar el cambio a ese componente y sus dependencias directas.

---

## Diseño

Seguir el lenguaje visual existente de MIXSABOR.

Evitar:

- interfaces genéricas de dashboard
- exceso de cards dentro de cards
- exceso de bordes
- chips innecesarios
- sombras exageradas
- espacios verticales excesivos
- componentes demasiado grandes en móvil
- cambios globales de estilos para resolver un problema local

Preferir:

- jerarquía visual clara
- buen uso del espacio
- diseño limpio
- responsive
- consistencia entre pantallas

---

## Tema

El tema Light es el tema inicial por defecto.

Si el usuario cambia de tema y ya existe persistencia, respetarla.

No romper la persistencia de preferencias existentes.

---

## Imágenes

No modificar innecesariamente:

- aspect ratio
- resolución
- object-fit
- paths
- lazy loading

Evitar introducir imágenes pesadas en el bundle inicial.

Preferir assets optimizados y carga diferida cuando corresponda.

---

## Rendimiento

No añadir dependencias grandes si puede resolverse con código existente.

Antes de incorporar una librería:

1. comprobar si ya existe una utilidad equivalente;
2. valorar impacto en bundle;
3. preferir import dinámico si es una función pesada usada bajo demanda.

No aumentar el bundle inicial innecesariamente.

No cargar datos, imágenes o módulos que no necesita la pantalla actual.

---

## Seguridad

No:

- exponer secretos
- incluir `.env` en commits
- confiar en precios enviados por cliente
- confiar en IDs de usuario enviados sin validar
- eliminar validaciones backend
- reducir protección de endpoints privados
- almacenar datos sensibles globalmente

Mantener autenticación/autorización existente.

---

## Principios

- TypeScript strict donde ya aplique.
- Respetar JavaScript existente en backend.
- No migrar backend a TypeScript salvo petición explícita.
- No usar `any` salvo necesidad justificada.
- No romper funcionalidad existente.
- Cambios mínimos y acotados.
- No introducir dependencias sin necesidad.
- No reestructurar el repositorio sin petición.
- No cambiar contratos API innecesariamente.
- No duplicar lógica.
- No reimplementar funcionalidades existentes.
- No hacer mejoras preventivas fuera del scope.
- Mantener compatibilidad mobile.
- Mantener tests existentes pasando.

---

## Eficiencia de contexto

Minimizar consumo de tokens.

### Inspección

No explorar todo el repositorio salvo necesidad real.

Buscar primero por:

- nombre de archivo
- componente
- servicio
- función
- endpoint
- ruta
- selector CSS
- modelo
- texto exacto
- símbolo

Abrir únicamente los archivos relacionados con la tarea.

No ejecutar búsquedas recursivas amplias si una búsqueda concreta puede localizar el código.

No releer archivos ya inspeccionados salvo que hayan cambiado o exista una duda concreta.

No analizar módulos no relacionados.

No volcar archivos completos si basta con unas líneas alrededor del código relevante.

### Antes de inspeccionar más

Si ya se ha localizado:

- el componente,
- su servicio,
- el modelo,
- y la API relacionada,

trabajar sobre ellos antes de seguir explorando.

---

## Cambios

Hacer el cambio mínimo que resuelva la tarea.

No:

- refactorizar código no relacionado;
- renombrar archivos innecesariamente;
- cambiar formato global;
- reorganizar imports de todo el proyecto;
- introducir arquitectura nueva si existe un patrón válido;
- crear abstracciones para un único uso sin necesidad;
- tocar backend si el cambio es exclusivamente visual;
- tocar frontend si el problema se resuelve exclusivamente en backend.

Si la funcionalidad solicitada ya existe:

1. identificarla;
2. comprobar por qué no se comporta como se espera;
3. corregirla;
4. no crear una segunda implementación.

Modificar el menor número posible de archivos.

---

## Flujo de trabajo

### Tarea pequeña

Para una tarea localizada:

1. localizar código;
2. inspeccionar archivos directamente relacionados;
3. implementar;
4. validar;
5. detenerse.

No redactar un plan largo.

### Tarea transversal

Solo crear un plan previo si afecta a varios dominios, por ejemplo:

- autenticación
- carrito
- pedidos
- almacenamiento
- pricing
- arquitectura
- contratos API
- migraciones de datos

El plan debe ser corto y orientado a ejecución.

---

## No avanzar automáticamente

No pasar a otra mejora, fase o refactor después de terminar la tarea.

Detenerse cuando el objetivo solicitado esté completado.

No implementar "el siguiente paso lógico" salvo petición explícita.

---

## Validación

Ejecutar primero la validación mínima necesaria.

Orden preferido:

1. test directamente relacionado;
2. tests del módulo;
3. build afectado;
4. suite completa solo si el cambio lo justifica.

No ejecutar la suite completa para un cambio CSS localizado.

No repetir tests/build sin cambios de código que lo justifiquen.

### Frontend

Según alcance:

- test específico
- tests Angular relacionados
- build Angular

### Backend

Según alcance:

- test específico
- tests del endpoint/servicio
- suite backend si el cambio es transversal

---

## Git

No:

- hacer commit automáticamente;
- hacer push automáticamente;
- cambiar de rama;
- mergear ramas;
- borrar ramas;
- resetear cambios del usuario;

salvo petición explícita.

Antes de modificar un archivo con cambios previos, comprobar que los cambios existentes no pertenecen al usuario o a otra tarea.

No sobrescribir trabajo no relacionado.

---

## Archivos generados

No modificar manualmente:

- `node_modules/`
- `dist/`
- archivos generados por build
- lockfiles salvo que cambien dependencias
- assets compilados

No regenerar `package-lock.json` si no se han modificado dependencias.

---

## Respuesta final

Ser breve.

Indicar únicamente:

1. archivos modificados;
2. cambio realizado;
3. validación ejecutada;
4. bloqueo o riesgo pendiente, si existe.

Formato recomendado:

### Archivos
- `ruta/archivo`

### Cambio
Descripción breve.

### Validación
- `comando` → OK

### Pendiente
Solo si existe.

No incluir:

- explicaciones largas;
- dumps de código;
- listas de archivos inspeccionados pero no modificados;
- razonamiento interno;
- resúmenes del repositorio;
- propuestas de mejoras no solicitadas.