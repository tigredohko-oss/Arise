# ARISE v8.2

Un solo archivo HTML + los assets del avatar. Sin dependencias, sin red, sin analítica.

## Publicar en GitHub Pages

Los `assets/` ya están en el root del repo. Solo hace falta reemplazar `index.html`.

⚠️ **Subir un archivo con el mismo nombre por la web de GitHub NO lo reemplaza: lo renombra.**

1. Abre `index.html` en el repo → icono de bote de basura → **Commit changes**
2. **Add file → Upload files** → sube el `index.html` nuevo → **Commit changes**
3. Espera 1-2 min y recarga la URL. Verifica que arriba a la derecha diga **v8.2**

## Novedades v8.2

**Legibilidad.** Ningún texto por debajo de 11.5px (antes había a 8px) y todo el texto
cumple contraste AA de WCAG. La prosa dejó de ser monoespaciada. En DATA hay un control
de tamaño de texto A / A+ / A++ que escala toda la app.

**Glosario.** Botón `? GLOSARIO` en el header con los 16 términos que la app abrevia.
Los acrónimos de la pantalla de entrenamiento (BOSS, PR, STR/AGI) se tocan y se traducen.

**Fichas de técnica para todos.** Los 72 ejercicios del generador tienen pasos, clave
técnica y error común, en español. Antes ninguno tenía. La rutina v5 también las recibe.
Cada ficha lleva un enlace a búsqueda de video, en lugar de imágenes con licencia ajena.

**El dolor ya no impide entrenar.** Las señales de alerta activan MODO CAUTO: la rutina
se genera igual, con el mínimo impacto posible en las zonas marcadas, y se avisa claro.
Antes se negaba a generar.

**Ejercicios favoritos.** En el generador eliges los que te gustan y se priorizan al
armar la rutina. Se agregaron ejercicios con kettlebell (antes no había ninguno).

## Privacidad

El repo es público. **Nunca subas aquí el JSON que exporta el Data Vault.**
