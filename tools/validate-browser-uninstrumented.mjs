// Real Chromium without a DevTools connection. Debugger attachment can disable
// Wasm optimization, so performance measurements use this separate runner.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {regressionJob} from '../test/support/regression.mjs';
const out=`build/validation/browser-native-${Date.now()}`;fs.mkdirSync(out,{recursive:true});
const cases=[true,false].map(legacy=>({legacy,...regressionJob(legacy)}));
const report=[];
let resolveDone,rejectDone;
const done=new Promise((a,b)=>{resolveDone=a;rejectDone=b;});
const html=`<!doctype html><title>George validation</title><p id="status">Running…</p><script type="module">
import {EclEngine} from '/src/engine.js';
try { const cases=await (await fetch('/cases.json')).json();const e=new EclEngine();let ticks=0;setInterval(()=>ticks++,20);
for(const c of cases){const t=performance.now(),tick=ticks;const r=await e.run(c.job);await fetch('/result',{method:'POST',body:JSON.stringify({...r,legacy:c.legacy,totalMs:performance.now()-t,ticks:ticks-tick,isolated:crossOriginIsolated})});}
e.cancel();await fetch('/done',{method:'POST'});document.querySelector('#status').textContent='PASS';
}catch(e){await fetch('/error',{method:'POST',body:String(e.stack||e)});}
</script>`;
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(req.url==='/cases.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(cases.map(({legacy,job})=>({legacy,job}))));return;}
  if(req.method==='POST'){
   let body='';for await(const b of req)body+=b;
   if(req.url==='/error')throw new Error(body);
   if(req.url==='/done'){res.end('ok');resolveDone();return;}
   const r=JSON.parse(body),expected=cases.find(c=>c.legacy===r.legacy).expected;
   for(const [file,text]of Object.entries(expected))assert.equal(r.files[file],text,file);
   assert.equal(r.isolated,false);assert.ok(r.ticks>10);
   const row={legacy:r.legacy,outputs:Object.keys(expected).length,computationMs:r.elapsedMs,totalMs:r.totalMs,memoryBytes:r.memoryBytes,ticks:r.ticks};
   report.push(row);fs.writeFileSync(`${out}/${r.legacy?'legacy':'fixed'}.log`,r.stdout);console.log(row);res.end('ok');return;
  }
  const p=path.resolve('web','.'+new URL(req.url,'http://localhost').pathname);
  if(!p.startsWith(path.resolve('web')+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(p)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.wasm')?'application/wasm':'application/octet-stream');
  res.end(fs.readFileSync(p));
 }catch(e){res.writeHead(500).end(String(e));rejectDone(e);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'george-browser-'));
const browser=spawn(process.env.CHROMIUM||'/usr/bin/chromium',['--headless','--no-sandbox','--no-first-run',`--user-data-dir=${profile}`,`http://127.0.0.1:${server.address().port}/`],{stdio:['ignore','ignore','pipe']});
let stderr='';browser.stderr.on('data',b=>{stderr+=b;});
browser.on('error',rejectDone);
const timeout=setTimeout(()=>rejectDone(new Error('Browser validation timed out')),300000);
try{await done;fs.writeFileSync(`${out}/report.json`,JSON.stringify({devtools:false,report},null,2));console.log(out);}
catch(e){console.error(e);process.exitCode=1;}
finally{clearTimeout(timeout);browser.kill('SIGTERM');server.close();fs.writeFileSync(`${out}/browser.log`,stderr);}
