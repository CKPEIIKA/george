// Serial browser comparisons without a debugger. Raw results stay in local/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
import {Sampler} from './linux-resource-sampler.mjs';
import {EnvironmentMonitor} from './benchmark-environment.mjs';
import {parseBasis} from '../web/src/bergman-syntax.js';
import {parseOutputRelation as parseRelation} from '../web/src/output-polynomial.js';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const out=path.resolve(arg('--out','local/benchmarks/fomkyr-wasm-diagnostics'));
const degree=Number(arg('--degree','9')),trials=Number(arg('--trials','1'));
const workers=Number(arg('--workers','4')),memoryMiB=Number(arg('--memory-mib','3584'));
const fixtureFile=arg('--fixture','fomkyr/fixtures/fk6.json');
const fixture=JSON.parse(fs.readFileSync(fixtureFile));
const engineURL=arg('--engine-url','/web/engine/fomkyr/engine.js');
const configFile=arg('--configs',null);
const configurations=configFile?JSON.parse(fs.readFileSync(configFile)):
  ['chromium','firefox'].flatMap(browser=>[32,64].flatMap(bits=>[
    {id:`${browser}-${bits}-cold`,browser,options:{bits}},
    {id:`${browser}-${bits}-warm`,browser,options:{bits},warmup:true},
  ]));
assert.ok(Number.isInteger(degree)&&degree>=2&&degree<=32);
assert.ok(Number.isInteger(trials)&&trials>=1&&trials<=10);
assert.ok(Number.isInteger(workers)&&workers>=1&&workers<=32);
assert.ok(memoryMiB>=16&&memoryMiB<=4095);
assert.ok(configurations.length&&configurations.every(c=>c.id&&['chromium','firefox'].includes(c.browser)));
fs.mkdirSync(out,{recursive:true});
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const report={state:'running',degree,trials,workers,memoryMiB,fixtureSha256:hash(fs.readFileSync(fixtureFile)),
  engineURL,configurations,rows:[],method:'Serial fresh browser profiles. No debugger. Fresh algebra for every timed run, including warmed instances. All runs have an external 120-second watchdog. Full text export and checkpoints enabled. Warm-up, when selected, computes degree 9, then discards the algebra before timing.'};
report.sourceHashes=Object.fromEntries(fs.readdirSync(engineURL.slice(1).replace(/engine\.js$/,''))
  .filter(n=>/\.(js|wasm)$/.test(n)).map(n=>{const file=engineURL.slice(1).replace(/engine\.js$/,'')+n;return [file,hash(fs.readFileSync(file))];}));
for(const config of configurations)if(config.options?.wasmURL){const file=config.options.wasmURL.slice(1);report.sourceHashes[file]=hash(fs.readFileSync(file));}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
let expectedBasisHash,active,interrupted=false;
const kill=signal=>{if(active)try{process.kill(-active.pid,signal);}catch{}};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{interrupted=true;kill('SIGTERM');});

async function workerJob({config,fixture,degree,workers,memoryMiB,engineURL}) {
  const {FomkyrEngine}=await import(engineURL);
  const events={};let progress;
  const e=new FomkyrEngine({bits:64,workers,budgetBytes:memoryMiB*1048576,batchPairs:128,
    resume:false,hilbert:false,exportText:true,progress:true,timeoutMs:120000,
    previewBytes:1048576,...config.options,onEvent:event=>{
      events[event.type]=(events[event.type]??0)+1;
      if(event.type==='progress')progress=event;
    }});
  try {
    if(config.warmup){
      await e.compute(fixture,Math.min(9,degree),config.modulus??0);
      e.handle?.truncate(0);
      if(e.directory)for(const name of ['checkpoint-0.json','checkpoint-1.json','partial-0.json','partial-1.json'])
        try{await e.directory.removeEntry(name);}catch(error){if(error.name!=='NotFoundError')throw error;}
      e.scheduler={epochs:0,dispatchedPairs:0,rpcMessages:0,reduceMs:0,commitMs:0,fallbacks:0};
      e.lastCheckpoint=null;e.lastProgressSent=undefined;
      for(const key of Object.keys(events))delete events[key];
    }
    await fetch('/__diagnostic/start',{method:'POST'});
    const started=performance.now(),result=await e.compute(fixture,degree,config.modulus??0),wallSeconds=(performance.now()-started)/1000;
    let basis=result.preview;
    if(result.previewTruncated){
      if(!result.fullBasisPath)throw Error('No complete text export');
      let dir=await navigator.storage.getDirectory();const parts=result.fullBasisPath.split('/');
      for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);
      basis=await(await(await dir.getFileHandle(parts.at(-1))).getFile()).text();
    }
    delete result.preview;
    let instrumentation;
    if(config.instrumentation){
      instrumentation={bits:e.bits};
      for(const section of ['data','names','counters']){
        const start=Number(e.e[`profile_${section}_start`]()),end=Number(e.e[`profile_${section}_end`]());
        instrumentation[section]={start,bytes:Array.from(new Uint8Array(e.memory.buffer,start,end-start))};
      }
    }
    await fetch('/__diagnostic/end',{method:'POST',body:JSON.stringify({status:'complete',wallSeconds,result,basis,events,progress,instrumentation})});
  }catch(error){await fetch('/__diagnostic/end',{method:'POST',body:JSON.stringify({status:'failed',error:String(error.stack??error),native:error.native})});}
  finally{await e.close();}
}

async function run(config,trial) {
  const key=`${config.id}-d${degree}-t${trial}`;
  const root=path.join(out,key);assert.ok(!fs.existsSync(root),'Choose a new report directory.');fs.mkdirSync(root);
  let browser,sampler,environment,row,resolveDone;
  const done=new Promise(resolve=>resolveDone=resolve);
  const server=staticServer('.', '/', {isolate:true}),serve=server.listeners('request')[0];server.removeAllListeners('request');
  server.on('request',async(req,res)=>{
    if(!req.url.startsWith('/__diagnostic/'))return serve(req,res);
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.url==='/__diagnostic/page'){
      res.setHeader('content-type','text/html');res.end('<script type="module">new Worker("/__diagnostic/worker.js",{type:"module"}).postMessage('+JSON.stringify({config,fixture,degree,workers,memoryMiB,engineURL})+');</script>');return;
    }
    if(req.url==='/__diagnostic/worker.js'){
      res.setHeader('content-type','text/javascript');res.end('self.onmessage=({data})=>('+workerJob.toString()+')(data).catch(error=>fetch("/__diagnostic/end",{method:"POST",body:JSON.stringify({status:"failed",error:String(error.stack??error)})}));');return;
    }
    if(req.url==='/__diagnostic/start'){
      sampler=new Sampler(browser.pid,{intervalMs:250});sampler.start();environment=new EnvironmentMonitor();environment.start();res.end('ok');return;
    }
    if(req.url==='/__diagnostic/end'){
      let text='';for await(const part of req)text+=part;
      try{row={id:config.id,browser:config.browser,trial,...JSON.parse(text),...sampler?.stop(),hostEnvironment:environment?.stop()};sampler=null;environment=null;
        if(row.instrumentation){fs.writeFileSync(path.join(root,'instrumentation.json'),JSON.stringify(row.instrumentation));delete row.instrumentation;}
        if(row.basis){
          fs.writeFileSync(path.join(root,'result.gb'),row.basis);
          const parsed=parseBasis(row.basis);assert.ok(parsed.done,'Complete result required');
          const canonical=parsed.groups.flatMap(g=>g.polys).map(p=>parseRelation(p,fixture.variables)
            .map(t=>({coefficient:String(BigInt(t.coef)*BigInt(t.sign))+(t.coefDen&&t.coefDen!=='1'?'/'+t.coefDen:''),word:t.factors.flatMap(f=>Array(f.e).fill(f.v))}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
          row.basisHash=hash(JSON.stringify(canonical));row.basisCount=canonical.length;delete row.basis;
          expectedBasisHash??=row.basisHash;assert.equal(row.basisHash,expectedBasisHash,'Changed polynomial basis');
          assert.equal(row.result.resumedFromDegree,0,'Timed algebra must be fresh');assert.equal(row.result.workers,workers);
          assert.equal(row.result.completedThroughDegree,degree);assert.equal(row.result.shared,config.options?.execution!=='single');
        }
      }catch(error){row={...row,status:'failed',error:String(error.stack??error)};}
      res.end('ok');resolveDone();return;
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const profile=path.join(root,'profile');fs.mkdirSync(profile);
  const url=`http://127.0.0.1:${server.address().port}/__diagnostic/page`;
  const args=config.browser==='firefox'?['-headless','--no-remote','-profile',profile,url]
    :['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run',`--user-data-dir=${profile}`,
      ...((config.noLiftoff||config.profile)?[`--js-flags=${config.noLiftoff?'--no-liftoff ':''}${config.profile?`--prof --logfile=${path.join(root,'v8.log')}`:''}`]:[]),url];
  if(config.browser==='firefox')fs.writeFileSync(path.join(profile,'user.js'),'user_pref("datareporting.policy.dataSubmissionEnabled", false);\nuser_pref("toolkit.telemetry.enabled", false);\n');
  browser=spawn(config.browser==='firefox'?path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox'):'/usr/bin/chromium',args,{stdio:['ignore','ignore','pipe'],detached:true});active=browser;
  let stderr='';browser.stderr.on('data',b=>stderr=(stderr+b).slice(-16000));
  const exited=new Promise(resolve=>{browser.once('exit',()=>{resolve();resolveDone();});browser.once('error',error=>{row={status:'failed',error:String(error)};resolve();resolveDone();});});
  const watchdog=setTimeout(()=>{row={id:config.id,trial,status:'timeout'};resolveDone();},120000);
  try{await done;}
  finally{
    clearTimeout(watchdog);sampler?.stop();environment?.stop();kill('SIGTERM');const force=setTimeout(()=>kill('SIGKILL'),3000);
    await exited;clearTimeout(force);active=null;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(root,'browser.log'),stderr);fs.rmSync(profile,{recursive:true,force:true});
  }
  row??={id:config.id,trial,status:'failed',error:'Browser exited before reporting.'};
  if(row.samples){fs.writeFileSync(path.join(root,'samples.json'),JSON.stringify(row.samples));delete row.samples;}
  report.rows.push(row);save();console.log(config.id,trial,row.status,row.wallSeconds?.toFixed(3)+' s',row.cpuSeconds?.toFixed(2)+' core-s');
  assert.equal(row.status,'complete',row.error);
}
try{
  save();for(let trial=0;trial<trials&&!interrupted;trial++)for(const config of trial%2?[...configurations].reverse():configurations){if(interrupted)break;await run(config,trial);}
  report.state=interrupted?'interrupted':'complete';
}catch(error){report.state='failed';report.error=String(error.stack??error);throw error;}
finally{save();}
