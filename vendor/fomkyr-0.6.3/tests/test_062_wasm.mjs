// Real WASM variants, not mocked kernel execution. OPFS uses a Node adapter.
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-062-'));setup(root);
const read=n=>JSON.parse(fs.readFileSync(new URL(`../fixtures/published/${n}.json`,import.meta.url)));
const q2=read('affine-q-serre-q2'),q3=read('affine-q-serre-q3'),sky=read('sklyanin-1-2-3');
const reports=[],entries=[];
async function run(f,d,o={}){
 const key=o.runKey??`check-${reports.length}`;const e=new FomkyrEngine({workers:4,bits:32,budgetBytes:128<<20,scratchBytes:16<<20,spill:true,resume:false,runKey:key,ioMode:'broker',progress:false,...o});let r;
 try{r=await e.compute(f,d,o.modulus??0);}finally{await e.close();}
 assert.equal(r.completedThroughDegree,d);assert.equal(r.modulus,o.modulus??0);
 if(o.bigRationalHeap!==false&&!o.modulus){assert.ok(r.bigRationalSuccesses>0,'new arbitrary tier was not exercised');}
 if(o.modulus)assert.equal(r.bigRationalAttempts,0,'a Q tier must not run in a prime field');
 if(o.fastBigDivision===false)assert.equal(r.fastBigDivision,false);
 reports.push({test:key,passed:true,degree:d,bits:r.bits,shared:r.shared,workers:r.workers,ioMode:r.ioMode,bigAttempts:r.bigRationalAttempts,bigSuccesses:r.bigRationalSuccesses,bigFallbacks:r.bigRationalFallbacks,collections:r.bigCoefficientCollections,growths:r.rationalInPlaceGrowths,retries:r.rationalTableRetries,allocatedBytes:r.allocatedBytes});
 entries.push({name:key,fixture:f,modulus:o.modulus??0,degree:d,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError});return r;
}
try{
 for(const bits of [32,64])for(const execution of ['single','multicore'])await run(q2,14,{bits,execution});
 await run(q3,14,{monomialPruning:false});
 await run(q2,14,{bigRationalHeap:false,growingRationalHeap:false});
 await run(q2,14,{fastBigDivision:false});
 await run(q2,14,{growingRationalHeap:false});
 for(const modulus of [2,5,101])await run(q2,8,{modulus});
 // Constrained arena: repeated coefficient-collection paths must execute.
 const small=await run(q3,16,{workers:1,budgetBytes:64<<20,scratchBytes:4<<20});
 assert.ok(small.bigCoefficientCollections>0,'collection stress did not collect');
 await run(sky,9,{workers:1,budgetBytes:64<<20,scratchBytes:4<<20});
 // Compatibility: load an old arithmetic configuration, switch bitness and
 // storage/execution mode, and finish without changing algebra cache identity.
 await run(q2,13,{runKey:'resume',bits:32,execution:'single',bigRationalHeap:false});
 const resumed=await run(q2,14,{runKey:'resume',bits:64,execution:'multicore',resume:'auto'});assert.equal(resumed.resumedFromDegree,13);
 entries.splice(entries.length-2,1);
 // A deadline in long-coefficient arithmetic must remain CANCELLED, not
 // become a fake corruption/scratch error after a failed temporary allocation.
 const timed=new FomkyrEngine({workers:4,bits:32,budgetBytes:128<<20,scratchBytes:32<<20,spill:true,resume:false,runKey:'deadline',timeoutMs:250,hilbert:false,exportText:false,progress:false});
 const t0=performance.now();let stopped;
 try{await timed.compute(sky,15,0);}catch(error){stopped=error;}
 assert.equal(stopped?.code,'CANCELLED');
 assert.ok(performance.now()-t0<10000,'deadline exceeded 10-second test grace');
 assert.ok(timed.lastCheckpoint.completedThroughDegree<15);
 reports.push({test:'large-coefficient-deadline',passed:true,code:stopped.code,completedThroughDegree:timed.lastCheckpoint.completedThroughDegree,elapsedMs:performance.now()-t0});
 await timed.close();
 const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const check=spawnSync('python3',['tests/verify_062_wasm.py',manifest,'results/0.6.2/wasm-exact-oracle.json'],{encoding:'utf8',timeout:240000});
 assert.equal(check.status,0,check.stdout+check.stderr);
 fs.writeFileSync('results/0.6.2/wasm-exact.json',JSON.stringify({passed:true,scope:'Real WASM32/WASM64, shared/unshared; Node filesystem, no browser execution claim',reports},null,2));
 console.log(JSON.stringify({passed:true,configurations:reports.length,independentSerializedBasisChecks:entries.length}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
