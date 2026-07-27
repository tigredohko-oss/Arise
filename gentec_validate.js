const fs = require('fs');
const path = require('path');
const DIR = '/home/claude/arise';

let fails = 0;
const fail = (msg) => { fails++; console.log('  FALLA: ' + msg); };
const sec = (t) => console.log('\n== ' + t);

const db = JSON.parse(fs.readFileSync(path.join(DIR, 'gendb.json'), 'utf8'));
let tec;
sec('1) JSON parseable');
try {
  tec = JSON.parse(fs.readFileSync(path.join(DIR, 'gentec.json'), 'utf8'));
  console.log('  OK: gentec.json parseado, ' + Object.keys(tec).length + ' llaves');
} catch (e) {
  console.log('  FALLA: no parsea -> ' + e.message);
  process.exit(1);
}

sec('2) Llaves == nombres de gendb.json');
const wanted = db.map(e => e.n);
const got = Object.keys(tec);
const missing = wanted.filter(n => !got.includes(n));
const extra = got.filter(n => !wanted.includes(n));
if (missing.length) fail('faltan ' + missing.length + ': ' + JSON.stringify(missing, null, 1));
if (extra.length) fail('sobran ' + extra.length + ': ' + JSON.stringify(extra, null, 1));
const dupN = wanted.filter((n, i) => wanted.indexOf(n) !== i);
if (dupN.length) fail('nombres duplicados en gendb: ' + dupN.join(', '));
if (!missing.length && !extra.length) console.log('  OK: ' + wanted.length + ' ejercicios, conjuntos idénticos');

sec('3) Estructura (p de 4-6 pasos, clave y error no vacíos)');
for (const [n, f] of Object.entries(tec)) {
  if (!Array.isArray(f.p)) { fail(n + ': p no es arreglo'); continue; }
  if (f.p.length < 4 || f.p.length > 6) fail(n + ': p tiene ' + f.p.length + ' pasos');
  f.p.forEach((s, i) => { if (typeof s !== 'string' || !s.trim()) fail(n + ': paso ' + (i + 1) + ' vacío'); });
  if (!f.clave || !String(f.clave).trim()) fail(n + ': clave vacía');
  if (!f.error || !String(f.error).trim()) fail(n + ': error vacío');
  const ex = Object.keys(f).filter(k => !['p', 'clave', 'error'].includes(k));
  if (ex.length) fail(n + ': llaves extra ' + ex.join(','));
}
console.log('  revisados: ' + got.length);

sec('4) Longitud de pasos <= 200 caracteres');
let longest = 0, longestOwner = '';
for (const [n, f] of Object.entries(tec)) {
  (f.p || []).forEach((s, i) => {
    if (s.length > longest) { longest = s.length; longestOwner = n + ' paso ' + (i + 1); }
    if (s.length > 200) fail(n + ' paso ' + (i + 1) + ': ' + s.length + ' caracteres');
  });
}
console.log('  paso más largo: ' + longest + ' caracteres (' + longestOwner + ')');

sec('5) Sin promesas médicas');
const banned = ['previene', 'corrige la postura', 'rehabilita', 'cura'];
for (const [n, f] of Object.entries(tec)) {
  const blob = [...(f.p || []), f.clave, f.error].join(' ').toLowerCase();
  for (const w of banned) if (blob.includes(w)) fail(n + ': contiene "' + w + '"');
}
console.log('  palabras vetadas revisadas: ' + banned.join(', '));

sec('6) Coherencia con stress >= 3');
const RE = {
  lumbar: /espalda|lumbar|columna/i,
  hombro: /hombro/i,
  rodilla: /rodilla/i,
};
let n3 = 0;
for (const e of db) {
  const f = tec[e.n];
  if (!f) continue;
  const blob = (f.clave || '') + ' ' + (f.error || '');
  for (const art of ['lumbar', 'hombro', 'rodilla']) {
    if ((e.stress || {})[art] >= 3) {
      n3++;
      if (!RE[art].test(blob)) fail(e.n + ': stress.' + art + '=3 pero clave+error no lo menciona');
    }
  }
}
console.log('  articulaciones con stress 3 revisadas: ' + n3);

sec('7) Coherencia con estirada:true');
const stretchRe = /estira|estiramiento|posición larga|abajo/i;
let nEst = 0;
for (const e of db) {
  if (!e.estirada) continue;
  nEst++;
  const f = tec[e.n];
  if (!f) continue;
  if (!(f.p || []).some(s => stretchRe.test(s))) fail(e.n + ': estirada=true pero ningún paso menciona el estiramiento');
}
console.log('  ejercicios estirada=true revisados: ' + nEst);

sec('8) Coherencia con tags');
let nTag = 0;
for (const e of db) {
  const f = tec[e.n];
  if (!f) continue;
  const tags = e.tags || [];
  const pasos = (f.p || []).join(' ').toLowerCase();
  const err = (f.error || '').toLowerCase();
  if (tags.includes('unilateral')) {
    nTag++;
    if (!/(cambia|cambiar) de (lado|pierna|brazo)|por lado|de ese lado/.test(pasos)) fail(e.n + ': unilateral pero los pasos no indican hacerlo por lado');
  }
  if (tags.includes('rango_profundo_rodilla')) {
    nTag++;
    if (!/(rango profundo|profund)/.test(err) || !/rodilla/.test(err)) fail(e.n + ': rango_profundo_rodilla pero el error no advierte de la profundidad/rodilla');
  }
  if (tags.includes('flexion_lumbar_cargada')) {
    nTag++;
    if (!/(lumbar|espalda|columna)/.test(err) || !/flexi[oó]n|redonde/.test(err)) fail(e.n + ': flexion_lumbar_cargada pero el error no advierte de la flexión cargada');
  }
}
console.log('  tags críticos revisados: ' + nTag);

sec('RESULTADO');
console.log(fails === 0 ? '  TODO PASA (0 fallas)' : '  ' + fails + ' FALLAS');
process.exit(fails === 0 ? 0 : 1);
