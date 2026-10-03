// Real builds and workers with filesystem-backed OPFS emulation, not a browser claim.
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-compiled-tests-'));setup(root);const reports=[],entries=[];
const fk=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url)));
const terms=xs=>xs.map(([word,coefficient])=>({word,coefficient:String(coefficient)}));
const oscillator={name:'oscillator-normal-ordering-degree6',variables:['t','b','a'],relations:[
 {degree:2,terms:terms([[[2,1],1],[[1,2],-1],[[0,0],-1]])},
 {degree:2,terms:terms([[[2,0],1],[[0,2],-1]])},
 {degree:2,terms:terms([[[1,0],1],[[0,1],-1]])},
 {degree:6,terms:terms([[[2,2,2,1,1,1],1],[[1,1,1,2,2,2],-1],[[0,0,1,1,2,2],-9],[[0,0,0,0,1,2],-18],[[0,0,0,0,0,0],-6]])}
]};
fs.writeFileSync(new URL('../fixtures/oscillator-normal-ordering.json',import.meta.url),JSON.stringify(oscillator,null,2));
async function run(f,d,o={}){
 const key=o.runKey??`check-${reports.length}`;
 const e=new FomkyrEngine({workers:4,bits:32,budgetBytes:128*1048576,scratchBytes:16*1048576,spill:true,runKey:key,resume:false,heapThreshold:1,...o});
 try{
  const r=await e.compute(f,d,o.modulus??0);assert.equal(r.completedThroughDegree,d);assert.equal(r.progressError,null);
  if(f===oscillator&&o.compiledRewrites!==false&&(o.rewriteBudgetBytes??1)>0){assert.equal(r.basisSize,3);assert.ok(r.localRewriteHits>0,'must exercise the new heap path');}
  entries.push({name:f.name,fixture:f,modulus:o.modulus??0,degree:d,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients,shared:r.shared,bits:r.bits,workers:r.workers,progressError:r.progressError});
  reports.push({test:key,passed:true,degree:d,bits:r.bits,workers:r.workers,ioMode:r.ioMode,field:r.modulus,localHits:r.localRewriteHits,entries:r.rewriteEntries,pinnedHits:r.pinnedReducerHits,resumedFromDegree:r.resumedFromDegree,bytes:r.allocatedBytes});return r;
 }finally{await e.close();}
}
try{
 for(const bits of [32,64])for(const execution of ['single','multicore'])await run(oscillator,6,{bits,execution,ioMode:'broker'});
 for(const modulus of [2,101,2147483647])await run(oscillator,6,{modulus});
 await run(fk,5,{runKey:'fk-new-macros',ioMode:'broker'});
 await run(fk,5,{runKey:'fk-no-macros',compiledRewrites:false,sharedReducerCacheBytes:0});
 await run(fk,5,{runKey:'fk-small-rewrite-cache',rewriteBudgetBytes:524304,sharedReducerCacheBytes:64});
 await run(fk,5,{runKey:'fk-pruning-off',monomialPruning:false});
 // Different heap implementation + different addressing/storage between degrees.
 await run(fk,4,{runKey:'resume',bits:32,execution:'single',compiledRewrites:false});
 const next=await run(fk,5,{runKey:'resume',bits:64,execution:'multicore',ioMode:'broker',resume:'auto'});assert.equal(next.resumedFromDegree,4);
 // The earlier record path was extended; the verifier must read only snapshots.
 entries.splice(entries.length-2,1);
 for(const options of [{rewriteDegree:5},{rewriteSupport:0},{rewriteBudgetBytes:-1},{sharedReducerCacheBytes:NaN}]){
  const e=new FomkyrEngine({spill:false,...options});try{await assert.rejects(()=>e.compute(oscillator,6,0));reports.push({test:'reject-invalid-option',options,passed:true});}finally{await e.close();}
 }
 const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const checked=spawnSync('python3',['tests/verify_physics_wasm.py',manifest,'results/0.6/compiled-wasm-oracle.json'],{encoding:'utf8',timeout:180000});assert.equal(checked.status,0,checked.stdout+checked.stderr);
 fs.writeFileSync('results/0.6/compiled-wasm-oracle.log',checked.stdout);
 fs.writeFileSync('results/0.6/compiled-wasm-tests.json',JSON.stringify({passed:true,scope:'Real WASM and workers, Node filesystem adapter; no browser execution claim',reports},null,2));
 console.log(JSON.stringify({passed:true,checks:reports.length,independentSerializedBasisChecks:entries.length}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
