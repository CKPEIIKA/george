// Real WASM/threads. Node filesystem emulates OPFS: NOT a Firefox browser test.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setup,FileHandle} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';import {parseNativeJob} from '../web/job-adapter.js';import {sha256} from '../web/storage.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr03-tests-'));setup(root);
const reports=[];const report=(test,extra={})=>{reports.push({test,passed:true,...extra});console.log(test);};
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url)));
const weyl=JSON.parse(fs.readFileSync(new URL('../fixtures/homogenized-weyl.json',import.meta.url)));
async function run(f,d,o={}){const e=new FomkyrEngine({budgetBytes:128*1048576,scratchBytes:32*1048576,workers:4,spill:true,...o});try{return await e.compute(f,d,o.modulus??0);}finally{await e.close();}}
for(const bits of [32,64])for(const execution of ['single','multicore']){
 const r=await run(fixture,4,{bits,execution,resume:false,runKey:`four-${bits}-${execution}`});
 assert.equal(r.basisSize,265);assert.equal(r.bits,bits);assert.equal(r.shared,execution==='multicore');assert.equal(r.workers,execution==='single'?1:4);
 assert.deepEqual(r.hilbert.coefficients,['1','15','125','765','3831']);report('WASM-'+bits+'-'+execution,{mode:r.executionMode,workers:r.workers});
}
const SAB=globalThis.SharedArrayBuffer;globalThis.crossOriginIsolated=false;globalThis.SharedArrayBuffer=undefined;
try{const r=await run(fixture,4,{execution:'auto',spill:false});assert.equal(r.executionMode,'wasm32-single');assert.ok(r.fallbacks.length);await assert.rejects(()=>run(fixture,3,{execution:'multicore',spill:false}),e=>e.code==='ISOLATION_REQUIRED');report('no-isolation-and-no-SAB-fallback');}
finally{globalThis.SharedArrayBuffer=SAB;globalThis.crossOriginIsolated=true;}
const Memory=WebAssembly.Memory;
WebAssembly.Memory=class extends Memory{constructor(d){if(d.address==='i64')throw new Error('simulated missing memory64');super(d);}};
try{const r=await run(fixture,4,{bits:64,spill:false});assert.equal(r.bits,32);assert.match(r.fallbacks.join(' '),/memory64/);report('memory64-unavailable-fallback-to32');}finally{WebAssembly.Memory=Memory;}
const sync=FileHandle.prototype.createSyncAccessHandle;
FileHandle.prototype.createSyncAccessHandle=async function(o){if(o?.mode==='readwrite-unsafe')throw Object.assign(new Error('unsupported lock mode'),{name:'TypeError'});return sync.call(this,o);};
try{const r=await run(fixture,5,{runKey:'portable-opfs',ioMode:'auto',resume:false});assert.equal(r.ioMode,'broker-exclusive');assert.equal(r.workers,4);assert.equal(r.basisSize,360);report('automatic-exclusive-owner-OPFS-fallback',{workers:r.workers,mode:r.ioMode,mailboxBytes:r.hostMailboxBytes});}finally{FileHandle.prototype.createSyncAccessHandle=sync;}
const getDir=navigator.storage.getDirectory;navigator.storage.getDirectory=async()=>{throw Object.assign(new Error('storage denied'),{name:'SecurityError'});};
try{const r=await run(fixture,4);assert.equal(r.storage,'memory');assert.ok(r.fallbacks.length);await assert.rejects(()=>run(fixture,4,{resume:true}),/storage denied/);report('denied-storage-RAM-fallback-and-strict-resume');}finally{navigator.storage.getDirectory=getDir;}
let r;
for(const [degree,bits,execution,ioMode] of [[4,32,'single','auto'],[5,64,'multicore','broker'],[6,32,'multicore','direct'],[7,64,'single','auto']]){
 r=await run(fixture,degree,{runKey:'cross-modes',bits,execution,ioMode});assert.equal(r.completedThroughDegree,degree);assert.equal(r.resumedFromDegree,degree===4?0:degree-1);
}assert.equal(r.basisSize,695);report('resume-across-shared-single-32-64-and-IO-modes');
// ABI 2 short-word checkpoints remain readable by ABI 3.
await run(fixture,4,{runKey:'v2-checkpoint'});const cp=path.join(root,'fomkyr','v2-checkpoint','checkpoint-0.json');let envelope=JSON.parse(fs.readFileSync(cp));envelope.payload.abi=2;envelope.sha256=await sha256(JSON.stringify(envelope.payload));fs.writeFileSync(cp,JSON.stringify(envelope));
r=await run(fixture,5,{runKey:'v2-checkpoint'});assert.equal(r.resumedFromDegree,4);report('read-ABI2-short-word-checkpoint');
const normalized=[];
for(const monomialPruning of [true,false]){
 const key='prune-'+monomialPruning;r=await run(fixture,4,{runKey:key,monomialPruning,heapReduction:false,cachePercent:0,batchPairs:0});
 assert.equal(r.monomialPruning,monomialPruning);assert.equal(r.heapReduction,false);assert.equal(r.basisSize,265);
 if(!monomialPruning){assert.equal(r.monomialPairsPruned,0);assert.equal(r.monomialTermsPruned,0);}else assert.ok(r.monomialPairsPruned>0);
 const audit=spawnSync('python3',[new URL('./verify_wasm_records.py',import.meta.url).pathname,path.join(root,'fomkyr',key,'basis.gnb'),new URL('../fixtures/fk6.json',import.meta.url).pathname,'4'],{encoding:'utf8'});assert.equal(audit.status,0,audit.stdout+audit.stderr);
 normalized.push(fs.readFileSync(path.join(root,'fomkyr',key,'basis.gnb')));
}
assert.deepEqual(normalized[0],normalized[1]);report('pruning-on-off-identical-binary-basis-and-independent-oracle');
for(const degree of [31,32,33,64,129]){
 const f={variables:['a','b'],relations:[{degree,terms:[{word:Array(degree).fill(1),coefficient:'1'},{word:Array(degree).fill(0),coefficient:'-1'}]}]};
 const key='long-'+degree,fixturePath=path.join(root,key+'.json');fs.writeFileSync(fixturePath,JSON.stringify(f));
 r=await run(f,degree+1,{runKey:key,bits:degree%2?32:64,execution:degree===33?'single':'multicore',ioMode:'broker',batchPairs:8});assert.equal(r.basisSize,2);assert.ok(r.preview.includes(`b^${degree}`));
 const audit=spawnSync('python3',[new URL('./verify_wasm_records.py',import.meta.url).pathname,path.join(root,'fomkyr',key,'basis.gnb'),fixturePath,String(degree+1)],{encoding:'utf8'});assert.equal(audit.status,0,audit.stdout+audit.stderr);
 const cached=await run(f,degree+1,{runKey:key,execution:'single'});assert.equal(cached.cacheHit,true);assert.deepEqual(cached.hilbert.coefficients,r.hilbert.coefficients);
 report('long-word-critical-composition-'+(degree+1),{inputDegree:degree,completedDegree:degree+1,rules:r.basisSize,independentOracle:true});
}
for(const generators of [3,16]){
 const f={variables:Array.from({length:generators},(_,i)=>'x'+i),relations:[]};
 r=await run(f,null,{execution:'single',spill:false,hilbertDegree:96});
 assert.equal(r.unrestrictedBasisComplete,true);assert.equal(r.completedThroughDegree,0);assert.equal(r.hilbert.certification,'complete-basis');
 assert.deepEqual(r.hilbert.coefficients,Array.from({length:97},(_,d)=>(BigInt(generators)**BigInt(d)).toString()));report('arbitrary-Hilbert-limbs-free-'+generators,{h96:r.hilbert.coefficients[96]});
}
r=await run(weyl,null,{spill:false,hilbertDegree:80});assert.equal(r.unrestrictedBasisComplete,true);assert.equal(r.completedThroughDegree,3);assert.equal(r.hilbert.coefficients[80],'3321');report('unbounded-mode-finite-GB-proof-and-higher-Hilbert-prefix');
r=await run(fixture,4,{spill:false,hilbert:false,hilbertDegree:100});assert.equal(r.hilbert,null);report('disabled-Hilbert-does-not-validate-inactive-prefix');
r=await run(fixture,4,{spill:false,hilbertDegree:100});assert.equal(r.complete,true);assert.equal(r.hilbert.available,false);report('unproved-Hilbert-extension-preserves-completed-GB');
const longJob={task:'gb',backend:'fomkyr',memoryMiB:128,files:{'input.bg':'(ALGFORMINPUT)\nvars a,b; b^100001-a^100001;'},script:'(SETLEGACYMODE NIL)\n(NONCOMMIFY)\n(DEGLEFTLEXIFY)\n(SETMODULUS 0)\n(SETMAXDEG NIL)\n(SIMPLE "input.bg" "result.gb")'};
assert.equal(parseNativeJob(longJob).target,null);assert.equal(parseNativeJob(longJob).fixture.relations[0].degree,100001);
assert.throws(()=>parseNativeJob({...longJob,files:{'input.bg':'(ALGFORMINPUT)\nvars a,b; b^4294967294-a^4294967294;'}}),/workspace budget/);report('parser-large-degree-and-memory-preflight');
let cancelled=false;try{await run(fixture,null,{runKey:'no-bound-cancel',onEvent:x=>{if(x.type==='degree'&&x.completedThroughDegree===4){/* separate test below owns cancellation */}} ,timeoutMs:5});}catch(e){assert.equal(e.code,'CANCELLED');cancelled=true;}assert.equal(cancelled,true);report('unbounded-computation-respects-deadline');
try{await run(fixture,9,{execution:'single',runKey:'single-timeout',timeoutMs:5});assert.fail('Expected timeout');}catch(e){assert.equal(e.code,'CANCELLED');}report('unshared-kernel-deadline');
fs.writeFileSync(new URL('../results/compatibility-tests.json',import.meta.url),JSON.stringify({host:'Node actual WASM/threads; filesystem OPFS emulation; no browser conformance claim',reports},null,2));
fs.rmSync(root,{recursive:true,force:true});
