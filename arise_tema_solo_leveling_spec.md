# ARISE — SPEC DE TEMA "SOLO LEVELING" + PERFIL EVOLUTIVO

> **Para pegar en la conversación de desarrollo de ARISE.** Convierte tus directrices de diseño
> y los 4 renders del avatar en tokens y componentes implementables. Acompaña al prototipo HTML
> `arise_profile_prototype.html` (ese es la referencia visual viva; esto es la receta).

---

## 1. Sistema de avatar evolutivo (perfil)

4 estados de avatar ligados al **rango**, que se derivan del **nivel**. Cross-fade de 0.9 s
entre estados al cruzar umbral + animación de subida de nivel. Umbrales propuestos (ajustables):

| Tier | Rango | Nivel | Asset | Aura / feel |
|---|---|---|---|---|
| 1 | **E-Rank Hunter** | 1–24 | `avatar_1_erank_hunter.png` | limpio, luz neutra, sin aura |
| 2 | **Shadow Recruit** | 25–49 | `avatar_2_shadow_recruit.png` | más oscuro, cicatrices, chispas azules |
| 3 | **Shadow Commander** | 50–79 | `avatar_3_shadow_commander.png` | armadura, ojos con brillo constante, aura humeante a los pies |
| 4 | **The Shadow Monarch** | 80–100 | `avatar_4_shadow_monarch.png` | negro/púrpura, llamas oscuras, realidad agrietada |

Regla: `tier = último umbral ≤ nivel`. La paleta de toda la pantalla cambia con el tier (ver §2).

---

## 2. Tokens de color (design tokens)

```json
{
  "color": {
    "bg0": "#0D0D12", "bg1": "#1A1A24",
    "panel": "rgba(18,20,32,0.72)",
    "system": { "cyan": "#00F0FF", "blue": "#0088FF" },
    "monarch": { "violet": "#A855F7", "deep": "#5B00FF" },
    "danger": "#FF003C",
    "gold": "#FFD700",
    "text": "#FFFFFF", "textDim": "#E2E8F0"
  },
  "tierAccent": {
    "1": { "accent": "#00F0FF", "accent2": "#0088FF", "aura": "0,240,255",  "glow": "0,240,255" },
    "2": { "accent": "#38B6FF", "accent2": "#1E6BFF", "aura": "40,120,255", "glow": "56,182,255" },
    "3": { "accent": "#8A9BFF", "accent2": "#5B00FF", "aura": "120,90,255", "glow": "138,155,255" },
    "4": { "accent": "#C084FC", "accent2": "#A855F7", "aura": "168,85,247", "glow": "192,132,252" }
  }
}
```

`accent`/`glow` se exponen como variables CSS a nivel raíz y **todo** (bordes, barras, botones,
sombras) las referencia → cambiar de tier retinta la UI completa sin tocar componentes.

---

## 3. UI / componentes

- **Ventanas holográficas:** fondo `panel` (opacity ~72%) + `backdrop-filter: blur(6px)`, borde
  1px `rgba(glow,.3)`, **esquinas biseladas** con `clip-path` (polígono con corte de 12px). Nada
  de esquinas redondeadas suaves — corte agresivo y afilado.
- **Tipografía:** títulos/sistema → sans condensada en mayúsculas con `letter-spacing` 2–3px;
  **números → monospace** (para que cambien sin saltar el layout: EXP, nivel, stats).
- **Texto del sistema (typewriter + glitch):** aparece letra por letra (~26 ms/carácter) con
  micro-desplazamiento aleatorio en X (±1.5px) en ~20% de los frames. Cursor `▮` parpadeante.
- **Botones:** clip biselado, borde neón; en hover/press → glow exterior + texto a blanco puro.
- **Barra EXP:** relleno degradado `accent2 → accent`, brillo exterior, "shine" que corre a la
  derecha. Barra de HP enemiga en `danger`.

---

## 4. VFX

**A. Subida de nivel** — columna de luz (accent) que sube desde el pie del avatar, flash del
texto **"¡NIVEL AUMENTADO!"**, y **shake** ligero de la app (0.5 s). Si el nivel cruza un
umbral de rango, encadenar toast **"RANGO ASCENDIDO → {rango}"**.

**B. Extracción de sombra / Arise** — ver §5.

**C. Navegación** — transiciones rápidas, corte limpio o cortina de humo oscuro que se disipa;
hover con glow azul.

---

## 5. Secuencia de derrota de jefe + Arise (clímax)

Tres fases, disparadas cuando el HP del jefe = 0:

1. **Golpe final** — micro-freeze + cámara lenta; el entorno se oscurece y siluetea al avatar y
   al jefe.
2. **Intervención del Sistema** — ventana holográfica cian entra de golpe con sonido cristalino;
   texto typewriter + glitch: **"EXTRACCIÓN DE SOMBRA POSIBLE"**.
3. **"Levántate" (Arise)** — el jugador toca el botón / desliza hacia arriba → llamarada de aura
   púrpura-negra desde el cadáver, tornado de humo, **bass drop**, y la nueva sombra se pone de
   pie abriendo ojos brillantes. Se añade una carta al **Ejército de Sombras**.

**Animaciones reales:** ya tienes 3 videos de "SHADOW EXTRACTION" (10 s, 720×1280, uno por
transición de rango) que contienen la secuencia completa (jefe → extracción → SUCCESS/LEVEL UP).
En el prototipo se disparan con `playTransition(toTier)`: al cruzar un umbral de rango se
reproduce el video, y al terminar (`ended`) se asienta el nuevo avatar y se suma una sombra al
ejército. Mapeo:

| Transición | Nivel | Video | Contenido |
|---|---|---|---|
| Hunter → Recruit | 25 | `trans_A.mp4` | Caballero rojo (Igris), jugador en tank top |
| Recruit → Commander | 50 | `trans_B.mp4` | Bestia/demonio, llamas púrpura |
| Commander → Monarch | 80 | `trans_C.mp4` | Jugador ya con armadura, cierra en "LEVEL 4" |

---

## 6. SFX (disparadores)

| Evento | Sonido |
|---|---|
| Notificación de sistema | electrónico agudo y limpio tipo cristal (*ting*) |
| Panel Monarca / ejército de sombras | drone de graves profundos constante |
| Navegación de inventario/ajustes | clic metálico seco y rápido |
| Subida de nivel | swell ascendente + destello |
| Arise (fase 3) | **bass drop** fuerte al levantarse la sombra |

---

## 7. Bloque de config pegable (perfil + tema en el estado de ARISE)

```json
{
  "themeVersion": "1.0-solo-leveling",
  "profile": {
    "name": "DAVID",
    "avatarSystem": {
      "driver": "level",
      "tiers": [
        { "tier": 1, "rank": "E-Rank Hunter",     "minLevel": 1,  "asset": "avatar_1_erank_hunter.png",   "aura": "none" },
        { "tier": 2, "rank": "Shadow Recruit",    "minLevel": 25, "asset": "avatar_2_shadow_recruit.png", "aura": "sparks" },
        { "tier": 3, "rank": "Shadow Commander",  "minLevel": 50, "asset": "avatar_3_shadow_commander.png","aura": "smoke+eyes" },
        { "tier": 4, "rank": "The Shadow Monarch","minLevel": 80, "asset": "avatar_4_shadow_monarch.png",  "aura": "dark-flames+cracks" }
      ],
      "crossfadeMs": 900
    }
  },
  "leveling": {
    "xpToNext": "200 + level*100",
    "xpFromExercise": 10,
    "xpFromBoss": 20,
    "onLevelUp": ["beamLight", "flashText:¡NIVEL AUMENTADO!", "shakeApp"],
    "onRankUp": ["toast:RANGO ASCENDIDO"]
  },
  "arise": {
    "phases": ["freezeFrame+slowmo", "systemWindow:EXTRACCIÓN DE SOMBRA POSIBLE", "flare+smoke+bassDrop"],
    "reward": "shadowSoldier",
    "videoAssets": {
      "toTier2": "trans_A.mp4",
      "toTier3": "trans_B.mp4",
      "toTier4": "trans_C.mp4"
    },
    "trigger": "playTransition(newTier) al cruzar umbral de rango; onEnded → asentar avatar + sumar sombra"
  }
}
```

### Notas para quien implemente
- **XP/nivel:** encaja con tu economía actual (`XP_EXERCISE=10`, `XP_BOSS=20`). La fórmula
  `xpToNext` de arriba es la del prototipo; sustitúyela por la real de ARISE si difiere — el
  sistema de tiers es independiente de la curva de XP.
- **Un solo punto de verdad para el tema:** expón `--accent`, `--accent2`, `--aura`, `--glow`
  como CSS vars y deriva todo de ahí; cambiar `data-tier` en el contenedor raíz retinta la app.
- **Assets:** los 4 PNG (avatar por rango) vienen del grid recortado (480×480). Los 3 videos de
  transición (`trans_A/B/C.mp4`) son las secuencias Arise/level-up entre rangos. En el prototipo
  van comprimidos a 480px y embebidos como data-URI; en producción sírvelos como archivos
  (`preload="auto"`) para no inflar el bundle. El `avatarSystem` (PNG estático) y el
  `arise.videoAssets` (video de transición) son independientes: el PNG es el estado en reposo, el
  video solo se reproduce al subir de rango.
- **Accesibilidad:** respeta `prefers-reduced-motion` para el shake, el beam y el humo.
