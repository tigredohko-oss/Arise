/* ============================================================
   ARISE v8.3 — importador de rutinas escritas a mano
   parseRutina(texto) → { days, sueltas, stats }
   Nada se descarta en silencio: lo que no entiende va a `sueltas`.
   ============================================================ */

const NORM = s => String(s||"")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9\s]/g," ")
  .replace(/\s+/g," ").trim();

/* 4x8-10 · 4 x 8 · 4×10 · 3 series de 12 · 3 sets x 12 · 4 series 8/10 */
const RE_SETS = /(\d{1,2})\s*(?:x|×|\*|series?\s*(?:de\s*|x\s*)?|sets?\s*(?:of\s*|x\s*)?)\s*(\d{1,3})(?:\s*(?:[-–—/a]|\s+a\s+)\s*(\d{1,3}))?/i;
/* al revés: "8-10 reps x 4 series" */
const RE_SETS_INV = /(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\s*(?:reps?|repeticiones?)\s*(?:x|×|por)\s*(\d{1,2})\s*(?:series?|sets?)/i;
/* sin multiplicador: "3 series" o "12 reps" sueltos */
const RE_SOLO_SERIES = /(\d{1,2})\s*(?:series?|sets?)\b/i;
const RE_RONDAS = /^\s*(\d{1,2})\s*(?:rondas?|vueltas?|rounds?)\b/i;
const RE_RONDAS_ANY = /\b(\d{1,2})\s*(?:rondas?|vueltas?|rounds?)\b/i;
const RE_SOLO_REPS   = /(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\s*(?:reps?|repeticiones?)\b/i;

const RE_RIR   = /\bRIR\s*[:=]?\s*(\d)(?:\s*[-–]\s*(\d))?/i;
/* "pausa" quedó fuera a propósito: "pausa 1 s arriba" es una indicación de tempo,
   no el descanso entre series, y se estaba comiendo la nota del ejercicio. */
const RE_DESC  = /\b(?:descanso|rest|descansa)\s*[:=]?\s*(\d{1,3})\s*(s|seg|segundos|m|min|minutos|')?/i;
const RE_PESO  = /(\d{1,3}(?:[.,]\d)?)\s*(kg|kgs|lb|lbs|libras)\b/i;
const RE_LADO  = /\b(?:por|cada|x)\s*(?:lado|pierna|brazo)\b|\bunilateral\b|\b\/\s*lado\b/i;

const DIAS_SEMANA = "lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const RE_DIA_NUM  = new RegExp("^\\s*(?:d[ií]a|day|sesi[oó]n|session|entrenamiento|workout|rutina)\\s*[:#\\-–]?\\s*(\\d{1,2}|[a-f])\\b","i");
const RE_DIA_SEM  = new RegExp("^\\s*(?:"+DIAS_SEMANA+")\\b","i");
const RE_DIA_LETRA= /^\s*([a-f])\s*[\)\.\-–:]\s*\S/i;
const RE_DIA_D    = /^\s*d\s*(\d{1,2})\s*(?:[·:\-–—.)]|\s)\s*\S/i;
const RE_DIA_TIPO = /^\s*(push|pull|legs|piernas?|upper|lower|full\s*body|torso|tren\s+(?:superior|inferior)|pecho|espalda|brazos?|hombros?|gl[uú]teos?)\b/i;

/* ruido típico de PDFs y capturas */
const RE_RUIDO = /^\s*(?:p[aá]g(?:ina)?\.?\s*\d+|\d+\s*\/\s*\d+|www\.|https?:|copyright|©|todos los derechos)/i;
const RE_ENCABEZADO_TABLA = /^\s*(?:ejercicio|exercise|series|sets|reps?|repeticiones|descanso|rest|peso|carga)(?:\s*[|\t,;]\s*(?:ejercicio|exercise|series|sets|reps?|repeticiones|descanso|rest|peso|carga|nota[s]?))+\s*$/i;

function esDia(linea){
  const t=linea.trim();
  if(!t) return false;
  if(RE_DIA_NUM.test(t)||RE_DIA_SEM.test(t)) return true;
  if(RE_DIA_D.test(t)&&!RE_SETS.test(t)) return true;
  if(RE_DIA_LETRA.test(t)&&!RE_SETS.test(t)) return true;
  if(RE_SETS.test(t)) return false;                       // si trae series, es ejercicio
  if(RE_DIA_TIPO.test(t)&&t.length<60) return true;
  /* línea corta en MAYÚSCULAS sin dígitos: casi siempre es un encabezado */
  const letras=t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g,"");
  if(letras.length>=3&&t.length<60&&letras===letras.toUpperCase()&&!/\d/.test(t)) return true;
  return false;
}

function limpiaNombre(s){
  return String(s)
    .replace(/\s*[\/]\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?\s*/g," ")   // colas de rangos: "/ 10-15"
    .replace(/^\s*(?:[-–—•*·▪◦]|\d{1,2}\s*[\).\-–:])\s*/,"")   // viñetas y numeración
    .replace(/\b(?:reps?|repeticiones?|series?|sets?)\b/gi," ")   // sobras del patrón de series
    .replace(/[()@]/g," ")                                          // símbolos huérfanos
    .replace(/\s*[|\t;]+\s*$/,"")
    .replace(/^\s*[-–—:·|,]+\s*/,"")
    .replace(/\s*[-–—:·|,]+\s*$/,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

function extraeSeries(linea){
  let ro=RE_RONDAS_ANY.exec(linea);
  if(ro) return {sets:+ro[1], r1:null, r2:null, txt:ro[0].trim()};
  let m=RE_SETS_INV.exec(linea);
  if(m) return {sets:+m[3], r1:+m[1], r2:m[2]?+m[2]:null, txt:m[0]};
  m=RE_SETS.exec(linea);
  if(m){
    const sets=+m[1], r1=+m[2], r2=m[3]?+m[3]:null;
    /* "12x60kg" no es series×reps: si el segundo número es peso, se descarta */
    if(sets>=1&&sets<=12&&r1>=1&&r1<=100) return {sets:sets,r1:r1,r2:r2,txt:m[0]};
  }
  const s=RE_SOLO_SERIES.exec(linea), r=RE_SOLO_REPS.exec(linea);
  if(s||r) return {sets:s?+s[1]:3, r1:r?+r[1]:null, r2:(r&&r[2])?+r[2]:null,
                   txt:[s&&s[0],r&&r[0]].filter(Boolean).join(" ")};
  return null;
}

function parseLinea(linea){
  const orig=linea;
  const ser=extraeSeries(linea);
  if(!ser) return null;

  let resto=linea;
  if(ser.txt) resto=resto.replace(ser.txt,"  ");

  const nota=[];
  const rir=RE_RIR.exec(orig);
  if(rir){ nota.push("RIR "+rir[1]+(rir[2]?"-"+rir[2]:"")); resto=resto.replace(rir[0]," "); }
  let rest=null;
  const de=RE_DESC.exec(orig);
  if(de){ const v=+de[1], u=(de[2]||"s").toLowerCase();
    rest=(u[0]==="m"||u==="'")?v*60:v;
    if(rest<10||rest>900) rest=null;
    resto=resto.replace(de[0]," "); }
  const pe=RE_PESO.exec(resto);
  if(pe){ nota.push(pe[0].trim()); resto=resto.replace(pe[0]," "); }
  const la=RE_LADO.exec(resto);
  if(la){ nota.push("por lado"); resto=resto.replace(la[0]," "); }
  else if(RE_LADO.test(orig)) nota.push("por lado");

  /* paréntesis y lo que va tras un separador fuerte son notas */
  const par=resto.match(/\(([^)]{2,80})\)/);
  if(par){ nota.push(par[1].trim()); resto=resto.replace(par[0]," "); }

  let bossMarcado=false;
  if(/\bBOSS\b/i.test(resto)){ bossMarcado=true; resto=resto.replace(/\bBOSS\b/ig," "); }

  let nombre=limpiaNombre(resto);
  /* si quedó un separador con cola, la cola es nota */
  const corte=nombre.match(/^(.{3,}?)\s*[—·|]\s*(.{2,})$/);
  if(corte){ nombre=corte[1].trim(); nota.push(corte[2].trim()); }
  nombre=limpiaNombre(nombre);
  if(nombre.length<3) return null;

  const reps = ser.r1==null ? "" : (ser.r2?ser.r1+"-"+ser.r2:String(ser.r1));
  return {
    n:nombre,
    s:ser.sets+(reps?"×"+reps:" series"),
    sets:ser.sets, r1:ser.r1, r2:ser.r2,
    note:nota.map(x=>String(x).replace(/^[\s·|—–-]+/,"").replace(/[\s·|—–-]+$/,"")).filter(Boolean).join(" · "),
    rest:rest,
    bossMarcado:bossMarcado,
    orig:orig.trim()
  };
}

const COLORES=["#3b82f6","#f97316","#22c55e","#ef4444","#a855f7","#06b6d4","#ec4899","#f59e0b"];

/* Encabezados de columna que quedan sueltos al copiar una tabla */
const PALABRAS_TABLA=/^\s*(?:#|n[°º]|num(?:ero)?|ejercicios?|exercises?|series\s*[x×]\s*reps?|series|sets|reps?|repeticiones|descanso|rest|peso|carga|nota[s]?|m[uú]sculo|c[oó]mo\s+queda|semana|tempo|rir)\s*$/i;
const NUM_SUELTO=/^\s*~?\d{1,2}\s*$/;

/* ¿la línea es SOLO una celda de series/reps? ("4×6-10", "3×8-12 por lado", "3 rondas") */
function esCeldaSeries(l){
  const t=String(l).trim();
  if(!t||!/^[~\d]/.test(t)) return false;
  if(NUM_SUELTO.test(t)) return false;
  const m=RE_RONDAS.exec(t)||RE_SETS_INV.exec(t)||RE_SETS.exec(t);
  if(!m) return false;
  const letras=t.replace(m[0],"").replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g,"");
  return letras.length<=10;
}
function esRelleno(l){
  const t=String(l).trim();
  return !t||NUM_SUELTO.test(t)||PALABRAS_TABLA.test(t);
}

/* Una tabla copiada deja cada celda en su propia línea:
     1 / Weighted Dip torso inclinado BOSS / 4×6-10 / RIR 1-2 · ...
   Sin esto el parser veía nombres sin series y series sin nombre, y tiraba todo. */
function esVertical(lineas){
  let celdas=0;
  lineas.forEach(l=>{ if(esCeldaSeries(l)) celdas++; });
  return celdas>=3;
}

function parseVertical(lineas,opts){
  opts=opts||{};
  const days=[], sueltas=[];
  let actual=null, nDia=0;
  const usado=new Array(lineas.length).fill(false);

  const nuevoDia=(titulo)=>{
    nDia++;
    actual={n:(titulo?limpiaNombre(titulo).toUpperCase().slice(0,60):"")||("DÍA "+nDia),
            c:COLORES[(nDia-1)%COLORES.length], stat:(nDia%2)?"STR":"AGI",
            cardio:opts.cardio||"", ex:[]};
    days.push(actual);
  };

  for(let i=0;i<lineas.length;i++){
    const t=(lineas[i]||"").trim();
    if(!t||usado[i]) continue;
    if(RE_RUIDO.test(t)||PALABRAS_TABLA.test(t)||NUM_SUELTO.test(t)){ usado[i]=true; continue; }

    if(esDia(t)&&!esCeldaSeries(t)){ usado[i]=true; nuevoDia(t); continue; }

    if(esCeldaSeries(t)){
      /* nombre: la línea útil más cercana hacia atrás */
      let j=i-1, nombre=null;
      while(j>=0){
        const p=(lineas[j]||"").trim();
        if(!usado[j]&&p&&!esRelleno(p)&&!esDia(p)&&!esCeldaSeries(p)){ nombre=p; usado[j]=true; break; }
        if(esDia(p)||esCeldaSeries(p)) break;
        j--;
      }
      usado[i]=true;
      if(!nombre){ sueltas.push({linea:t,n:i+1,tipo:"series sin nombre"}); continue; }

      /* nota: la siguiente línea, salvo que sea el nombre del ejercicio siguiente */
      let nota="";
      const n1=(lineas[i+1]||"").trim();
      if(n1&&!esRelleno(n1)&&!esDia(n1)&&!esCeldaSeries(n1)){
        let k=i+2;
        while(k<lineas.length&&esRelleno((lineas[k]||"").trim())) k++;
        const n2=(lineas[k]||"").trim();
        if(!esCeldaSeries(n2)){ nota=n1; usado[i+1]=true; }
      }

      const ex=parseLinea(nombre+" "+t+(nota?" ("+nota.replace(/[()]/g,"")+")":""));
      if(!ex){ sueltas.push({linea:nombre+" "+t,n:i+1,tipo:"no pude leer las series"}); continue; }
      if(!actual) nuevoDia(null);
      ex.boss=ex.bossMarcado||actual.ex.length===0;
      actual.ex.push(ex);
      continue;
    }
  }

  /* nada más se convierte en ejercicio: en modo tabla, la prosa con números
     (p. ej. "mete 3×10-15 de pantorrilla al final") es texto, no una fila */
  lineas.forEach((l,i)=>{
    const t=(l||"").trim();
    if(t&&!usado[i]&&!RE_RUIDO.test(t)&&!esRelleno(t)&&!esDia(t))
      sueltas.push({linea:t,n:i+1,tipo:RE_SETS.test(t)?"texto con números":"texto"});
  });
  sueltas.sort((a,b)=>a.n-b.n);
  return {days:days.filter(d=>d.ex.length),sueltas:sueltas,
          vacios:days.filter(d=>!d.ex.length).map(d=>d.n),vertical:true};
}

function parseRutina(texto,opts){
  opts=opts||{};
  const lineas=String(texto||"").split(/\r?\n/);

  if(esVertical(lineas)){
    const v=parseVertical(lineas,opts);
    return {days:v.days,sueltas:v.sueltas,vacios:v.vacios,vertical:true,
      stats:{dias:v.days.length,
        ejercicios:v.days.reduce((a,d)=>a+d.ex.length,0),
        series:v.days.reduce((a,d)=>a+d.ex.reduce((b,e)=>b+(e.sets||0),0),0),
        lineas:lineas.filter(l=>l.trim()).length,
        sinParsear:v.sueltas.length}};
  }

  const days=[], sueltas=[];
  let actual=null, nDia=0;

  lineas.forEach((raw,idx)=>{
    const t=raw.trim();
    if(!t) return;
    if(RE_RUIDO.test(t)||RE_ENCABEZADO_TABLA.test(t)) return;

    /* filas de tabla: "Press banca | 4 | 8-10" */
    let linea=t;
    if(/[|\t]/.test(t)&&!RE_SETS.test(t)){
      const cel=t.split(/\s*[|\t]\s*/).filter(Boolean);
      if(cel.length>=2){
        const nom=cel[0];
        const nums=cel.slice(1).join(" x ");
        if(/\d/.test(nums)) linea=nom+" "+nums;
      }
    }

    if(esDia(linea)){
      nDia++;
      actual={n:limpiaNombre(linea).toUpperCase().slice(0,60)||("DÍA "+nDia),
              c:COLORES[(nDia-1)%COLORES.length],
              stat:(nDia%2)?"STR":"AGI",
              cardio:opts.cardio||"", ex:[]};
      days.push(actual);
      return;
    }

    const ex=parseLinea(linea);
    if(ex){
      if(!actual){
        nDia++;
        actual={n:"DÍA "+nDia,c:COLORES[0],stat:"STR",cardio:opts.cardio||"",ex:[]};
        days.push(actual);
      }
      ex.boss=ex.bossMarcado||actual.ex.length===0;
      actual.ex.push(ex);
    } else {
      sueltas.push({linea:t,n:idx+1});
    }
  });

  /* días vacíos: el encabezado se detectó pero no traía ejercicios */
  const vacios=days.filter(d=>!d.ex.length).map(d=>d.n);
  const limpios=days.filter(d=>d.ex.length);

  return {
    days:limpios,
    sueltas:sueltas,
    vacios:vacios,
    vertical:false,
    stats:{
      dias:limpios.length,
      ejercicios:limpios.reduce((a,d)=>a+d.ex.length,0),
      series:limpios.reduce((a,d)=>a+d.ex.reduce((b,e)=>b+(e.sets||0),0),0),
      lineas:lineas.filter(l=>l.trim()).length,
      sinParsear:sueltas.length
    }
  };
}

/* Sin esto, "peso muerto rumano" emparejaba con "Peso Muerto Convencional":
   comparten las dos palabras del principio y la que los distingue estaba en otro idioma. */
const SINONIMOS={
  "peso":"deadlift","muerto":"deadlift","rumano":"romanian","rumana":"romanian",
  "sentadilla":"squat","sentadillas":"squat","banca":"bench","banco":"bench",
  "jalon":"pulldown","jalones":"pulldown","polea":"cable","poleas":"cable",
  "dominada":"pullup","dominadas":"pullup","pull":"pullup","up":"pullup",
  "remo":"row","prensa":"press","empuje":"press",
  "mancuerna":"dumbbell","mancuernas":"dumbbell","barra":"barbell",
  "inclinado":"incline","inclinada":"incline","declinado":"decline",
  "femoral":"curl","bicep":"curl","biceps":"curl","tricep":"triceps","tríceps":"triceps",
  "elevacion":"raise","elevaciones":"raise","talones":"calf","pantorrilla":"calf",
  "fondos":"dip","fondo":"dip","aperturas":"fly","cruce":"fly","cruces":"fly",
  "gluteo":"glute","gluteos":"glute","cadera":"hip","empujes":"thrust",
  "abdominal":"core","abdominales":"core","plancha":"plank",
  "hombro":"shoulder","hombros":"shoulder","militar":"overhead",
  "extension":"extension","flexiones":"pushup","lagartijas":"pushup",
  "bulgara":"bulgarian","zancada":"lunge","zancadas":"lunge","split":"bulgarian"
};
function tokens(s){
  return NORM(s).split(" ").filter(w=>w.length>2).map(w=>SINONIMOS[w]||w);
}

/* Calificadores mutuamente excluyentes. Si el nombre escrito y el candidato traen
   uno distinto del MISMO grupo, no son el mismo ejercicio por más palabras que
   compartan. Sin esto, "Press declinado con mancuernas" emparejaba con
   "Press Inclinado con Mancuernas" y heredaba un record que nunca existió. */
const GRUPOS_EXCLUYENTES=[
  ["incline","inclinado","inclinada","decline","declinado","declinada","plano","flat"],
  ["sentado","seated","pie","standing","tumbado","lying","acostado","arrodillado","kneeling"],
  ["barbell","dumbbell","cable","maquina","machine","banda","band","kettlebell","smith"],
  ["ancho","wide","cerrado","close","neutro","neutral","supino","prono"],
  ["romanian","convencional","conventional","sumo","rumano"],
  ["frontal","front","trasera","back","nuca"],
  ["unilateral","bilateral"]
];
const EQUIV={inclinado:"incline",inclinada:"incline",declinado:"decline",declinada:"decline",
  plano:"flat",sentado:"seated",pie:"standing",tumbado:"lying",acostado:"lying",
  arrodillado:"kneeling",ancho:"wide",cerrado:"close",neutro:"neutral",rumano:"romanian",
  convencional:"conventional",frontal:"front",trasera:"back"};
function calificadores(ws){
  const out={};
  ws.forEach(w=>{
    const v=EQUIV[w]||w;
    GRUPOS_EXCLUYENTES.forEach((g,gi)=>{
      if(g.indexOf(w)>=0||g.indexOf(v)>=0) (out[gi]=out[gi]||{})[v]=1;
    });
  });
  return out;
}
function chocan(a,b){
  const ca=calificadores(a), cb=calificadores(b);
  for(const gi in ca){
    if(!cb[gi]) continue;
    const ka=Object.keys(ca[gi]), kb=Object.keys(cb[gi]);
    if(!ka.some(x=>kb.indexOf(x)>=0)) return true;   // mismo grupo, valores distintos
  }
  return false;
}

/* Empareja el nombre escrito a mano con la base, para heredar técnica y descanso.
   Puntaje por palabras compartidas; sin match si no llega al umbral. */
function emparejar(nombre,DB){
  const a=tokens(nombre);
  if(!a.length) return null;
  let mejor=null,mejorP=0;
  const aCrudo=NORM(nombre).split(" ").filter(w=>w.length>2);
  DB.forEach(x=>{
    const b=tokens(x.n);
    if(!b.length) return;
    if(chocan(aCrudo,NORM(x.n).split(" ").filter(w=>w.length>2))) return;
    let hit=0;
    a.forEach(w=>{ if(b.some(y=>y===w||y.indexOf(w)===0||w.indexOf(y)===0)) hit++; });
    const p=hit/Math.max(a.length,b.length);
    if(p>mejorP){ mejorP=p; mejor=x; }
  });
  return mejorP>=0.5?{ex:mejor,score:mejorP}:null;
}

if(typeof module!=="undefined") module.exports={parseRutina,parseLinea,esDia,emparejar,NORM,limpiaNombre,tokens,SINONIMOS,
  esVertical,esCeldaSeries,parseVertical,chocan,calificadores};
