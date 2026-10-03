import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {setup} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';
import {stats} from '../web/runtime.js';
const root=path.resolve('results/0.6.4/cancel-storage');fs.mkdirSync(root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q3.json'));
class PressureEngine extends FomkyrEngine {
  async open(){await super.open();this.scratch=4*1048576;this.memoryPlan.rowReserveBytes=0;return this;}
}
let observed=false;const events=[];let e;
e=new PressureEngine({workers:4,bits:32,memoryPolicy:'auto',budgetBytes:128*1048576,
  spill:true,resume:false,runKey:'cancel-after-repack',timeoutMs:30000,hilbert:false,exportText:false,
  progress:false,onEvent:event=>{if(event.type==='memory-adaptation'){observed=true;events.push(event);e.cancel();}}});
let error;
try {await e.compute(fixture,18,0);}catch(x){error=x;}
const s=stats(e.e);
assert(observed,'must observe real automatic capacity recovery before cancellation');
assert.equal(error?.code,'CANCELLED');
assert.equal(s.reserveLeased,false);assert.equal(e.e.gn_memory_stat(5),0n);
assert(s.completedThroughDegree<18);
const cp=e.lastCheckpoint;
await e.close();
// Recover from the completed-degree boundary using the normal automatic plan;
// the incomplete suffix must never be presented as a completed checkpoint.
const r=new FomkyrEngine({workers:2,bits:32,memoryPolicy:'auto',budgetBytes:128*1048576,
 spill:true,resume:true,runKey:'cancel-after-repack',hilbert:true,exportText:false,progress:false,timeoutMs:30000});
const result=await r.compute(fixture,17,0);await r.close();
assert.equal(result.resumedFromDegree,cp.completedThroughDegree);assert.equal(result.completedThroughDegree,17);
fs.writeFileSync('results/0.6.4/auto-cancellation.json',JSON.stringify({passed:true,
 injection:'4 MiB aggregate scratch and no reserve to force capacity handling',
 observedAdaptations:events,code:error.code,lastCheckpointDegree:cp.completedThroughDegree,
 reserveReleased:!s.reserveLeased,readersDrained:true,resumedFromDegree:result.resumedFromDegree,
 completedThroughDegree:result.completedThroughDegree,record:path.join(root,'fomkyr','cancel-after-repack','basis.gnb')},null,2));
console.log('CAPACITY-CANCELLATION-RESUME PASS');
