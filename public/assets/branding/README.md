# Assets de MIXSABOR

Logos definitivos incorporados sin cambiar sus proporciones ni aplicar filtros CSS:

- `logo-espiral-oscura.png`: original de espiral azul para fondos claros (1254×1254, conservado sin cambios).
- `logo-espiral-clara.png`: original de espiral marfil para fondos oscuros (1254×1254, conservado sin cambios).
- `logo-espiral-oscura-256.png`: variante derivada optimizada para header/footer (256×256).
- `logo-espiral-clara-256.png`: variante derivada optimizada para header/footer (256×256).

Las variantes optimizadas están activadas desde `shared/brand.config.json`. Un único
archivo por tema cubre header y footer para evitar descargas duplicadas. La interfaz conserva el
wordmark de texto `MIXSABOR` únicamente como fallback ante un error real de carga.

La variante oscura conserva el fondo azul integrado del original; no se corrige
mediante filtros ni hacks visuales.

`favicon_mixsabor_dark.png` es una variante derivada del logo dark, recortada sin
redibujar ni recolorear la marca para que ocupe mejor el espacio de la pestaña.
El original permanece intacto.

Los iconos `pwa-icon-*` usan sobre fondo carbón el símbolo original de
`logo-espiral-clara.png`, cuya variante marfil mantiene el contraste. Las variantes
`maskable` reducen el símbolo al área segura central para que Android pueda aplicar
su máscara sin recortarlo. `pwa-icon-192.png` también se utiliza como `apple-touch-icon`.
