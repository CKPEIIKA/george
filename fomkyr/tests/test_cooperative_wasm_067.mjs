// Actual WASM modules, with Node filesystem OPFS adapter. No browser claim.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.7/cooperative-wasm');fs.rmSync(root,{force:true,recursive:true});fs.mkdirSync(root,{recursive:true});setup(root);
const q2=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q2.json'));const report=[];
const base={timeoutMs:120000,budgetBytes:256*1048576,workers:4,spill:true,hilbert:true,exportText:false,progress:true,progressIntervalMs:1000,hashBits:16,quantumMs:1,lookahead:64,ioMode:'broker',resume:false};
for(const [bits,execution] of [[32,'multicore'],[64,'multicore'],[32,'single'],[64,'single']]){
 const key=`q2-${bits}-${execution}`;const e=new FomkyrEngine({...base,bits,execution,runKey:key});let r;
 try{r=await e.compute(q2,20,0);}finally{await e.close();}
 assert.equal(r.completedThroughDegree,20);assert.equal(r.hilbert.coefficients[20],'7336');
 assert(r.cooperative.lanes.some(x=>x.yields>0),'must actually suspend a live row');assert.equal(r.cooperative.capacityReplayPairs,0);
 const record=path.join(root,'fomkyr',key,'basis.gnb');report.push({mode:{bits,execution},record,result:r});console.log('YIELD PASS',bits,execution,r.cooperative);
}
// A writer stops only after observed yields and a nonempty committed/pending frontier.
let e,observed;const key='cancel-resume';e=new FomkyrEngine({...base,bits:32,execution:'multicore',runKey:key,checkpointIntervalMs:0,onEvent:m=>{
 if(m.type==='checkpoint'&&m.partial&&m.currentDegree>=17&&m.retainedCommittedPairs>0&&m.pendingPairs>0&&!observed&&e.cooperativeStats().lanes.some(l=>l.yields>0)) {observed=m;e.cancel();}
}});
let error;try{await e.compute(q2,20,0);}catch(x){error=x;}const cp=e.lastCheckpoint;await e.close();assert.equal(error?.code,'CANCELLED');assert(observed&&cp.partial);
const rengine=new FomkyrEngine({...base,bits:64,execution:'single',runKey:key,resume:true,quantumMs:5});const r=await rengine.compute(q2,20,0);await rengine.close();assert.equal(r.completedThroughDegree,20);
report.push({mode:{cancelResume:true},observed,checkpoint:cp,record:path.join(root,'fomkyr',key,'basis.gnb'),result:r});
const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(report,null,2));
const audit=spawnSync('python3',['tests/check_cooperative_q2_067.py',manifest],{encoding:'utf8',timeout:120000});assert.equal(audit.status,0,audit.stdout+audit.stderr);console.log(audit.stdout);
fs.writeFileSync('results/0.6.7/cooperative-wasm.json',JSON.stringify({passed:true,cases:report},null,2));
