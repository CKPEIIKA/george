// Focused release tests: real WASM; OPFS/Web Locks emulated by the Node adapter.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine,validateFixture} from '../web/engine.js';
import {identityOf,readCheckpoint,listCachedRuns,deleteCachedRun} from '../web/storage.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-release-'));setup(root);
const reports=[];const report=(test,details={})=>{reports.push({test,passed:true,...details});console.log(test);};
const load=n=>JSON.parse(fs.readFileSync(new URL(`../fixtures/${n}.json`,import.meta.url)));
const fk=load('fk6');
async function run(f,target,o={}){const e=new FomkyrEngine({workers:4,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,spill:true,exportText:false,...o});try{return await e.compute(f,target,o.modulus??0);}finally{await e.close();}}
// Homogenized oscillator: [a,b]=t^2, t central. This is NOT the ordinary
// ungraded Weyl algebra's graded Hilbert series; its PBW dimension is C(d+2,2).
const weyl={variables:['t','b','a'],relations:[
 {degree:2,terms:[{word:[2,1],coefficient:'1'},{word:[1,2],coefficient:'-1'},{word:[0,0],coefficient:'-1'}]},
 {degree:2,terms:[{word:[2,0],coefficient:'1'},{word:[0,2],coefficient:'-1'}]},
 {degree:2,terms:[{word:[1,0],coefficient:'1'},{word:[0,1],coefficient:'-1'}]}
]};
fs.writeFileSync(new URL('../fixtures/homogenized-weyl.json',import.meta.url),JSON.stringify({...weyl,name:'Homogenized oscillator',expectedHilbertThrough7:[1,3,6,10,15,21,28,36]},null,2));
for(const [name,f] of [['polynomial-ring',load('commutative')],['exterior',load('exterior')],['FK3',load('fk3')],['homogenized-Weyl',weyl]]){
 const r=await run(f,7,{runKey:'physical-'+name});
 const expected=name==='homogenized-Weyl'?Array.from({length:8},(_,d)=>((d+1)*(d+2)/2).toString()):f.expectedHilbertThrough7.map(String);
 assert.deepEqual(r.hilbert.coefficients,expected);report('Hilbert-'+name,{coefficients:expected,finite:r.hilbert.finiteDimensionalProved,dimension:r.hilbert.dimension});
}
for(const modulus of [0,2,101]){
 const r=await run(load('exterior'),7,{runKey:'field-'+modulus,modulus});assert.equal(r.hilbert.dimension,'8');assert.equal(r.hilbert.field,modulus?`F_${modulus}`:'Q');
}
report('coefficient-field-labels-and-finite-dimension');
const free={variables:Array.from({length:16},(_,i)=>'x'+i),relations:[]};
const big=await run(free,20,{runKey:'free16',workers:1});assert.equal(big.hilbert.coefficients[20],(16n**20n).toString());assert.ok(BigInt(big.hilbert.coefficients[20])>2n**64n);report('80-bit-Hilbert-coefficients',{h20:big.hilbert.coefficients[20]});
const late={variables:['x'],relations:[{degree:5,terms:[{word:[0,0,0,0,0],coefficient:'1'}]}]};
assert.deepEqual((await run(late,7,{runKey:'late'})).hilbert.coefficients,['1','1','1','1','1','0','0','0']);report('higher-degree-input-relation');
assert.throws(()=>validateFixture({variables:['a','b'],relations:[{degree:2,terms:[{word:[0],coefficient:'1'}]}]}));report('reject-invalid-direct-fixture');
const cpdir=path.join(root,'fomkyr','cache-test'),basis=path.join(cpdir,'basis.gnb');
let r=await run(fk,4,{runKey:'cache-test'});assert.equal(r.cacheHit,false);
r=await run(fk,7,{runKey:'cache-test',bits:64});assert.equal(r.resumedFromDegree,4);assert.deepEqual(r.hilbert.coefficients,fk.expectedHilbertThrough7.map(String));
const size=fs.statSync(basis).size;
r=await run(fk,4,{runKey:'cache-test'});assert.equal(r.completedThroughDegree,7);assert.equal(r.hilbert.certifiedThroughDegree,4);assert.equal(r.cacheHit,true);assert.equal(fs.statSync(basis).size,size);
report('cross-ABI-resume-and-nondestructive-lower-target',{savedThrough:7,requested:4});
fs.appendFileSync(basis,Buffer.alloc(1234,77));r=await run(fk,7,{runKey:'cache-test'});assert.equal(r.cacheHit,true);assert.equal(fs.statSync(basis).size,size);report('discard-uncommitted-tail');
// Corrupted metadata must fall back to the preceding completed degree.
const last=path.join(cpdir,'checkpoint-1.json');const original=fs.readFileSync(last,'utf8');const corrupt=JSON.parse(original);corrupt.payload.basisSize++;fs.writeFileSync(last,JSON.stringify(corrupt));
r=await run(fk,7,{runKey:'cache-test'});assert.equal(r.resumedFromDegree,6);assert.equal(r.basisSize,695);report('metadata-checksum-fallback');
// Corrupt a payload byte belonging only to degree 7. The record checksum must
// reject the latest checkpoint; the degree-6 prefix is independently restored.
const buffer=fs.readFileSync(basis);buffer[buffer.length-1]^=0x40;fs.writeFileSync(basis,buffer);
r=await run(fk,7,{runKey:'cache-test'});assert.equal(r.resumedFromDegree,6);assert.equal(r.basisSize,695);report('record-checksum-fallback');
const before=fs.readFileSync(basis);
await assert.rejects(()=>run(load('fk3'),7,{runKey:'cache-test'}),e=>e.code==='CACHE_INVALID');assert.deepEqual(fs.readFileSync(basis),before);report('identity-mismatch-preserves-cache');
const held=new FomkyrEngine({workers:2,budgetBytes:64*1048576,scratchBytes:16*1048576,runKey:'held',exportText:false});
try{await held.compute(load('fk3'),5);await assert.rejects(()=>run(load('fk3'),5,{runKey:'held'}),e=>e.code==='CACHE_BUSY');await assert.rejects(()=>deleteCachedRun('held'),e=>e.code==='CACHE_BUSY');}finally{await held.close();}
await deleteCachedRun('held');assert.ok(!(await listCachedRuns()).some(x=>x.key==='held'));report('cache-lock-list-and-protected-deletion');
r=await run(fk,4,{runKey:'hilbert-small',hilbertBudgetBytes:64});assert.equal(r.complete,true);assert.equal(r.hilbert.available,false);
r=await run(fk,4,{runKey:'hilbert-small'});assert.equal(r.cacheHit,true);assert.equal(r.hilbert.coefficients[4],'3831');report('Hilbert-budget-failure-preserves-GB-and-checkpoint');
// Stress the adaptive low-memory scheduler without a full-scale algebra run.
r=await run(fk,8,{runKey:'batch-pressure',workers:4,scratchBytes:4*1048576,budgetBytes:32*1048576,batchPairs:512});assert.equal(r.basisSize,990);assert.ok(r.allocatedBytes<=r.budgetBytes);report('bounded-small-scratch',{fallbacks:r.scheduler.fallbacks,activeLanes:r.workers,allocatedBytes:r.allocatedBytes});
// Independent Fraction completion, critical pairs and mutual reduction of actual
// WASM batch results. Do not confuse same-core native/WASM agreement with this.
r=await run(fk,4,{runKey:'oracle',batchPairs:64});
const oracle=spawnSync('python3',[new URL('./verify_wasm_records.py',import.meta.url).pathname,path.join(root,'fomkyr','oracle','basis.gnb'),new URL('../fixtures/fk6.json',import.meta.url).pathname,'4'],{encoding:'utf8'});
assert.equal(oracle.status,0,oracle.stdout+oracle.stderr);report('independent-Fraction-oracle-on-batched-WASM',{detail:oracle.stdout.trim()});
fs.writeFileSync(new URL('../results/fomkyr-tests.json',import.meta.url),JSON.stringify({host:'Node actual WASM; emulated OPFS and Web Locks',reports},null,2));
fs.rmSync(root,{recursive:true,force:true});
