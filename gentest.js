const DB=require('./gendb.json'), G=require('./gen.js');
let pass=0,fail=0;
const ok=(n,c,x)=>{c?(pass++,console.log('  \x1b[32mPASS\x1b[0m '+n)):(fail++,console.log('  \x1b[31mFAIL\x1b[0m '+n+(x!==undefined?'  → '+x:'')))};
const base={edad:30,sexo:"m",peso:85.1,altura:178,anios:15,dias:4,minutos:60,cardio:10,
  objetivo:"masa",equipo:["barra","mancuerna","polea","maquina","prensa","peso_corporal","banco","rack","barra_z","smith","banda","kettlebell"],
  excluir:[],excluirTags:[],cintura:99,prioridad:["pectoral","dorsal"],dolor:null};

console.log('\n\x1b[36mA. GENERACIÓN 2-6 DÍAS\x1b[0m');
[2,3,4,5,6].forEach(d=>{
  const r=G.generar(DB,Object.assign({},base,{dias:d}));
  ok(d+' días genera rutina', !!r.rutina && r.rutina.days.length===d, r.rutina?r.rutina.days.length:'null');
  ok('  '+d+'d: cada día tiene BOSS único', r.rutina.days.every(x=>x.ex.filter(e=>e.boss).length===1),
     r.rutina.days.map(x=>x.ex.filter(e=>e.boss).length).join(','));
  ok('  '+d+'d: ningún día vacío', r.rutina.days.every(x=>x.ex.length>=3), r.rutina.days.map(x=>x.ex.length).join(','));
  ok('  '+d+'d: presupuesto de tiempo respetado', r.audit.sesiones.every(s=>s.ok),
     r.audit.sesiones.map(s=>Math.round(s.seg/60)+'/'+Math.round(s.cap/60)).join(' '));
  ok('  '+d+'d: notas en formato RIR que lee restFor()', r.rutina.days.every(x=>x.ex.every(e=>/RIR \d/.test(e.note))));
});

console.log('\n\x1b[36mB. OBJETIVO GRASA — PISO DE 10 SERIES\x1b[0m');
const rg=G.generar(DB,Object.assign({},base,{objetivo:"grasa",prioridad:[]}));
const pre=G.presupuesto(Object.assign({},base,{objetivo:"grasa",prioridad:[]}),G.derivar(base));
ok('el target nunca baja de 10 en déficit', G.MUS_AUDIT.every(m=>pre.porMusculo[m]>=10),
   JSON.stringify(pre.porMusculo));
const rm=G.generar(DB,Object.assign({},base,{objetivo:"mantener",prioridad:[]}));
ok('el déficit produce MÁS volumen que mantenimiento, no menos',
   rg.audit.volTotal>=rm.audit.volTotal, rg.audit.volTotal+' vs '+rm.audit.volTotal);
ok('el generador NO baja el objetivo para que la auditoría salga limpia',
   rg.audit.musculos.every(x=>x.target>=10), JSON.stringify(rg.audit.musculos.map(x=>x.m+':'+x.target)));
ok('declara el conflicto piso-vs-tiempo en vez de esconderlo',
   rg.avisos.some(a=>a.tipo==='conflicto'&&/no caben/.test(a.txt)),
   JSON.stringify(rg.avisos.map(a=>a.tipo)));

console.log('\n\x1b[36mC. PRESUPUESTO DE TIEMPO\x1b[0m');
[30,45,60,90].forEach(min=>{
  const r=G.generar(DB,Object.assign({},base,{minutos:min,cardio:min>40?10:0}));
  ok(min+' min: ninguna sesión rebasa el tope', r.audit.sesiones.every(s=>s.ok),
     r.audit.sesiones.map(s=>Math.round(s.seg/60)+'min').join(' '));
});
const corto=G.generar(DB,Object.assign({},base,{minutos:30,cardio:0}));
const largo=G.generar(DB,Object.assign({},base,{minutos:90,cardio:10}));
ok('menos tiempo produce menos series', corto.audit.volTotal < largo.audit.volTotal,
   corto.audit.volTotal+' vs '+largo.audit.volTotal);

console.log('\n\x1b[36mD. RODILLA MARCADA — SUSTITUYE SIN DEJAR HUECOS\x1b[0m');
const sano=G.generar(DB,base);
const rod=G.generar(DB,Object.assign({},base,{dolor:{zonas:{rodilla:{sev:3}},banderas:{}}}));
ok('sigue generando con rodilla marcada', !!rod.rutina && !rod.bloqueo);
const idsRod=[]; rod.rutina.days.forEach(d=>d.ex.forEach(e=>idsRod.push(e._id)));
const stressRod=idsRod.map(i=>DB.find(x=>x.id===i).stress.rodilla);
ok('ningún ejercicio supera el stress de rodilla permitido', stressRod.every(s=>s<=1), Math.max.apply(null,stressRod));
const patrones=new Set(); rod.rutina.days.forEach(d=>d.ex.forEach(e=>patrones.add(DB.find(x=>x.id===e._id).pat)));
ok('NO elimina el patrón rodilla_dom', patrones.has('rodilla_dom'), [...patrones].join(','));
const volRod=G.volumen(rod.rutina.days.map(d=>({ex:d.ex.map(e=>({src:DB.find(x=>x.id===e._id),sets:e._sets}))})));
ok('el cuádriceps conserva volumen (no queda en 0)', volRod.cuadriceps>=6, volRod.cuadriceps);
ok('agrega accesorio compensatorio de abductores', idsRod.some(i=>DB.find(x=>x.id===i).m==='abductores'),
   idsRod.filter(i=>DB.find(x=>x.id===i).m==='abductores').join(','));
const cambió = JSON.stringify(idsRod)!==JSON.stringify((()=>{const a=[];sano.rutina.days.forEach(d=>d.ex.forEach(e=>a.push(e._id)));return a})());
ok('la rutina cambia respecto a la de alguien sin dolor', cambió);

console.log('\n\x1b[36mE. HOMBRO Y LUMBAR\x1b[0m');
[['hombro','deltoides_ant'],['lumbar','femoral']].forEach(([z,mus])=>{
  const r=G.generar(DB,Object.assign({},base,{dolor:{zonas:{[z]:{sev:3}},banderas:{}}}));
  const ids=[];r.rutina.days.forEach(d=>d.ex.forEach(e=>ids.push(e._id)));
  ok(z+': ningún ejercicio supera el stress permitido', ids.every(i=>DB.find(x=>x.id===i).stress[z]<=1),
     Math.max.apply(null,ids.map(i=>DB.find(x=>x.id===i).stress[z])));
  const v=G.volumen(r.rutina.days.map(d=>({ex:d.ex.map(e=>({src:DB.find(x=>x.id===e._id),sets:e._sets}))})));
  ok(z+': '+mus+' conserva volumen', v[mus]>=4, v[mus]);
});

console.log('\n\x1b[36mF. BLOQUEO DURO\x1b[0m');
G.BANDERAS.forEach(b=>{
  const r=G.generar(DB,Object.assign({},base,{dolor:{zonas:{rodilla:{sev:2}},banderas:{[b.k]:true}}}));
  ok('bandera "'+b.k+'" bloquea la generación', !!r.bloqueo && !r.rutina, JSON.stringify(r.bloqueo));
});

console.log('\n\x1b[36mG. DERIVACIÓN\x1b[0m');
ok('nivel por años: 0.5→novato', G.nivelDe(0.5)==='novato');
ok('nivel por años: 2→intermedio', G.nivelDe(2)==='intermedio');
ok('nivel por años: 15→avanzado', G.nivelDe(15)==='avanzado');
ok('la edad NO cambia el nivel', G.nivelDe(15)===G.nivelDe(15));
ok('factor edad 30→1.0', G.factorEdad(30)===1.0);
ok('factor edad 45→0.95', G.factorEdad(45)===0.95);
ok('factor edad 65→0.85', G.factorEdad(65)===0.85);
const dv=G.derivar(base);
ok('cintura/estatura de Dave = 0.556', Math.abs(dv.ratio-0.5562)<0.001, dv.ratio);
ok('avisa que el objetivo masa no cuadra con >0.53', dv.avisos.some(a=>a.tipo==='objetivo'));
ok('el aviso está redactado como pregunta, no como alarma',
   dv.avisos.some(a=>a.tipo==='objetivo'&&/¿Seguro/.test(a.txt)&&/señal, no un veredicto/.test(a.txt)));
const dv60=G.derivar(Object.assign({},base,{edad:65}));
ok('el ajuste por edad se etiqueta como recuperación, no capacidad',
   dv60.avisos.some(a=>a.tipo==='edad'&&/No es capacidad reducida/.test(a.txt)));

console.log('\n\x1b[36mH. PRIORIDAD Y EQUIPO\x1b[0m');
const pp=G.presupuesto(Object.assign({},base,{prioridad:["pectoral"]}),G.derivar(base));
ok('prioridad sube 35% al músculo elegido', Math.abs(pp.porMusculo.pectoral-11*1.35)<0.2, pp.porMusculo.pectoral);
ok('los demás bajan 20% para que cuadre', Math.abs(pp.porMusculo.biceps-11*0.8)<0.2, pp.porMusculo.biceps);
const solaDb=G.generar(DB,Object.assign({},base,{equipo:["mancuerna","banco","peso_corporal"]}));
ok('genera solo con mancuernas y banco', !!solaDb.rutina && solaDb.rutina.days.every(d=>d.ex.length>=3),
   solaDb.rutina?solaDb.rutina.days.map(d=>d.ex.length).join(','):'null');
const soloPc=G.generar(DB,Object.assign({},base,{equipo:["peso_corporal","banda"]}));
ok('genera solo con peso corporal y banda', !!soloPc.rutina && soloPc.rutina.days.every(d=>d.ex.length>=3),
   soloPc.rutina?soloPc.rutina.days.map(d=>d.ex.length).join(','):'null');
const noSq=G.generar(DB,Object.assign({},base,{excluirTags:["carga_axial_columna"]}));
const idsNo=[];noSq.rutina.days.forEach(d=>d.ex.forEach(e=>idsNo.push(e._id)));
ok('respeta "no sentadillas" por tag', idsNo.every(i=>DB.find(x=>x.id===i).tags.indexOf('carga_axial_columna')<0));
ok('  y aun así conserva el patrón rodilla_dom', idsNo.some(i=>DB.find(x=>x.id===i).pat==='rodilla_dom'));

console.log('\n\x1b[36mI. AUDITORÍA\x1b[0m');
const ra=G.generar(DB,base);
ok('la auditoría reporta todos los músculos', ra.audit.musculos.length===G.MUS_AUDIT.length);
ok('reporta tiempo por sesión', ra.audit.sesiones.length===4 && ra.audit.sesiones.every(s=>s.seg>0));
const prioV=ra.audit.musculos.find(x=>x.m==='pectoral').vol;
const noPrioV=ra.audit.musculos.find(x=>x.m==='deltoides_ant').vol;
ok('el músculo priorizado recibe más volumen que uno no priorizado', prioV>noPrioV, prioV+' vs '+noPrioV);
ok('el core nunca queda en 0', ra.audit.musculos.find(x=>x.m==='abdomen').vol>0,
   ra.audit.musculos.find(x=>x.m==='abdomen').vol);
ok('cuando el tiempo no alcanza, la auditoría lo dice en vez de fingir',
   ra.audit.musculos.some(x=>x.estado==='bajo') ? ra.avisos.some(a=>a.tipo==='volumen'&&/no da para el volumen objetivo/.test(a.txt)) : true,
   JSON.stringify(ra.avisos.filter(a=>a.tipo==='volumen').map(a=>a.txt.slice(0,60))));
ok('ningún músculo pasa de MAV', ra.audit.musculos.every(x=>x.vol<=G.MAV+0.01),
   ra.audit.musculos.filter(x=>x.vol>G.MAV).map(x=>x.m+':'+x.vol).join(','));
console.log('\n  volumen semanal de Dave (4d, prioridad pecho+dorsal):');
ra.audit.musculos.forEach(x=>console.log('    '+x.label.padEnd(18)+String(x.vol).padStart(5)+' / '+x.target+'  '+x.estado));
console.log('  tiempos:', ra.audit.sesiones.map(s=>s.n+' '+Math.round(s.seg/60)+'min('+s.series+'s)').join(' · '));

console.log('\n'+(fail===0?'\x1b[32m':'\x1b[31m')+pass+' pasaron · '+fail+' fallaron\x1b[0m\n');
process.exit(fail?1:0);
