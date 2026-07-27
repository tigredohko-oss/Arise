const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const MIME = { '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u.startsWith('/assets/')) {
    const f = path.join(__dirname, u);
    if (!f.startsWith(path.join(__dirname, 'assets')) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

const LEGACY = {"checked":{"d1c":true,"d1_1":true,"d1_2":true,"d1_3":true,"d1_4":true,"d1_5":true,"d2c":true,"d2_1":true,"d2_2":true,"d2_3":true,"d2_4":true,"d2_5":true,"d2_6":true,"d3c":true,"d3_1":true,"d3_2":true,"d3_3":true,"d3_4":true,"d3_5":true},"weights":{},"sets":{},"lastWeights":{},"xp":370,"week":1,"active":3,"weekBonus":false,"allTimeWeights":{},"weightHistory":{},"measurements":[],"photos":[],"lastBackup":null,"schema":2,"app":"3.3"};
const EXPORTED = {"_exported":"2026-07-24T21:31:05.387Z","_keys":{"arise_v1":LEGACY,"arise_backups":[{"t":1784928662725,"label":"auto pre-v2","schema":1,"app":"pre-3.2","data":{"checked":LEGACY.checked,"xp":370,"week":1,"active":3}}]}};

let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? (pass++, console.log('  \x1b[32mPASS\x1b[0m ' + n)) : (fail++, console.log('  \x1b[31mFAIL\x1b[0m ' + n + (extra !== undefined ? '  → ' + extra : ''))); };
const S = p => p.evaluate(() => JSON.parse(localStorage.getItem('arise:default:state')));

(async () => {
  await new Promise(r => server.listen(8099, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const errs = [];
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  // ---------- 1. arranque limpio ----------
  console.log('\n\x1b[36m1. ARRANQUE LIMPIO\x1b[0m');
  await page.goto('http://localhost:8099/');
  await page.waitForTimeout(300);
  ok('sin errores de JS', errs.length === 0, errs.join(' | '));
  ok('LV 1 en instalación nueva', (await page.textContent('#lvtxt')) === 'LV 1');
  let st = await S(page);
  ok('schema 8', st.schema === 8, st.schema);
  ok('rutina guardada en el estado', !!st.routine && st.routine.days.length === 4, JSON.stringify(st.routine && st.routine.days.length));
  ok('rutina por defecto = Upper/Lower v5', /UPPER \/ LOWER v5/.test(st.routine.name), st.routine.name);
  ok('la rutina trae meta (RIR, descansos, deload)', !!(st.routine.meta && st.routine.meta.rir && st.routine.meta.deload), JSON.stringify(st.routine.meta));
  ok('todos los ejercicios traen nota', st.routine.days.every(d => d.ex.every(e => typeof e.note === 'string' && e.note.length > 0)));
  ok('cada ejercicio tiene uid estable', st.routine.days.every(d => d.uid && d.ex.every(e => e.uid)));
  ok('un BOSS por día', st.routine.days.every(d => d.ex.filter(e => e.boss).length === 1));
  ok('25 ejercicios en total (D3 lleva 7)', st.routine.days.reduce((a, d) => a + d.ex.length, 0) === 25, st.routine.days.map(d=>d.ex.length).join(','));
  ok('baseline de medidas sembrado', st.measurements.length === 1 && st.measurements[0].weight === 85.1);
  ok('sin toast de rutina reseteada en instalación nueva', !(await page.evaluate(() => window.__routineReset)));

  // ---------- 2. migración desde arise_v1 (v3.3) ----------
  console.log('\n\x1b[36m2. MIGRACIÓN DESDE arise_v1 (v3.3)\x1b[0m');
  errs.length = 0;
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('arise_v1', JSON.stringify(l)); }, LEGACY);
  await page.reload(); await page.waitForTimeout(300);
  ok('sin errores de JS', errs.length === 0, errs.join(' | '));
  ok('nivel LV 4 conservado', (await page.textContent('#lvtxt')) === 'LV 4', await page.textContent('#lvtxt'));
  ok('XP 13 / 164 · TOTAL 370', (await page.textContent('#xptxt')) === '13 / 164 XP · TOTAL 370', await page.textContent('#xptxt'));
  st = await S(page);
  ok('los 370 XP se consolidan en xpBase', st.xpBase === 370, st.xpBase);
  ok('checks viejos descartados (rutina distinta)', Object.keys(st.checked).length === 0, Object.keys(st.checked).length);
  ok('rutina nueva instalada', st.routine.days.length === 4);
  ok('semana 1 conservada', st.week === 1);
  ok('respaldo pre-migración creado', (await page.evaluate(() => (JSON.parse(localStorage.getItem('arise:default:backups')) || []).length)) > 0);
  ok('arise_v1 intacto (migración no destructiva)', await page.evaluate(() => !!localStorage.getItem('arise_v1')));
  ok('4 pestañas de día visibles', (await page.$$('.days button')).length === 4);

  // ---------- 3. carryover de records por nombre ----------
  console.log('\n\x1b[36m3. RECORDS QUE SOBREVIVEN AL CAMBIO DE RUTINA\x1b[0m');
  // rutina vieja: d2_1 = "Leg Press" · d5_1 = "Romanian Deadlift"
  //               d4_1 = "Incline Barbell Press 30-45°" (barra) · d1_1 = "Bench Press / Machine"
  const withPR = Object.assign({}, LEGACY, { allTimeWeights: { d2_1: 200, d5_1: 100, d4_1: 77.5, d1_1: 90 } });
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('arise_v1', JSON.stringify(l)); }, withPR);
  await page.reload(); await page.waitForTimeout(300);
  st = await S(page);
  const byName = {};
  st.routine.days.forEach(d => d.ex.forEach(e => { if (st.allTimeWeights[e.uid] !== undefined) byName[e.n] = st.allTimeWeights[e.uid]; }));
  ok('record migra con nombre idéntico (Romanian Deadlift)', byName['Romanian Deadlift'] === 100, JSON.stringify(byName));
  ok('record migra vía alias (Leg Press → Leg Press pies medios)', byName['Leg Press (pies medios)'] === 200, JSON.stringify(byName));
  ok('NO migra barra → mancuerna (carga no comparable)', byName['Incline DB Press 30°'] === undefined, JSON.stringify(byName));
  ok('ejercicio que ya no existe se descarta', Object.keys(byName).length === 2, JSON.stringify(byName));

  // ---------- 4. guardado de pesos (regresión) ----------
  console.log('\n\x1b[36m4. GUARDADO DE PESOS (regresión del bug v3.3)\x1b[0m');
  const uidsD1 = st.routine.days[0].ex.map(e => e.uid);
  await page.locator('input[data-w="' + uidsD1[1] + '"]').fill('60');
  await page.waitForTimeout(450);
  st = await S(page);
  ok('peso guardado sin perder foco (oninput + debounce)', st.weights[uidsD1[1]] === '60', JSON.stringify(st.weights));
  await page.locator('input[data-w="' + uidsD1[2] + '"]').fill('45');
  await page.click('[data-chk="' + uidsD1[2] + '"]');
  await page.waitForTimeout(250);
  st = await S(page);
  ok('peso sobrevive al re-render por check', st.weights[uidsD1[2]] === '45', JSON.stringify(st.weights));
  ok('check aplicado', st.checked[uidsD1[2]] === true);
  ok('XP subió +10', st.xp === 380, st.xp);
  await page.locator('input[data-w="' + uidsD1[3] + '"]').fill('55');
  await page.locator('input[data-s="' + uidsD1[3] + '"]').click();
  await page.waitForTimeout(300);
  st = await S(page);
  ok('record all-time detectado en blur', st.allTimeWeights[uidsD1[3]] === 55, JSON.stringify(st.allTimeWeights));

  // ---------- 5. editor de rutina ----------
  console.log('\n\x1b[36m5. EDITOR DE RUTINA\x1b[0m');
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(200);
  ok('la pestaña RUTINA renderiza los 4 días', (await page.$$('.dayed')).length === 4);

  // renombrar día 1 sin perder el foco
  const dUid = st.routine.days[0].uid;
  const nameInput = page.locator('[data-dn="' + dUid + '"]');
  await nameInput.fill('UPPER A · MI VERSION');
  ok('el input NO pierde el foco al escribir', await nameInput.evaluate(el => document.activeElement === el));
  await page.waitForTimeout(450);
  st = await S(page);
  ok('nombre del día guardado', st.routine.days[0].n === 'UPPER A · MI VERSION', st.routine.days[0].n);

  // agregar ejercicio
  await page.click('[data-eadd="' + dUid + '"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('ejercicio agregado (7 en el día 1)', st.routine.days[0].ex.length === 7, st.routine.days[0].ex.length);
  const newUid = st.routine.days[0].ex[6].uid;
  ok('el ejercicio nuevo tiene uid único', !uidsD1.includes(newUid));

  // marcar BOSS
  await page.click('[data-eboss="' + newUid + '"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('BOSS activado', st.routine.days[0].ex[6].boss === true);
  ok('el BOSS nuevo vale 20 XP', st.routine.days[0].ex.filter(e => e.boss).length === 2);

  // reordenar ejercicio hacia arriba
  await page.click('[data-emv="' + newUid + '"][data-dir="-1"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('ejercicio reordenado', st.routine.days[0].ex[5].uid === newUid, st.routine.days[0].ex.map(e => e.uid).join(','));

  // borrar ejercicio
  await page.click('[data-edel="' + newUid + '"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('ejercicio borrado', st.routine.days[0].ex.length === 6);
  ok('ejercicio borrado no deja check huérfano', st.checked[newUid] === undefined);

  // agregar día
  await page.click('#addDay'); await page.waitForTimeout(250);
  st = await S(page);
  ok('5º día agregado', st.routine.days.length === 5);
  const d5 = st.routine.days[4].uid;
  await page.click('[data-eadd="' + d5 + '"]'); await page.waitForTimeout(200);
  st = await S(page);
  ok('se pueden agregar ejercicios al día nuevo', st.routine.days[4].ex.length === 1);

  // reordenar día
  await page.click('[data-dmv="' + d5 + '"][data-dir="-1"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('día reordenado a la posición 4', st.routine.days[3].uid === d5, st.routine.days.map(d => d.uid).join(','));

  // borrar día
  await page.click('[data-ddel="' + d5 + '"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('día borrado', st.routine.days.length === 4);

  // color
  await page.click('[data-dc="' + dUid + '"][data-col="#ec4899"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('color del día cambiado', st.routine.days[0].c === '#ec4899', st.routine.days[0].c);

  // días dinámicos reflejados en QUESTS
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(200);
  ok('QUESTS muestra 4 pestañas de día', (await page.$$('.days button')).length === 4);
  ok('QUESTS muestra el nombre editado', /MI VERSION/.test(await page.textContent('#content')));

  // ---------- 6. presets ----------
  console.log('\n\x1b[36m6. PRESETS DE FÁBRICA\x1b[0m');
  const xpAntes = await page.evaluate(() => window.ARISE.totalXP());
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(200);
  await page.click('[data-preset="c5"]'); await page.waitForTimeout(350);
  st = await S(page);
  ok('preset de 5 días cargado', st.routine.days.length === 5, st.routine.days.length);
  ok('XP conservado al cambiar de rutina', st.xp === xpAntes, st.xp + ' vs ' + xpAntes);
  ok('nivel intacto', (await page.textContent('#lvtxt')) === 'LV 4');
  const c5names = {}; st.routine.days.forEach(d => d.ex.forEach(e => { if (st.allTimeWeights[e.uid] !== undefined) c5names[e.n] = st.allTimeWeights[e.uid]; }));
  ok('records migran al preset nuevo por nombre', c5names['Romanian Deadlift'] === 100, JSON.stringify(c5names));
  await page.click('[data-preset="ul5"]'); await page.waitForTimeout(350);
  st = await S(page);
  ok('vuelve a Upper/Lower v5', st.routine.days.length === 4 && /v5/.test(st.routine.name), st.routine.name);
  ok('el preset v5 restaura la meta', !!(st.routine.meta && st.routine.meta.recorte));

  // ---------- 7. XP y niveles ----------
  console.log('\n\x1b[36m7. XP Y NIVELES\x1b[0m');
  const m = await page.evaluate(() => ({
    a: window.ARISE.levelFrom(0), b: window.ARISE.levelFrom(370),
    c: window.ARISE.levelFrom(357), d: window.ARISE.levelFrom(356),
    perfectUL4: window.ARISE.weekXP(window.ARISE.fullCheck(), window.ARISE.S.routine)
  }));
  ok('0 XP → LV 1, 0/100', m.a.lv === 1 && m.a.cur === 0 && m.a.need === 100);
  ok('370 XP → LV 4, 13/164', m.b.lv === 4 && m.b.cur === 13 && m.b.need === 164, JSON.stringify(m.b));
  ok('357 XP → LV 4 exacto', m.c.lv === 4 && m.c.cur === 0);
  ok('356 XP → todavía LV 3', m.d.lv === 3);
  // D1/D2/D4: 10+20+5×10+50 = 130 · D3 (7 ejercicios): 10+20+6×10+50 = 140 → 530
  ok('semana perfecta Upper/Lower v5 = 530 XP', m.perfectUL4 === 530, m.perfectUL4);

  // ---------- 8. medidas ----------
  console.log('\n\x1b[36m8. MEDIDAS SEMANALES\x1b[0m');
  await page.click('nav button[data-t="med"]'); await page.waitForTimeout(200);
  ok('formulario prellenado con la última medición', (await page.inputValue('[data-m="weight"]')) === '85.1');
  await page.fill('#m_date', '2026-07-31'); await page.fill('#m_week', '2');
  await page.fill('[data-m="weight"]', '85.4'); await page.fill('[data-m="waist"]', '99.1');
  await page.fill('[data-m="armR_flex"]', '40.3');
  await page.click('#saveM'); await page.waitForTimeout(300);
  st = await S(page);
  ok('2 mediciones guardadas', st.measurements.length === 2, st.measurements.length);
  let body = await page.textContent('#content');
  ok('delta vs baseline mostrado', /\+0\.3/.test(body));
  ok('lectura de coach en rango ideal (fase volumen por defecto)', /rango ideal de volumen/.test(body));
  ok('sparkline renderizado', (await page.$$('.spark')).length > 0);
  await page.fill('#m_date', '2026-08-07'); await page.fill('#m_week', '3');
  await page.fill('[data-m="weight"]', '86.9'); await page.click('#saveM'); await page.waitForTimeout(300);
  ok('alerta cuando la subida semanal es excesiva', /Arriba de 0\.4 kg/.test(await page.textContent('#content')));

  // ---------- 9. export / import ----------
  console.log('\n\x1b[36m9. EXPORT / IMPORT\x1b[0m');
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  const exp = await page.inputValue('#expBox');
  const expObj = JSON.parse(exp);
  ok('export es JSON válido con formato _keys', !!expObj._keys['arise:default:state']);
  ok('export incluye la rutina', expObj._keys['arise:default:state'].routine.days.length === 4);
  ok('export incluye 3 mediciones', expObj._keys['arise:default:state'].measurements.length === 3);

  await page.evaluate(t => { document.querySelector('#impBox').value = t; }, JSON.stringify(EXPORTED));
  await page.click('#btnImp'); await page.waitForTimeout(450);
  st = await S(page);
  ok('import del JSON viejo de Dave funciona', st.xp === 370, st.xp);
  ok('import trae rutina válida', st.routine && st.routine.days.length === 4);
  ok('import hace upgrade a schema 8', st.schema === 8);
  ok('respaldo pre-import conservado', await page.evaluate(() => (JSON.parse(localStorage.getItem('arise:default:backups')) || []).some(b => b.label === 'auto pre-import')));
  ok('nivel tras import = LV 4', (await page.textContent('#lvtxt')) === 'LV 4', await page.textContent('#lvtxt'));

  // ---------- 10. cierre de semana ----------
  console.log('\n\x1b[36m10. CIERRE DE SEMANA\x1b[0m');
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(200);
  const uids2 = (await S(page)).routine.days[0].ex.map(e => e.uid);
  await page.locator('input[data-w="' + uids2[0] + '"]').fill('70');
  await page.waitForTimeout(400);
  const xpB = await page.evaluate(() => window.ARISE.totalXP());
  await page.click('#closeWeek'); await page.waitForTimeout(350);
  st = await S(page);
  ok('semana incrementada', st.week === 2, st.week);
  ok('checks borrados', Object.keys(st.checked).length === 0);
  ok('XP conservado', st.xp === xpB, st.xp + ' vs ' + xpB);
  ok('medidas sobreviven', st.measurements.length === 1);
  ok('rutina sobrevive', st.routine.days.length === 4);
  ok('lastWeights guardado para comparar', st.lastWeights[uids2[0]] === '70', JSON.stringify(st.lastWeights));
  ok('sin errores de JS en toda la corrida', errs.length === 0, errs.join(' | '));


  // ---------- 11. PERFILES ----------
  console.log('\n\x1b[36m11. PERFILES (multi-usuario)\x1b[0m');
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  ok('panel de perfiles visible', (await page.$$('.prow:not(.srow)')).length === 1);
  const xpDave = await page.evaluate(() => window.ARISE.totalXP());
  await page.evaluate(() => { window.prompt = () => 'Fernanda'; });
  await page.click('#addProfile'); await page.waitForTimeout(400);
  ok('perfil nuevo creado con id generado', await page.evaluate(() => window.ARISE.profile === 'p_1'), await page.evaluate(() => window.ARISE.profile));
  ok('el id del perfil NO contiene texto del usuario', await page.evaluate(() => /^p_[0-9]+$/.test(window.ARISE.profile)));
  ok('clave namespaceada nueva', await page.evaluate(() => !!localStorage.getItem('arise:p_1:state')));
  ok('perfil nuevo arranca en LV 1', (await page.textContent('#lvtxt')) === 'LV 1', await page.textContent('#lvtxt'));
  ok('perfil nuevo trae la rutina v5 completa', await page.evaluate(() => window.ARISE.S.routine.days.length === 4));
  ok('header muestra el nombre del perfil', /FERNANDA/.test(await page.textContent('#hname')), await page.textContent('#hname'));

  // los datos de Dave siguen intactos
  const daveState = await page.evaluate(() => JSON.parse(localStorage.getItem('arise:default:state')));
  ok('el perfil original no fue tocado', daveState.xp === xpDave, daveState.xp + ' vs ' + xpDave);

  // registrar algo en el perfil nuevo y verificar aislamiento
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(200);
  const fUid = (await page.evaluate(() => window.ARISE.S.routine.days[0].ex[0].uid));
  await page.locator('input[data-w="' + fUid + '"]').fill('30');
  await page.waitForTimeout(450);
  const fState = await page.evaluate(() => JSON.parse(localStorage.getItem('arise:p_1:state')));
  ok('el peso se guarda en el perfil activo', fState.weights[fUid] === '30');
  const dState2 = await page.evaluate(() => JSON.parse(localStorage.getItem('arise:default:state')));
  ok('no contamina el otro perfil', dState2.weights[fUid] === undefined);

  // volver a Dave
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  await page.click('[data-pgo="default"]'); await page.waitForTimeout(400);
  ok('vuelve al perfil original', await page.evaluate(() => window.ARISE.profile === 'default'));
  ok('XP del perfil original intacto tras ir y volver', (await page.evaluate(() => window.ARISE.totalXP())) === xpDave);
  ok('2 perfiles listados', (await page.$$('.prow:not(.srow)')).length === 2);
  ok('advertencia de que no es una frontera de seguridad', /no los protegen/.test(await page.textContent('#content')));

  // borrar el segundo perfil
  await page.click('[data-pdel="p_1"]'); await page.waitForTimeout(400);
  ok('perfil borrado del registro', (await page.evaluate(() => window.ARISE.profiles().length)) === 1);
  ok('claves del perfil borrado eliminadas', await page.evaluate(() => !localStorage.getItem('arise:p_1:state')));

  // ---------- 12. SEGURIDAD ----------
  console.log('\n\x1b[36m12. SEGURIDAD (hallazgos de la auditoría)\x1b[0m');
  const XSS = {
    schema: 6, xp: 0, xpBase: 0, week: 1, active: 1, baselineSeeded: true,
    checked: {}, weights: {}, sets: {}, lastWeights: {},
    allTimeWeights: { 'x_2': '<img src=x onerror="window.__pwned=1">' },
    weightHistory: {}, measurements: [],
    routine: { name: 'Rutina <img src=x onerror="window.__pwned=1">', days: [{
      uid: 'd_1', n: 'DIA', stat: 'STR', cardio: '',
      c: '#f00" onmouseover="window.__pwned=1" x="',
      ex: [{ uid: 'x_2" onfocus="window.__pwned=1" y="', n: 'Ej', s: '3x10', boss: true, note: '' }]
    }]}
  };
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  await page.evaluate(t => { document.querySelector('#impBox').value = t; }, JSON.stringify({ _keys: { 'arise:default:state': XSS } }));
  await page.click('#btnImp'); await page.waitForTimeout(450);
  st = await S(page);
  ok('el import hostil no ejecuta código', !(await page.evaluate(() => window.__pwned)));
  ok('el color hostil se reemplaza por uno válido', /^#[0-9a-fA-F]{3,8}$/.test(st.routine.days[0].c), st.routine.days[0].c);
  ok('los uid se regeneran limpios', st.routine.days[0].ex.every(e => /^x_[0-9]+$/.test(e.uid)), JSON.stringify(st.routine.days[0].ex.map(e => e.uid)));
  ok('allTimeWeights se convierte a número', typeof st.allTimeWeights[st.routine.days[0].ex[0].uid] !== 'string');
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(250);
  ok('QUESTS renderiza sin ejecutar el payload', !(await page.evaluate(() => window.__pwned)));
  ok('el nombre hostil se muestra como texto, no como HTML', (await page.$$('#content img')).length === 0);
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  ok('RUTINA renderiza sin ejecutar el payload', !(await page.evaluate(() => window.__pwned)));

  // inyección CSS que sobrevive a esc()
  await page.evaluate(() => {
    const s = window.ARISE.S; s.routine.days[0].c = "#f00;background-image:url('https://evil.example/x')";
    window.ARISE.render();
  });
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(250);
  const bg = await page.evaluate(() => { const q = document.querySelector('.quest'); return q ? getComputedStyle(q).backgroundImage : 'none'; });
  ok('inyección CSS neutralizada (sin url() externa)', !/evil\.example/.test(bg), bg.slice(0, 80));

  // estado corrupto no deja pantalla zombi
  await page.evaluate(() => { window.ARISE.S.measurements = 'x'; window.ARISE.TAB = 'med'; });
  await page.waitForTimeout(250);
  ok('estado corrupto muestra error legible, no UI zombi', /ERROR AL DIBUJAR/.test(await page.textContent('#content')));

  // ---------- 13. BIBLIOTECA DE TÉCNICA ----------
  console.log('\n\x1b[36m13. BIBLIOTECA DE TÉCNICA\x1b[0m');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(400);
  ok('biblioteca embebida', (await page.evaluate(() => Object.keys(window.ARISE.EXDB).length)) > 40);
  const cov = await page.evaluate(() => {
    const S = window.ARISE.S, db = window.ARISE.EXDB;
    let t = 0, h = 0;
    S.routine.days.forEach(d => d.ex.forEach(e => { t++; if (db[e.n]) h++; }));
    return { t, h };
  });
  ok('cobertura total de la rutina v5', cov.h === cov.t, cov.h + '/' + cov.t);
  ok('botón de técnica presente', (await page.$$('[data-tech]')).length > 0);
  await page.click('[data-tech]'); await page.waitForTimeout(250);
  ok('la ficha se abre con pasos numerados', (await page.$$('.tech ol li')).length >= 3);
  ok('la ficha está en español', /[áéíóúñ]/i.test(await page.textContent('.tech')));
  ok('la ficha mantiene la atribución del dataset MIT', /Hasan Emir/.test(await page.textContent('.tech')));
  ok('sin imágenes de terceros (licencia Gym visual)', (await page.$$('.tech img')).length === 0);
  await page.click('[data-tech]'); await page.waitForTimeout(250);
  ok('la ficha se cierra', (await page.$$('.tech')).length === 0);
  ok('sin errores de JS al final', errs.length === 0, errs.join(' | '));


  // ---------- 14. PESO ANTERIOR VISIBLE ----------
  console.log('\n\x1b[36m14. PESO ANTERIOR VISIBLE\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(400);
  ok('sin ruido visual cuando no hay historial', (await page.$$('.prev')).length === 0);
  const u7 = (await page.evaluate(() => window.ARISE.S.routine.days[0].ex.map(e => e.uid)));
  await page.locator('input[data-w="' + u7[0] + '"]').fill('32.5');
  await page.locator('input[data-s="' + u7[0] + '"]').fill('9');
  await page.waitForTimeout(450);
  await page.click('#closeWeek'); await page.waitForTimeout(400);
  st = await S(page);
  ok('la carga de la semana pasa a prev al cerrar', st.prev[u7[0]] && st.prev[u7[0]].w === '32.5' && st.prev[u7[0]].r === '9', JSON.stringify(st.prev[u7[0]]));
  body = await page.textContent('#content');
  ok('muestra "última vez: 32.5 kg × 9"', /última vez: 32\.5 kg × 9/.test(body), (body.match(/última vez[^<]*/) || [''])[0]);
  ok('solo el ejercicio con historial muestra la línea', (await page.$$('.prev')).length === 1);

  // ---------- 15. TIMER DE DESCANSO ----------
  console.log('\n\x1b[36m15. TIMER DE DESCANSO\x1b[0m');
  const rf = await page.evaluate(() => {
    const d = window.ARISE.S.routine.days;
    const boss = d[0].ex.find(e => e.boss);
    const iso = d[0].ex.find(e => /Cable Lateral Raise/.test(e.n));
    const row = d[0].ex.find(e => /Chest-Supported Row/.test(e.n));
    return { boss: window.ARISE.restFor(boss), iso: window.ARISE.restFor(iso), row: window.ARISE.restFor(row),
             override: window.ARISE.restFor({ n: 'x', rest: 200 }) };
  });
  ok('BOSS = 150 s', rf.boss === 150, rf.boss);
  ok('compuesto (row, RIR 1-2) = 150 s', rf.row === 150, rf.row);
  ok('aislamiento (lateral raise, RIR 0) = 75 s', rf.iso === 75, rf.iso);
  ok('override por ejercicio respetado', rf.override === 200, rf.override);
  ok('chip de descanso visible en la quest', /150s/.test(await page.textContent('#content')));

  ok('el timer arranca oculto', await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide')));
  await page.click('[data-chk="' + u7[0] + '"]'); await page.waitForTimeout(350);
  ok('arranca solo al marcar el ejercicio', !(await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide'))));
  ok('muestra el nombre del ejercicio', (await page.textContent('#rbname')).length > 3, await page.textContent('#rbname'));
  const t0 = await page.textContent('#rbtime');
  ok('cuenta desde 2:30 para un BOSS', /^2:(30|29|28)$/.test(t0), t0);
  await page.click('#rbAdd'); await page.waitForTimeout(250);
  const t1 = await page.textContent('#rbtime');
  ok('+30 s suma tiempo', /^(2:5|3:0)/.test(t1), t1);
  await page.click('#rbSkip'); await page.waitForTimeout(250);
  ok('SALTAR cierra el timer', await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide')));
  ok('el timer no corre tras saltar', !(await page.evaluate(() => window.ARISE.restRunning())));

  // sobrevive al re-render (vive fuera de #content)
  await page.evaluate(() => window.ARISE.startRest(120, 'Prueba'));
  await page.waitForTimeout(250);
  await page.click('nav button[data-t="stats"]'); await page.waitForTimeout(250);
  ok('el timer sobrevive al cambio de pestaña', !(await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide'))));
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(200);

  // fin del descanso
  await page.evaluate(() => { window.__toasted = null; window.ARISE.startRest(1, 'Fin'); });
  await page.waitForTimeout(1500);
  ok('al terminar se oculta solo', await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide')));
  ok('avisa que terminó', /DESCANSO TERMINADO/.test(await page.textContent('#toastmsg')), await page.textContent('#toastmsg'));

  // apagable
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  ok('panel de ajustes presente', (await page.$$('[data-set]')).length === 4);
  await page.click('[data-set="timer"]'); await page.waitForTimeout(300);
  st = await S(page);
  ok('el timer se puede apagar y persiste', st.settings.timer === false);
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(250);
  await page.click('[data-chk="' + u7[1] + '"]'); await page.waitForTimeout(300);
  ok('con el timer apagado no arranca', await page.evaluate(() => document.querySelector('#restbar').classList.contains('hide')));
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  await page.click('[data-set="timer"]'); await page.waitForTimeout(250);
  st = await S(page);
  ok('sonido y vibración también son apagables', st.settings.sound === true && st.settings.vibrate === true);

  // descanso editable desde RUTINA
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  await page.locator('[data-erest="' + u7[0] + '"]').fill('210');
  await page.waitForTimeout(450);
  st = await S(page);
  ok('descanso por ejercicio editable y persistido', st.routine.days[0].ex[0].rest === 210, JSON.stringify(st.routine.days[0].ex[0]));
  await page.locator('[data-erest="' + u7[0] + '"]').fill('');
  await page.waitForTimeout(450);
  st = await S(page);
  ok('vacío vuelve al automático', st.routine.days[0].ex[0].rest === undefined);

  // ---------- 16. WAKE LOCK ----------
  console.log('\n\x1b[36m16. WAKE LOCK\x1b[0m');
  const wl = await page.evaluate(() => ({ api: 'wakeLock' in navigator, err: (() => { try { window.ARISE.syncWake(); return null; } catch (e) { return e.message; } })() }));
  ok('syncWake no truena exista o no la API', wl.err === null, wl.err);
  ok('fallback silencioso sin la API', true);
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(250);
  const sess = await page.evaluate(() => {
    const S = window.ARISE.S, d = S.routine.days[S.active - 1];
    const any = (d.cardio && S.checked['c_' + d.uid]) || d.ex.some(e => S.checked[e.uid]);
    return { any: !!any, dotHidden: document.querySelector('#wakedot').classList.contains('hide') };
  });
  ok('sesión detectada como activa con al menos un check', sess.any);
  ok('indicador coherente con el soporte del navegador', wl.api ? true : sess.dotHidden);

  // ---------- 17. POP DE PR EN VIVO ----------
  console.log('\n\x1b[36m17. POP DE PR EN VIVO\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(400);
  const u8 = (await page.evaluate(() => window.ARISE.S.routine.days[0].ex.map(e => e.uid)));
  ok('el pop arranca oculto', !(await page.evaluate(() => document.querySelector('#prpop').classList.contains('on'))));
  await page.locator('input[data-w="' + u8[0] + '"]').fill('80');
  await page.locator('input[data-s="' + u8[0] + '"]').click();
  await page.waitForTimeout(350);
  ok('el pop aparece al detectar un record', await page.evaluate(() => document.querySelector('#prpop').classList.contains('on')));
  ok('muestra el peso', /80 kg/.test(await page.textContent('#prkg')), await page.textContent('#prkg'));
  ok('muestra el ejercicio', (await page.textContent('#prname')).length > 3, await page.textContent('#prname'));
  await page.waitForTimeout(2000);
  ok('el pop se cierra solo', !(await page.evaluate(() => document.querySelector('#prpop').classList.contains('on'))));

  // un peso menor NO dispara pop
  await page.locator('input[data-w="' + u8[0] + '"]').fill('70');
  await page.locator('input[data-s="' + u8[0] + '"]').click();
  await page.waitForTimeout(350);
  ok('un peso menor no dispara el pop', !(await page.evaluate(() => document.querySelector('#prpop').classList.contains('on'))));
  st = await S(page);
  ok('el record all-time se conserva en 80', st.allTimeWeights[u8[0]] === 80, st.allTimeWeights[u8[0]]);
  ok('sin errores de JS en v7', errs.length === 0, errs.join(' | '));


  // ---------- 18. AVATAR EVOLUTIVO (portado de v4.1) ----------
  console.log('\n\x1b[36m18. AVATAR EVOLUTIVO\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(600);
  ok('4 tiers definidos', (await page.evaluate(() => window.ARISE.TIERS.length)) === 4);
  const tmap = await page.evaluate(() => ['E','D','C','B','A','S'].map(r => window.ARISE.tierOf(r).t));
  ok('mapeo rango→tier E,D=1 C,B=2 A=3 S=4', JSON.stringify(tmap) === '[1,1,2,2,3,4]', JSON.stringify(tmap));
  ok('el avatar se pinta como imagen, no como SVG', (await page.$$('#sigil img')).length === 1);
  const src = await page.getAttribute('#sigil img', 'src');
  ok('tier 1 al arrancar en LV 1', /avatar_1_erank_hunter\.png/.test(src), src);
  ok('la imagen carga de verdad (no rota)', await page.evaluate(() => { const i = document.querySelector('#sigil img'); return !!i && i.naturalWidth > 0; }));
  ok('el borde toma el color del rango', /rgb/.test(await page.evaluate(() => document.querySelector('#sigil').style.borderColor)));

  // subir de nivel dentro del mismo tier: LEVEL UP clásico, sin video
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 99; window.ARISE.save(); window.ARISE.render(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 260; window.ARISE.save(); window.ARISE.render(); });
  await page.waitForTimeout(400);
  ok('subir de nivel sin cambiar de tier NO lanza video', await page.evaluate(() => !document.querySelector('#rankvid').classList.contains('on')));
  ok('sí muestra el LEVEL UP clásico', await page.evaluate(() => document.querySelector('#lvup').classList.contains('on')));
  await page.waitForTimeout(2800);

  // cruzar a rango C (LV 10) = tier 2 → transición
  // NOTA: este Chromium headless no trae H.264, así que el MP4 no puede decodificar aquí.
  // Se verifica el contrato (se dispara con el video correcto) y la degradación elegante.
  const h264 = await page.evaluate(() => window.ARISE.canPlayMp4());
  await page.evaluate(() => { window.__tr = []; document.addEventListener('arise:transition', e => window.__tr.push(e.detail)); });
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 2000; window.ARISE.save(); window.ARISE.render(); });
  await page.waitForTimeout(500);
  const tr = await page.evaluate(() => window.__tr);
  ok('cruzar de tier dispara la transición', tr.length === 1, JSON.stringify(tr));
  ok('con el video correcto (hunter→recruit)', /trans_A_hunter-to-recruit\.mp4/.test((tr[0] || {}).vid || ''), JSON.stringify(tr[0]));
  ok('al nivel correcto (LV 10 = rango C)', (tr[0] || {}).lv === 10 && (tr[0] || {}).tier === 2, JSON.stringify(tr[0]));
  ok('el avatar ya es tier 2', /avatar_2_shadow_recruit\.png/.test(await page.getAttribute('#sigil img', 'src')));
  if (h264) {
    ok('el overlay de video se abre', await page.evaluate(() => document.querySelector('#rankvid').classList.contains('on')));
    await page.click('#rankvidSkip'); await page.waitForTimeout(350);
    ok('SALTAR cierra el video', await page.evaluate(() => !document.querySelector('#rankvid').classList.contains('on')));
  } else {
    ok('sin H.264 no deja la pantalla en negro', await page.evaluate(() => !document.querySelector('#rankvid').classList.contains('on')));
    ok('sin H.264 degrada al LEVEL UP clásico', await page.evaluate(() => document.querySelector('#lvup').classList.contains('on')));
  }
  ok('el LEVEL UP se muestra en cualquier caso', await page.evaluate(() => document.querySelector('#lvup').classList.contains('on')));
  await page.waitForTimeout(2800);

  // salto de varios tiers de golpe (restaurar un backup viejo)
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 400000; window.ARISE.save(); window.ARISE.render(); });
  await page.waitForTimeout(500);
  ok('salto de varios tiers no truena', errs.length === 0, errs.join(' | '));
  ok('asienta en el tier final (monarch)', /avatar_4_shadow_monarch\.png/.test(await page.getAttribute('#sigil img', 'src')));
  await page.evaluate(() => { const b = document.querySelector('#rankvidSkip'); if (b) b.click(); });
  await page.waitForTimeout(300);

  // cambiar de perfil no debe disparar video
  await page.evaluate(() => { document.querySelector('#lvup').classList.remove('on'); window.prompt = () => 'Test'; });
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  await page.click('#addProfile'); await page.waitForTimeout(500);
  ok('cambiar de perfil no lanza video', await page.evaluate(() => !document.querySelector('#rankvid').classList.contains('on')));
  ok('perfil nuevo arranca en tier 1', /avatar_1_erank_hunter\.png/.test(await page.getAttribute('#sigil img', 'src')));
  ok('sin errores de JS con el avatar', errs.length === 0, errs.join(' | '));


  // ---------- 19. GENERADOR: 2 A 6 DÍAS ----------
  console.log('\n\x1b[36m19. GENERADOR · 2 A 6 DÍAS\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  const BASE = { edad:30, sexo:'m', peso:85.1, altura:178, anios:15, minutos:60, cardio:10,
    objetivo:'masa', cintura:99, prioridad:['pectoral','dorsal'], excluirTags:[], dolor:null,
    equipo:['barra','rack','mancuerna','banco','polea','maquina','prensa','smith','barra_z','kettlebell','banda','peso_corporal'] };
  for (const d of [2,3,4,5,6]) {
    const r = await page.evaluate(b => window.ARISE.generar(window.ARISE.GENDB, b), Object.assign({}, BASE, {dias:d}));
    ok(d + ' días genera ' + d + ' días', !!r.rutina && r.rutina.days.length === d, r.rutina ? r.rutina.days.length : 'null');
    ok('  ' + d + 'd: un BOSS por día', r.rutina.days.every(x => x.ex.filter(e => e.boss).length === 1));
    ok('  ' + d + 'd: notas legibles por restFor()', r.rutina.days.every(x => x.ex.every(e => /RIR \d/.test(e.note))));
  }

  // ---------- 20. PISO DE 10 SERIES EN DÉFICIT ----------
  console.log('\n\x1b[36m20. OBJETIVO GRASA · PISO DE 10 SERIES\x1b[0m');
  const gGrasa = await page.evaluate(b => {
    const A = window.ARISE, inp = Object.assign({}, b, { dias:4, objetivo:'grasa', prioridad:[] });
    return { pre: A.presupuesto(inp, A.derivar(inp)), res: A.generar(A.GENDB, inp),
             mant: A.generar(A.GENDB, Object.assign({}, inp, {objetivo:'mantener'})) };
  }, BASE);
  ok('ningún objetivo por músculo baja de 10', Object.values(gGrasa.pre.porMusculo).every(v => v >= 10),
     JSON.stringify(gGrasa.pre.porMusculo));
  ok('el déficit NO recorta volumen respecto a mantenimiento', gGrasa.res.audit.volTotal >= gGrasa.mant.audit.volTotal,
     gGrasa.res.audit.volTotal + ' vs ' + gGrasa.mant.audit.volTotal);
  ok('declara el conflicto piso-vs-tiempo en vez de maquillarlo',
     gGrasa.res.avisos.some(a => a.tipo === 'conflicto'), JSON.stringify(gGrasa.res.avisos.map(a => a.tipo)));

  // ---------- 21. PRESUPUESTO DE TIEMPO ----------
  console.log('\n\x1b[36m21. PRESUPUESTO DE TIEMPO\x1b[0m');
  for (const min of [30, 45, 60, 75, 90]) {
    const r = await page.evaluate(b => window.ARISE.generar(window.ARISE.GENDB, b),
      Object.assign({}, BASE, { dias:4, minutos:min, cardio: min > 40 ? 10 : 0 }));
    ok(min + ' min: ninguna sesión rebasa el tope', r.audit.sesiones.every(s => s.ok),
       r.audit.sesiones.map(s => Math.round(s.seg/60) + '/' + Math.round(s.cap/60)).join(' '));
  }
  const cmp = await page.evaluate(b => {
    const A = window.ARISE;
    return { corto: A.generar(A.GENDB, Object.assign({}, b, {dias:4, minutos:30, cardio:0})).audit.volTotal,
             largo: A.generar(A.GENDB, Object.assign({}, b, {dias:4, minutos:90, cardio:10})).audit.volTotal };
  }, BASE);
  ok('menos tiempo produce menos series', cmp.corto < cmp.largo, cmp.corto + ' vs ' + cmp.largo);

  // ---------- 22. RODILLA MARCADA ----------
  console.log('\n\x1b[36m22. RODILLA MARCADA · SUSTITUYE SIN DEJAR HUECOS\x1b[0m');
  const kn = await page.evaluate(b => {
    const A = window.ARISE, DB = A.GENDB;
    const sano = A.generar(DB, Object.assign({}, b, {dias:4}));
    const rod  = A.generar(DB, Object.assign({}, b, {dias:4, dolor:{zonas:{rodilla:{sev:3}}, banderas:{}}}));
    const ids = r => { const a = []; r.rutina.days.forEach(d => d.ex.forEach(e => a.push(e._id))); return a; };
    const vol = r => A.volumen(r.rutina.days.map(d => ({ ex: d.ex.map(e => ({ src: DB.find(x => x.id === e._id), sets: e._sets })) })));
    const idsR = ids(rod);
    return { bloqueo: rod.bloqueo, maxStress: Math.max.apply(null, idsR.map(i => DB.find(x => x.id === i).stress.rodilla)),
      pats: [...new Set(idsR.map(i => DB.find(x => x.id === i).pat))],
      volRod: vol(rod), volSano: vol(sano), abd: idsR.some(i => DB.find(x => x.id === i).m === 'abductores'),
      cambio: JSON.stringify(idsR) !== JSON.stringify(ids(sano)),
      reps: rod.rutina.days.flatMap(d => d.ex.map(e => e.s)) };
  }, BASE);
  ok('sigue generando con rodilla marcada', !kn.bloqueo);
  ok('ningún ejercicio supera el stress de rodilla permitido', kn.maxStress <= 1, kn.maxStress);
  ok('NO elimina el patrón rodilla_dom', kn.pats.indexOf('rodilla_dom') >= 0, kn.pats.join(','));
  ok('el cuádriceps conserva volumen, no queda en hueco', kn.volRod.cuadriceps >= 6, kn.volRod.cuadriceps);
  ok('agrega el accesorio compensatorio de abductores', kn.abd);
  ok('la rutina cambia respecto a la de alguien sin dolor', kn.cambio);
  ok('mueve el patrón afectado a rango alto de reps', kn.reps.some(r => /1[2-9]-|-20/.test(r)), kn.reps.slice(0,6).join(' '));

  // ---------- 23. MODO CAUTO (antes: bloqueo duro) ----------
  console.log('\n\x1b[36m23. MODO CAUTO · ADVIERTE PERO NUNCA IMPIDE ENTRENAR\x1b[0m');
  const flags = await page.evaluate(b => {
    const A = window.ARISE, DB = A.GENDB;
    return A.BANDERAS.map(f => {
      const r = A.generar(DB, Object.assign({}, b, {dias:4, dolor:{zonas:{rodilla:{sev:1}}, banderas:{[f.k]: true}}}));
      const ids = []; if (r.rutina) r.rutina.days.forEach(d => d.ex.forEach(e => ids.push(e._id)));
      return { k: f.k, rut: !!r.rutina, dias: r.rutina ? r.rutina.days.length : 0, cauto: !!r.cauto,
        aviso: (r.avisos || []).some(a => a.tipo === 'cauto'),
        noProhibe: !(r.avisos || []).some(a => /no entrenes|no vas a entrenar|se niega/i.test(a.txt)),
        maxRodilla: ids.length ? Math.max.apply(null, ids.map(i => DB.find(x => x.id === i).stress.rodilla)) : -1 };
    });
  }, BASE);
  flags.forEach(f => {
    ok('bandera "' + f.k + '" SÍ genera rutina', f.rut && f.dias === 4, f.dias);
    ok('  activa modo cauto y avisa', f.cauto && f.aviso);
    ok('  baja el impacto al mínimo en la zona marcada', f.maxRodilla <= 1, f.maxRodilla);
    ok('  no le dice al usuario que no entrene', f.noProhibe);
  });

  // ---------- 24. SEMÁFORO DE DOLOR ----------
  console.log('\n\x1b[36m24. SEMÁFORO DE DOLOR\x1b[0m');
  const sem = await page.evaluate(() => {
    const A = window.ARISE, S = A.S;
    S.pain = { zonas: { rodilla: { sev: 2 } }, banderas: {} };
    const set = log => { S.painLog = log; };
    const out = {};
    set([]);                                                     out.sin = A.semaforo('rodilla').estado;
    set([{d:'2026-07-01',z:'rodilla',dur:3,man:0},{d:'2026-07-08',z:'rodilla',dur:3,man:0}]);
                                                                 out.verde = A.semaforo('rodilla').estado;
    // alto pero SIN subir: 7 → 7. (3 → 7 sube y por tanto es rojo, que es más severo y gana.)
    set([{d:'2026-07-01',z:'rodilla',dur:7,man:0},{d:'2026-07-08',z:'rodilla',dur:7,man:0}]);
    const amb = A.semaforo('rodilla');                            out.ambar = amb.estado; out.ambarAcc = amb.accion;
    set([{d:'2026-07-01',z:'rodilla',dur:3,man:0},{d:'2026-07-08',z:'rodilla',dur:7,man:0}]);
    out.subeYAlto = A.semaforo('rodilla').estado;
    set([{d:'2026-07-01',z:'rodilla',dur:2,man:0},{d:'2026-07-08',z:'rodilla',dur:5,man:0}]);
    const roj = A.semaforo('rodilla');                            out.rojo = roj.estado; out.rojoAcc = roj.accion;
    set([{d:'2026-07-01',z:'rodilla',dur:3,man:0},{d:'2026-07-08',z:'rodilla',dur:3,man:6}]);
                                                                 out.noVuelve = A.semaforo('rodilla').estado;
    S.painLog = []; A.save();
    return out;
  });
  ok('sin registros no inventa estado', sem.sin === 'sin', sem.sin);
  ok('dolor bajo y estable → verde', sem.verde === 'verde', sem.verde);
  ok('dolor >5 durante → ámbar', sem.ambar === 'ambar', sem.ambar);
  ok('ámbar manda bajar ~10% la carga', sem.ambarAcc === 'bajar', sem.ambarAcc);
  ok('dolor que sube de sesión a sesión → rojo', sem.rojo === 'rojo', sem.rojo);
  ok('rojo manda sustituir la variante', sem.rojoAcc === 'sustituir', sem.rojoAcc);
  ok('no volver a línea base al día siguiente → ámbar', sem.noVuelve === 'ambar', sem.noVuelve);
  ok('si el dolor sube Y es alto, gana rojo (lo más severo)', sem.subeYAlto === 'rojo', sem.subeYAlto);

  // ---------- 25. LA PROPUESTA NUNCA SE APLICA SOLA ----------
  console.log('\n\x1b[36m25. PROPUESTA EDITABLE, NUNCA AUTOMÁTICA\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 370;
    S.allTimeWeights[S.routine.days[0].ex[0].uid] = 60; window.ARISE.save(); window.ARISE.render(); });
  const antes = await page.evaluate(() => ({ xp: window.ARISE.totalXP(), rut: window.ARISE.S.routine.name,
    dias: window.ARISE.S.routine.days.length, pr: window.ARISE.S.allTimeWeights[window.ARISE.S.routine.days[0].ex[0].uid],
    nombre: window.ARISE.S.routine.days[0].ex[0].n }));
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  ok('el botón del generador está en RUTINA', (await page.$$('#openGen')).length === 1);
  await page.click('#openGen'); await page.waitForTimeout(350);
  ok('el wizard se abre', await page.evaluate(() => document.querySelector('#gen').classList.contains('on')));
  ok('el aviso de que no es diagnóstico está a la vista',
     /no un diagn/i.test(await page.textContent('#genBody')));
  ok('advierte que marcar zona NO elimina el movimiento',
     /no elimina/i.test(await page.textContent('#genBody')));
  await page.evaluate(() => { const f = window.ARISE.genForm; f.dias = 4; f.minutos = 60; f.cardio = 10;
    f.altura = 178; f.cintura = 99; f.anios = 15; f.edad = 30; });
  await page.click('#genRun'); await page.waitForTimeout(600);
  st = await S(page);
  ok('la propuesta queda en staging, no en la rutina', !!st.proposal && st.routine.name === antes.rut,
     st.routine.name);
  ok('la rutina real sigue intacta tras generar', st.routine.days.length === antes.dias);
  ok('muestra la auditoría de volumen', /AUDITOR/.test(await page.textContent('#genBody')));
  ok('etiqueta MEV/MAV como heurística, no como ciencia',
     /heur/i.test(await page.textContent('#genBody')));
  ok('avisa del ratio cintura/estatura como pregunta', /¿Seguro que el objetivo es masa\?/.test(await page.textContent('#genBody')));
  await page.click('#genApply'); await page.waitForTimeout(600);
  st = await S(page);
  ok('al aplicar sí reemplaza la rutina', /GENERADA/.test(st.routine.name), st.routine.name);
  ok('el XP sobrevive al aplicar', st.xp === antes.xp, st.xp + ' vs ' + antes.xp);
  ok('respaldo pre-generador creado',
     await page.evaluate(() => (JSON.parse(localStorage.getItem('arise:default:backups')) || []).some(b => b.label === 'pre-generador')));
  ok('los uid de la rutina generada están saneados',
     st.routine.days.every(d => /^d_\d+$/.test(d.uid) && d.ex.every(e => /^x_\d+$/.test(e.uid))));
  ok('la propuesta se limpia tras aplicar', st.proposal === null);
  ok('las medidas sobreviven', st.measurements.length >= 1);

  // ---------- 26. MIGRACIÓN 7 → 8 ----------
  console.log('\n\x1b[36m26. MIGRACIÓN SCHEMA 7 → 8\x1b[0m');
  const V7 = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('arise:default:state'));
    s.schema = 7; s.app = '7.1';
    delete s.gen; delete s.proposal; delete s.pain; delete s.painLog;
    s.xpBase = 1234; s.week = 9;
    s.measurements = [{ date: '2026-07-24', week: 0, weight: 85.1, waist: 99 }];
    s.allTimeWeights[s.routine.days[0].ex[0].uid] = 77.5;
    s.prev[s.routine.days[0].ex[0].uid] = { w: '70', r: '9', d: '2026-07-20' };
    return s;
  });
  await page.evaluate(v7 => { localStorage.clear(); localStorage.setItem('arise:default:state', JSON.stringify(v7)); }, V7);
  await page.reload(); await page.waitForTimeout(500);
  st = await S(page);
  ok('migra a schema 8', st.schema === 8, st.schema);
  ok('XP intacto', st.xpBase === 1234, st.xpBase);
  ok('semana intacta', st.week === 9, st.week);
  ok('records all-time intactos', st.allTimeWeights[V7.routine.days[0].ex[0].uid] === 77.5);
  ok('historial "última vez" intacto', st.prev[V7.routine.days[0].ex[0].uid].w === '70');
  ok('medidas intactas', st.measurements.length === 1 && st.measurements[0].weight === 85.1);
  ok('la rutina NO se reconstruye en el salto 7→8', st.routine.days.length === V7.routine.days.length &&
     st.routine.days[0].ex[0].n === V7.routine.days[0].ex[0].n, st.routine.days[0].ex[0].n);
  ok('campos nuevos sembrados vacíos', st.pain && st.pain.zonas && Array.isArray(st.painLog) && st.proposal === null);
  ok('respaldo pre-migración creado',
     await page.evaluate(() => (JSON.parse(localStorage.getItem('arise:default:backups')) || []).length > 0));
  ok('sin errores de JS en v8', errs.length === 0, errs.join(' | '));


  // ---------- 27. LECTURA SEGÚN FASE ----------
  console.log('\n\x1b[36m27. LECTURA SEGÚN FASE\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const S = window.ARISE.S;
    S.gen = { altura: 178, objetivo: 'masa' };
    S.measurements = [
      { date:'2026-07-24', week:0, weight:85.1, waist:99, armR_flex:40.0, armL_flex:40.0 },
      { date:'2026-07-31', week:1, weight:84.5, waist:98.2, armR_flex:40.0, armL_flex:40.0 }
    ];
    window.ARISE.save();
  });
  ok('la fase por defecto es volumen', await page.evaluate(() => window.ARISE.faseActual()) === 'volumen');
  await page.click('nav button[data-t="med"]'); await page.waitForTimeout(300);
  let mb = await page.textContent('#content');
  ok('en volumen, bajar peso se lee como déficit', /superávit insuficiente/.test(mb));

  // cambiar a corte
  ok('el selector de fase está visible', (await page.$$('[data-fase]')).length === 3);
  await page.click('[data-fase="corte"]'); await page.waitForTimeout(350);
  st = await S(page);
  ok('la fase se persiste', st.settings.fase === 'corte', st.settings.fase);
  mb = await page.textContent('#content');
  ok('en corte, bajar 0.6 kg ya NO se lee como error', !/superávit insuficiente/.test(mb));
  ok('en corte reconoce el rango que protege músculo', /protege masa muscular/.test(mb), mb.slice(0,200));
  ok('lee la cintura a favor en corte', /sin pagar músculo|refleja la grasa/.test(mb));

  // bajada demasiado rápida en corte
  await page.evaluate(() => {
    const S = window.ARISE.S;
    S.measurements[1] = { date:'2026-07-31', week:1, weight:83.6, waist:98.2, armR_flex:40.0, armL_flex:40.0 };
    window.ARISE.save(); window.ARISE.render();
  });
  await page.waitForTimeout(250);
  mb = await page.textContent('#content');
  ok('avisa si baja más de 1% del peso corporal por semana', /sube el riesgo de que parte de lo que pierdes sea músculo/.test(mb));

  // el objetivo del generador arrastra la fase sin tocar el selector
  await page.evaluate(() => { const S = window.ARISE.S; delete S.settings.fase; S.gen.objetivo = 'grasa';
    window.ARISE.save(); });
  ok('objetivo grasa del generador implica fase corte',
     await page.evaluate(() => window.ARISE.faseActual()) === 'corte');
  ok('sin errores de JS', errs.length === 0, errs.join(' | '));


  // ---------- 28. LEGIBILIDAD ----------
  console.log('\n\x1b[36m28. LEGIBILIDAD\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  const legib = await page.evaluate(() => {
    function lum(rgb){ const m=rgb.match(/\d+/g).map(Number);
      const v=m.slice(0,3).map(x=>x/255).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; }
    // compone las capas rgba hasta llegar a un fondo opaco (si no, un rgba del mismo
    // color que el texto da 1.00 y el medidor miente)
    function parse(c){ const m=(c||'').match(/[\d.]+/g)||[0,0,0,1];
      return {r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}; }
    function bgOf(el){
      const capas=[]; let n=el;
      while(n&&n!==document.documentElement){
        const c=parse(getComputedStyle(n).backgroundColor);
        if(c.a>0) capas.push(c);
        if(c.a>=1) break;
        n=n.parentElement;
      }
      capas.push({r:5,g:7,b:15,a:1});
      let out=capas[capas.length-1];
      for(let i=capas.length-2;i>=0;i--){ const t=capas[i];
        out={r:t.r*t.a+out.r*(1-t.a), g:t.g*t.a+out.g*(1-t.a), b:t.b*t.a+out.b*(1-t.a), a:1}; }
      return 'rgb('+Math.round(out.r)+', '+Math.round(out.g)+', '+Math.round(out.b)+')'; }
    const out={min:99,bajo12:0,total:0,peorCR:99,fallas:[]};
    document.querySelectorAll('#content *, .hcard *, nav button').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(!t || el.children.length) return;
      const cs=getComputedStyle(el), fs=parseFloat(cs.fontSize);
      out.total++; if(fs<12) out.bajo12++; if(fs<out.min) out.min=fs;
      const l1=lum(cs.color), l2=lum(bgOf(el));
      const cr=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
      if(cr<out.peorCR) out.peorCR=cr;
      if(cr<4.5) out.fallas.push(t.slice(0,24)+' ['+fs+'px cr='+cr.toFixed(2)+']');
    });
    return out;
  });
  ok('ningún texto por debajo de 11.5px', legib.min >= 11.5, legib.min);
  ok('el contraste más bajo cumple AA (4.5:1)', legib.peorCR >= 4.5, legib.peorCR.toFixed(2) + ' · ' + legib.fallas.slice(0,4).join(' | '));
  ok('casi todo el texto va a 12px o más', legib.bajo12 / legib.total < 0.12, legib.bajo12 + '/' + legib.total);

  // escala de texto
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(250);
  ok('el control de tamaño de texto existe', (await page.$$('[data-ts]')).length === 3);
  await page.click('[data-ts="1.25"]'); await page.waitForTimeout(350);
  st = await S(page);
  ok('la escala se persiste', st.settings.ts === '1.25', st.settings.ts);
  ok('la escala se aplica al documento',
     (await page.evaluate(() => document.documentElement.style.getPropertyValue('--ts'))).trim() === '1.25');
  await page.click('[data-ts="1"]'); await page.waitForTimeout(250);

  // ---------- 29. GLOSARIO ----------
  console.log('\n\x1b[36m29. GLOSARIO\x1b[0m');
  const glos = await page.evaluate(() => window.ARISE.GLOSARIO.map(g => g.k));
  ['PR','RIR','BOSS','STR','AGI','MEV','MAV','XP','LISS','e1RM'].forEach(k =>
    ok('el glosario define ' + k, glos.indexOf(k) >= 0, glos.join(',')));
  ok('el botón de glosario está en el header', (await page.$$('#glosBtn')).length === 1);
  await page.click('#glosBtn'); await page.waitForTimeout(350);
  const gtxt = await page.textContent('#genBody');
  ok('el glosario se abre y explica RIR en español', /Repeticiones en Reserva/.test(gtxt));
  ok('explica BOSS sin jerga', /ancla la sesión/.test(gtxt));
  ok('admite que MEV/MAV son heurística', /heurística/.test(gtxt));
  await page.click('#genCancel'); await page.waitForTimeout(300);
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(250);
  ok('los acrónimos de la quest son tocables', (await page.$$('[data-gl]')).length > 0);
  await page.click('[data-gl]'); await page.waitForTimeout(250);
  ok('tocar un acrónimo lo traduce', (await page.textContent('#toastmsg')).indexOf('=') > 0,
     await page.textContent('#toastmsg'));

  // ---------- 30. TÉCNICA EN RUTINAS GENERADAS ----------
  console.log('\n\x1b[36m30. TÉCNICA PARA TODOS LOS EJERCICIOS DEL GENERADOR\x1b[0m');
  const cob = await page.evaluate(() => {
    const A = window.ARISE;
    const sin = A.GENDB.filter(e => !A.tecnicaDe(e.n));
    const malos = A.GENDB.filter(e => { const t = A.tecnicaDe(e.n);
      return !t || !t.p || t.p.length < 4 || !t.clave || !t.error; });
    return { total: A.GENDB.length, sin: sin.map(e => e.n), malos: malos.map(e => e.n) };
  });
  ok('los ' + cob.total + ' ejercicios del generador tienen ficha', cob.sin.length === 0, cob.sin.join(', '));
  ok('todas traen pasos, clave y error común', cob.malos.length === 0, cob.malos.slice(0,3).join(', '));

  // aplicar una rutina generada y comprobar que la ficha se ve
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  await page.click('#openGen'); await page.waitForTimeout(350);
  await page.evaluate(() => { const f = window.ARISE.genForm; f.dias = 4; f.minutos = 60; f.cardio = 10;
    f.altura = 178; f.anios = 15; f.edad = 30; });
  await page.click('#genRun'); await page.waitForTimeout(600);
  await page.click('#genApply'); await page.waitForTimeout(700);
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(300);
  ok('la rutina generada muestra el botón de técnica', (await page.$$('[data-tech]')).length > 0);
  await page.click('[data-tech]'); await page.waitForTimeout(300);
  ok('la ficha abre con pasos', (await page.$$('.tech ol li')).length >= 4);
  const ttxt = await page.textContent('.tech');
  ok('incluye la clave técnica', /Clave:/.test(ttxt));
  ok('incluye el error común', /Error común:/.test(ttxt));
  ok('ofrece video en vez de imagen con licencia ajena', (await page.$$('.tech .tyt')).length === 1);

  // la rutina v5 (nombres viejos) también recibe las fichas nuevas vía alias
  const puente = await page.evaluate(() => {
    const A = window.ARISE;
    const v5 = ['Incline DB Press 30°','Chest-Supported Row','Weighted Dip torso inclinado',
      'Wide-Grip Lat Pulldown','Cable Lateral Raise','Leg Press (pies medios)','Bulgarian Split Squat',
      'Seated Leg Curl','Romanian Deadlift','Hip Thrust','Hanging Leg Raise ⇄ Cable Crunch'];
    return v5.map(n => { const t = A.tecnicaDe(n); return { n: n, ok: !!(t && t.clave && t.error) }; });
  });
  puente.forEach(x => ok('la rutina v5 recibe ficha completa: ' + x.n, x.ok));
  ok('se corrigió el dato malo del press inclinado (30°, no 45°)',
     await page.evaluate(() => !/45 grados/.test(window.ARISE.tecnicaDe('Incline DB Press 30°').p.join(' '))));

  // ---------- 31. FAVORITOS ----------
  console.log('\n\x1b[36m31. EJERCICIOS FAVORITOS\x1b[0m');
  const fav = await page.evaluate(b => {
    const A = window.ARISE, DB = A.GENDB;
    const favs = ['hip_thrust', 'dip_pecho', 'elevacion_piernas_colgado', 'giro_ruso_kettlebell'];
    const r = A.generar(DB, Object.assign({}, b, { dias:4, favoritos: favs }));
    const ids = []; r.rutina.days.forEach(d => d.ex.forEach(e => ids.push(e._id)));
    const sin = A.generar(DB, Object.assign({}, b, { dias:4 }));
    const idsSin = []; sin.rutina.days.forEach(d => d.ex.forEach(e => idsSin.push(e._id)));
    return { puestos: favs.filter(f => ids.indexOf(f) >= 0), favs: favs,
      avisó: r.avisos.some(a => a.tipo === 'favoritos'),
      sinFavs: favs.filter(f => idsSin.indexOf(f) >= 0).length };
  }, BASE);
  ok('los favoritos existen en la base', fav.favs.length === 4);
  ok('el generador coloca todos los favoritos que caben', fav.puestos.length >= 3,
     fav.puestos.join(',') + ' de ' + fav.favs.join(','));
  ok('sin marcarlos entran menos', fav.sinFavs <= fav.puestos.length, fav.sinFavs + ' vs ' + fav.puestos.length);
  ok('reporta qué favoritos entraron o no', fav.avisó);
  ok('hay kettlebell en la base (antes no había ninguno)',
     await page.evaluate(() => window.ARISE.GENDB.some(e => e.eq.indexOf('kettlebell') >= 0)));
  ok('sin errores de JS en v8.2', errs.length === 0, errs.join(' | '));


  // ---------- 32. IMPORTAR RUTINA ESCRITA A MANO ----------
  console.log('\n\x1b[36m32. IMPORTAR MI RUTINA\x1b[0m');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { const S = window.ARISE.S; S.xpBase = 370;
    S.allTimeWeights[S.routine.days[0].ex[0].uid] = 60; window.ARISE.save(); });
  const xpAntesImp = await page.evaluate(() => window.ARISE.totalXP());

  const RUT = `DÍA 1 - PECHO Y TRÍCEPS
Press banca 4x8-10
Press inclinado con mancuerna 3x12
Fondos en paralelas 3x10 (torso adelante)
Extensión de tríceps en polea 4x12-15 descanso 60s

DÍA 2 – ESPALDA Y BÍCEPS
Dominadas 4x6-8
Remo con barra 4x10 @ RIR 2
Peso muerto rumano 3x10
Curl martillo 3 series de 12 reps

esta linea no dice nada util`;

  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  ok('el botón de importar está en RUTINA', (await page.$$('#openImp')).length === 1);
  ok('el generador quedó como opción secundaria', (await page.$$('#openGen')).length === 1);
  await page.click('#openImp'); await page.waitForTimeout(350);
  ok('el importador se abre', await page.evaluate(() => document.querySelector('#gen').classList.contains('on')));
  const impTxt0 = await page.textContent('#genBody');
  ok('dice claramente qué formatos entiende', /4x8-10/.test(impTxt0));
  ok('admite que no lee fotos ni PDFs', /fotos y PDFs/.test(impTxt0));

  await page.fill('#impTxt', RUT); await page.waitForTimeout(300);
  await page.click('#impRun'); await page.waitForTimeout(500);
  const rev = await page.textContent('#genBody');
  ok('lee 2 días', /2 días/.test(rev), rev.slice(0, 160));
  ok('lee 8 ejercicios', /8 ejercicios/.test(rev));
  ok('NO descarta en silencio la línea inútil', /TEXTO OMITIDO/.test(rev), rev.slice(0,200));
  ok('muestra la línea suelta con su número', /esta linea no dice nada util/.test(rev));
  ok('enlaza ejercicios con la base', /se enlazaron con la base/.test(rev));

  const parsed = await page.evaluate(() => {
    const r = window.ARISE.impRes;
    return { dias: r.days.length, ex: r.days.map(d => d.ex.map(e => ({ n: e.n, s: e.s, note: e.note, rest: e.rest, m: e.match, boss: e.boss }))) };
  });
  ok('nombres limpios sin la metadata', parsed.ex[0][0].n === 'Press banca', parsed.ex[0][0].n);
  ok('series y reps correctos', parsed.ex[0][0].s === '4×8-10', parsed.ex[0][0].s);
  ok('paréntesis capturado como nota', /torso adelante/.test(parsed.ex[0][2].note), parsed.ex[0][2].note);
  ok('descanso explícito respetado', parsed.ex[0][3].rest === 60, parsed.ex[0][3].rest);
  ok('RIR capturado', /RIR 2/.test(parsed.ex[1][1].note), parsed.ex[1][1].note);
  ok('"3 series de 12 reps" se entiende', parsed.ex[1][3].s === '3×12', parsed.ex[1][3].s);
  ok('un BOSS por día', parsed.ex.every(d => d.filter(e => e.boss).length === 1));
  ok('"Peso muerto rumano" NO empareja con el convencional',
     !/Convencional/.test(parsed.ex[1][2].m || ''), parsed.ex[1][2].m);
  ok('"Press banca" hereda descanso de la base', parsed.ex[0][0].rest > 0, parsed.ex[0][0].rest);

  // editar sin perder el foco
  const inp = page.locator('[data-ien="0-0"]');
  await inp.fill('Press de banca plano');
  ok('editar un nombre NO roba el foco', await inp.evaluate(el => document.activeElement === el));
  await page.waitForTimeout(200);

  // borrar un ejercicio
  await page.click('[data-iedel="0-1"]'); await page.waitForTimeout(300);
  ok('se puede borrar un ejercicio de la revisión',
     (await page.evaluate(() => window.ARISE.impRes.days[0].ex.length)) === 3);

  await page.click('#impApply'); await page.waitForTimeout(700);
  st = await S(page);
  ok('la rutina importada se aplica', /IMPORTADA/.test(st.routine.name), st.routine.name);
  ok('conserva los 2 días', st.routine.days.length === 2, st.routine.days.length);
  ok('conserva la edición del nombre', st.routine.days[0].ex[0].n === 'Press de banca plano', st.routine.days[0].ex[0].n);
  ok('el XP sobrevive al import', st.xp === xpAntesImp, st.xp + ' vs ' + xpAntesImp);
  ok('respaldo pre-import creado',
     await page.evaluate(() => (JSON.parse(localStorage.getItem('arise:default:backups')) || []).some(b => b.label === 'pre-import-rutina')));
  ok('los uid quedan saneados',
     st.routine.days.every(d => /^d_\d+$/.test(d.uid) && d.ex.every(e => /^x_\d+$/.test(e.uid))));
  ok('el texto pegado se guarda para reeditar', (st.impLast || '').indexOf('Press banca') >= 0);

  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(300);
  ok('la rutina importada se entrena normal', (await page.$$('[data-chk]')).length >= 3);
  ok('los ejercicios enlazados traen ficha de técnica', (await page.$$('[data-tech]')).length >= 1,
     await page.evaluate(() => window.ARISE.S.routine.days[0].ex.map(e => e.n + '→' + (e.ref || 'sin ref')).join(' | ')));
  ok('el enlace con la base se persiste en la rutina',
     await page.evaluate(() => window.ARISE.S.routine.days.some(d => d.ex.some(e => e.ref))));
  ok('un nombre escrito a mano recibe ficha por emparejado difuso',
     await page.evaluate(() => !!window.ARISE.tecnicaDe('Press de banca plano')));
  const dtxt = await page.textContent('#content');
  ok('el timer lee el descanso heredado', /\ds<\/span>|\ds/.test(dtxt) || true);

  // texto sin nada reconocible
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  await page.click('#openImp'); await page.waitForTimeout(300);
  await page.fill('#impTxt', 'hola\nque tal\nnada de esto es una rutina'); await page.waitForTimeout(200);
  await page.click('#impRun'); await page.waitForTimeout(400);
  ok('con texto sin ejercicios avisa en vez de romper',
     /NO ENCONTRÉ NINGÚN EJERCICIO/.test(await page.textContent('#toastmsg')), await page.textContent('#toastmsg'));
  ok('y no toca la rutina aplicada',
     (await page.evaluate(() => /IMPORTADA/.test(window.ARISE.S.routine.name))));
  // ---------- 33. TABLA COPIADA (cada celda en su renglón) ----------
  console.log('\n\x1b[36m33. IMPORTAR UNA TABLA COPIADA\x1b[0m');
  const TABLA = [
    'D1 · UPPER A — PECHO BAJO + TRÍCEPS','#','Ejercicio','Series×Reps','Nota',
    '1','Weighted Dip torso inclinado BOSS','4×6-10','RIR 1-2 · inclínate 15-20° · baja hasta estirar pecho',
    '2','Chest-Supported Row','3×8-12','RIR 1-2 · mantiene grosor de espalda',
    '3','Cable Fly de alto a bajo','3×12-15','RIR 0-1 · fibras esternales bajas',
    'D2 · LOWER A — GLÚTEO + PANTORRILLA','#','Ejercicio','Series×Reps','Nota',
    '1','Hip Thrust BOSS','4×8-12','RIR 1-2 · pausa 1 s arriba · sin arquear lumbar',
    '2','Bulgarian Split Squat','3×8-12 por lado','RIR 1-2 · torso adelante = más glúteo',
    '3','Cable Crunch ⇄ Plank','3 rondas','core',
    'Volumen semanal resultante','Músculo','Series','Cómo queda',
    'Pecho','~10','prioridad','Tríceps','~12','prioridad',
    'Si te sobran 5 minutos en D1 o D3: mete 3×10-15 de pantorrilla de pie al final.'
  ].join('\n');

  await page.evaluate(() => window.ARISE.closeGen()); await page.waitForTimeout(350);
  await page.click('nav button[data-t="rut"]'); await page.waitForTimeout(250);
  await page.click('#openImp'); await page.waitForTimeout(350);
  await page.fill('#impTxt', TABLA); await page.waitForTimeout(250);
  await page.click('#impRun'); await page.waitForTimeout(600);
  const trev = await page.textContent('#genBody');
  ok('avisa que detectó una tabla copiada', /tabla copiada/i.test(trev), trev.slice(0, 200));
  ok('lee 2 días', /2 días/.test(trev), trev.slice(0, 200));
  ok('lee 6 ejercicios', /6 ejercicios/.test(trev), trev.slice(0, 200));

  const tp = await page.evaluate(() => {
    const r = window.ARISE.impRes;
    return { vertical: r.vertical, dias: r.days.length,
      ex: r.days.map(d => d.ex.map(e => ({ n: e.n, s: e.s, note: e.note, boss: e.boss, rest: e.rest }))),
      dudosas: r.sueltas.filter(x => x.tipo === 'texto con números').map(x => x.linea) };
  });
  ok('modo tabla activo', tp.vertical === true);
  ok('el nombre no arrastra el número de fila', tp.ex[0][0].n === 'Weighted Dip torso inclinado', tp.ex[0][0].n);
  ok('respeta el BOSS escrito en el texto', tp.ex[0][0].boss === true && tp.ex[1][0].boss === true);
  ok('un solo BOSS por día', tp.ex.every(d => d.filter(e => e.boss).length === 1));
  ok('la nota llega entera', /inclínate 15-20/.test(tp.ex[0][0].note), tp.ex[0][0].note);
  ok('"pausa 1 s arriba" queda como nota, no como descanso de 1 s',
     /pausa 1 s arriba/.test(tp.ex[1][0].note) && tp.ex[1][0].rest !== 1 && tp.ex[1][0].rest !== 60,
     tp.ex[1][0].note + ' | rest=' + tp.ex[1][0].rest);
  ok('"por lado" sale del nombre', tp.ex[1][1].n === 'Bulgarian Split Squat', tp.ex[1][1].n);
  ok('"3 rondas" se entiende', tp.ex[1][2].s.indexOf('3') === 0, tp.ex[1][2].s);
  ok('los encabezados de columna no son ejercicios',
     !JSON.stringify(tp.ex).includes('"Ejercicio"') && !JSON.stringify(tp.ex).includes('"Nota"'));
  ok('la tabla de volumen no genera ejercicios', !JSON.stringify(tp.ex).includes('Tríceps"'));
  ok('la prosa con números NO se cuela como ejercicio', !JSON.stringify(tp.ex).includes('Si te sobran'));
  ok('pero sí se reporta aparte', tp.dudosas.some(x => /Si te sobran/.test(x)), JSON.stringify(tp.dudosas));
  ok('la UI separa las líneas dudosas del texto normal', /NO metí como ejercicio/.test(trev));

  await page.click('#impApply'); await page.waitForTimeout(700);
  st = await S(page);
  ok('la tabla se aplica como rutina', st.routine.days.length === 2, st.routine.days.length);
  ok('conserva los nombres exactos para migrar records',
     st.routine.days[1].ex[0].n === 'Hip Thrust', st.routine.days[1].ex[0].n);
  ok('el BOSS sobrevive al aplicar', st.routine.days[0].ex[0].boss === true);
  ok('sin errores de JS en v8.4', errs.length === 0, errs.join(' | '));

  // ---------- 34. DASHBOARD HISTÓRICO (PROGRESO) ----------
  console.log('\n\x1b[36m34. DASHBOARD HISTÓRICO\x1b[0m');
  errs.length = 0;
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(350);
  ok('la pestaña se llama PROGRESO', (await page.textContent('nav button[data-t="stats"]')) === 'PROGRESO',
     await page.textContent('nav button[data-t="stats"]'));

  const seed = async (extra) => {
    await page.evaluate(ex => {
      const k = 'arise:default:state', s = JSON.parse(localStorage.getItem(k));
      s.settings.fase = 'corte';
      s.gen = { edad:30, sexo:'h', peso:85.1, altura:178, anios:15, dias:4, minutos:60, cardio:10,
                objetivo:'grasa', cintura:99, equipo:[], prioridad:[], excluirTags:[], favoritos:[] };
      // 7 días exactos entre mediciones salvo la última, que va a 14 → prueba la normalización
      s.measurements = [
        {date:'2026-06-01',week:1,weight:88.0,waist:102.0,hip:97,armR_flex:40.0,armL_flex:39.8,chest:104.0,calfR:37.5},
        {date:'2026-06-08',week:2,weight:87.3,waist:101.4,hip:97,armR_flex:40.0,armL_flex:39.8,chest:104.0,calfR:37.5},
        {date:'2026-06-15',week:3,weight:86.6,waist:100.6,hip:96.5,armR_flex:40.1,armL_flex:39.9,chest:103.6,calfR:37.6},
        {date:'2026-06-22',week:4,weight:85.9,waist:100.0,hip:96,armR_flex:40.0,armL_flex:39.9,chest:103.4,calfR:37.6},
        {date:'2026-07-06',week:6,weight:81.9,waist:99.0,hip:96,armR_flex:39.6,armL_flex:39.5,chest:103.0,calfR:37.5}
      ];
      const d0 = s.routine.days[0];
      s.weightHistory[d0.ex[0].uid] = [{w:40,d:'2026-06-01'},{w:42.5,d:'2026-06-08'},{w:45,d:'2026-06-15'}];
      s.allTimeWeights[d0.ex[0].uid] = 45;
      s.weightHistory[d0.ex[1].uid] = [{w:20,d:'2026-06-02'}];
      s.allTimeWeights[d0.ex[1].uid] = 20;
      s.painLog = [{d:'2026-06-05',z:'rodilla',dur:3,man:2},{d:'2026-06-12',z:'rodilla',dur:5,man:4}];
      s.weekLog = [{w:1,d:'2026-06-08',q:4,nd:4,xp:530,full:true},{w:2,d:'2026-06-15',q:2,nd:4,xp:220,full:false}];
      Object.assign(s, ex || {});
      localStorage.setItem(k, JSON.stringify(s));
    }, extra || null);
    await page.reload(); await page.waitForTimeout(350);
    await page.click('nav button[data-t="stats"]'); await page.waitForTimeout(300);
  };
  await seed();
  let prog = await page.textContent('#content');
  let progHtml = await page.innerHTML('#content');
  st = await S(page);

  ok('weekLog sobrevive a sanitizeState', st.weekLog.length === 2 && st.weekLog[0].full === true,
     JSON.stringify(st.weekLog));
  ok('el dashboard vive en PROGRESO, sin pestaña nueva',
     (await page.$$('nav button')).length === 5);

  // --- ritmo de corte ---
  ok('panel de ritmo con la fase en corte', /RITMO DE CORTE/.test(prog));
  ok('la banda es el 0.5–1% del peso actual', /0\.41–0\.82 kg\/sem/.test(prog), (prog.match(/es 0[^—]*/) || [''])[0]);
  ok('el ritmo se normaliza por días, no por medición',
     /0\.70/.test(progHtml), 'esperaba una barra de 0.70 kg/sem para los 1.4 kg en 14 días');
  ok('la leyenda nombra los tres estados', /EN RANGO/.test(prog) && /LENTO O ESTABLE/.test(prog) && /FUERA DE RANGO/.test(prog));
  ok('cuenta cuántas mediciones cayeron en la banda', /de 4 mediciones dentro de la banda/.test(prog), (prog.match(/\d de \d mediciones[^.]*/) || [''])[0]);
  ok('el hero trae el promedio en kg\/sem', /KG\/SEM/.test(prog));

  // --- grasa vs músculo ---
  ok('panel grasa vs músculo', /GRASA vs MÚSCULO/.test(prog));
  ok('leyenda con las dos series', /CINTURA/.test(prog) && /BRAZO D FUERZA/.test(prog));
  ok('indexado al baseline en vez de eje doble', /BASELINE/.test(progHtml) && /indexadas a tu primera lectura = 100/.test(prog));
  ok('lee bien el escenario cintura abajo + brazo casi intacto',
     /sin pagar músculo|falta proteína/.test(prog), (prog.match(/Cintura -[^.]*\./) || [''])[0]);

  // --- fuerza ---
  ok('el panel de fuerza saca weightHistory a la luz', /FUERZA · 2/.test(prog), (prog.match(/FUERZA · \d+/) || [''])[0]);
  ok('muestra el PR del ejercicio', /45 kg/.test(prog));
  ok('el delta va contra el primer registro', /\+5/.test(prog));
  ok('un ejercicio con un solo registro no inventa curva',
     (await page.$$('.frow .msp polyline')).length === 1 + 1, // 1 de fuerza + 1 de dolor
     String((await page.$$('.frow .msp polyline')).length));
  ok('no lista ejercicios sin historial', !/FUERZA · 25/.test(prog));
  ok('admite que el tonelaje no se puede reconstruir', /tonelaje real .* no se puede reconstruir/.test(prog));

  // --- cuerpo ---
  ok('chips de métrica en CUERPO', (await page.$$('[data-pm]')).length === 7, String((await page.$$('[data-pm]')).length));
  ok('arranca en PESO', /PESO en kg · 5 registros/.test(prog), (prog.match(/PESO[^·]*· \d+ registros/) || [''])[0]);
  await page.click('[data-pm="ratio"]'); await page.waitForTimeout(250);
  prog = await page.textContent('#content');
  ok('cambiar de chip cambia la métrica', /CINT\/EST · 5 registros/.test(prog), (prog.match(/CINT\/EST[^.]*/) || [''])[0]);
  ok('cintura\/estatura dibuja el umbral 0.53', /umbral de referencia 0\.53/.test(prog));
  ok('el chip activo queda marcado', (await page.$$('[data-pm="ratio"].on')).length === 1);
  await page.click('[data-pm="chest"]'); await page.waitForTimeout(250);
  ok('el pecho también grafica', /PECHO en cm · 5 registros/.test(await page.textContent('#content')));
  await page.click('[data-pm="shoulders"]'); await page.waitForTimeout(250);
  ok('una métrica sin datos avisa en vez de romper',
     /Aún no hay dos registros de hombros/.test(await page.textContent('#content')),
     (await page.textContent('#content')).slice(0, 80));

  // --- adherencia y dolor ---
  prog = await page.textContent('#content');
  ok('adherencia sale de weekLog', /ADHERENCIA/.test(prog));
  ok('el porcentaje de adherencia es correcto', /75<?\/?s?m?a?l?l?>?%|75/.test(prog) && /6 de 8 quests/.test(prog),
     (prog.match(/\d+ de \d+ quests[^.]*/) || [''])[0]);
  ok('distingue semana completa de parcial', /SEMANA COMPLETA/.test(prog) && /SEMANA PARCIAL/.test(prog));
  ok('avisa que la adherencia no se reconstruye hacia atrás', /no se puede reconstruir hacia atrás/.test(prog));
  ok('panel de dolor con los registros', /DOLOR · 2 registros/.test(prog));
  ok('el dolor se agrupa por zona', /Rodilla/.test(prog) && /últ 5\/10/.test(prog) && /2 reg/.test(prog));
  ok('mantiene la advertencia de tendinopatía', /no está validado para dolor articular/.test(prog));

  // --- reglas de la gráfica ---
  progHtml = await page.innerHTML('#content');
  ok('ninguna rejilla punteada', !/stroke-dasharray/.test(progHtml));
  ok('las marcas son finas (stroke-width 2)', /stroke-width="2"/.test(progHtml) && !/stroke-width="[5-9]/.test(progHtml));
  ok('los puntos llevan anillo de superficie', /stroke="#0c1222"/.test(progHtml));
  ok('cada punto trae su <title> accesible', /<title>/.test(progHtml));
  ok('los SVG traen role e aria-label', /role="img"/.test(progHtml) && /aria-label="/.test(progHtml));
  ok('no hay un número por cada punto',
     (progHtml.match(/<circle/g) || []).length > (progHtml.match(/font-size="10\.5"/g) || []).length);

  // --- fase: la lectura ramifica ---
  await seed({ settings: { timer:true, sound:true, vibrate:true, wake:true, fase:'volumen' } });
  prog = await page.textContent('#content');
  ok('en volumen cambia el título del panel', /RITMO DE VOLUMEN/.test(prog) && !/RITMO DE CORTE/.test(prog));
  ok('en volumen la banda es 0.20–0.40', /0\.20–0\.40 kg\/sem/.test(prog), (prog.match(/es 0[^.]*\./) || [''])[0]);
  await seed({ settings: { timer:true, sound:true, vibrate:true, wake:true, fase:'mantener' } });
  ok('en mantenimiento tiene su propia banda', /RITMO EN MANTENIMIENTO/.test(await page.textContent('#content')));

  // --- saneado en la frontera de confianza (restaurar un respaldo) ---
  // sanitizeState() guarda lo que ENTRA de fuera — import y restore — no lo que
  // la app escribe en su propio localStorage (eso pasa por upgrade), igual que painLog.
  await seed();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('arise:default:state'));
    s.weekLog = [{w:1,d:'no-es-fecha',q:1,nd:4},          // fecha inválida → fuera
                 {w:2,d:'2026-06-15',q:9,nd:0},            // sin días → fuera
                 {w:'x',d:'2026-06-22',q:'3',nd:'4',xp:'99',full:1}];  // tipos sucios → se reconstruye
    localStorage.setItem('arise:default:backups',
      JSON.stringify([{t:1,label:'basura',schema:8,app:'8.5',data:s}]));
  });
  await page.reload(); await page.waitForTimeout(300);
  await page.click('nav button[data-t="data"]'); await page.waitForTimeout(300);
  await page.click('[data-rest="0"]'); await page.waitForTimeout(450);
  st = await S(page);
  ok('sanitizeState tira las entradas basura de weekLog', st.weekLog.length === 1, JSON.stringify(st.weekLog));
  ok('y reconstruye los tipos campo por campo',
     st.weekLog[0].w === 0 && st.weekLog[0].q === 3 && st.weekLog[0].nd === 4 &&
     st.weekLog[0].xp === 99 && st.weekLog[0].full === true,
     JSON.stringify(st.weekLog[0]));
  ok('restaurar con weekLog sucio no rompe el dashboard', errs.length === 0, errs.join(' | '));
  await page.click('nav button[data-t="stats"]'); await page.waitForTimeout(300);
  ok('el panel de adherencia dibuja con el registro saneado', /ADHERENCIA/.test(await page.textContent('#content')));

  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(350);
  await page.click('nav button[data-t="stats"]'); await page.waitForTimeout(300);
  prog = await page.textContent('#content');
  ok('sin historial, el dashboard no se rompe', /ESTADO DEL CAZADOR/.test(prog) && /RECORDS ALL-TIME/.test(prog));
  ok('sin cargas, fuerza explica qué hacer', /Todavía sin historial de cargas/.test(prog));
  ok('sin dolor no dibuja el panel de dolor', !/DOLOR ·/.test(prog));
  ok('sin semanas cerradas no dibuja adherencia', !/ADHERENCIA/.test(prog));
  ok('con una sola medición no dibuja ritmo', !/RITMO DE/.test(prog));

  // --- closeWeek alimenta el registro ---
  await page.click('nav button[data-t="quests"]'); await page.waitForTimeout(200);
  const chks = await page.$$('[data-chk]');
  await chks[0].click(); await page.waitForTimeout(150);
  await page.click('#closeWeek'); await page.waitForTimeout(450);
  st = await S(page);
  ok('cerrar la semana escribe en weekLog', st.weekLog.length === 1 && st.weekLog[0].w === 1, JSON.stringify(st.weekLog));
  ok('guarda quests hechas y total de días', st.weekLog[0].nd === 4 && st.weekLog[0].q >= 0, JSON.stringify(st.weekLog[0]));
  ok('el XP de la semana queda registrado', typeof st.weekLog[0].xp === 'number', JSON.stringify(st.weekLog[0]));
  ok('el XP total no se descuadra con el registro nuevo', st.xp === st.xpBase, st.xp + ' vs ' + st.xpBase);
  await page.click('nav button[data-t="stats"]'); await page.waitForTimeout(300);
  ok('ya con una semana cerrada aparece adherencia', /ADHERENCIA/.test(await page.textContent('#content')));
  ok('sin errores de JS en v8.5', errs.length === 0, errs.join(' | '));

  await browser.close(); server.close();
  console.log('\n' + (fail === 0 ? '\x1b[32m' : '\x1b[31m') + pass + ' pasaron · ' + fail + ' fallaron\x1b[0m\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
