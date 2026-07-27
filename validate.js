const fs = require('fs');
const raw = fs.readFileSync('/home/claude/arise/gendb.json', 'utf8');

let db;
try { db = JSON.parse(raw); } catch (e) { console.error('JSON NO PARSEABLE:', e.message); process.exit(1); }

const PAT = ['empuje_h','empuje_v','jalon_h','jalon_v','rodilla_dom','cadera_dom','aislamiento','core','pantorrilla'];
const TIPO = ['compuesto','aislamiento'];
const MUS = ['pectoral','dorsal','espalda_alta','deltoides_lat','deltoides_post','deltoides_ant','biceps','triceps','cuadriceps','femoral','gluteo','pantorrilla','abdomen','erectores','trapecio','antebrazo','aductores','abductores'];
const EQ = ['barra','mancuerna','polea','maquina','prensa','peso_corporal','banda','kettlebell','banco','rack','barra_z','smith'];
const JOINTS = ['rodilla','hombro','lumbar','codo','muneca','cadera','cuello','tobillo'];
const TAGS = ['compresion_patelofemoral','rango_profundo_rodilla','carga_axial_columna','abduccion_sobre_cabeza','extension_muneca_cargada','cizalla_lumbar','flexion_lumbar_cargada','rotacion_externa_forzada','valgo_codo','impacto','unilateral','agarre_limitante'];

const errs = [];
const warns = [];
const E = m => errs.push(m);

// 1. esquema
const ids = new Set();
for (const [i, x] of db.entries()) {
  const at = `[${i}] ${x && x.id ? x.id : '??'}`;
  if (typeof x !== 'object' || x === null) { E(`${at}: no es objeto`); continue; }
  for (const k of ['id','n','pat','tipo','estirada','m','syn','eq','reps','rir','rest','stress','tags'])
    if (!(k in x)) E(`${at}: falta campo '${k}'`);
  const extra = Object.keys(x).filter(k => !['id','n','pat','tipo','estirada','m','syn','eq','reps','rir','rest','stress','tags'].includes(k));
  if (extra.length) E(`${at}: campos extra ${extra}`);
  if (typeof x.id !== 'string' || !/^[a-z0-9_]+$/.test(x.id)) E(`${at}: id no snake_case ascii`);
  if (ids.has(x.id)) E(`${at}: id DUPLICADO`); ids.add(x.id);
  if (typeof x.n !== 'string' || !x.n.length) E(`${at}: n invalido`);
  if (!PAT.includes(x.pat)) E(`${at}: pat fuera de vocabulario: ${x.pat}`);
  if (!TIPO.includes(x.tipo)) E(`${at}: tipo invalido: ${x.tipo}`);
  if (typeof x.estirada !== 'boolean') E(`${at}: estirada no booleano`);
  if (!MUS.includes(x.m)) E(`${at}: m fuera de vocabulario: ${x.m}`);
  if (!Array.isArray(x.syn)) E(`${at}: syn no array`);
  else {
    if (x.syn.length > 3) E(`${at}: syn con ${x.syn.length} elementos (>3)`);
    for (const s of x.syn) {
      if (!Array.isArray(s) || s.length !== 2) { E(`${at}: syn mal formado`); continue; }
      if (!MUS.includes(s[0])) E(`${at}: syn musculo invalido ${s[0]}`);
      if (s[1] !== 0.5) E(`${at}: syn peso != 0.5 (${s[1]})`);
      if (s[0] === x.m) E(`${at}: syn repite el musculo primario`);
    }
    if (new Set(x.syn.map(s => s[0])).size !== x.syn.length) E(`${at}: syn con musculos repetidos`);
  }
  if (!Array.isArray(x.eq) || !x.eq.length) E(`${at}: eq vacio o no array`);
  else for (const e of x.eq) if (!EQ.includes(e)) E(`${at}: eq invalido ${e}`);
  for (const f of ['reps','rir']) {
    const v = x[f];
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isInteger) || v[0] > v[1])
      E(`${at}: ${f} invalido ${JSON.stringify(v)}`);
  }
  if (!Number.isInteger(x.rest) || x.rest < 45 || x.rest > 300) E(`${at}: rest invalido ${x.rest}`);
  // coherencia tipo/reps/rir/rest
  if (x.tipo === 'compuesto') {
    if (x.reps[0] < 5 || x.reps[1] > 15) warns.push(`${at}: compuesto con reps ${JSON.stringify(x.reps)} fuera de 5-15`);
    if (x.rir[0] < 1 || x.rir[1] > 3) E(`${at}: compuesto con rir ${JSON.stringify(x.rir)} (esperado dentro de [1,3])`);
    if (x.rest < 120) warns.push(`${at}: compuesto con rest ${x.rest}`);
  } else {
    if (x.reps[0] < 8 || x.reps[1] > 20) warns.push(`${at}: aislamiento con reps ${JSON.stringify(x.reps)} fuera de 8-20`);
    if (x.rir[0] !== 0 || x.rir[1] > 1) E(`${at}: aislamiento con rir ${JSON.stringify(x.rir)} (esperado [0,1])`);
    if (x.rest > 90) warns.push(`${at}: aislamiento con rest ${x.rest}`);
  }
  // stress
  if (typeof x.stress !== 'object' || x.stress === null) E(`${at}: stress invalido`);
  else {
    const ks = Object.keys(x.stress);
    if (ks.length !== 8 || !JOINTS.every(j => ks.includes(j)))
      E(`${at}: stress debe tener exactamente las 8 llaves; tiene ${JSON.stringify(ks)}`);
    for (const j of JOINTS) {
      const v = x.stress[j];
      if (!Number.isInteger(v) || v < 0 || v > 3) E(`${at}: stress.${j} = ${v} (entero 0-3)`);
    }
  }
  if (!Array.isArray(x.tags)) E(`${at}: tags no array`);
  else {
    for (const t of x.tags) if (!TAGS.includes(t)) E(`${at}: tag invalido ${t}`);
    if (new Set(x.tags).size !== x.tags.length) E(`${at}: tags repetidos`);
  }
}

// 2. tamaño
console.log(`\n=== TOTAL: ${db.length} ejercicios ===`);
if (db.length < 55 || db.length > 65) E(`total ${db.length} fuera del rango 55-65`);

// 3. cobertura por patron
console.log('\n--- Ejercicios por patron (min 4) ---');
for (const p of PAT) {
  const n = db.filter(x => x.pat === p).length;
  console.log(`  ${p.padEnd(12)} ${String(n).padStart(2)} ${n >= 4 ? 'OK' : 'FALLA'}`);
  if (n < 4) E(`patron ${p} con solo ${n} ejercicios`);
}

// 4. PROPIEDAD CRITICA: por patron x articulacion, min stress <= 1
console.log('\n--- PROPIEDAD CRITICA: min(stress) por patron x articulacion (debe ser <=1) ---');
console.log('patron'.padEnd(13) + JOINTS.map(j => j.slice(0, 7).padStart(8)).join(''));
let critOk = true;
for (const p of PAT) {
  const ex = db.filter(x => x.pat === p);
  let row = p.padEnd(13);
  for (const j of JOINTS) {
    const min = Math.min(...ex.map(x => x.stress[j]));
    row += (String(min) + (min <= 1 ? ' ' : '!')).padStart(8);
    if (min > 1) { critOk = false; E(`PROPIEDAD CRITICA: patron ${p} no tiene opcion con ${j} <= 1 (min=${min})`); }
  }
  console.log(row);
}
console.log(critOk ? '  => PROPIEDAD CRITICA: CUMPLE en 9x8 = 72 celdas' : '  => PROPIEDAD CRITICA: FALLA');

// 5. escaleras de sustitucion: dentro del mismo patron y mismo musculo primario,
//    >=3 opciones con stress estrictamente descendente en la articulacion.
function ladders(joint) {
  const out = [];
  for (const p of PAT) {
    const ex = db.filter(x => x.pat === p);
    const maxJ = Math.max(...ex.map(x => x.stress[joint]));
    if (maxJ < 2) { out.push({ p, skip: true, maxJ }); continue; }
    let best = null;
    for (const m of new Set(ex.map(x => x.m))) {
      const grp = ex.filter(x => x.m === m).sort((a, b) => b.stress[joint] - a.stress[joint]);
      // cadena mas larga con valores estrictamente decrecientes
      const chain = [];
      for (const x of grp) if (!chain.length || x.stress[joint] < chain[chain.length - 1].stress[joint]) chain.push(x);
      if (!best || chain.length > best.chain.length) best = { m, chain };
    }
    // exigencia: si la articulacion se carga fuerte (max 3) pedimos 3 escalones;
    // si el maximo del patron es 2 no se puede fabricar un 3er escalon sin inventar un 0,
    // asi que basta con bajar de 2 a <=1 (2 escalones).
    const req = maxJ >= 3 ? 3 : 2;
    out.push({ p, maxJ, req, m: best.m, chain: best.chain, ok: best.chain.length >= req });
  }
  return out;
}
for (const joint of ['rodilla', 'hombro', 'lumbar']) {
  console.log(`\n--- Escaleras de sustitucion: ${joint.toUpperCase()} ---`);
  for (const r of ladders(joint)) {
    if (r.skip) { console.log(`  ${r.p.padEnd(12)} (no carga: max=${r.maxJ}, no requiere cadena)`); continue; }
    const txt = r.chain.map(x => `${x.n} (${x.stress[joint]})`).join(' -> ');
    console.log(`  ${r.p.padEnd(12)} [${r.m}] ${txt}   (req ${r.req}) ${r.ok ? 'OK' : 'FALLA'}`);
    if (!r.ok) E(`escalera ${joint}/${r.p}: ${r.chain.length} escalones, se requieren ${r.req} (max stress ${r.maxJ})`);
  }
}

// 6. tiers de equipo
console.log('\n--- Tiers de equipo ---');
function tier(name, allowed) {
  const ex = db.filter(x => x.eq.every(e => allowed.includes(e)));
  console.log(`  ${name}: ${ex.length} ejercicios`);
  const pats = {};
  for (const p of PAT) pats[p] = ex.filter(x => x.pat === p).length;
  console.log('    por patron: ' + PAT.map(p => `${p}=${pats[p]}`).join(' '));
  const faltan = PAT.filter(p => pats[p] === 0);
  if (faltan.length) { E(`tier ${name} sin cobertura en: ${faltan.join(', ')}`); }
  const mus = new Set(ex.map(x => x.m));
  console.log('    musculos primarios: ' + [...mus].sort().join(', '));
  return ex;
}
tier('mancuerna+banco (+peso_corporal)', ['mancuerna', 'banco', 'peso_corporal']);
tier('peso_corporal+banda', ['peso_corporal', 'banda']);

// 7. cobertura de musculos rezagados
console.log('\n--- Cobertura por musculo primario ---');
const byM = {};
for (const x of db) (byM[x.m] = byM[x.m] || []).push(x.id);
for (const m of MUS) console.log(`  ${m.padEnd(16)} ${String((byM[m] || []).length).padStart(2)}`);
for (const m of ['pectoral', 'dorsal', 'espalda_alta']) {
  const n = (byM[m] || []).length;
  if (n < 3) E(`musculo rezagado ${m} con solo ${n} opciones primarias`);
}

// 8. estirada
console.log('\n--- estirada:true ---');
console.log('  ' + db.filter(x => x.estirada).length + ' ejercicios: ' + db.filter(x => x.estirada).map(x => x.id).join(', '));

console.log('\n================ RESULTADO ================');
if (warns.length) { console.log(`AVISOS (${warns.length}):`); for (const w of warns) console.log('  ! ' + w); }
if (errs.length) { console.log(`ERRORES (${errs.length}):`); for (const e of errs) console.log('  X ' + e); process.exitCode = 1; }
else console.log('TODO OK: esquema, vocabularios, ids, patrones, propiedad critica, escaleras y tiers.');
