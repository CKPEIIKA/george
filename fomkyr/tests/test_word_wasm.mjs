import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/pref4.2/wasm-word');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const f=JSON.parse(fs.readFileSync('fixtures/pair-plan-fk4.json')),reports=[],outputs=[];
const common={workers:4,budgetBytes:128*1048576,memoryPolicy:'auto',spill:true,progress:false,exportText:false,hilbert:true,hashBits:16,quantumMs:1,lookahead:16,batchPairs:16,checkpointIntervalMs:0};
for(const [bits,execution]of [[32,'multicore'],[32,'single'],[64,'multicore'],[64,'single']]){
 const key=`adopt-${bits}-${execution}`;let e,cut;
 e=new FomkyrEngine({...common,bits,execution,runKey:key,resume:false,scheduler:'barrier',pairOrder:'legacy',onEvent:x=>{if(!cut&&x.type==='checkpoint'&&x.partial&&x.currentDegree===5&&x.retainedCommittedPairs>0&&x.pendingPairs>0){cut=x;e.cancel();}}});
 let error;try{await e.compute(f,5,0);}catch(x){error=x;}const old=e.lastCheckpoint;await e.close();assert.equal(error?.code,'CANCELLED');assert(cut&&old.partial);assert.equal(Buffer.from(old.frontier,'hex').readBigUInt64LE(8),1n);
 let adopted;const next=new FomkyrEngine({...common,bits:bits===32?64:32,execution,workers:2,runKey:key,resume:true,pairOrder:'word',planMinDegree:5,checkpointIntervalMs:0,onEvent:x=>{if(x.type==='pair-plan-adopted')adopted=x;}});
 let r;try{r=await next.compute(f,5,0);}finally{await next.close();}
 assert(adopted);assert.equal(adopted.retainedCommittedPairs,old.retainedCommittedPairs);assert.equal(r.completedThroughDegree,5);assert.equal(r.pairPlan.order,3);assert.equal(r.pairPlan.adoptions,1);
 reports.push({bits,execution,passed:true,savedCommitted:old.retainedCommittedPairs,savedPending:old.pendingPairs,adopted,completed:5});
 outputs.push({name:key,fixture:f,degree:5,modulus:0,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});
 console.log('VARIANT',bits,execution,'PASS');
}
for(const field of [2,101])for(const pairOrder of ['word']){
 const key=`field-${field}-${pairOrder}`,e=new FomkyrEngine({...common,bits:32,runKey:key,resume:false,pairOrder,planMinDegree:3,checkpointIntervalMs:30000});let r;try{r=await e.compute(f,5,field);}finally{await e.close();}assert.equal(r.completedThroughDegree,5);
 outputs.push({name:key,fixture:f,degree:5,modulus:field,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});reports.push({test:key,passed:true,order:pairOrder,field});
}
const key='budget-refusal',e=new FomkyrEngine({...common,bits:32,runKey:key,resume:false,pairOrder:'word',planMinDegree:3,pairPlanBytes:1,checkpointIntervalMs:30000});let r;try{r=await e.compute(f,5,0);}finally{await e.close();}assert.equal(r.pairPlan.allocatedBytes,0);assert(r.pairPlan.declines>0);
outputs.push({name:key,fixture:f,degree:5,modulus:0,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients});reports.push({test:key,passed:true});
fs.writeFileSync(path.join(root,'audit-input.json'),JSON.stringify(outputs));const checked=spawnSync('python3',['tests/verify_physics_wasm.py',path.join(root,'audit-input.json'),'results/pref4.2/word-wasm-oracle.json'],{encoding:'utf8',timeout:180000});assert.equal(checked.status,0,checked.stdout+checked.stderr);
fs.writeFileSync('results/pref4.2/word-wasm.json',JSON.stringify({passed:true,scope:'Four actual WASM variants with Node filesystem OPFS adapter, no browser claim',reports,independentlyCheckedOutputs:outputs.length},null,2));console.log('PAIR PLAN WASM PASS');
