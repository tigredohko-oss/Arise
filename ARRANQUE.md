# ARISE — cómo retomar el proyecto en una conversación nueva

Estado al 27 jul 2026: **v8.5**, schema 8, 424 pruebas de navegador + 78 del parser en verde.

## Qué es cada archivo

| Archivo | Qué es |
|---|---|
| `index.html` | **La app entera.** Es lo único que se sube al repo. Autocontenido, sin dependencias |
| `assets/` | Avatares (4 PNG) y videos de transición de rango (3 MP4). Ya están en el repo |
| `parse.js` | El importador de rutinas, extraído de `index.html` para poder probarlo en node |
| `gen.js` | El generador determinista, igual: copia extraída para pruebas |
| `gendb.json` | 72 ejercicios del generador, con vectores de `stress` por articulación |
| `gentec.json` | 72 fichas de técnica que corresponden a `gendb.json` |
| `exdb.json` | Base de ejercicios de la biblioteca (origen: dataset MIT) |
| `test.js` | 424 pruebas Playwright contra `index.html` |
| `partest.js` | 78 pruebas del parser en node, sin navegador |
| `gentest.js`, `validate.js`, `gentec_validate.js` | Validadores del generador y de las fichas |
| `shot.js` | Capturas de pantalla para revisar visualmente |
| `rutv6.txt` | La rutina UPPER/LOWER v6 CORTE tal como Dave la pega — caso de prueba real |

⚠️ **`index.html` es la fuente de verdad.** `parse.js` y `gen.js` son copias extraídas para
probar en node. Si cambias uno, hay que reinyectarlo en `index.html` y volver a correr
`node test.js`. No existe script de build: la inyección se hace a mano buscando el bloque
correspondiente dentro del `<script>`.

## Cómo correr las pruebas

```bash
npm install                # playwright ya viene en el contenedor
node partest.js            # parser, rápido, sin navegador
node test.js               # suite completa en Chromium headless
```

El navegador vive en `/opt/pw-browsers`. **No corras `playwright install`.**
Este Chromium **no trae H.264**, así que los MP4 de transición no reproducen en pruebas —
es esperado, no es un bug.

## Cómo publicar

1. En GitHub, **borra `index.html` del repo primero** y confirma el borrado
2. Sube el nuevo `index.html`

Si lo subes sin borrar, GitHub lo **renombra** en vez de reemplazarlo. Los `assets/` ya están
arriba, no hace falta volver a subirlos.

## Reglas que no se rompen

- El repo es **público**. Solo van `index.html` y `assets/`.
  **El JSON del Data Vault (pesos, medidas, XP, fotos) nunca se sube.**
- Los datos del usuario viven en `localStorage`, namespaceados: `arise:<perfil>:state`
- `xp` es campo **derivado**: `xpBase + weekXP(checked)`, se recalcula en cada `save()`
- Los inputs de peso usan `oninput` + debounce 300 ms, PR en `onblur`, `flushNow()` en cambio
  de día / check / `visibilitychange` / `pagehide` / `blur`. **Con `onchange` se perdían
  semanas enteras de cargas** (bug v3.3). Hay pruebas de regresión del escenario exacto
- **Los inputs de texto NO disparan re-render** — roban el foco
- Todo lo que entra de fuera pasa por `sanitizeState()` / `sanitizeRoutine()`, que reconstruyen
  el estado campo por campo y **regeneran todos los uid**
- Los colores se **validan** con `safeColor()`, no se escapan: `esc()` no escapa `;` ni `:`

El resto del contexto — perfil de Dave, fase de corte, medidas, dieta, rutinas, backlog
completo y todos los gotchas — está en el documento del proyecto
**`claude/ARISE-checkpoint.md`**, que Claude lee solo al iniciar una conversación en el
proyecto "Dios Griego".
