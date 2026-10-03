// Isolated benchmark process: root can be pristine 0.3.0 or this release.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [source,targetText,workersText,progressText,output,recordCopy]=process.argv.slice(2);
const root=path.resolve(source),url=name=>pathToFileURL(path.join(root,name));
const {setup}=await import(url('tests/node-host.mjs'));const {FomkyrEngine}=await import(url('web/engine.js'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-speed-'));setup(temp);
const target=Number(targetText),workers=Number(workersText),progress=progressText!=='off';const events=[];
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures/fk6.json')));
const e=new FomkyrEngine({workers,bits:32,batchPairs:Number(process.env.FOMKYR_BATCH??workers*8),costScheduling:process.env.FOMKYR_COST!=='off',wordCacheEntries:Number(process.env.FOMKYR_WORD_CACHE??256),spill:true,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,runKey:'trial',resume:false,hilbert:false,exportText:false,progress,progressIntervalMs:1000,onEvent:v=>{if(['degree','progress'].includes(v.type))events.push(v);}});
let r;
try{
 await e.open(); // do not charge module compilation/worker creation to algebra timing
 r=await e.compute(fixture,target,Number(process.env.PRIME??0));
 if(recordCopy)fs.copyFileSync(path.join(temp,'fomkyr/trial/basis.gnb'),recordCopy);
 const result={sourceVersion:r.version,target,workersRequested:workers,progress,mode:'actual shared WASM32; node:fs adapter for OPFS',node:process.version,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,result:r,events,peakProcessRSSBytes:process.resourceUsage().maxRSS*1024};
 fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({version:r.version,target,workers,progress,elapsedMs:r.elapsedMs,rules:r.basisSize,terms:r.terms,progressEvents:events.filter(x=>x.type==='progress').length}));
}finally{await e.close();fs.rmSync(temp,{recursive:true,force:true});}
