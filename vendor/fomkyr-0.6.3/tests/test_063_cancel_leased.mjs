// Observe the atomic lease flag before cancelling: a never-used reserve would
// make a simple unlocked-after-cancellation assertion vacuous.
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {stats} from '../web/runtime.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr063-cancel-'));setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/fk6.json'));const reports=[];
try{
 for(const [bits,execution,workers] of [[32,'multicore',4],[64,'single',1]]){
  let observed=false,e;
  e=new FomkyrEngine({bits,execution,workers,budgetBytes:128<<20,scratchBytes:workers<<20,rowReserveBytes:32<<20,spill:true,resume:false,runKey:`cancel-${bits}`,progress:true,progressIntervalMs:250,hilbert:false,exportText:false,timeoutMs:15000,onEvent(ev){
   if(!observed&&ev.type==='progress'&&e.e&&e.e.gn_reserve_stat(0,9)!==0n){observed=true;e.cancel();}
  }});
  let error;const t0=performance.now();try{await e.compute(fixture,11,0);}catch(x){error=x;}
  const s=stats(e.e);assert.equal(error?.code,'CANCELLED');assert.equal(observed,true,'cancellation was not triggered during an acquired lease');
  assert.equal(s.reserveLeased,false,'lease survived cancellation');assert.ok(s.reservePromotions>0,'the in-place promotion cancellation path was not exercised');
  assert.ok(e.lastCheckpoint.completedThroughDegree<11);
  reports.push({bits,execution,workers,passed:true,observedLeasedBeforeCancel:observed,leaseReleased:true,promotions:s.reservePromotions,completedThroughDegree:e.lastCheckpoint.completedThroughDegree,elapsedMs:performance.now()-t0});await e.close();
 }
 fs.writeFileSync('results/0.6.3/cancel-leased.json',JSON.stringify({passed:true,reports},null,2));console.log(JSON.stringify({passed:true,reports}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
