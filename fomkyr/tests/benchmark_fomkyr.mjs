// Controlled within-version comparison. Node fs emulates OPFS; not browser I/O timings.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-bench-'));setup(root);
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url)));
const repeats=Number(process.argv[2]??3),degree=Number(process.argv[3]??8),trials=[];
for(let rep=0;rep<repeats;rep++)for(const [workers,batchPairs] of [[4,0],[1,8],[2,16],[4,32],[8,64]]){
  const e=new FomkyrEngine({workers,batchPairs,spill:true,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,hilbert:false,exportText:false,runKey:`r${rep}-w${workers}-b${batchPairs}`,resume:false});
  try{const r=await e.compute(fixture,degree);if(r.basisSize!==990&&degree===8)throw Error('Bad basis');trials.push({rep,workers,batchPairs,elapsedMs:r.elapsedMs,basisSize:r.basisSize,allocatedBytes:r.allocatedBytes,diskReads:r.diskReads,diskReadBytes:r.diskReadBytes,...r.scheduler,lanePairs:r.lanePairs});}
  finally{await e.close();}
}
const median=a=>{a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
const summary=[];for(const [workers,batchPairs] of [[4,0],[1,8],[2,16],[4,32],[8,64]]){
 const t=trials.filter(t=>t.workers===workers&&t.batchPairs===batchPairs);summary.push({workers,batchPairs,medianElapsedMs:median(t.map(x=>x.elapsedMs)),medianReduceMs:median(t.map(x=>x.reduceMs)),medianEpochs:median(t.map(x=>x.epochs)),medianRpcMessages:median(t.map(x=>x.rpcMessages)),medianDiskReads:median(t.map(x=>x.diskReads))});
}
const result={degree,repeats,host:'Node '+process.version+'; genuine WASM shared workers; node:fs storage adapter, NOT browser OPFS',cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,trials,summary};
fs.writeFileSync(new URL('../results/fomkyr-benchmark.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(summary,null,2));fs.rmSync(root,{recursive:true,force:true});
