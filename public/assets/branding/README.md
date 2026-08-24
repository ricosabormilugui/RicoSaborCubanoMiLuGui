# Assets de MIXSABOR

Logos definitivos incorporados sin cambiar sus proporciones ni aplicar filtros CSS:

- `logo_mixsabor_light.png`: original para fondos claros (1254×1254, conservado sin cambios).
- `logo_mixsabor_dark.png`: original para fondos oscuros (1254×1254, conservado sin cambios).
- `logo_mixsabor_light_256.png`: variante derivada optimizada para header/footer (256×256).
- `logo_mixsabor_dark_256.png`: variante derivada optimizada para header/footer (256×256).

Las variantes optimizadas están activadas desde `shared/brand.config.json`. Un único
archivo por tema cubre header y footer para evitar descargas duplicadas. La interfaz conserva el
wordmark de texto `MIXSABOR` únicamente como fallback ante un error real de carga.

La variante oscura conserva el fondo azul integrado del original; no se corrige
mediante filtros ni hacks visuales.

`favicon_mixsabor_dark.png` es una variante derivada del logo dark, recortada sin
redibujar ni recolorear la marca para que ocupe mejor el espacio de la pestaña.
El original permanece intacto. Siguen pendientes un `apple-touch-icon` específico
y una imagen social de marca.
