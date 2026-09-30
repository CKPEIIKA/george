// Real Chromium without a DevTools connection. Debugger attachment can disable
// Wasm optimization, so performance measurements use this separate runner.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {regressionJob} from '../test/support/regression.mjs';
import {buildJob} from '../web/src/bergman-syntax.js';
const out=`build/validation/browser-native-${Date.now()}`;fs.mkdirSync(out,{recursive:true});
const cases=[true,false].map(legacy=>({id:legacy?'legacy':'fixed',legacy,...regressionJob(legacy)}));
const latest=prefix=>fs.readdirSync('build/validation').filter(n=>n.startsWith(prefix)&&fs.existsSync(`build/validation/${n}/report.json`)).sort((a,b)=>fs.statSync(`build/validation/${b}/report.json`).mtimeMs-fs.statSync(`build/validation/${a}/report.json`).mtimeMs)[0];
const fixture=JSON.parse(fs.readFileSync('test/fixtures/upstream-cases.json','utf8'));
const reference=latest('upstream-');assert.ok(reference,'Run test:upstream first.');
assert.deepEqual(JSON.parse(fs.readFileSync(`build/validation/${reference}/report.json`,'utf8')).engine,JSON.parse(fs.readFileSync('web/engine/build.json','utf8')));
for(const id of ['sympy-katsura4','singular-gb_braid3-11','gbnp-weighted','gbnp-sl2-quotient']){
 const c=fixture.cases.find(c=>c.id===id),job=buildJob({task:'gb',ring:c.comm?'comm':'noncomm',order:c.comm?'deglex':'degleftlex',field:'0',vars:c.vars,rels:c.rels,maxdeg:c.maxdeg,weights:c.weights?.join(' '),lowterms:'safe'});
 cases.push({id,job,expected:{[job.outputs.gb]:fs.readFileSync(`build/validation/${reference}/${id}-F0/${job.outputs.gb}`,'utf8')}});
}
const braid=latest('braid-');assert.ok(braid,'Run test:braid first.');
const braidRows=JSON.parse(fs.readFileSync(`build/validation/${braid}/report.json`,'utf8'));
for(const id of ['prefix-F0','weighted-reversed-F0']){
 const c=braidRows.find(c=>c.id===id),[x,y]=c.generators;
 const job=buildJob({task:'anick',ring:'noncomm',order:'degleftlex',field:'0',vars:c.generators,rels:[`${x}^2-${x}`,`${y}^2-${y}`,`${y}*${x}*${y}-${x}*${y}*${x}`],maxdeg:id==='prefix-F0'?8:18,weights:c.weights||'',reverseVars:c.reversed,augmentation:c.augmentation,lowterms:'safe'});
 const dir=`build/validation/${braid}/${id}/native`;
 const expected=Object.fromEntries(fs.readdirSync(dir).filter(n=>/\.(gb|anick|jsonl)$/.test(n)).map(n=>[n,fs.readFileSync(`${dir}/${n}`,'utf8')]));
 cases.push({id:'braid-'+id,job,expected,homology:c.homology});
}
const report=[],additional=[];
let resolveDone,rejectDone;
const done=new Promise((a,b)=>{resolveDone=a;rejectDone=b;});
const html=`<!doctype html><title>George validation</title><p id="status">Running…</p><script type="module">
import {EclEngine} from '/src/engine.js';
try { const cases=await (await fetch('/cases.json')).json();const e=new EclEngine();let ticks=0;setInterval(()=>ticks++,20);
for(const c of cases){const t=performance.now(),tick=ticks;const r=await e.run(c.job);await fetch('/result',{method:'POST',body:JSON.stringify({...r,id:c.id,legacy:c.legacy,totalMs:performance.now()-t,ticks:ticks-tick,isolated:crossOriginIsolated})});}
e.cancel();await fetch('/done',{method:'POST'});document.querySelector('#status').textContent='PASS';
}catch(e){await fetch('/error',{method:'POST',body:String(e.stack||e)});}
</script>`;
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(req.url==='/cases.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(cases.map(({id,legacy,job})=>({id,legacy,job}))));return;}
  if(req.method==='POST'){
   let body='';for await(const b of req)body+=b;
   if(req.url==='/error')throw new Error(body);
   if(req.url==='/done'){res.end('ok');resolveDone();return;}
   const r=JSON.parse(body),c=cases.find(c=>c.id===r.id),expected=c.expected;
   for(const [file,text]of Object.entries(expected))assert.equal(r.files[file],text,file);
   if(c.homology)assert.deepEqual(r.homology,c.homology);
   assert.equal(r.isolated,false);assert.ok(r.ticks>10);
   const row={legacy:r.legacy,outputs:Object.keys(expected).length,computationMs:r.elapsedMs,totalMs:r.totalMs,memoryBytes:r.memoryBytes,ticks:r.ticks};
   if(c.legacy!==undefined)report.push(row);else additional.push({id:c.id,...row,nativeEquality:true,...(c.homology?{homology:c.homology}:{})});
   fs.writeFileSync(`${out}/${c.id}.log`,r.stdout);console.log(c.id,row);res.end('ok');return;
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
try{await done;assert.equal(report.length,2);assert.equal(additional.length,6);fs.writeFileSync(`${out}/report.json`,JSON.stringify({devtools:false,report,additional},null,2));console.log(out);}
catch(e){console.error(e);process.exitCode=1;}
finally{clearTimeout(timeout);browser.kill('SIGTERM');server.close();fs.writeFileSync(`${out}/browser.log`,stderr);}
