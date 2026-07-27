const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const HTML=fs.readFileSync('index.html','utf8');const MIME={'.png':'image/png','.mp4':'video/mp4'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent((q.url||'/').split('?')[0]);
 if(u.startsWith('/assets/')){const f=path.join(__dirname,u);
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});return r.end(fs.readFileSync(f));}
 r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML)});
const RUT=`DÍA 1 - PECHO Y TRÍCEPS
Press banca 4x8-10
Press inclinado con mancuerna 3x12
Fondos en paralelas 3x10 (torso adelante)
Extensión de tríceps en polea 4x12-15 descanso 60s

DÍA 2 – ESPALDA Y BÍCEPS
Dominadas 4x6-8
Remo con barra 4x10 @ RIR 2
Peso muerto rumano 3x10
Curl martillo 3 series de 12 reps

tomar creatina antes de entrenar`;
(async()=>{await new Promise(r=>srv.listen(8087,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const c=await b.newContext({viewport:{width:414,height:940},deviceScaleFactor:2});const p=await c.newPage();
p.on('dialog',d=>d.accept());
await p.goto('http://localhost:8087/');await p.waitForTimeout(600);
await p.click('nav button[data-t="rut"]');await p.waitForTimeout(250);
await p.click('#openImp');await p.waitForTimeout(350);
await p.fill('#impTxt',RUT);await p.waitForTimeout(200);
await p.screenshot({path:'i1.png'});
await p.click('#impRun');await p.waitForTimeout(600);
await p.screenshot({path:'i2.png'});
await p.evaluate(()=>{document.querySelector('#gen').scrollTop=720});await p.waitForTimeout(250);
await p.screenshot({path:'i3.png'});
await b.close();srv.close();console.log('ok')})();
