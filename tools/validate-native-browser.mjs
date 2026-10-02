// Actual Chromium/OPFS; no debugger is attached during calculations or timings.
// node tools/validate-native-browser.mjs [OUTPUT] [--benchmark-only|--ui-only]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
import {buildJob, readInputFile, parseBasis} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';

const out=path.resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||`build/validation/native-browser-${Date.now()}`);
fs.mkdirSync(out,{recursive:true});
const input=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).inputText;
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input);
const base={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,maxdeg:'7',memoryMiB:512,
  legacy:false,lowterms:'quick',nonhomog:'degreewise'};
const configs=[
  {id:'compiled',backend:'compiled',pruning:false},
  {id:'compiled-pruned',backend:'compiled',pruning:true},
  {id:'memory64',backend:'memory64',pruning:false},
  {id:'memory64-pruned',backend:'memory64',pruning:true},
  {id:'native-1',backend:'native',workers:1},
  {id:'native-4',backend:'native',workers:4},
  {id:'native64-4',backend:'native',workers:4,bits:64},
];
const jobs=configs.map(c=>({...c,job:{...buildJob({...base,backend:c.backend,monomialPruning:!!c.pruning}),
  ...(c.backend==='native'?{nativeOptions:{workers:c.workers,bits:c.bits,resume:false}}:{})}}));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={state:'running',startedAt:new Date().toISOString(),debuggerDuringCalculations:false,
  browser:'/usr/bin/chromium',platform:process.platform,degree:7,vars:vars.length,relations:rels.length,
  trials:3,method:'Serial fresh-worker trials in a real isolated browser. Cold wall time includes startup, calculation and result transfer for both engines. Native job time includes its lazy startup; Bergman job time excludes its eager startup. No builds/oracle tests run concurrently.',
  sourceHashes:Object.fromEntries(['web/src/engine.js','web/engine/native/engine.js','web/engine/native/runtime.js','web/engine/native/george-entry.js','web/engine/native/worker.js',
    'web/engine/native/george32.wasm','web/engine/native/george64.wasm','web/engine/compiled/ecl.wasm','web/engine/memory64/ecl.wasm','web/engine/ecl.data'].map(n=>[n,sha(n)])),
  configurations:configs,rows:[],ui:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');

async function benchmark(){
  const data=await(await fetch('/__native/data')).json();
  const {EclEngine}=await import('/src/engine.js');
  const post=async(kind,value)=>{const r=await fetch('/__native/'+kind,{method:'POST',body:JSON.stringify(value)});if(!r.ok)throw Error(await r.text());};
  try {
    await post('environment',{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,isolated:crossOriginIsolated});
    for(let trial=0;trial<3;trial++) {
      const configs=[...data.jobs.slice(trial),...data.jobs.slice(0,trial)];
      for(const c of configs) {
        const events=[],engine=new EclEngine({backend:c.backend,onMemory:bytes=>events.push(bytes)});
        try {
          const start=performance.now();await engine.init();const initialized=performance.now();
          const r=await engine.run(c.job);const end=performance.now();
          await post('row',{id:c.id,trial,coldWallMs:end-start,jobWallMs:end-initialized,
            initializationWallMs:initialized-start,engineReportedMs:r.elapsedMs,memoryBytes:r.memoryBytes,
            native:r.native,files:r.files,memoryEvents:events});
        } finally {engine.cancel();}
      }
    }
    await post('done',{mode:'benchmark'});
  } catch(error) {await post('error',{mode:'benchmark',message:error.stack||String(error)});}
}

async function ui(){
  const data=await(await fetch('/__native/data')).json(),$=id=>document.getElementById(id);
  const ok=(x,msg)=>{if(!x)throw Error(msg);};
  const wait=async(fn,label,limit=60000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>limit)throw Error(label+': '+$('runStatus').textContent);await new Promise(r=>setTimeout(r,15));}};
  const post=async(kind,value)=>fetch('/__native/'+kind,{method:'POST',body:JSON.stringify(value)});
  const set=(id,value)=>{const el=$(id);el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
  try {
    await wait(()=>$('engineNote').classList.contains('live'),'initial engine');
    document.querySelector('[data-lang="en"]').click();
    if(!crossOriginIsolated) {
      ok($('backend').querySelector('[value="native"]').disabled,'native unavailable without isolation');
      await post('ui',{mode:'unisolated',passed:true});await post('done',{mode:'ui'});return;
    }
    const memory=[];new MutationObserver(()=>{if(!$('memoryUsage').hidden)memory.push($('memoryUsage').textContent);})
      .observe($('memoryUsage'),{subtree:true,childList:true,attributes:true});
    set('vars',data.vars.join(','));set('rels',data.rels.join(',\n'));set('maxdeg','3');set('backend','native');set('memoryMiB','512');set('nativeWorkers','2');
    ok(!$('backend').querySelector('[value="native"]').disabled,'native available');
    for(const el of document.querySelectorAll('input[name="task"]'))ok(el.disabled===(el.value!=='gb'),'unsupported task disabled');
    for(const id of ['weights','legacy','monomialPruning','strategy','outmode','nonhomog'])ok($(id).disabled,'unsupported option '+id);
    ok(document.querySelector('[data-view="console"]').getAttribute('aria-disabled')==='true','console disabled');
    const compute=async()=>{$('go').click();await wait(()=>$('stop').hidden,'calculation');ok(/^Computed/.test($('runStatus').textContent),'native finished: '+$('runStatus').textContent);};
    await compute();ok($('basisOut').textContent.includes('176'),'176 rules through degree3');ok(memory.length>0,'live memory visible');
    ok(document.querySelector('#filesOut .native-result button'),'disk download control');
    const meta=()=>JSON.parse([...document.querySelectorAll('#filesOut .file')].find(e=>e.querySelector('.name').textContent==='native-result.json').querySelector('pre').textContent);
    ok(meta().bits===32,'automatic wasm32 for small budget');ok($('basisOut').textContent.includes('not globally interreduced'),'honest basis notice');ok(!$('logOut').textContent.includes('session.lsp'),'no Lisp session claimed');ok(meta().workers===2,'explicit multicore setting');
    ok(JSON.parse(localStorage.getItem('george.form.v1')).form.nativeWorkers===2,'worker count saved');
    const help=document.querySelector('[aria-controls="nativeWorkersHint"]');
    help.click();ok(help.getAttribute('aria-expanded')==='true','worker help opens');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ok(help.getAttribute('aria-expanded')==='false','help closes with Escape');
    const root=await navigator.storage.getDirectory();
    const disk=await (await root.getDirectoryHandle('george-native')).getDirectoryHandle(meta().runKey);
    const full=await (await (await disk.getFileHandle('result.gb')).getFile()).text();
    const preview=[...document.querySelectorAll('#filesOut .file')].find(e=>e.querySelector('.name').textContent==='result.gb').querySelector('pre').textContent;
    ok(full===preview&&full.endsWith('Done\n'),'full OPFS download matches preview');
    const {readShareLink}=await import('/src/share.js');
    $('share').click();await wait(()=>$('shareLink').value.includes('#s='),'share');
    const state=await readShareLink(new URL($('shareLink').value).hash);ok(state.backend==='native'&&state.maxdeg==='3'&&state.nativeWorkers===2,'native Share parameters');
    // Automatic memory64, still a low-degree problem and only on-demand allocation.
    set('memoryMiB','6144');await compute();ok(meta().bits===64,'automatic memory64 above wasm32 budget');
    document.querySelector('[data-lang="ru"]').click();ok($('filesOut').textContent.includes('Скачать'),'localized disk download');
    document.querySelector('[data-lang="en"]').click();
    set('memoryMiB','512');set('maxdeg','7');
    $('go').click();await wait(()=>$('runStatus').classList.contains('busy'),'started');
    await wait(()=>$('logOut').textContent.includes('Native degree 4')||$('stop').hidden,'degree progress');
    ok(!$('stop').hidden,'run remains cancellable');$('stop').click();await wait(()=>$('stop').hidden,'stopped');
    await compute();ok(meta().completedThroughDegree===7&&meta().basisSize===695,'restart/resume degree7');
    set('timeoutMinutes','0.00001');$('go').click();await wait(()=>$('stop').hidden,'timeout');
    ok(/time limit/.test($('runStatus').textContent),'configured time limit');set('timeoutMinutes','0');await compute();
    set('maxdeg','21');$('go').click();ok(!$('stop').offsetParent,'degree above supported range rejected');
    set('maxdeg','3');set('backend','compiled');ok(!$('legacy').disabled&&!$('weights').disabled,'Bergman settings re-enabled');
    await compute();
    await post('ui',{mode:'isolated',passed:true,share:true,memoryEvents:memory.length,
      automaticMemory64:true,workerSetting:true,workerPersistence:true,contextualHelp:true,cancelResume:true,timeoutRestart:true,downloadControls:true,localization:true});
    await post('done',{mode:'ui'});
  } catch(error){await post('error',{mode:'ui',message:error.stack||String(error)});}
}

async function run(mode,isolate){
  const server=staticServer('web','/',{isolate}),serve=server.listeners('request')[0];server.removeAllListeners('request');
  let resolve,completed=false;const done=new Promise(r=>resolve=r);
  server.on('request',async(req,res)=>{
    try{
      if(isolate){res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');}
      if(req.url==='/__native/data'){res.setHeader('content-type','application/json');res.end(JSON.stringify({jobs,vars,rels}));return;}
      // This case simulates unavailable service workers, rather than Pages,
      // whose first navigation now installs the isolation worker.
      if(!isolate&&req.url==='/isolation-worker.js'){res.writeHead(404).end();return;}
      if(req.url?.startsWith('/__native/')){
        let text='';for await(const b of req)text+=b;const value=JSON.parse(text||'{}'),kind=req.url.slice(10);
        if(kind==='row'){
          assert.equal(parseBasis(value.files['result.gb']).groups.reduce((n,g)=>n+g.polys.length,0),695);
          const file=`${value.id}-${value.trial}.gb`;fs.writeFileSync(path.join(out,file),value.files['result.gb']);
          const row={...value,basisFile:file};delete row.files;report.rows.push(row);console.log(row.id,row.trial,(row.coldWallMs/1000).toFixed(3),'seconds cold');
        }else if(kind==='ui')report.ui.push(value);
        else if(kind==='environment')report.environment=value;
        else if(kind==='error')report.errors.push(value);
        save();res.end('ok');if(kind==='done'||kind==='error'){completed=true;resolve();}return;
      }
      if(req.url==='/__bench'){res.setHeader('content-type','text/html');res.end(`<!doctype html><script type="module">(${benchmark})();</script>`);return;}
      if(mode==='ui'&&req.url==='/'){
        res.setHeader('content-type','text/html');res.end(fs.readFileSync('web/index.html','utf8')+`<script type="module">(${ui})();</script>`);return;
      }
      serve(req,res);
    }catch(error){report.errors.push({message:error.stack});save();res.statusCode=500;res.end(String(error));resolve();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'george-native-browser-'));
  const browser=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage',`--user-data-dir=${profile}`,
    `http://127.0.0.1:${server.address().port}/${mode==='benchmark'?'__bench':''}`],{stdio:['ignore','ignore','pipe']});
  let stderr='';browser.stderr.on('data',bytes=>stderr=(stderr+bytes).slice(-12000));
  const exit=new Promise(r=>browser.once('exit',(code,signal)=>{
    if(!completed){report.errors.push({mode,message:`Browser exited before completing: ${code??signal}`,stderr});save();resolve();}
    r();
  }));
  const timer=setTimeout(()=>{report.errors.push({mode,message:'Browser watchdog expired'});save();resolve();},600000);
  try {await done;assert.deepEqual(report.errors,[]);}
  finally{completed=true;clearTimeout(timer);browser.kill();await exit;server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
}
save();
try {
  if(!process.argv.includes('--ui-only')){
    await run('benchmark',true);assert.equal(report.rows.length,configs.length*3);
    // Do independent checks after timing, so they do not compete for CPU.
    const a=algebra(vars,false,0),expected=a.basis(fs.readFileSync(path.join(out,'compiled-0.gb'),'utf8'));
    let certified=false;
    for(const row of report.rows){
      const gb=a.basis(fs.readFileSync(path.join(out,row.basisFile),'utf8'));
      for(const p of gb)assert.equal(a.nf(p,expected).size,0,row.id+': forward membership');
      for(const p of expected)assert.equal(a.nf(p,gb).size,0,row.id+': reverse membership');
      if(row.native&&!certified){row.ambiguities=a.certify(rels.map(r=>a.parse(r)),gb,7);certified=true;}
      row.mutualMembershipPassed=true;
    }
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    report.medians=Object.fromEntries(configs.map(c=>[c.id,{coldSeconds:median(report.rows.filter(r=>r.id===c.id).map(r=>r.coldWallMs))/1000,
      jobSeconds:median(report.rows.filter(r=>r.id===c.id).map(r=>r.jobWallMs))/1000}]));
    const best=configs.filter(c=>c.backend!=='native').sort((a,b)=>report.medians[a.id].coldSeconds-report.medians[b.id].coldSeconds)[0];
    report.speedup={bestBergman:best.id,byColdMedian:Object.fromEntries(configs.filter(c=>c.backend==='native').map(c=>[c.id,report.medians[best.id].coldSeconds/report.medians[c.id].coldSeconds]))};save();
  }
  if(!process.argv.includes('--benchmark-only')){await run('ui',true);await run('ui',false);}
  report.state='complete';
}catch(error){report.state='failed';report.error=error.stack||String(error);throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
console.log(out,'PASS');
