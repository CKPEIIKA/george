// SPDX-License-Identifier: MIT. Real compiled kernels; Node filesystem OPFS adapter.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const source=path.resolve(process.argv[2]),outdir=path.resolve(process.argv[3]);fs.mkdirSync(outdir,{recursive:true});
const {setup}=await import(pathToFileURL(path.join(source,'tests/node-host.mjs')));const {FomkyrEngine}=await import(pathToFileURL(path.join(source,'web/engine.js')));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fk-gate-test-'));setup(root);
const f=JSON.parse(fs.readFileSync(path.join(source,'fixtures/fk6.json'))),reports=[];let reference;
async function run(name,{fixture=f,modulus=0,target=5,...settings}={}){
 const e=new FomkyrEngine({bits:32,workers:12,budgetBytes:128*1048576,scratchBytes:64*1048576,hashBits:16,spill:true,resume:false,runKey:name,hilbert:true,exportText:false,progress:false,hilbertGate:true,hilbertSectors:true,...settings});
 try{const r=await e.compute(fixture,target,modulus);assert.equal(r.completedThroughDegree,target);if(r.hilbertGate?.status===3&&r.hilbertGate.sectors&&r.hilbertGate.sectorCounterError===0)for(let g=0;g<360;g++)assert.equal(e.e.gn_fg_group(g,0),e.e.gn_fg_group(g,1));const file=path.join(root,'fomkyr',name,'basis.gnb');const bytes=fs.readFileSync(file);return {r,bytes,engine:e,file};}
 finally{await e.close();}
}
try{
 let b=await run('off',{hilbertGate:false});reference=b.bytes;reports.push({name:'unchanged baseline',passed:true,basisSize:b.r.basisSize});
 for(const bits of [32,64])for(const execution of ['single','multicore']){
  const name=`bits${bits}-${execution}`;let {r,bytes,file}=await run(name,{bits,execution});assert.deepEqual(bytes,reference);assert.equal(r.hilbertGate.certifiedProfileThroughDegree,16);assert.equal(r.hilbertGate.completeDimensionThroughDegree,16);assert.equal(r.hilbertGate.certifiedProfileThroughDegree,16);assert.equal(r.hilbertGate.completeDimensionThroughDegree,16);assert.ok(BigInt(r.hilbertGate.sectorSkips)>0);assert.equal(r.hilbertGate.sectorCounterError,0);
  const v=spawnSync('python3',[path.join(source,'tests/verify_wasm_records.py'),file,path.join(source,'fixtures/fk6.json'),'5'],{encoding:'utf8',timeout:45000});assert.equal(v.status,0,v.stdout+v.stderr);
  reports.push({name,passed:true,independentExactCheck:JSON.parse(v.stdout.trim()),all360GroupBoundsClosed:true,workers:r.workers,gate:r.hilbertGate});
 }
 for(const budget of [0,1,64,1024]){let {r,bytes}=await run('tiny'+budget,{gateBudgetBytes:budget});assert.deepEqual(bytes,reference);assert.ok(r.hilbertGate.closedDegrees<5);assert.equal(r.hilbertGate.sectorSkips,"0");reports.push({name:'optional-counter-budget-'+budget,passed:true});}
 let renamed=structuredClone(f);renamed.variables[0]='other_a';let a=await run('renamed',{fixture:renamed});assert.equal(a.r.hilbertGate.closedDegrees,0);assert.equal(a.r.hilbertGate.sectorSkips,'0');assert.deepEqual(a.bytes,reference);reports.push({name:'exact-identity-mismatch-disables',passed:true});
 let q=await run('prime',{modulus:101});assert.equal(q.r.hilbertGate.closedDegrees,0);assert.equal(q.r.hilbertGate.sectorSkips,'0');reports.push({name:'prime-field-disables',passed:true});
 // An actual checkpoint closed with the proof can be consumed without the addon.
 let e=new FomkyrEngine({bits:32,workers:4,budgetBytes:128*1048576,scratchBytes:32*1048576,spill:true,resume:true,runKey:'bits32-multicore',hilbertGate:false,exportText:false});
 try{let r=await e.compute(f,6,0);assert.equal(r.resumedFromDegree,5);assert.equal(r.completedThroughDegree,6);reports.push({name:'proof-checkpoint-resume-with-gate-off',passed:true});}finally{await e.close();}
 // Enable halfway through an actual computation; no cached logical gate state is needed.
 e=new FomkyrEngine({bits:64,workers:3,budgetBytes:128*1048576,scratchBytes:32*1048576,spill:true,resume:true,runKey:'off',hilbertGate:true,hilbertSectors:true,exportText:false});
 try{let r=await e.compute(f,6,0);assert.equal(r.resumedFromDegree,5);assert.ok(BigInt(r.hilbertGate.sectorSkips)>0);reports.push({name:'baseline-checkpoint-enable-proof-later',passed:true});}finally{await e.close();}
 // Reject a forged closure at an actual unfinished degree; this is not a bypass API.
 e=new FomkyrEngine({bits:32,workers:1,budgetBytes:32*1048576,scratchBytes:8*1048576,spill:false,exportText:false,hilbertGate:false});
 try{await e.open();await e.resetKernel(f,2,0);assert.equal(e.e.gn_fg_close(1024n),-7);reports.push({name:'out-of-state-closure-rejected',passed:true});}finally{await e.close();}
 fs.writeFileSync(path.join(outdir,'wasm-integration.json'),JSON.stringify({passed:true,realWasm:true,browser:false,filesystemOPFSAdapter:true,reports},null,2));console.log('PASS',reports.length,'real-WASM and host checks');
}finally{fs.rmSync(root,{recursive:true,force:true});}
