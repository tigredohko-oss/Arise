# ARISE · Paquete Solo Leveling (perfil evolutivo)

Assets, especificaciones y prototipo para el rediseño anime del perfil de **ARISE**
(backlog #7 + rediseño de avatar de rango). Todo listo para subir al repo `tigredohko-oss/Arise`.

## Contenido

```
arise-solo-leveling-pack/
├── README.md                         ← este archivo (instrucciones)
├── assets/
│   ├── avatars/                      ← avatar en reposo, uno por tier (512×512 PNG)
│   │   ├── avatar_1_erank_hunter.png
│   │   ├── avatar_2_shadow_recruit.png
│   │   ├── avatar_3_shadow_commander.png
│   │   └── avatar_4_shadow_monarch.png
│   └── transitions/                  ← animación Shadow Extraction al subir de rango (mp4, 480px, ~0.7 MB)
│       ├── trans_A_hunter-to-recruit.mp4
│       ├── trans_B_recruit-to-commander.mp4
│       └── trans_C_commander-to-monarch.mp4
├── design/
│   ├── rutina_hipertrofia_ARISE_v5.md    ← rutina v5 + JSON con schema de rutina de la app
│   └── arise_tema_solo_leveling_spec.md  ← tokens de color, UI, VFX/SFX, secuencia Arise
└── prototype/
    └── perfil_prototype.html         ← demo autocontenida (abre en el navegador para ver el objetivo)
```

---

## Mapeo de avatar por rango (ajústalo a tu curva real)

La app ya tiene 6 rangos — **E(1) · D(5) · C(10) · B(18) · A(28) · S(40)** — y 4 ilustraciones.
Mapeo recomendado (el video se reproduce al **cruzar** el umbral):

| Tier | Avatar | Rangos | Nivel | Video de entrada |
|---|---|---|---|---|
| 1 | `avatar_1_erank_hunter.png`    | E · D | 1–9   | — |
| 2 | `avatar_2_shadow_recruit.png`  | C · B | 10–27 | `trans_A_hunter-to-recruit.mp4` (al llegar a C / Lv 10) |
| 3 | `avatar_3_shadow_commander.png`| A     | 28–39 | `trans_B_recruit-to-commander.mp4` (al llegar a A / Lv 28) |
| 4 | `avatar_4_shadow_monarch.png`  | S     | 40+   | `trans_C_commander-to-monarch.mp4` (al llegar a S / Lv 40) |

Los umbrales son ajustables. Puedes mantener los códigos E/D/C/B/A/S o renombrar los rangos al
estilo Solo Leveling (E-Rank Hunter → Shadow Monarch); es solo texto.

---

## Cómo subirlo a GitHub

> Recordatorio del proyecto: la publicación la haces tú a mano (desde las sesiones de Claude no
> hay escritura al repo). Estos son los pasos exactos.

### Opción A — Web (la más simple, sin terminal)

1. Entra a **https://github.com/tigredohko-oss/Arise**
2. Botón **Add file → Upload files**.
3. Arrastra la carpeta **`assets`** completa (avatars + transitions) a la zona de carga.
   GitHub conserva la estructura de carpetas.
4. (Opcional) Arrastra también **`design`** y **`prototype`** si quieres versionarlos en el repo.
5. Abajo, en **Commit changes**, escribe un mensaje (ej. `Add Solo Leveling avatar pack`) y
   pulsa **Commit changes**.
6. Espera 1–2 min al deploy de Pages y verás los assets en
   `https://tigredohko-oss.github.io/Arise/assets/avatars/avatar_1_erank_hunter.png`

### Opción B — Git por terminal

```bash
git clone https://github.com/tigredohko-oss/Arise.git
cd Arise
# copia aquí las carpetas assets/ (y design/, prototype/ si quieres)
git add assets design prototype
git commit -m "Add Solo Leveling avatar pack (avatares + transiciones + spec)"
git push origin main
```

> No subas ningún `arise-*.json` (respaldo con datos personales). Tu `.gitignore` ya lo cubre.

---

## Cómo usarlo

**1. Ver el objetivo.** Abre `prototype/perfil_prototype.html` en el navegador. Arrastra el slider
"Simular nivel" para ver la evolución del avatar y las animaciones. Es una **demo de referencia**,
no la app — sirve para que tú (o la conversación de desarrollo) vean exactamente qué construir.

**2. Integrar en la app (`index.html`).** En la conversación donde mejoras ARISE, pega los dos
archivos de `design/`:
   - `rutina_hipertrofia_ARISE_v5.md` → contiene el JSON con el schema de rutina para cargar la v5.
   - `arise_tema_solo_leveling_spec.md` → tokens de color, componentes de UI, VFX/SFX y el bloque
     `profile.avatarSystem` + `arise.videoAssets`.

   Luego referencia los assets desde el estado/perfil (rutas relativas dentro del repo):
   ```js
   avatar:  "assets/avatars/avatar_2_shadow_recruit.png"
   arise:   "assets/transitions/trans_A_hunter-to-recruit.mp4"
   ```

**3. Lógica de disparo.** El avatar PNG es el **estado en reposo** (cambia por rango). El video
solo se reproduce **al cruzar un umbral de rango**; al terminar (`onended`) se asienta el nuevo
avatar. La demo lo implementa en `playTransition(toTier)` — cópiala como referencia.

**Rendimiento:** en la app sirve los `.mp4` como **archivos** (`<video preload="auto">`), NO
embebidos en base64 como en la demo. Los videos van a 480px para carga rápida en móvil.
Respeta `prefers-reduced-motion` para quien tenga animaciones reducidas.
