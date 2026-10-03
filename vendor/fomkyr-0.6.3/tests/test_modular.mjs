import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {setup} from './node-host.mjs';
import {CRTGroup,encodeRecord,decodeRecord,reconstruct,isqrt,primitiveRow} from '../web/rational-lift.js';
import {createEngine,ModularEngine} from '../web/modular-engine.js';
import {FomkyrEngine} from '../web/engine.js';import {checkCandidate} from '../web/candidate-verifier.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-mod-tests-'));setup(root);const tests=[];
async function test(name,f){const t=performance.now();await f();tests.push({name,passed:true,ms:performance.now()-t});console.log('PASS '+name);}
const base={budgetBytes:64*1048576,scratchBytes:16*1048576,hashBits:14,workers:4,bits:32,spill:true,resume:false,exportText:false,progress:false,modularMinPrimes:1,modularFallback:false};
const f=JSON.parse(fs.readFileSync('fixtures/fk3.json'));
const row=(degree,terms)=>({degree,lm:[...terms.keys()].sort().at(-1),terms});
await test('BigInt rational reconstruction and exact long/big-coefficient record roundtrip',()=>{
 for(let n=1n;n<100n;n++)assert.equal(isqrt(n*n+2n*n),n);
 assert.deepEqual(reconstruct(34n,101n),[1n,3n]);assert.deepEqual(reconstruct(67n,101n),[-1n,3n]);
 for(const d of [2,31,32,130]){const r=row(d,new Map([['1'.repeat(d),(1n<<180n)+5n],['0'.repeat(d),-(1n<<155n)+3n]]));assert.deepEqual(decodeRecord(encodeRecord(r,100000)),r);}
});
await test('CRT missing coefficient support treated as zero; rational denominator retained',()=>{
 const a=row(1,new Map([['1',1n]])),b=row(1,new Map([['1',1n],['0',101n]]));const g=new CRTGroup([a],101,1048576);g.merge([b],103);g.merge([row(1,new Map([['1',1n],['0',101n]]))],107);assert.deepEqual(g.reconstruct()[0].terms,new Map([['1',1n],['0',101n]]));
 const h=new CRTGroup([row(1,new Map([['1',1n],['0',34n]]))],101,1048576);h.merge([row(1,new Map([['1',1n],['0',69n]]))],103);assert.deepEqual(h.reconstruct()[0].terms,new Map([['1',3n],['0',1n]]));
});
await test('Aggressive heap threshold 1 cannot prune a canonical rule by itself',async()=>{const e=new ModularEngine({...base,heapThreshold:1});try{const r=await e.compute(f,5,0);assert(r.certification.deterministic);}finally{await e.close();}});
await test('Denominator clearing cannot allocate beyond its coefficient workspace',()=>{assert.throws(()=>primitiveRow(row(1,new Map([['1',1n],['0',1n]])),[[1n,65537n],[1n,65539n]],20),x=>x.code==='LIFT_WORKSPACE');});
let candidate;
await test('Certified shared WASM32, complete primitive candidate with exact certificate',async()=>{
 const e=createEngine({...base,arithmeticMode:'modular-verified'});try{const r=await e.compute(f,5,0);assert.equal(r.certification.deterministic,true);assert.equal(r.arithmeticMode,'modular-verified');assert.equal(r.tailReduced,true);assert.equal(r.reduced,false);assert.equal(r.certification.inputRelationsChecked,f.relations.length);candidate=[];const bytes=fs.readFileSync(path.join(root,'fomkyr',r.runKey,'basis.gnb'));for(let at=0;at<bytes.length;){const n=bytes.readUInt32LE(at+4);candidate.push(decodeRecord(bytes.subarray(at,at+n)));at+=n;}}finally{await e.close();}
});
for(const [bits,execution,workers] of [[32,'single',1],[64,'single',1],[64,'multicore',4]])await test(`Certified WASM${bits} ${execution}`,async()=>{
 const e=new ModularEngine({...base,bits,execution,workers});try{const r=await e.compute(f,4,0);assert.equal(r.bits,bits);assert.equal(r.shared,execution==='multicore');assert.equal(r.certification.throughDegree,4);}finally{await e.close();}
});
await test('Bad rational candidate rejected without completion or checkpoint',async()=>{
 const rows=candidate.map(r=>({...r,terms:new Map(r.terms)}));const r=rows.find(r=>r.terms.size>1),tail=[...r.terms.keys()].find(w=>w!==r.lm);r.terms.set(tail,r.terms.get(tail)+123n);
 const e=new FomkyrEngine({...base,runKey:'reject-check'});try{await assert.rejects(checkCandidate(e,f,rows,5),x=>x.code==='CANDIDATE_REJECTED');assert.equal(Number(e.e.gn_stat(0)),rows.length);assert(!fs.readdirSync(path.join(root,'fomkyr','reject-check')).some(n=>n.startsWith('checkpoint')));}finally{await e.close();}
});
await test('Nested/duplicate leading words rejected by exact checker',async()=>{
 const e=new FomkyrEngine({...base,runKey:'reject-lm'});try{await assert.rejects(checkCandidate(e,f,[...candidate,candidate[0]],5),x=>x.code==='CANDIDATE_REJECTED');}finally{await e.close();}
});
const unlucky={variables:['y','x'],relations:[{degree:1,terms:[{word:[1],coefficient:'101'},{word:[0],coefficient:'-1'}]}]};
await test('Unlucky leading-ideal shape and incorrect small lifts rejected; larger lift certified',async()=>{
 const e=new ModularEngine({...base,modularPrimes:[101,103,107,109,113,127],modularMaxPrimes:6});try{const r=await e.compute(unlucky,3,0);assert.equal(r.certification.deterministic,true);assert(r.modular.attempts.some(a=>a.verification==='rejected'));assert(r.modular.attempts.some(a=>a.shape==='discarded-mismatch'));assert.notEqual(r.certification.witnessPrime,101);}finally{await e.close();}
});
await test('Prime budget exhaustion is not Q certification; explicit baseline fallback',async()=>{
 const e=new ModularEngine({...base,modularPrimes:[101],modularMaxPrimes:1});try{await assert.rejects(e.compute(unlucky,3,0),x=>x.code==='MODULAR_UNCERTIFIED');}finally{await e.close();}
 const events=[];const g=new ModularEngine({...base,modularFallback:true,modularPrimes:[101],modularMaxPrimes:1,onEvent:v=>events.push(v)});try{const r=await g.compute(unlucky,3,0);assert.equal(r.arithmeticMode,'exact-fallback');assert(!r.certification);assert(events.some(v=>v.type==='degree'&&v.completedThroughDegree===3));}finally{await g.close();}
});
await test('Sequential prime checkpoints are reused across calls',async()=>{
 const e=new ModularEngine({...base,resume:'auto'});try{const r=await e.compute(f,5,0);assert(r.modular.attempts[0].resumedFromDegree>=4);}finally{await e.close();}
});
await test('Unbounded and explicitly selected finite field retain original engine',async()=>{
 for(const [degree,p] of [[null,0],[4,101]]){const e=new ModularEngine({...base});try{const r=await e.compute(f,degree,p);assert.equal(r.modulus,p);assert.notEqual(r.arithmeticMode,'modular-verified');}finally{await e.close();}}
});
await test('Invalid prime lists rejected and deadline cancellation does not certify',async()=>{
 const a=new ModularEngine({...base,modularPrimes:[101,101]});try{await assert.rejects(a.compute(f,5,0));}finally{await a.close();}
 const b=new ModularEngine({...base,timeoutMs:1});try{await assert.rejects(b.compute(f,5,0),x=>x.code==='CANCELLED');assert.equal(b.active,false);}finally{await b.close();}
});
fs.mkdirSync('results/0.5',{recursive:true});fs.writeFileSync('results/0.5/modular-tests.json',JSON.stringify({passed:true,environment:'Node OPFS adapter, not browser conformance',tests},null,2));fs.rmSync(root,{recursive:true,force:true});
