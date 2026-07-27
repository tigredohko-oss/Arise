const P=require('./parse.js');const DB=require('./gendb.json');
let pass=0,fail=0;
const ok=(n,c,x)=>{c?(pass++,console.log('  \x1b[32mPASS\x1b[0m '+n)):(fail++,console.log('  \x1b[31mFAIL\x1b[0m '+n+(x!==undefined?'  → '+x:'')))};

const A=`DÍA 1 - PECHO Y TRÍCEPS
Press banca 4x8-10
Press inclinado con mancuerna 3x12
Aperturas en polea 3 x 15
Fondos en paralelas 3x10
Extensión de tríceps en polea 4x12-15

DÍA 2 – ESPALDA Y BÍCEPS
Dominadas 4x6-8
Remo con barra 4x10
Jalón al pecho 3x12
Curl con barra 3x10-12`;

const B=`LUNES — TREN SUPERIOR
- Press militar: 4 series de 8 reps
- Remo sentado: 3 series de 12 reps
• Elevaciones laterales: 3 series de 15 reps (RIR 0-1)
1) Curl martillo: 3 series de 12 reps

MIÉRCOLES — TREN INFERIOR
- Sentadilla: 5 series de 5 reps, descanso 3 min
- Prensa 4 series de 12 reps
- Curl femoral tumbado 3 series de 15 reps`;

const C=`Ejercicio | Series | Reps
Press de banca | 4 | 8-10
Remo con mancuerna | 3 | 10 por lado
Peso muerto rumano | 4 | 8

Página 1/2`;

const D=`A) PUSH
Press banca 4x8 @ RIR 2 - descanso 150s - 80kg
Press inclinado 3x10 (enfocar pecho superior)
Fondos 3x12 por lado

B) PULL
Dominadas lastradas 4x6
Remo T 4x10 — agarre neutro`;

const E=`8-10 reps x 4 series press banca
12 reps x 3 series curl biceps`;

const F=`Mi rutina
Press banca 4x10
esto es una linea rara que no dice nada
Sentadilla 3x12
NOTAS IMPORTANTES
tomar creatina`;

console.log('\n\x1b[36mA. FORMATO CLÁSICO\x1b[0m');
let r=P.parseRutina(A);
ok('2 días', r.stats.dias===2, r.stats.dias);
ok('9 ejercicios', r.stats.ejercicios===9, r.stats.ejercicios);
ok('nombres limpios', r.days[0].ex[0].n==='Press banca', r.days[0].ex[0].n);
ok('series×reps con rango', r.days[0].ex[0].s==='4×8-10', r.days[0].ex[0].s);
ok('espacios alrededor de la x', r.days[0].ex[2].s==='3×15', r.days[0].ex[2].s);
ok('primer ejercicio marcado BOSS', r.days[0].ex[0].boss===true);
ok('solo uno por día es BOSS', r.days.every(d=>d.ex.filter(e=>e.boss).length===1));
ok('nada sin parsear', r.stats.sinParsear===0, JSON.stringify(r.sueltas));

console.log('\n\x1b[36mB. VIÑETAS Y "SERIES DE"\x1b[0m');
r=P.parseRutina(B);
ok('2 días por nombre de día de la semana', r.stats.dias===2, r.stats.dias);
ok('7 ejercicios', r.stats.ejercicios===7, r.stats.ejercicios);
ok('quita la viñeta -', r.days[0].ex[0].n==='Press militar', r.days[0].ex[0].n);
ok('quita la viñeta •', r.days[0].ex[2].n==='Elevaciones laterales', r.days[0].ex[2].n);
ok('quita la numeración 1)', r.days[0].ex[3].n==='Curl martillo', r.days[0].ex[3].n);
ok('captura RIR como nota', /RIR 0-1/.test(r.days[0].ex[2].note), r.days[0].ex[2].note);
ok('captura descanso en minutos → segundos', r.days[1].ex[0].rest===180, r.days[1].ex[0].rest);
ok('nada sin parsear', r.stats.sinParsear===0, JSON.stringify(r.sueltas));

console.log('\n\x1b[36mC. TABLA PEGADA DE HOJA DE CÁLCULO\x1b[0m');
r=P.parseRutina(C);
ok('3 ejercicios', r.stats.ejercicios===3, r.stats.ejercicios);
ok('descarta el encabezado de tabla', !JSON.stringify(r).includes('"Ejercicio"'), JSON.stringify(r.days[0].ex.map(e=>e.n)));
ok('descarta el pie de página', r.stats.sinParsear===0, JSON.stringify(r.sueltas));
ok('lee la fila como nombre + series + reps', r.days[0].ex[0].n==='Press de banca'&&r.days[0].ex[0].s==='4×8-10',
   r.days[0].ex[0].n+' / '+r.days[0].ex[0].s);
ok('detecta "por lado"', /por lado/.test(r.days[0].ex[1].note), r.days[0].ex[1].note);

console.log('\n\x1b[36mD. CON RIR, DESCANSO, PESO Y NOTAS\x1b[0m');
r=P.parseRutina(D);
ok('2 días por "A)" y "B)"', r.stats.dias===2, r.stats.dias);
ok('nombre sin la metadata', r.days[0].ex[0].n==='Press banca', r.days[0].ex[0].n);
ok('descanso en segundos', r.days[0].ex[0].rest===150, r.days[0].ex[0].rest);
ok('RIR y peso a la nota', /RIR 2/.test(r.days[0].ex[0].note)&&/80\s*kg/i.test(r.days[0].ex[0].note),
   r.days[0].ex[0].note);
ok('paréntesis a la nota', /pecho superior/.test(r.days[0].ex[1].note), r.days[0].ex[1].note);
ok('cola tras — a la nota', /agarre neutro/.test(r.days[1].ex[1].note), r.days[1].ex[1].note);
ok('nombre sin la cola', r.days[1].ex[1].n==='Remo T', r.days[1].ex[1].n);

console.log('\n\x1b[36mE. ORDEN INVERTIDO (reps x series)\x1b[0m');
r=P.parseRutina(E);
ok('2 ejercicios', r.stats.ejercicios===2, r.stats.ejercicios);
ok('4 series de 8-10, no al revés', r.days[0].ex[0].sets===4&&r.days[0].ex[0].s==='4×8-10', JSON.stringify(r.days[0].ex[0]));

console.log('\n\x1b[36mF. NADA SE PIERDE EN SILENCIO\x1b[0m');
r=P.parseRutina(F);
ok('parsea los 2 ejercicios', r.stats.ejercicios===2, r.stats.ejercicios);
ok('reporta las líneas que no entendió', r.sueltas.length>=1, JSON.stringify(r.sueltas));
ok('la línea rara aparece en sueltas', r.sueltas.some(x=>/linea rara/.test(x.linea)), JSON.stringify(r.sueltas));
ok('cada suelta trae su número de línea', r.sueltas.every(x=>x.n>0));

console.log('\n\x1b[36mG. EMPAREJADO CON LA BASE\x1b[0m');
[['Press banca','Press Banca con Barra'],['Sentadilla búlgara','Sentadilla Búlgara'],
 ['Peso muerto rumano','Romanian Deadlift'],['Jalón al pecho','Jalón al Pecho en Polea'],
 ['Curl martillo','Curl Martillo'],['Hip thrust','Hip Thrust con Barra']].forEach(([q,esperado])=>{
  const m=P.emparejar(q,DB);
  ok('"'+q+'" empareja', m&&m.ex.n.indexOf(esperado.split(' ')[0])>=0, m?m.ex.n:'sin match');
});
const raro=P.emparejar('Ejercicio inventado xyz',DB);
ok('un nombre inventado NO empareja a la fuerza', !raro, raro?raro.ex.n:'null');

console.log('\n\x1b[36mH. ROBUSTEZ\x1b[0m');
ok('texto vacío no truena', P.parseRutina('').stats.dias===0);
ok('null no truena', P.parseRutina(null).stats.dias===0);
ok('solo basura no inventa días', P.parseRutina('hola\nque tal\nadios').stats.dias===0);
ok('un solo ejercicio sin encabezado crea el día', P.parseRutina('Press banca 4x10').stats.dias===1);
ok('no confunde peso con reps', (()=>{const x=P.parseRutina('Press banca 4x8 con 60kg');
   return x.days[0].ex[0].sets===4&&x.days[0].ex[0].r1===8})(), JSON.stringify(P.parseRutina('Press banca 4x8 con 60kg').days[0].ex[0]));

console.log('\n\x1b[36mI. TABLA VERTICAL (cada celda en su renglón)\x1b[0m');
const V=require('fs').readFileSync('rutv6.txt','utf8');
r=P.parseRutina(V);
ok('detecta el modo tabla vertical', r.vertical===true);
ok('4 días', r.stats.dias===4, r.stats.dias);
ok('21 ejercicios (antes leía 3)', r.stats.ejercicios===21, r.stats.ejercicios);
ok('nombres sin la numeración de fila', r.days[0].ex[0].n==='Weighted Dip torso inclinado', r.days[0].ex[0].n);
ok('respeta el BOSS marcado en el texto', r.days[0].ex[0].boss===true&&r.days[1].ex[0].boss===true);
ok('un solo BOSS por día', r.days.every(d=>d.ex.filter(e=>e.boss).length===1),
   r.days.map(d=>d.ex.filter(e=>e.boss).length).join(','));
ok('la nota llega completa', /inclínate 15-20/.test(r.days[0].ex[0].note), r.days[0].ex[0].note);
ok('"pausa 1 s arriba" NO se confunde con descanso', /pausa 1 s arriba/.test(r.days[1].ex[0].note)&&!r.days[1].ex[0].rest,
   r.days[1].ex[0].note+' | rest='+r.days[1].ex[0].rest);
ok('"por lado" sale del nombre y va a la nota',
   r.days[3].ex[1].n==='Bulgarian Split Squat'&&/por lado/.test(r.days[3].ex[1].note),
   r.days[3].ex[1].n+' | '+r.days[3].ex[1].note);
ok('la cola "/ 10-15" no ensucia el nombre',
   r.days[1].ex[4].n==='Abducción de cadera ⇄ Hanging Leg Raise', r.days[1].ex[4].n);
ok('"3 rondas" se entiende como 3 series', r.days[3].ex[4].sets===3, JSON.stringify(r.days[3].ex[4]));
ok('los encabezados de columna no son ejercicios',
   !JSON.stringify(r.days).includes('"Ejercicio"')&&!JSON.stringify(r.days).includes('"Nota"'));
ok('la tabla de volumen del final no genera ejercicios',
   !r.days.some(d=>d.ex.some(e=>/Cuádriceps|Deltoide lateral/.test(e.n))));
ok('la prosa con números NO se cuela como ejercicio',
   !r.days.some(d=>d.ex.some(e=>/Si te sobran/.test(e.n))));
ok('pero sí se reporta para que el usuario decida',
   r.sueltas.some(x=>/Si te sobran/.test(x.linea)&&x.tipo==='texto con números'),
   JSON.stringify(r.sueltas.filter(x=>x.tipo==='texto con números').map(x=>x.linea.slice(0,40))));
ok('las sueltas vienen clasificadas', r.sueltas.every(x=>x.tipo));
ok('el formato clásico NO entra en modo vertical', P.parseRutina(A).vertical===false);

console.log('\n\x1b[36mJ. EMPAREJADO DE LA RUTINA v6\x1b[0m');
const nombres=[]; r.days.forEach(d=>d.ex.forEach(e=>nombres.push(e.n)));
const conservados=['Chest-Supported Row','Hip Thrust','Seated Leg Curl','Standing Calf Raise',
  'Seated Calf Raise','Seated Cable Row neutro','Romanian Deadlift','Bulgarian Split Squat','Leg Extension'];
conservados.forEach(n=>ok('conserva el nombre exacto "'+n+'" (para que migren los records)',
  nombres.indexOf(n)>=0, nombres.filter(x=>x.indexOf(n.split(' ')[0])>=0).join(' | ')));
const declMatch=P.emparejar('Press declinado con mancuernas',DB);
ok('"Press declinado" NO empareja con el inclinado (ángulo distinto = record falso)',
   !declMatch||!/Inclinado/.test(declMatch.ex.n), declMatch?declMatch.ex.n:'sin match');
ok('tampoco empareja sentado con de pie',
   (()=>{const m=P.emparejar('Elevación de talones sentado',DB);return !m||!/de Pie/.test(m.ex.n)})(),
   (P.emparejar('Elevación de talones sentado',DB)||{ex:{n:'sin match'}}).ex.n);
ok('detecta el choque incline/decline', P.chocan(['press','declinado'],['press','inclinado']));
ok('detecta el choque barra/mancuerna', P.chocan(['press','barbell'],['press','dumbbell']));
ok('no marca choque si uno no trae calificador', !P.chocan(['press','banca'],['press','banca','barbell']));
ok('"Weighted Dip torso inclinado" no fuerza un match difuso equivocado',
   (()=>{const m=P.emparejar('Weighted Dip torso inclinado',DB);
         return !m||/Fondos|Dip/i.test(m.ex.n)})(),
   (P.emparejar('Weighted Dip torso inclinado',DB)||{ex:{n:'sin match — lo cubre el alias curado de la app'}}).ex.n);

console.log('\n'+(fail===0?'\x1b[32m':'\x1b[31m')+pass+' pasaron · '+fail+' fallaron\x1b[0m\n');
process.exit(fail?1:0);
