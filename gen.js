/* ============================================================
   ARISE v8 — motor generador de rutinas (determinista, sin red)
   Función pura: generar(inputs) → { rutina, audit, avisos, bloqueo }
   ============================================================ */

const MUS_ES={pectoral:"Pecho",dorsal:"Dorsal",espalda_alta:"Espalda alta",
  deltoides_ant:"Deltoide frontal",deltoides_lat:"Deltoide lateral",deltoides_post:"Deltoide posterior",
  biceps:"Bíceps",triceps:"Tríceps",cuadriceps:"Cuádriceps",femoral:"Femoral",gluteo:"Glúteo",
  pantorrilla:"Pantorrilla",abdomen:"Core",erectores:"Erectores",trapecio:"Trapecio",
  antebrazo:"Antebrazo",aductores:"Aductores",abductores:"Abductores"};

/* músculos con presupuesto auditado */
const MUS_AUDIT=["pectoral","dorsal","espalda_alta","deltoides_ant","deltoides_lat","deltoides_post",
  "biceps","triceps","cuadriceps","femoral","gluteo","pantorrilla","abdomen"];

const ZONAS=["rodilla","hombro","lumbar","codo","muneca","cadera","cuello","tobillo"];
const ZONA_ES={rodilla:"Rodilla",hombro:"Hombro",lumbar:"Espalda baja",codo:"Codo",
  muneca:"Muñeca",cadera:"Cadera",cuello:"Cuello",tobillo:"Tobillo"};

/* accesorio compensatorio por zona (regla e del módulo de dolor) */
const COMPENSA={rodilla:"abductores",hombro:"deltoides_post",lumbar:"abdomen",
  cadera:"abductores",tobillo:"pantorrilla"};

/* banderas rojas → el generador se niega */
const BANDERAS=[
  {k:"agudo",     t:"Dolor agudo o de inicio reciente"},
  {k:"inflamacion",t:"Inflamación visible"},
  {k:"bloqueo",   t:"Bloqueo o fallo articular"},
  {k:"nocturno",  t:"Dolor nocturno que despierta"},
  {k:"trauma",    t:"Dolor tras golpe o caída"}
];

/* ---------- etapa 2: derivar ---------- */
const MEV={novato:8,intermedio:9,avanzado:11};
const MAV=20;
const PISO_DEFICIT=10;          // piso duro en objetivo grasa

function nivelDe(anios){ const a=+anios||0; return a<1?"novato":a<4?"intermedio":"avanzado"; }
function factorEdad(edad){
  const e=+edad||30;
  if(e<40) return 1.0;
  if(e<50) return 0.95;
  if(e<60) return 0.90;
  return 0.85;
}
function derivar(inp){
  const nivel=nivelDe(inp.anios);
  const alturaCm=(+inp.altura||0)>3?(+inp.altura):((+inp.altura||0)*100);
  const ratio=(inp.cintura&&alturaCm)?(+inp.cintura)/alturaCm:null;
  const avisos=[];
  if(ratio!==null&&ratio>0.53&&inp.objetivo==="masa"){
    avisos.push({tipo:"objetivo",nivel:"pregunta",
      txt:"Tu índice cintura/estatura es "+ratio.toFixed(3)+" (>0.53). ¿Seguro que el objetivo es masa? "+
          "Puede convenir un corte primero. Es una señal, no un veredicto: el índice no distingue grasa "+
          "visceral de estructura ancha. Coméntalo con quien te lleva la dieta."});
  }
  if(factorEdad(inp.edad)<1){
    avisos.push({tipo:"edad",nivel:"info",
      txt:"Ajuste conservador de recuperación por edad (×"+factorEdad(inp.edad).toFixed(2)+"). "+
          "No es capacidad reducida: la evidencia no muestra que la edad baje sustancialmente la respuesta "+
          "hipertrófica. Es margen, y se puede subir si te recuperas bien."});
  }
  return {nivel,ratio,alturaCm,factorEdad:factorEdad(inp.edad),avisos};
}

/* ---------- etapa 3: presupuesto de series ---------- */
function presupuesto(inp,der){
  const base=MEV[der.nivel];
  const fe=der.factorEdad;
  const prio=(inp.prioridad||[]).slice(0,2);
  const obj=inp.objetivo||"masa";
  const target={};
  MUS_AUDIT.forEach(m=>{
    let v=base*fe;
    if(prio.indexOf(m)>=0) v*=1.35;
    else if(prio.length) v*=0.80;                 // mantenimiento para que cuadre
    if(obj==="grasa") v=Math.max(v,PISO_DEFICIT); // piso duro, no negociable
    target[m]=Math.round(Math.min(v,MAV)*10)/10;
  });
  return {porMusculo:target,mev:base,mav:MAV,piso:obj==="grasa"?PISO_DEFICIT:null,prio:prio,objetivo:obj};
}

/* tiempo real de una serie, con su descanso */
function segSerie(ex){ return (ex.reps[1]*3+15)+ex.rest; }
const SEG_TRANSICION=45;

function segSesion(dia){
  let s=0;
  dia.ex.forEach(e=>{ s+=e.sets*segSerie(e.src)+SEG_TRANSICION; });
  return s;
}
function presupuestoSesionSeg(inp){
  const min=+inp.minutos||60, cardio=+inp.cardio||0;
  return Math.max(300,(min-cardio)*60);
}

/* ---------- etapa 4: split ---------- */
const P_EMPUJE=["empuje_h","empuje_v"], P_JALON=["jalon_h","jalon_v"];
const SPLITS={
  2:[{n:"FULL BODY A",c:"#3b82f6",stat:"STR",pats:["rodilla_dom","empuje_h","jalon_v","cadera_dom","aislamiento","core"]},
     {n:"FULL BODY B",c:"#f97316",stat:"AGI",pats:["cadera_dom","jalon_h","empuje_v","rodilla_dom","aislamiento","pantorrilla"]}],
  3:[{n:"FULL BODY A",c:"#3b82f6",stat:"STR",pats:["rodilla_dom","empuje_h","jalon_h","aislamiento","core"]},
     {n:"FULL BODY B",c:"#f97316",stat:"AGI",pats:["cadera_dom","jalon_v","empuje_v","aislamiento","pantorrilla"]},
     {n:"FULL BODY C",c:"#22c55e",stat:"STR",pats:["rodilla_dom","empuje_h","jalon_h","aislamiento","core"]}],
  4:[{n:"UPPER A",c:"#3b82f6",stat:"STR",pats:["empuje_h","jalon_h","empuje_h","jalon_v","aislamiento","aislamiento"]},
     {n:"LOWER A",c:"#f97316",stat:"AGI",pats:["rodilla_dom","core","rodilla_dom","cadera_dom","pantorrilla","aislamiento"]},
     {n:"UPPER B",c:"#22c55e",stat:"STR",pats:["jalon_v","empuje_h","jalon_h","empuje_v","aislamiento","aislamiento"]},
     {n:"LOWER B",c:"#ef4444",stat:"AGI",pats:["cadera_dom","core","rodilla_dom","cadera_dom","pantorrilla","aislamiento"]}],
  5:[{n:"UPPER",c:"#3b82f6",stat:"STR",pats:["empuje_h","jalon_h","empuje_v","jalon_v","aislamiento"]},
     {n:"LOWER",c:"#f97316",stat:"AGI",pats:["rodilla_dom","cadera_dom","rodilla_dom","pantorrilla","core"]},
     {n:"PUSH",c:"#a855f7",stat:"STR",pats:["empuje_h","empuje_v","empuje_h","aislamiento","aislamiento"]},
     {n:"PULL",c:"#22c55e",stat:"STR",pats:["jalon_v","jalon_h","jalon_h","aislamiento","aislamiento"]},
     {n:"LEGS",c:"#ef4444",stat:"AGI",pats:["cadera_dom","rodilla_dom","cadera_dom","pantorrilla","core"]}],
  6:[{n:"PUSH A",c:"#3b82f6",stat:"STR",pats:["empuje_h","empuje_v","empuje_h","aislamiento","aislamiento"]},
     {n:"PULL A",c:"#22c55e",stat:"STR",pats:["jalon_v","jalon_h","jalon_h","aislamiento","aislamiento"]},
     {n:"LEGS A",c:"#f97316",stat:"AGI",pats:["rodilla_dom","cadera_dom","rodilla_dom","pantorrilla","core"]},
     {n:"PUSH B",c:"#a855f7",stat:"STR",pats:["empuje_v","empuje_h","empuje_h","aislamiento","aislamiento"]},
     {n:"PULL B",c:"#06b6d4",stat:"STR",pats:["jalon_h","jalon_v","jalon_h","aislamiento","aislamiento"]},
     {n:"LEGS B",c:"#ef4444",stat:"AGI",pats:["cadera_dom","rodilla_dom","cadera_dom","pantorrilla","core"]}]
};

/* ---------- módulo de dolor: capas 1-3 ---------- */
function bloqueoDuro(dolor){
  const f=(dolor&&dolor.banderas)||{};
  const activas=BANDERAS.filter(b=>f[b.k]).map(b=>b.t);
  return activas.length?activas:null;
}
/* severidad → stress máximo tolerado en esa zona */
function maxStress(sev){ return sev>=3?1:2; }

function zonasMarcadas(dolor){
  const z=(dolor&&dolor.zonas)||{};
  return ZONAS.filter(k=>z[k]&&+z[k].sev>0).map(k=>({zona:k,sev:+z[k].sev}));
}
function pasaDolor(ex,marcadas){
  for(let i=0;i<marcadas.length;i++){
    const m=marcadas[i];
    if((ex.stress[m.zona]||0)>maxStress(m.sev)) return false;
  }
  return true;
}

/* ---------- etapa 5: selección ---------- */
function tieneEquipo(ex,eq){
  if(!eq||!eq.length) return true;
  return ex.eq.every(e=>eq.indexOf(e)>=0);
}
function excluido(ex,inp){
  const ex_ids=(inp.excluir||[]);
  if(ex_ids.indexOf(ex.id)>=0) return true;
  const tagsNo=(inp.excluirTags||[]);
  return ex.tags.some(t=>tagsNo.indexOf(t)>=0);
}

function candidatos(DB,inp,marcadas){
  return DB.filter(ex=>tieneEquipo(ex,inp.equipo)&&!excluido(ex,inp)&&pasaDolor(ex,marcadas));
}

/* sustituto para un ejercicio que no pasa el filtro de dolor:
   mismo patrón y mismo músculo primario, el de menor stress en la zona.
   Nunca elimina el patrón. */
function sustituir(DB,ex,inp,marcadas){
  const mismo=DB.filter(c=>c.pat===ex.pat&&c.m===ex.m&&c.id!==ex.id&&
                        tieneEquipo(c,inp.equipo)&&!excluido(c,inp)&&pasaDolor(c,marcadas));
  if(mismo.length) return ordenarPorStress(mismo,marcadas)[0];
  const patron=DB.filter(c=>c.pat===ex.pat&&c.id!==ex.id&&
                        tieneEquipo(c,inp.equipo)&&!excluido(c,inp)&&pasaDolor(c,marcadas));
  if(patron.length) return ordenarPorStress(patron,marcadas)[0];
  return null;
}
function ordenarPorStress(list,marcadas){
  return list.slice().sort((a,b)=>{
    const sa=marcadas.reduce((s,m)=>s+(a.stress[m.zona]||0),0);
    const sb=marcadas.reduce((s,m)=>s+(b.stress[m.zona]||0),0);
    if(sa!==sb) return sa-sb;
    return (b.estirada?1:0)-(a.estirada?1:0);
  });
}

function aporte(ex,sets){
  const o={}; o[ex.m]=sets;
  ex.syn.forEach(s=>{ o[s[0]]=(o[s[0]]||0)+sets*s[1]; });
  return o;
}

function seleccionar(DB,inp,der,pre,marcadas){
  const dias=SPLITS[inp.dias]||SPLITS[4];
  const cands=candidatos(DB,inp,marcadas);
  const deficit={}; MUS_AUDIT.forEach(m=>deficit[m]=pre.porMusculo[m]);
  const usados={};
  const out=[];

  dias.forEach((plantilla,di)=>{
    const dia={n:plantilla.n,c:plantilla.c,stat:plantilla.stat,ex:[]};
    const enSesion={};
    plantilla.pats.forEach((pat,pi)=>{
      const pool=cands.filter(c=>{
        if(c.pat!==pat) return false;
        if(dia.ex.some(x=>x.src.id===c.id)) return false;
        const setsM=(enSesion[c.m]||0);
        if(setsM>=10) return false;                       // máx ~10 series/músculo/sesión
        if(pi===0&&c.tipo!=="compuesto") return false;    // el BOSS es compuesto
        return true;
      });
      if(!pool.length) return;
      pool.sort((a,b)=>{
        const da=(deficit[a.m]||0)-(usados[a.id]||0)*2;
        const db_=(deficit[b.m]||0)-(usados[b.id]||0)*2;
        if(Math.abs(da-db_)>0.01) return db_-da;
        if(a.estirada!==b.estirada) return (b.estirada?1:0)-(a.estirada?1:0);
        return marcadas.reduce((s,m)=>s+(a.stress[m.zona]||0),0)-
               marcadas.reduce((s,m)=>s+(b.stress[m.zona]||0),0);
      });
      const pick=pool[0];
      const sets=pi===0?4:3;
      dia.ex.push({src:pick,sets:sets,boss:pi===0});
      usados[pick.id]=(usados[pick.id]||0)+1;
      enSesion[pick.m]=(enSesion[pick.m]||0)+sets;
      const ap=aporte(pick,sets);
      for(const m in ap) if(deficit[m]!==undefined) deficit[m]-=ap[m];
    });
    out.push(dia);
  });

  /* regla (e): accesorio compensatorio por zona marcada */
  marcadas.forEach(m=>{
    const musc=COMPENSA[m.zona]; if(!musc) return;
    const ya=out.some(d=>d.ex.some(x=>x.src.m===musc));
    if(ya) return;
    const acc=cands.filter(c=>c.m===musc);
    if(!acc.length) return;
    const dia=out.reduce((a,b)=>segSesion(a)<=segSesion(b)?a:b);
    dia.ex.push({src:ordenarPorStress(acc,marcadas)[0],sets:3,boss:false,compensa:m.zona});
  });
  return out;
}

/* ---------- volumen fraccional ---------- */
function volumen(dias){
  const v={}; MUS_AUDIT.forEach(m=>v[m]=0);
  dias.forEach(d=>d.ex.forEach(e=>{
    const ap=aporte(e.src,e.sets);
    for(const m in ap) if(v[m]!==undefined) v[m]+=ap[m];
  }));
  for(const m in v) v[m]=Math.round(v[m]*10)/10;
  return v;
}

/* ---------- auditoría + reasignación ---------- */
function auditar(dias,pre,inp){
  const vol=volumen(dias);
  const capSeg=presupuestoSesionSeg(inp);
  const sesiones=dias.map(d=>({n:d.n,seg:segSesion(d),cap:capSeg,ok:segSesion(d)<=capSeg,
                               series:d.ex.reduce((a,e)=>a+e.sets,0)}));
  const musculos=MUS_AUDIT.map(m=>{
    const t=pre.porMusculo[m], v=vol[m];
    let estado="ok";
    if(v<t-1.5) estado="bajo"; else if(v>MAV) estado="alto";
    return {m:m,label:MUS_ES[m],vol:v,target:t,mav:MAV,estado:estado};
  });
  return {musculos:musculos,sesiones:sesiones,
          ok:musculos.every(x=>x.estado==="ok")&&sesiones.every(s=>s.ok),
          volTotal:Math.round(dias.reduce((a,d)=>a+d.ex.reduce((b,e)=>b+e.sets,0),0))};
}

function reasignar(dias,pre,inp,DB,marcadas){
  const capSeg=presupuestoSesionSeg(inp);
  const relDef=()=>{ const v=volumen(dias),o={};
    MUS_AUDIT.forEach(m=>o[m]=(pre.porMusculo[m]-v[m])/Math.max(1,pre.porMusculo[m])); return o; };
  const patCount=d=>{ const c={}; d.ex.forEach(e=>c[e.src.pat]=(c[e.src.pat]||0)+1); return c; };

  for(let iter=0;iter<60;iter++){
    let cambio=false;

    /* 1. el tiempo manda: recorta del músculo MENOS deficitario, no del último de la lista.
       Nunca borra el único ejercicio de un patrón: eso dejaría el patrón sin cubrir
       (así es como el core se quedaba en 0). */
    dias.forEach(d=>{
      let guard=0;
      while(segSesion(d)>capSeg&&guard++<40){
        const rd=relDef();
        const cand=d.ex.filter(e=>!e.boss&&!e.compensa);
        if(!cand.length) break;
        cand.sort((a,b)=>(rd[a.src.m]||0)-(rd[b.src.m]||0));   // menos deficitario primero
        const victima=cand.find(e=>e.sets>2)||cand[0];
        if(victima.sets>2){ victima.sets--; }
        else{
          const pc=patCount(d);
          const noUnico=cand.filter(e=>pc[e.src.pat]>1);
          if(noUnico.length){
            noUnico.sort((a,b)=>(rd[a.src.m]||0)-(rd[b.src.m]||0));
            d.ex.splice(d.ex.indexOf(noUnico[0]),1);
          } else if(d.ex.length>3){
            /* el tiempo manda sobre la cobertura de patrones: si no cabe, un patrón se cae */
            d.ex.splice(d.ex.indexOf(victima),1);
          } else if(victima.sets>1){ victima.sets--; }
          else {
            const boss=d.ex.find(e=>e.boss);
            if(boss&&boss.sets>2){ boss.sets--; }
            else if(d.ex.length>1){ d.ex.splice(d.ex.indexOf(victima),1); }
            else if(boss&&boss.sets>1){ boss.sets--; }
            else break;
          }
        }
        cambio=true;
      }
    });

    /* 2. rellena mientras quede tiempo, recorriendo TODOS los déficits
       (antes cortaba tras el primero y el recorte le ganaba siempre) */
    const rd=relDef();
    const sub=MUS_AUDIT.filter(m=>rd[m]>0.12).sort((a,b)=>rd[b]-rd[a]);
    for(let i=0;i<sub.length;i++){
      const m=sub[i];
      let hecho=false;
      const orden=dias.slice().sort((a,b)=>segSesion(a)-segSesion(b));
      for(let k=0;k<orden.length&&!hecho;k++){
        const d=orden[k];
        const enSesion=d.ex.filter(e=>e.src.m===m).reduce((a,e)=>a+e.sets,0);
        if(enSesion>=10) continue;
        const cand=d.ex.filter(e=>e.src.m===m&&e.sets<5);
        for(let j=0;j<cand.length&&!hecho;j++){
          cand[j].sets++;
          if(segSesion(d)<=capSeg){ hecho=true; cambio=true; }
          else cand[j].sets--;
        }
      }
      if(hecho) continue;
    }

    /* 3. nada puede pasar de MAV */
    MUS_AUDIT.forEach(m=>{
      let guard=0;
      while(volumen(dias)[m]>MAV&&guard++<20){
        let mayor=null;
        dias.forEach(d=>d.ex.forEach(e=>{
          if(e.src.m===m&&!e.boss&&e.sets>2&&(!mayor||e.sets>mayor.sets)) mayor=e;
        }));
        if(!mayor) break;
        mayor.sets--; cambio=true;
      }
    });
    if(!cambio) break;
  }
  return dias;
}

/* ---------- etapa 6: prescripción ---------- */
function notaDe(ex,marcadas,ajuste){
  const rir=ex.rir[0]===ex.rir[1]?("RIR "+ex.rir[0]):("RIR "+ex.rir[0]+"-"+ex.rir[1]);
  const bits=[rir];
  if(ex.estirada) bits.push("carga en estiramiento");
  if(ajuste&&ajuste.rango) bits.push("rango recortado en el extremo doloroso");
  if(ajuste&&ajuste.sustituido) bits.push("sustituido por "+ZONA_ES[ajuste.zona].toLowerCase());
  if(ex.tags.indexOf("unilateral")>=0) bits.push("por lado");
  return bits.join(" · ");
}
function prescribir(dias,inp,der,marcadas){
  return dias.map((d,i)=>({
    n:d.n, c:d.c, stat:d.stat,
    cardio:(+inp.cardio>0)?((+inp.cardio)+" min remadora o escaleras"):"",
    ex:d.ex.map(e=>{
      const src=e.src;
      /* regla (c): patrón con articulación marcada va a 12-20 @ RIR 1-2 */
      const tocado=marcadas.some(m=>(src.stress[m.zona]||0)>=1);
      const reps=tocado?[12,20]:src.reps;
      const rirX=tocado?{rir:[1,2]}:{};
      const conRir=Object.assign({},src,rirX);
      return {
        n:src.n,
        s:e.sets+"×"+(reps[0]===reps[1]?reps[0]:reps[0]+"-"+reps[1]),
        boss:!!e.boss,
        note:notaDe(conRir,marcadas,tocado?{rango:true}:null)+(e.compensa?" · accesorio compensatorio":""),
        rest:src.rest,
        _id:src.id, _m:src.m, _sets:e.sets
      };
    })
  }));
}

function rutinaPats(dias){ const o=[]; dias.forEach(d=>d.ex.forEach(e=>{if(o.indexOf(e.src.pat)<0)o.push(e.src.pat)})); return o; }

/* ---------- entrada principal ---------- */
function generar(DB,inp){
  const bloq=bloqueoDuro(inp.dolor);
  if(bloq) return {bloqueo:bloq,rutina:null,audit:null,avisos:[]};

  const der=derivar(inp);
  const pre=presupuesto(inp,der);
  const marcadas=zonasMarcadas(inp.dolor);
  let dias=seleccionar(DB,inp,der,pre,marcadas);
  dias=reasignar(dias,pre,inp,DB,marcadas);
  let audit=auditar(dias,pre,inp);

  const avisos=der.avisos.slice();
  if(marcadas.length){
    avisos.push({tipo:"dolor",nivel:"info",
      txt:"Zonas marcadas: "+marcadas.map(m=>ZONA_ES[m.zona]).join(", ")+
          ". Se sustituyeron ejercicios por variantes de menor carga en esa articulación, "+
          "sin quitar ningún patrón de movimiento ni bajar el volumen del músculo. "+
          "Esto es un filtro de selección de ejercicios, no un diagnóstico."});
  }
  const bajos=audit.musculos.filter(x=>x.estado==="bajo");
  if(bajos.length&&pre.objetivo==="grasa"){
    avisos.push({tipo:"conflicto",nivel:"aviso",
      txt:"CONFLICTO: en déficit el piso es "+PISO_DEFICIT+" series por músculo, porque el error "+
          "clásico es recortar entrenamiento cuando lo que se recorta es comida. Pero con "+inp.minutos+
          " min × "+inp.dias+" días no caben. El generador NO bajó el objetivo para que la auditoría "+
          "saliera limpia: te lo deja en rojo. La salida es más días o más minutos, no menos series."});
  }
  if(bajos.length){
    avisos.push({tipo:"volumen",nivel:"aviso",
      txt:"El presupuesto de tiempo no da para el volumen objetivo en: "+
          bajos.map(x=>MUS_ES[x.m]+" ("+x.vol+"/"+x.target+")").join(", ")+
          ". No es un error del plan: con "+inp.minutos+" min × "+inp.dias+
          " días no caben más series. Para cerrar el hueco tienes que subir minutos, subir días, "+
          "o bajar la lista de prioridades. Los músculos chicos reciben además volumen indirecto "+
          "que esta cuenta ya incluye a media serie."});
  }
  const patsPlan={},patsReal={};
  (SPLITS[inp.dias]||SPLITS[4]).forEach(p=>p.pats.forEach(x=>patsPlan[x]=1));
  rutinaPats(dias).forEach(x=>patsReal[x]=1);
  const faltan=Object.keys(patsPlan).filter(p=>!patsReal[p]);
  if(faltan.length){
    avisos.push({tipo:"patron",nivel:"aviso",
      txt:"El presupuesto de tiempo dejó fuera estos patrones: "+faltan.join(", ")+
          ". Son los primeros que deberías recuperar si consigues más minutos."});
  }
  audit.musculos.filter(x=>x.estado==="alto").forEach(x=>{
    avisos.push({tipo:"volumen",nivel:"aviso",txt:MUS_ES[x.m]+" queda en "+x.vol+" series, por encima del techo de "+MAV+"."});
  });

  const rutina={
    name:"GENERADA · "+inp.dias+" DÍAS · "+
         (inp.objetivo==="grasa"?"DÉFICIT":inp.objetivo==="mantener"?"MANTENIMIENTO":"HIPERTROFIA"),
    meta:{
      fase:inp.objetivo==="grasa"?"Déficit — el volumen se protege, se recorta comida":"Hipertrofia",
      rir:"Compuestos 1-3 RIR · aislamientos 0-1 RIR",
      descanso:"Compuestos 2-3 min · aislamientos 60-90 s",
      progresion:"Doble progresión: sube reps dentro del rango; al tope en todas las series, sube el peso",
      deload:"Cada 6-8 semanas, o al estancarte 2 semanas, o si molestan las articulaciones",
      recorte:"Si vas corto de tiempo: último ejercicio → penúltimo → nunca el BOSS"
    },
    days:prescribir(dias,inp,der,marcadas)
  };
  return {rutina:rutina,audit:audit,avisos:avisos,derivado:der,presupuesto:pre,bloqueo:null};
}

if(typeof module!=="undefined") module.exports={generar,derivar,presupuesto,auditar,volumen,
  segSerie,segSesion,presupuestoSesionSeg,SPLITS,MUS_AUDIT,MUS_ES,ZONAS,ZONA_ES,BANDERAS,
  nivelDe,factorEdad,MEV,MAV,PISO_DEFICIT,bloqueoDuro,zonasMarcadas,maxStress,COMPENSA};
