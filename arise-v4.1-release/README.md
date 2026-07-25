# ARISE v4.1 — release lista para GitHub

Esta carpeta reemplaza directamente lo que hay en tu repo `tigredohko-oss/Arise`.
Incluye la app completa (v4.0 real + rutina v5.0 + perfil evolutivo Solo Leveling),
ya probada en navegador headless: carga sin errores, la rutina v5.0 queda como
preset, el avatar cambia por rango y el video de transición se dispara al cruzar
de tier.

## ⚠️ Hallazgo importante antes de subir esto

Tu sitio en vivo (`https://tigredohko-oss.github.io/Arise/`) **está sirviendo v3.4,
no v4.0**. Lo que pasó: subiste el v4.0 real, pero como ya existía un `index.html`
en el repo, GitHub lo renombró solo a `index_1.html` en vez de reemplazarlo — así
que Pages nunca llegó a usarlo. Ese archivo viejo (v3.4) no tiene medidas de pecho/
hombros ni el editor de rutina. Esta subida corrige eso de una vez.

## Contenido

```
index.html                              ← la app completa (reemplaza al index.html actual del repo)
assets/avatars/avatar_1..4_*.png        ← avatar por rango
assets/transitions/trans_A/B/C_*.mp4    ← animación al cruzar de rango
```

## Qué cambió respecto a lo que tienes en producción (v3.4)

- Todo lo de v4.0 que nunca llegó a publicarse: rutina editable, días dinámicos,
  presets de fábrica, medidas de pecho y hombros.
- **Rutina v5.0**: mismo split Upper/Lower 4 días, ejercicios afinados con
  evidencia 2024-2025 (posición estirada, RIR y descansos explícitos en cada
  ejercicio). 4 días · 25 ejercicios · 530 XP por semana perfecta.
- **Perfil evolutivo**: el avatar del header (`#sigil`) ahora muestra tu foto de
  rango en vez del hexágono con letra. Rango E/D → E-Rank Hunter · C/B → Shadow
  Recruit · A → Shadow Commander · S → The Shadow Monarch.
- **Animación de ascenso de rango**: al subir de nivel y cruzar a un rango de
  tier superior (ej. de D a C), se reproduce a pantalla completa el video de
  "Shadow Extraction" correspondiente antes de mostrar el LEVEL UP normal.
  Subir de nivel dentro del mismo tier se comporta exactamente igual que antes.
- Versión bump: `v4.0` → **`v4.1`**. `SCHEMA` se mantiene en `4` — no hace falta
  ninguna migración especial, tu progreso, XP, records y medidas se conservan.

## Cómo subirlo a GitHub (reemplazando correctamente, sin duplicar)

**El error de la vez pasada fue subir un archivo nuevo con el mismo nombre por
la web — GitHub lo renombra en vez de reemplazarlo.** Dos formas de hacerlo bien:

### Opción A — Borrar y volver a subir (web, sin terminal)

1. Entra a **github.com/tigredohko-oss/Arise**.
2. Abre el `index.html` actual (el viejo, v3.4) → ícono de basura 🗑 → **Delete file**
   → confirma el commit de borrado ("Delete index.html").
3. **Add file → Upload files** → arrastra el `index.html` de esta carpeta (el nuevo,
   v4.1) → **Commit changes**.
4. **Add file → Upload files** de nuevo → arrastra la carpeta **`assets`** completa
   (GitHub conserva `assets/avatars/...` y `assets/transitions/...`) → **Commit changes**.
5. (Limpieza opcional pero recomendada) Borra también `index_1.html` y
   `arise-v3.3.html` del repo — ya no se usan y solo generan confusión.

### Opción B — Git por terminal (más seguro, reemplaza en un solo paso)

```bash
git clone https://github.com/tigredohko-oss/Arise.git
cd Arise
cp /ruta/a/esta/carpeta/index.html ./index.html      # sobrescribe directamente
cp -r /ruta/a/esta/carpeta/assets ./assets
rm -f index_1.html arise-v3.3.html                     # limpieza opcional
git add index.html assets
git rm --cached index_1.html arise-v3.3.html 2>/dev/null || true
git commit -m "ARISE v4.1: rutina v5.0 + perfil evolutivo Solo Leveling"
git push origin main
```

Espera 1-2 min al deploy de Pages y recarga
**`https://tigredohko-oss.github.io/Arise/`** (fuerza refresh / borra caché si tu
navegador guardó la versión vieja como PWA instalada).

## Paso obligatorio después de publicar: aplicar la rutina v5.0 a tu progreso guardado

Importante — esto **no es automático** para ti porque tu perfil ya tiene una
rutina guardada en el navegador (el cambio de v4.0→v4.1 no dispara migración de
rutina, solo la trae para perfiles nuevos). Tienes que aplicarla una vez:

1. Abre la app → pestaña **RUTINA**.
2. Botón **"UPPER/LOWER 4D"** (recarga el preset de fábrica).
3. Confirma el diálogo. Esto:
   - Reemplaza tus 4 días con los ejercicios/notas de v5.0.
   - Conserva tu XP total (se consolida, no se pierde nada).
   - Conserva tus récords (PRs) de los ejercicios cuyo **nombre no cambió**
     (ej. "Chest-Supported Row", "Leg Press", "Romanian Deadlift", "Hip Thrust").
   - Los ejercicios con nombre nuevo (ej. "Incline Barbell Press 30-45°" ahora es
     "Incline DB Press 30°") arrancan sin PR — es normal, es un ejercicio distinto
     para el sistema de récords, aunque trabaje el mismo músculo.
4. Se guarda un respaldo automático antes del cambio (pestaña DATA → Respaldos),
   por si quieres revertir.

## Verificación rápida post-publicación

- Header muestra **v4.1** en la esquina.
- El avatar circular junto a "HUNTER · DAVE" es tu foto (no el hexágono con letra).
- Pestaña RUTINA (después del paso anterior) muestra "UPPER / LOWER · 4 DÍAS ·
  v5.0 HIPERTROFIA" y notas de RIR bajo cada ejercicio.
- Sube de rango (o simula desde DATA/backups) para ver el video de transición.

## Nota técnica para la próxima conversación de desarrollo

El mapeo rango→tier→avatar/video vive en la constante `TIERS` cerca de `RANKS`
en el `<script>` del `index.html`. Los umbrales de rango (E/D/C/B/A/S → niveles
1/5/10/18/28/40) no cambiaron — es la misma progresión de siempre, solo se le
puso una cara encima. Si más adelante quieres más de 4 ilustraciones (una por
cada uno de los 6 rangos en vez de agrupar), la estructura ya está lista para
extenderse: solo hay que añadir entradas a `TIERS` y sus assets correspondientes.
