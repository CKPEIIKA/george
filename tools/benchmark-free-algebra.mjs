// Serial opt-in stress measurements. Nothing here is part of release:check.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {loadCatalog,selectBenchmarks,loadBenchmark,sha256,singularScript,acceptancePassed} from './free-algebra-benchmarks.mjs';
import {writeJSON} from './release-support.mjs';
import {processMetrics} from './benchmark-process-metrics.mjs';

if(process.argv.includes('--help')){
 console.log(`Usage: npm run benchmark:stress -- [options]
  --list                         List catalog entries; runs no computations
  --suite priority|stress|overnight|physics|fk6|unsupported
  --cases braid3,serre-e6         Select named cases instead of a suite
  --smoke                        Use the small input-check bounds
  --degree N                     Override all selected degree bounds
  --engines fomkyr,chromium,firefox,singular (default fomkyr)
  --workers N                    Fomkyr workers, 1..32 (default 4)
  --memory-mib N                 Native kernel allowance (default 4096)
  --browser-memory-mib N         Browser allowance (default min(native,15360))
  --timeout-seconds N            Per calculation cap (default 120)
  --out directory                Fresh output under local/benchmarks/
  --check                        Compare completed homogeneous outputs with cached Singular
  --acceptance                   Require every selected run and independent check to pass
  --oracle-timeout-seconds N     Cap for a missing reference (default 120)
  --resume                       Reuse only rows with an identical run contract
No Hilbert/FK dimension assumptions are enabled. Timeout, OOM, unsupported,
and an incomplete independent check are recorded explicitly.`);
 process.exit(0);
}
const arg=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const flags=new Set(['--list','--smoke','--resume','--check','--acceptance']);
const valued=new Set(['--suite','--cases','--degree','--engines','--workers','--memory-mib','--browser-memory-mib','--timeout-seconds','--out','--oracle-timeout-seconds','--fomkyr','--singular-root']);
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i];assert.ok(flags.has(key)||valued.has(key),'Unknown option: '+key);
 if(valued.has(key)){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing value for '+key);i++;}
}
const catalog=loadCatalog();
if(process.argv.includes('--list')){
 for(const c of catalog.cases)console.log(`${c.id.padEnd(26)} d${String(c.targetDegree).padEnd(4)} ${c.suites.join(',')}${c.homogeneous?'':' [Fomkyr unsupported]'}`);
 process.exit(0);
}
const {Sampler}=await import('./linux-resource-sampler.mjs');
const check=process.argv.includes('--check')||process.argv.includes('--acceptance');
const suite=arg('--suite','priority');
const selected=selectBenchmarks(catalog,suite,arg('--cases',null)?.split(','));
const engines=arg('--engines','fomkyr').split(','),workers=Number(arg('--workers','4'));
const memoryMiB=Number(arg('--memory-mib','4096'));
const browserMemoryMiB=Number(arg('--browser-memory-mib',String(Math.min(memoryMiB,15360))));
const timeoutSeconds=Number(arg('--timeout-seconds','120'));
const oracleTimeoutSeconds=Number(arg('--oracle-timeout-seconds','120'));
const degreeOverride=arg('--degree',null);
assert.ok(engines.length&&new Set(engines).size===engines.length&&engines.every(c=>['fomkyr','chromium','firefox','singular'].includes(c)));
assert.ok(Number.isInteger(workers)&&workers>=1&&workers<=32);
assert.ok(Number.isSafeInteger(memoryMiB)&&memoryMiB>=64);
assert.ok(Number.isInteger(browserMemoryMiB)&&browserMemoryMiB>=64&&browserMemoryMiB<=15360);
assert.ok(Number.isSafeInteger(timeoutSeconds)&&timeoutSeconds>=1&&timeoutSeconds<=43200,'Choose a cap from 1 second to 12 hours');
assert.ok(Number.isSafeInteger(oracleTimeoutSeconds)&&oracleTimeoutSeconds>=1&&oracleTimeoutSeconds<=43200);
if(degreeOverride!==null)assert.ok(Number.isInteger(Number(degreeOverride))&&Number(degreeOverride)>=1&&Number(degreeOverride)<=10000);
const cases=selected.map(c=>({...c,degree:degreeOverride===null?(process.argv.includes('--smoke')?c.smokeDegree:c.targetDegree):Number(degreeOverride)}));
const out=path.resolve(arg('--out','local/benchmarks/free-algebra-'+new Date().toISOString().replaceAll(':','-')));
const local=path.resolve('local/benchmarks');
assert.ok(out.startsWith(local+path.sep),'Keep raw host measurements in ignored local/benchmarks/');
fs.mkdirSync(out,{recursive:true});
const native=path.resolve(arg('--fomkyr','fomkyr/dist/fomkyr'));
const singularRoot=path.resolve(arg('--singular-root','build/oracles/root'));
const singular=path.join(singularRoot,'usr/bin/Singular');
const singularEnv={...process.env,LD_LIBRARY_PATH:`${singularRoot}/usr/lib/x86_64-linux-gnu:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULARPATH:`${singularRoot}/usr/share/singular/LIB:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULAR_PROCS_DIR:path.join(singularRoot,'usr/lib/x86_64-linux-gnu/singular/MOD')};
const hashes=Object.fromEntries(['tools/benchmark-free-algebra.mjs','tools/free-algebra-benchmarks.mjs','tools/benchmark-process-metrics.mjs','tools/benchmark-backend-resources.mjs','tools/linux-resource-sampler.mjs','fomkyr/fixtures/benchmarks/catalog.json',
 ...cases.map(c=>c.inputFile),
 ...(engines.includes('fomkyr')?[native,'fomkyr/dist/build-profile.json'].filter(f=>fs.existsSync(f)):[]),
 ...(engines.includes('singular')||check?[singular]:[]),
 ...(engines.some(c=>c==='chromium'||c==='firefox')?fs.readdirSync('web/engine/fomkyr').filter(n=>/\.(js|wasm)$/.test(n)).map(n=>'web/engine/fomkyr/'+n):[])
 ].map(f=>[f,sha256(fs.readFileSync(f))]));
const machine={cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalRamMiB:os.totalmem()/1048576,platform:process.platform};
const contract={schema:1,suite,cases:cases.map(c=>({id:c.id,degree:c.degree,inputSha256:c.inputSha256})),engines,workers,memoryMiB,browserMemoryMiB,timeoutSeconds,oracleTimeoutSeconds,singularRoot,check,acceptance:process.argv.includes('--acceptance'),hashes,node:process.version,machine};
const reportFile=path.join(out,'report.json');
const previous=process.argv.includes('--resume')&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):null;
if(previous)assert.deepEqual(previous.contract,contract,'Input, build, or measurement settings changed; use a fresh directory');
else assert.ok(!fs.existsSync(reportFile),'Use --resume or a fresh output directory');
const report=previous??{state:'running',startedAt:new Date().toISOString(),contract,rows:[],method:{
 field:'Q; inclusive ambiguity-degree bound; ascending generators with degree left lex',
 native:'Cold process, exact completion, fresh durable workdir and full export. Successful exits use GNU time CPU and peak RSS; forced or failed exits use sampled process-tree CPU/RSS lower bounds. Process-tree PSS is sampled every 0.25 seconds.',
 browser:'Cold engine startup, computation, export and result delivery. Browser launch and page rendering excluded. PSS includes browser processes; it is not directly equal to native kernel RAM.',
 singular:'Fresh timed Letterplace run only when explicitly selected. Check references are separately cached by input script and oracle identity.',
 assumptions:'No imported Hilbert or FK component dimensions; ordinary exact completion.',
 limits:'Native memory controls the kernel workspace; Singular uses a virtual address limit; browser memory controls the Wasm budget. The scopes differ.',
 verification:'Checks run after every timed job has finished. A completed computation is not an independent certificate. Failed or capped checks remain incomplete.'}};
const save=()=>writeJSON(reportFile,report);save();
let active,interrupted=false;
const stop=()=>{
 if(!active)return;
 const descendants=[];
 const collect=pid=>{
  let children=[];try{children=fs.readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean).map(Number);}catch{}
  for(const child of children)collect(child);descendants.push(pid);
 };
 collect(active.pid);
 // timeout creates another process group. Kill descendants explicitly too.
 for(const pid of descendants)try{process.kill(pid,'SIGKILL');}catch{}
 try{process.kill(-active.pid,'SIGKILL');}catch{}
};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{interrupted=true;stop();});

async function processRun(command,args,dir,{input=null,env=process.env,cap=timeoutSeconds,cwd=dir}={}){
 const fd=fs.openSync(path.join(dir,'stdout.txt'),'w'),err=fs.openSync(path.join(dir,'stderr.txt'),'w');
 const metrics=path.join(dir,'time.txt'),start=performance.now();
 const child=spawn('/usr/bin/time',['-f','%U %S %M','-o',metrics,'--','/usr/bin/timeout','--signal=KILL',String(cap),command,...args],
  {cwd,env,stdio:[input===null?'ignore':'pipe',fd,err],detached:true});active=child;
 fs.closeSync(fd);fs.closeSync(err);
 if(input!==null){child.stdin.on('error',()=>{});child.stdin.end(input);}
 const sampler=new Sampler(child.pid,{intervalMs:250});sampler.start();
 const heartbeat=setInterval(()=>console.log(path.basename(dir),((performance.now()-start)/1000).toFixed(0)+' s'),30000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}
 finally{clearInterval(heartbeat);active=null;}
 const resource=sampler.stop(),wallSeconds=(performance.now()-start)/1000;
 writeJSON(path.join(dir,'samples.json'),resource.samples);delete resource.samples;
 const t=fs.existsSync(metrics)?fs.readFileSync(metrics,'utf8').trim().split('\n').at(-1).split(/\s+/).map(Number):[];
 return {...exit,wallSeconds,...processMetrics(t,resource,exit.code,wallSeconds),
  status:interrupted?'interrupted':exit.code===0?'complete':wallSeconds>=cap-0.5?'timeout':'error'};
}

try{
 for(const entry of cases){
  const presentation=loadBenchmark(entry);
  for(const engine of engines){
   if(interrupted)break;
   if(report.rows.some(r=>r.id===entry.id&&r.engine===engine))continue;
   const dir=path.join(out,entry.id+'-'+engine);fs.mkdirSync(dir,{recursive:true});
   const row={id:entry.id,engine,degree:entry.degree,inputSha256:entry.inputSha256,independentCheck:{status:'not-run'}};
   if(!presentation.homogeneous&&engine!=='singular'){
    Object.assign(row,{status:'unsupported',reason:entry.unsupportedReason});report.rows.push(row);save();continue;
   }
   console.log(entry.id,engine,'degree',entry.degree,'started');
   const fixtureFile=path.join(dir,'input.json');writeJSON(fixtureFile,presentation);
   if(engine==='fomkyr'){
    assert.ok(fs.existsSync(native),'Build the native CLI with make -C fomkyr first');
    const result=await processRun(native,['-i',fixtureFile,'-d',String(entry.degree),'-j',String(workers),'--memory',memoryMiB+'M','--batch-pairs','128','--time-limit',String(timeoutSeconds),'--workdir',path.join(dir,'job'),'--export','--quiet'],dir);
    Object.assign(row,result,{memoryMiB,workers});
    const text=fs.readFileSync(path.join(dir,'stdout.txt'),'utf8');let metadata;try{metadata=JSON.parse(text);}catch{}
    row.metadata=metadata;
    if(row.status==='complete'&&!metadata?.complete)row.status='error';
    if(metadata?.complete)assert.equal(metadata.completedThroughDegree,entry.degree);
    const root=path.join(dir,'job','fomkyr');
    const run=fs.existsSync(root)?fs.readdirSync(root).find(n=>n.startsWith('alg-')):null;
    const basis=run?path.join(root,run,'result.gb'):null;
    if(basis&&fs.existsSync(basis)){row.basisFile=path.relative(out,basis);row.basisSha256=sha256(fs.readFileSync(basis));}
    if(row.status==='complete')assert.ok(row.basisFile,'Native calculation did not export a basis');
   }else if(engine==='singular'){
    const source=singularScript(presentation,entry.degree);fs.writeFileSync(path.join(dir,'input.sing'),source);
    Object.assign(row,await processRun('/usr/bin/prlimit',['--as='+String(memoryMiB*1048576),'--',singular,'-q'],dir,{input:source,env:singularEnv}),{memoryMiB});
    const log=fs.readFileSync(path.join(dir,'stdout.txt'),'utf8');
    if(row.status==='complete'&&(!/^BENCHMARK_DONE$/m.test(log)||/^\s*\?/m.test(log)))row.status='error';
    if(row.status==='complete'){row.basisFile=path.relative(out,path.join(dir,'stdout.txt'));row.basisSha256=sha256(log);}
   }else{
    const config=engine==='chromium'?'fomkyr':'fomkyr-firefox';
    const measurement=path.join(dir,'measurement');
    const args=['tools/benchmark-backend-resources.mjs','--out',measurement,'--input-file',fixtureFile,'--degrees',String(entry.degree),'--configs',config,'--workers',String(workers),'--memory-mib',String(browserMemoryMiB),'--timeout-seconds',String(timeoutSeconds)];
    // The existing browser runner owns its sampling and calculation deadline.
    const invocation=await processRun(process.execPath,args.map((a,i)=>i===0?path.resolve(a):a),dir,{cap:timeoutSeconds+180,cwd:process.cwd()});
    const file=path.join(measurement,'report.json');
    if(fs.existsSync(file)){
     const measured=JSON.parse(fs.readFileSync(file)),r=measured.rows[0];
     if(r){Object.assign(row,r,{id:entry.id,engine,measurementReport:path.relative(out,file),wallSeconds:r.coldWallSeconds});
      if(r.basisFile){row.basisFile=path.relative(out,path.join(measurement,r.basisFile));row.basisSha256=sha256(fs.readFileSync(path.join(out,row.basisFile)));}}
     else Object.assign(row,{status:'error',error:measured.errors});
    }else Object.assign(row,invocation);
   }
   const stderr=fs.readFileSync(path.join(dir,'stderr.txt'),'utf8');
   if(row.status==='watchdog'){row.status='timeout';row.browserWatchdog=true;}
   if(row.status==='error'&&/out of memory|memory exhausted|cannot allocate|std::bad_alloc/i.test(stderr))row.status='oom';
   report.rows.push(row);save();console.log(entry.id,engine,row.status,row.wallSeconds?.toFixed(2),'s');
  }
  if(interrupted)break;
 }
 // No audits or reference computations compete with a timed engine job.
 if(!interrupted&&check){
  const missingReferences=new Map();
  for(const row of report.rows.filter(r=>r.status==='complete')){
   if(interrupted)break;
   const entry=cases.find(c=>c.id===row.id);
   if(!entry.homogeneous){row.independentCheck={status:'unsupported',reason:'The bounded homogeneous certificate does not apply.'};save();continue;}
   const referenceKey=row.id+':'+row.degree;
   if(missingReferences.has(referenceKey)){
    row.independentCheck={...missingReferences.get(referenceKey),reason:'The identical reference already reached its limit in this session; no repeated oracle run.'};save();continue;
   }
   const directory=path.join(out,entry.id+'-'+row.engine,'check');fs.mkdirSync(directory,{recursive:true});
   const result=await processRun(process.execPath,[path.resolve('tools/check-free-algebra-benchmark.mjs'),reportFile,row.id,row.engine,String(oracleTimeoutSeconds)],directory,{cap:oracleTimeoutSeconds+125,cwd:process.cwd()});
   const text=fs.readFileSync(path.join(directory,'stdout.txt'),'utf8');
   let checked;try{checked=JSON.parse(text.trim().split('\n').at(-1));}catch{}
   row.independentCheck=checked??{status:'incomplete',error:fs.readFileSync(path.join(directory,'stderr.txt'),'utf8').slice(-2000),capSeconds:oracleTimeoutSeconds};save();
   if(row.independentCheck.status==='incomplete'&&row.independentCheck.stage==='reference')missingReferences.set(referenceKey,row.independentCheck);
  }
 }
 report.state=interrupted?'interrupted':'complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
report.summary={completed:report.rows.filter(r=>r.status==='complete').length,censored:report.rows.filter(r=>['timeout','oom'].includes(r.status)).length,
 unsupported:report.rows.filter(r=>r.status==='unsupported').length,verified:report.rows.filter(r=>r.independentCheck.status==='passed').length,
 failedChecks:report.rows.filter(r=>r.independentCheck.status==='failed').length,incompleteChecks:report.rows.filter(r=>r.independentCheck.status==='incomplete').length};save();
if(contract.acceptance){report.acceptancePassed=!interrupted&&acceptancePassed(report.rows,cases.length*engines.length);save();if(!report.acceptancePassed)process.exitCode=1;}
report.performancePassed=!interrupted&&report.rows.length===cases.length*engines.length&&report.rows.every(r=>r.status==='complete');save();
if(report.summary.failedChecks||report.rows.some(r=>['error','timeout','oom'].includes(r.status)))process.exitCode=1;
if(interrupted)process.exitCode=130;
console.log(path.relative(process.cwd(),reportFile));
