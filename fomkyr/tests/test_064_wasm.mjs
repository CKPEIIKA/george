import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {stats} from '../web/runtime.js';
const root=path.resolve('results/0.6.4/auto-wasm-storage');fs.mkdirSync(root,{recursive:true});setup(root);
const q=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q3.json'));
const q2=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q2.json'));
const reports=[],entries=[];
class PressureEngine extends FomkyrEngine {
 async open(){await super.open();this.scratch=4*1048576;this.memoryPlan.rowReserveBytes=0;return this;}
}
async function run(name,options={},d=16,pressure=false){
 const events=[];const cls=pressure?PressureEngine:FomkyrEngine;
 const e=new cls({workers:4,bits:32,memoryPolicy:'auto',budgetBytes:128*1048576,runKey:name,resume:false,spill:true,hilbert:true,exportText:false,progress:false,timeoutMs:120000,...options,onEvent:x=>{if(['memory-plan','memory-adaptation'].includes(x.type))events.push(x);}});
 try{
 const r=await e.compute(options.modulus?q2:q,d,options.modulus??0);
 assert.equal(r.completedThroughDegree,d);assert.equal(r.automaticMemory,true);assert.equal(r.reserveLeased,false);
 assert(r.allocatedBytes<=r.budgetBytes);assert.equal(e.e.gn_memory_stat(5),0n);
 reports.push({name,pressureInjection:pressure,events,result:r});entries.push({name,fixture:options.modulus?q2:q,modulus:options.modulus??0,degree:d,record:path.join(root,'fomkyr',name,'basis.gnb'),hilbert:r.hilbert.coefficients});
 console.log(name,r.basisSize,r.workers,r.workspaceRetryBatches,r.elapsedMs);return r;
 }finally{await e.close();}
}
try{
 for(const bits of [32,64])for(const execution of ['single','multicore'])await run(`auto-${bits}-${execution}`,{bits,execution});
 const p=await run('injected-capacity',{bits:32},17,true);assert(p.workspaceRetryBatches>0,'test must exercise a live resize');assert(p.workers<4);
 await run('prime2',{modulus:2},8);await run('prime101',{modulus:101},8);
 await run('resume',{bits:32,execution:'single'},14);
 const r=await run('resume',{bits:64,execution:'multicore',resume:true},16);assert.equal(r.resumedFromDegree,14);
 fs.writeFileSync('results/0.6.4/auto-wasm.json',JSON.stringify({passed:true,reports},null,2));fs.writeFileSync('results/0.6.4/auto-wasm-manifest.json',JSON.stringify(entries,null,2));
}catch(e){fs.writeFileSync('results/0.6.4/auto-wasm-failed.json',JSON.stringify({error:String(e),reports},null,2));throw e;}
