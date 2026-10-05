// Actual WASM and Node storage adapter, not browser conformance evidence.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/pref4/wasm');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const q2=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q2.json')),fk4=JSON.parse(fs.readFileSync('fixtures/pair-plan-fk4.json'));const rows=[],small=[],big=[];
const base={workers:4,budgetBytes:128*1048576,memoryPolicy:'auto',hashBits:16,spill:true,progress:false,exportText:false,quantumMs:1,lookahead:16,checkpointIntervalMs:30000,commitReduction:'delta',hilbert:true,resume:false};
for(const bits of [32,64])for(const execution of ['single','multicore']){
 const key=`q2-${bits}-${execution}`,e=new FomkyrEngine({...base,bits,execution,runKey:key});let r;try{r=await e.compute(q2,20,0);}finally{await e.close();}
 assert.equal(r.completedThroughDegree,20);assert.equal(r.commit.enabled,1);assert.ok(r.commit.eligible>0);assert.equal(r.commit.contractFallbacks,0);assert.equal(r.hilbert.coefficients[20],'7336');
 big.push({mode:{bits,execution},record:path.join(root,'fomkyr',key,'basis.gnb')});rows.push({name:key,passed:true,commit:r.commit,cooperative:r.cooperative});console.log(key,r.commit);
}
for(const [modulus,scheduler,order] of [[0,'barrier','overlap'],[2,'cooperative','sparse'],[101,'cooperative','overlap']]){
 const key=`f4-${modulus}`,e=new FomkyrEngine({...base,bits:32,runKey:key,scheduler,pairOrder:order,planMinDegree:2});let r;try{r=await e.compute(fk4,5,modulus);}finally{await e.close();}
 assert.equal(r.commit.contractFallbacks,0);rows.push({name:key,passed:true,commit:r.commit});small.push({name:key,fixture:fk4,modulus,degree:5,bits:r.bits,workers:r.workers,shared:r.shared,progressError:r.progressError,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});
}
// Interrupted legacy/full source, changed queue order and delta method on resume.
let e,cut,key='full-to-delta';e=new FomkyrEngine({...base,bits:32,runKey:key,scheduler:'barrier',batchPairs:16,commitReduction:'full',checkpointIntervalMs:0,onEvent:x=>{if(!cut&&x.type==='checkpoint'&&x.partial&&x.currentDegree===5&&x.retainedCommittedPairs>0&&x.pendingPairs>0){cut=x;e.cancel();}}});
let err;try{await e.compute(fk4,5,0);}catch(x){err=x;}const cp=e.lastCheckpoint;await e.close();assert.equal(err?.code,'CANCELLED');assert(cut&&cp.partial);
e=new FomkyrEngine({...base,bits:64,execution:'single',workers:1,runKey:key,resume:true,pairOrder:'sparse',planMinDegree:5});let r;try{r=await e.compute(fk4,5,0);}finally{await e.close();}
assert.equal(r.commit.contractFallbacks,0);small.push({name:key,fixture:fk4,modulus:0,degree:5,bits:r.bits,workers:r.workers,shared:r.shared,progressError:r.progressError,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});rows.push({name:key,passed:true,retainedCommitted:cp.retainedCommittedPairs,commit:r.commit});
// Opposite direction: active delta worker tasks are recomputed normally after restart.
key='delta-to-full';cut=null;e=new FomkyrEngine({...base,bits:32,runKey:key,checkpointIntervalMs:0,onEvent:x=>{if(!cut&&x.type==='checkpoint'&&x.partial&&x.currentDegree>=17&&x.retainedCommittedPairs>0&&x.pendingPairs>0){cut=x;e.cancel();}}});
err=null;try{await e.compute(q2,20,0);}catch(x){err=x;}await e.close();assert.equal(err?.code,'CANCELLED');assert(cut);
e=new FomkyrEngine({...base,bits:64,execution:'single',workers:1,runKey:key,resume:true,commitReduction:'full'});try{r=await e.compute(q2,20,0);}finally{await e.close();}assert.equal(r.commit.enabled,0);big.push({mode:{resume:'delta-to-full'},record:path.join(root,'fomkyr',key,'basis.gnb')});rows.push({name:key,passed:true,savedDegree:cut.currentDegree,commit:r.commit});
fs.writeFileSync(path.join(root,'small.json'),JSON.stringify(small));let p=spawnSync('python3',['tests/verify_physics_wasm.py',path.join(root,'small.json'),'results/pref4/wasm-independent.json'],{encoding:'utf8',timeout:120000});assert.equal(p.status,0,p.stdout+p.stderr);console.log(p.stdout);
fs.mkdirSync('results/0.6.7',{recursive:true});fs.writeFileSync(path.join(root,'big.json'),JSON.stringify(big));p=spawnSync('python3',['tests/check_cooperative_q2_067.py',path.join(root,'big.json')],{encoding:'utf8',timeout:120000});assert.equal(p.status,0,p.stdout+p.stderr);fs.copyFileSync('results/0.6.7/cooperative-q2-golden-audit.json','results/pref4/wasm-golden.json');
fs.writeFileSync('results/pref4/wasm.json',JSON.stringify({passed:true,actualWasmVariants:4,smallIndependentOutputs:small.length,highDegreeGoldenOutputs:big.length,rows},null,2));console.log('PREF4 WASM PASS',rows.length);
