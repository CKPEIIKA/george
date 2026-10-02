// Degree-12+ profiling: retain partial results, checkpoints, per-degree events.
import fs from 'node:fs';import crypto from 'node:crypto';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [fixturePath,degreeString,outputRoot]=process.argv.slice(2);
const source=path.resolve(process.env.FOMKYR_SOURCE??'.');
const {setup}=await import(pathToFileURL(path.join(source,'tests/node-host.mjs')));
const {FomkyrEngine}=await import(pathToFileURL(path.join(source,'web/engine.js')));
const output=path.resolve(outputRoot);fs.mkdirSync(output,{recursive:true});const store=path.join(output,'storage');fs.mkdirSync(store,{recursive:true});setup(store);
const events=[],options={workers:4,bits:32,budgetBytes:512*1048576,scratchBytes:128*1048576,hashBits:16,spill:true,resume:false,exportText:false,hilbert:false,progress:true,progressIntervalMs:5000,rationalHeap:true,timeoutMs:900000,...JSON.parse(process.env.TRIAL_OPTIONS??'{}')};
const fixture=JSON.parse(fs.readFileSync(fixturePath));const start=performance.now();let e;
options.onEvent=ev=>{const item={elapsedMs:performance.now()-start,...ev};if(ev.type!=='progress'||!events.length||item.elapsedMs-(events.at(-1)?.elapsedMs??0)>10000){events.push(item);fs.appendFileSync(path.join(output,'events.jsonl'),JSON.stringify(item)+'\n');if(ev.type==='degree'||ev.type==='checkpoint'||ev.type==='warning')console.log(JSON.stringify(item));}};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let report={sourceHashes:Object.fromEntries(['src/kernel.c','src/rational_heap_nf.inc','web/engine.js','web/fomkyr32.wasm'].map(p=>[p,sha(path.join(source,p))])),fixtureSHA256:sha(fixturePath),options:{...options,onEvent:undefined},source,fixturePath:path.resolve(fixturePath),requestedDegree:Number(degreeString),node:process.version,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,startedAt:new Date().toISOString()};
try{e=new FomkyrEngine(options);report.result=await e.compute(fixture,Number(degreeString),0);report.status='completed';}
catch(error){report.status='incomplete';report.error=String(error.message);report.code=error.code;report.lastCheckpoint=e?.lastCheckpoint;console.error(error);}
finally{report.elapsedMs=performance.now()-start;report.peakProcessRSSBytes=process.resourceUsage().maxRSS*1024;try{if(e?.e){const {stats}=await import(pathToFileURL(path.join(source,'web/runtime.js')));report.kernelStats=stats(e.e);if(e.e.gn_deep_stat)report.deepStats=Array.from({length:e.workers},(_,i)=>Array.from({length:5},(_,j)=>String(e.e.gn_deep_stat(i,j))));}}catch{}if(e){report.scheduler=e.scheduler;report.lastProgress=e.lastProgress;await e.close();}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,elapsedMs:report.elapsedMs,error:report.error,result:report.result}));if(report.status!=='completed')process.exitCode=1;}
