import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {setup} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.5/frontier-wasm');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q3.json'));
const opts={workers:4,bits:32,budgetBytes:256*1048576,memoryPolicy:'auto',spill:true,hilbert:false,exportText:false,progress:false,batchPairs:8,checkpointIntervalMs:0,hashBits:16};
const reports=[];
for(const variant of [{bits:32,execution:'auto'},{bits:64,execution:'auto'},{bits:32,execution:'single'},{bits:64,execution:'single'}]){
 const key=`cursor-${variant.bits}-${variant.execution}`;let e,observed;
 e=new FomkyrEngine({...opts,...variant,runKey:key,resume:false,onEvent:m=>{
  if(m.type==='checkpoint'&&m.partial&&m.currentDegree>=12&&m.retainedCommittedPairs>0&&m.pendingPairs>0&&!observed){observed={...m};e.cancel();}
 }});
 let error;try{await e.compute(fixture,17,0);}catch(x){error=x;}const cp=e.lastCheckpoint;await e.close();
 assert.equal(error?.code,'CANCELLED');assert(observed);assert(cp.partial);assert(cp.retainedCommittedPairs>0);
 const r=new FomkyrEngine({...opts,bits:variant.bits===32?64:32,workers:2,runKey:key,resume:true,checkpointIntervalMs:30000});
 const got=await r.compute(fixture,17,0);await r.close();assert.equal(got.completedThroughDegree,17);
 const base=new FomkyrEngine({...opts,...variant,runKey:key+'-cold',resume:false,checkpointIntervalMs:30000});
 const ref=await base.compute(fixture,17,0);await base.close();
 const bytes=fs.readFileSync(path.join(root,'fomkyr',key,'basis.gnb'));
 assert.deepEqual(bytes,fs.readFileSync(path.join(root,'fomkyr',key+'-cold','basis.gnb')));
 reports.push({variant,observed,checkpoint:cp,completed:got.completedThroughDegree,byteEqual:true});console.log('FRONTIER PASS',variant,observed.currentDegree,observed.retainedCommittedPairs,observed.pendingPairs);
}
fs.writeFileSync('results/0.6.5/frontier-wasm.json',JSON.stringify({passed:true,cases:reports},null,2));
