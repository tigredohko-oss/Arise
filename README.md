# ARISE v8.5

App de una sola página (`index.html`). No necesita servidor, no necesita internet
después de la primera carga. Tus datos viven en el navegador (`localStorage`),
nunca salen de tu teléfono.

## Qué cambia en la v8.4

**Importar tu propia rutina desde una tabla copiada.**

Cuando copias una tabla desde un documento, Word, Notion o un `.md` renderizado,
el pegado llega "aplanado": cada celda cae en su propio renglón. La v8.3 leía eso
como texto suelto y encontraba 3 ejercicios de 21.

La v8.4 detecta ese formato y lo vuelve a armar. Con la rutina UPPER/LOWER v6 CORTE:

- antes: 2 días · 3 ejercicios · 154 líneas sin parsear
- ahora: 4 días · 21 ejercicios · 69 series, con notas, RIR y BOSS intactos

Además:

- **Nada se descarta en silencio.** Lo que no entró se muestra en dos grupos:
  "texto con números" (posible ejercicio que se me escapó, con su número de línea)
  y prosa normal (colapsada con un contador).
- **`3 rondas`** ahora se entiende aunque esté a mitad de línea.
- **`pausa 1 s arriba`** ya no se confunde con descanso entre series — es un tempo,
  se queda como nota.
- **`por lado`** y **`/ 10-15`** salen del nombre del ejercicio y pasan a la nota.
- **Guardia de antónimos al emparejar.** `Press declinado con mancuernas` ya NO
  empareja con `Press Inclinado con Mancuernas`. Distinto ángulo, distinto
  ejercicio, récord falso. Mismo criterio para sentado/de pie, barra/mancuerna,
  rumano/convencional, ancho/cerrado, frontal/trasera, unilateral/bilateral.

## Cómo se usa

RUTINA → **IMPORTAR MI RUTINA** → pega el texto → revisa lo que leí (puedes editar
o borrar cualquier renglón ahí mismo) → APLICAR.

Antes de aplicar se guarda un respaldo `pre-import-rutina`. Tu XP, tus récords y
tus medidas no se tocan.

Lee texto pegado. **No lee fotos ni PDFs.**

## Publicar en GitHub Pages

En la web de GitHub, subir un archivo con el mismo nombre lo *renombra* en vez de
reemplazarlo. Borra `index.html` del repo primero, confirma el borrado, y después
sube el nuevo. La carpeta `assets/` solo hace falta subirla una vez.

## Privacidad

El repo es público. `index.html` y `assets/` son lo único que va ahí.
El JSON del Data Vault (pesos, medidas, XP) **nunca** se sube al repo.
