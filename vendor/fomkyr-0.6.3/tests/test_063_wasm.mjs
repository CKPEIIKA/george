// Exact execution of all four binaries. Browser storage is Node-emulated here.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {stats} from '../web/runtime.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-063-'));setup(root);
const R=new URL('../',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(`fixtures/published/${n}.json`,R)));
const q2=read('affine-q-serre-q2'),q3=read('affine-q-serre-q3'),sky=read('sklyanin-1-2-3');
const reports=[],entries=[];fs.mkdirSync('results/0.6.3',{recursive:true});
async function run(f,d,o={}) {
 const key=o.runKey??`test-${reports.length}`;
 const e=new FomkyrEngine({workers:4,bits:32,budgetBytes:128<<20,scratchBytes:4<<20,rowReserveBytes:32<<20,spill:true,resume:false,runKey:key,progress:false,exportText:false,hilbert:true,ioMode:'broker',timeoutMs:45000,...o});
 let r;try{r=await e.compute(f,d,o.modulus??0);}finally{await e.close();}
 assert.equal(r.completedThroughDegree,d);assert.equal(r.modulus,o.modulus??0);assert.equal(r.radixHeap,o.radixHeap!==false);
 assert.equal(r.reserveInPlace,o.reserveInPlace!==false);assert.equal(r.reserveLeased,false,'a completed call leaked the shared workspace lease');
 if(o.modulus)assert.equal(r.rowReserveBytes,0,'Q overflow workspace should not be allocated in a prime field');
 if(o.mustRescue)assert.ok(r.reserveSuccesses>0,'overflow path was not exercised');
 reports.push({test:key,passed:true,bits:r.bits,shared:r.shared,workers:r.workers,degree:d,modulus:r.modulus,radixHeap:r.radixHeap,reserveInPlace:r.reserveInPlace,allocatedBytes:r.allocatedBytes,reserveBytes:r.rowReserveBytes,reserveAttempts:r.reserveAttempts,reserveSuccesses:r.reserveSuccesses,reserveBusy:r.reserveBusy,reservePromotions:r.reservePromotions,reserveLeased:r.reserveLeased,scheduler:r.scheduler});
 entries.push({name:key,fixture:f,modulus:o.modulus??0,degree:d,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});
 return r;
}
try{
 for(const bits of [32,64])for(const execution of ['single','multicore']) {
  await run(q3,18,{bits,execution,scratchBytes:execution==='single'?1<<20:4<<20,mustRescue:true});
 }
 await run(q3,18,{radixHeap:false,mustRescue:true});
 await run(q3,18,{batchPairs:0,mustRescue:true});
 await run(q3,18,{reserveInPlace:false,mustRescue:true});
 await run(q3,18,{monomialPruning:false,mustRescue:true});
 await run(q2,14,{rowReserveBytes:0,scratchBytes:32<<20});
 const refused=await run(q2,14,{rowReserveBytes:1024<<20,scratchBytes:32<<20});assert.equal(refused.rowReserveBytes,0,'over-budget reserve must be declined, not break the ordinary path');
 for(const modulus of [2,101])await run(q2,8,{modulus});
 // Cross-bitness and queue-policy continuation must preserve the same algebra.
 await run(q3,14,{bits:32,execution:'single',runKey:'resume',radixHeap:false});entries.pop();
 const resumed=await run(q3,18,{bits:64,execution:'multicore',runKey:'resume',resume:'auto',mustRescue:true});assert.equal(resumed.resumedFromDegree,14);
 const e=new FomkyrEngine({workers:4,bits:32,budgetBytes:128<<20,scratchBytes:4<<20,rowReserveBytes:32<<20,spill:true,resume:false,runKey:'cancel',progress:false,hilbert:false,exportText:false,timeoutMs:150});
 let error;const t0=performance.now();try{await e.compute(sky,20,0);}catch(x){error=x;}
 assert.equal(error?.code,'CANCELLED');assert.equal(stats(e.e).reserveLeased,false,'cancellation leaked a shared lease');
 assert.ok(performance.now()-t0<10000);reports.push({test:'cancellation-releases-reserve',passed:true,code:error.code,elapsedMs:performance.now()-t0,stats:stats(e.e)});await e.close();
 const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const verify=spawnSync('python3',['tests/verify_062_wasm.py',manifest,'results/0.6.3/reserve-wasm-oracle.json'],{encoding:'utf8',timeout:480000});
 fs.writeFileSync('results/0.6.3/reserve-wasm-oracle.log',verify.stdout+verify.stderr);
 assert.equal(verify.status,0,verify.stdout+verify.stderr);
 fs.writeFileSync('results/0.6.3/reserve-wasm.json',JSON.stringify({passed:true,scope:'Four actual WASM variants under Node; independent Fraction/prime-field checking. Not a browser conformance test.',reports,independentlyCheckedOutputs:entries.length},null,2));
 console.log(JSON.stringify({passed:true,configurations:reports.length,independentlyCheckedOutputs:entries.length}));
}catch(error){fs.writeFileSync('results/0.6.3/reserve-wasm-failure.json',JSON.stringify({error:String(error),reports,root},null,2));throw error;}
finally{fs.rmSync(root,{recursive:true,force:true});}
