import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {writeJSON} from '../web/storage.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-progress-'));setup(root);
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url))),reports=[];
try{
 const events=[];const e=new FomkyrEngine({execution:'single',bits:32,workers:1,spill:false,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,hilbert:false,exportText:false,progressIntervalMs:250,onEvent:v=>{if(v.type==='progress')events.push(v);}});
 let r;try{r=await e.compute(fixture,9);}finally{await e.close();}
 assert.equal(r.basisSize,1451);assert.equal(r.progressError,null);
 const live=events.filter(v=>v.phase==='reducing'&&v.activity.activeLanes===1&&BigInt(v.activity.maxActiveRowTerms)>0n);
 fs.writeFileSync(new URL('../results/progress-live-sample.json',import.meta.url),JSON.stringify({description:'Actual unshared WASM32 FK6 degree9; 250ms requested interval for live-pulse regression',events},null,2));
 assert.ok(live.length>0,'No live event while a single unshared lane was inside reduction');
 assert.ok(events.every(v=>v.overlaps.total===null||BigInt(v.overlaps.resolved)<=BigInt(v.overlaps.total)));
 assert.equal(r.progress.completedThroughDegree,9);
 reports.push({test:'live-progress-inside-single-worker-WASM',passed:true,events:events.length,activeReductionEvents:live.length,sample:live.at(-1)});
 const bad=new FomkyrEngine({workers:1,spill:false,budgetBytes:64*1048576,scratchBytes:16*1048576,hilbert:false,exportText:false,onEvent:v=>{if(v.type==='progress')throw new Error('intentional telemetry listener exception');}});
 try{r=await bad.compute(fixture,4);assert.equal(r.basisSize,265);assert.match(r.progressError,/intentional/);}finally{await bad.close();}
 reports.push({test:'progress-listener-error-cannot-corrupt-algebra',passed:true});
 // An actual 0.3.0 record stream from the controlled benchmark. Re-envelope its
 // completed-degree metadata using the unchanged public checkpoint schema.
 const old=JSON.parse(fs.readFileSync(new URL('../results/speed/d9-baseline-w4-p1-r0.json',import.meta.url)));
 const dir=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('fomkyr',{create:true})).getDirectoryHandle('upgrade',{create:true});
 fs.copyFileSync(new URL('../results/speed/d9-baseline-w4-p1-r0.gnb',import.meta.url),path.join(root,'fomkyr','upgrade','basis.gnb'));
 await writeJSON(dir,'checkpoint-1.json',{abi:3,version:'0.3.0',identity:old.result.identity,completedThroughDegree:9,basisSize:old.result.basisSize,diskBytes:old.result.diskBytes},{checkpoint:true});
 const upgrade=new FomkyrEngine({execution:'single',bits:64,spill:true,runKey:'upgrade',resume:true,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,hilbert:false,exportText:false});
 try{r=await upgrade.compute(fixture,9);assert.equal(r.resumedFromDegree,9);assert.equal(r.cacheHit,true);assert.equal(r.basisSize,1451);assert.equal(r.bits,64);assert.equal(r.shared,false);assert.equal(r.progress.completedThroughDegree,9);}finally{await upgrade.close();}
 reports.push({test:'actual-v0.3-records-restored-in-v0.4-memory64-unshared',passed:true,throughDegree:9,metadataEnvelope:'reconstructed from actual old result via unchanged checkpoint writer; old polynomial bytes unchanged'});
 // Extend an actual old checkpoint, not only return its cached result. Old
 // degree-9 records are ordered by completed degree, so its <=4 prefix is exact.
 const prior=fs.readFileSync(new URL('../results/speed/d9-baseline-w4-p1-r0.gnb',import.meta.url));
 let end=0,count=0;while(end<prior.length&&prior.readUInt32LE(end+12)<=4){end+=prior.readUInt32LE(end+4);count++;}assert.equal(count,265);
 const extdir=await(await(await navigator.storage.getDirectory()).getDirectoryHandle('fomkyr',{create:true})).getDirectoryHandle('upgrade-extend',{create:true});
 fs.writeFileSync(path.join(root,'fomkyr','upgrade-extend','basis.gnb'),prior.subarray(0,end));
 await writeJSON(extdir,'checkpoint-0.json',{abi:3,version:'0.3.0',identity:old.result.identity,completedThroughDegree:4,basisSize:count,diskBytes:end},{checkpoint:true});
 const opts={execution:'single',bits:32,spill:true,resume:true,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,hilbert:true,exportText:false};
 const extend=new FomkyrEngine({...opts,runKey:'upgrade-extend'});try{r=await extend.compute(fixture,5);assert.equal(r.resumedFromDegree,4);assert.equal(r.hilbert.coefficients.at(-1),'16605');}finally{await extend.close();}
 const fresh=new FomkyrEngine({...opts,resume:false,runKey:'fresh-five'});try{await fresh.compute(fixture,5);}finally{await fresh.close();}
 assert.deepEqual(fs.readFileSync(path.join(root,'fomkyr','upgrade-extend','basis.gnb')),fs.readFileSync(path.join(root,'fomkyr','fresh-five','basis.gnb')));
 reports.push({test:'extend-old-v0.3-degree4-checkpoint-to-degree5',passed:true,identicalToFreshNewBinaryBasis:true,hilbert5:'16605'});
 const on=fs.readFileSync(new URL('../results/speed/d10-optimized-w4-p1-r0.gnb',import.meta.url));const off=fs.readFileSync(new URL('../results/speed/d10-optimized-w4-p0-r0.gnb',import.meta.url));assert.deepEqual(on,off);
 reports.push({test:'telemetry-on-off-identical-degree10-WASM-binary-basis',passed:true,bytes:on.length});
}finally{fs.rmSync(root,{recursive:true,force:true});}
fs.writeFileSync(new URL('../results/progress-integration-tests.json',import.meta.url),JSON.stringify({passed:true,mode:'Actual WASM; node:fs emulates browser storage',reports},null,2));console.log(JSON.stringify(reports.map(({sample,...r})=>r),null,2));
