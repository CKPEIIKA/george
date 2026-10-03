// Actual shared/unshared WASM replay, closure, resume authority and exact output.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.6/wasm-closure');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const source=JSON.parse(fs.readFileSync('results/0.6.6/certificate-tests/wasm-cases.json'));let rows=[];
async function run(c,bits,execution,j,extra={}){
 const key=`case-${rows.length}-${bits}-${execution}`;
 const e=new FomkyrEngine({workers:j,bits,execution,spill:true,budgetBytes:128*1048576,memoryPolicy:'auto',hashBits:16,runKey:key,resume:false,exportText:true,progress:false,hilbertClosure:{[c.mode]:c.evidence},...extra});
 try{const r=await e.compute(c.fixture,c.degree,c.modulus);assert.equal(r.conditionalOnExternalDimensions,c.mode==='assume');assert.equal(r.hilbertEvidenceId,JSON.parse(fs.readFileSync(`results/0.6.6/certificate-tests/${c.name}.log`,'utf8').split('\nSTDERR')[0]).hilbertEvidenceId);
 rows.push({name:c.name,fixture:c.fixture,degree:c.degree,modulus:c.modulus,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError,closureEvents:r.hilbertClosureEvents});
 const out=fs.readFileSync(rows.at(-1).record);assert.deepEqual(out,fs.readFileSync(c.record));assert.match(fs.readFileSync(path.join(root,'fomkyr',key,'result.gb'),'utf8'),/Hilbert evidence/);
 await e.close();
 const plain=new FomkyrEngine({workers:1,bits,execution:'single',spill:true,budgetBytes:128*1048576,runKey:key,progress:false});try{await assert.rejects(()=>plain.compute(c.fixture,c.degree+1,c.modulus),/evidence|authority/i);}finally{await plain.close();}
 assert.deepEqual(fs.readFileSync(rows.at(-1).record),out);
 }finally{await e.close();}
}
for(const bits of [32,64])for(const execution of ['multicore','single'])await run(source[0],bits,execution,4);
for(const c of source.slice(1))await run(c,32,'multicore',4);
// The legacy small epoch scheduler also uses the same mathematically checked gate.
await run(source[0],32,'multicore',4,{batchPairs:0});
// Failed witnesses may not publish any completed degree.
const c=source[0],bad=structuredClone(c.evidence);bad.entries[0].vectors[0]=[];
const reject=new FomkyrEngine({workers:2,bits:32,budgetBytes:128*1048576,runKey:'tampered',progress:false,hilbertClosure:{certificate:bad}});
try{await assert.rejects(()=>reject.compute(c.fixture,c.degree,0));}finally{await reject.close();}
assert.equal(fs.readdirSync(path.join(root,'fomkyr','tampered')).filter(n=>n.startsWith('checkpoint-')).length,0);
// Certificate-free numbers cannot masquerade as a replayed lower bound.
const rank=new FomkyrEngine({workers:1,bits:32,budgetBytes:128*1048576,runKey:'wrong-direction',progress:false,hilbertClosure:{certificate:{...c.evidence,kind:'modular-relation-rank'}}});
try{await assert.rejects(()=>rank.compute(c.fixture,c.degree,0),/kind|schema/);}finally{await rank.close();}
// Saved certificate continuation across bitness/runtime is tested with actual native CLI.
const nativeJob=path.resolve('results/0.6.6/wasm-closure-native-job');fs.rmSync(nativeJob,{recursive:true,force:true});
const inp=path.join(root,'input.json'),ev=path.join(root,'proof.json');fs.writeFileSync(inp,JSON.stringify(c.fixture));fs.writeFileSync(ev,JSON.stringify(c.evidence));
let q=spawnSync('dist/fomkyr',['-i',inp,'-d','3','-j','2','--workdir',nativeJob,'--memory','128M','--hilbert-certificate',ev,'--quiet'],{encoding:'utf8'});assert.equal(q.status,0,q.stderr);const initial=JSON.parse(q.stdout);
q=spawnSync('dist/fomkyr',['--wasm','--resume',nativeJob,'-d','5','-j','4','--memory','128M','--hilbert-certificate',ev,'--quiet'],{encoding:'utf8'});assert.equal(q.status,0,q.stderr);const next=JSON.parse(q.stdout);
assert.equal(next.resumedFromDegree,3);assert.equal(next.hilbertEvidenceId,initial.hilbertEvidenceId);
q=spawnSync('dist/fomkyr',['--resume',nativeJob,'-d','7','-j','1','--memory','128M','--hilbert-certificate',ev,'--quiet'],{encoding:'utf8'});assert.equal(q.status,0,q.stderr);assert.equal(JSON.parse(q.stdout).resumedFromDegree,5);
fs.writeFileSync(path.join(root,'matrix.json'),JSON.stringify(rows));
q=spawnSync('python3',['tests/verify_physics_wasm.py',path.join(root,'matrix.json'),path.join(root,'independent-audits.json')],{encoding:'utf8',timeout:180000});assert.equal(q.status,0,q.stdout+q.stderr);
console.log(q.stdout);fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify({passed:true,actualVariants:4,independentlyVerifiedOutputs:rows.length,certificateTamperRejected:true,wrongDirectionRejected:true,missingAuthorityResumeRejected:true,nativeWasmNativeContinuation:true,rows},null,2));
console.log('WASM HILBERT CLOSURE PASS');
