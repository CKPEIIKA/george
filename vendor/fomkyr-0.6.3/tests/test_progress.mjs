import assert from 'node:assert/strict';import fs from 'node:fs';import {ProgressTracker} from '../web/progress.js';
let now=0;const p=new ProgressTracker({target:20,now:()=>now});
const raw=(n,total=100n)=>({total,seen:n,scheduled:n,committed:n,monomialSkipped:0n,chainSkipped:0n,replay:0,totalKnown:true,reductions:n*1000n,maxTerms:77n,activeLanes:1});
p.begin(9,8);let x=p.sample(raw(800n,1000n));assert.equal(x.overlaps.total,null);assert.equal(x.overlaps.resolved,'0');assert.equal(x.completedThroughDegree,8);
p.setPhase('indexing');x=p.sample(raw(800n,1000n));assert.equal(x.overlaps.total,null);
p.setPhase('reducing');p.sample(raw(0n));
for(let i=1;i<=5;i++){now=i*1000;x=p.sample(raw(BigInt(10*i)));}
assert.equal(x.overlaps.fraction,.5);assert.ok(x.eta.currentDegreeSeconds);assert.equal(x.forecast.targetSeconds,null);
now+=10000;x=p.sample({...raw(50n),reductions:1000000n});assert.equal(x.eta.currentDegreeSeconds,null);assert.match(x.eta.reason,/long unresolved/);assert.equal(x.activity.activeLanes,1);
x=p.sample({...raw(0n),replay:1});assert.equal(x.overlaps.replay,1);assert.equal(x.overlaps.resolved,'0');assert.equal(x.eta.currentDegreeSeconds,null);
p.begin(10,9);p.setPhase('reducing');x=p.sample(raw(10n**24n,2n*10n**24n));assert.equal(x.overlaps.resolved,'1000000000000000000000000');assert.equal(x.overlaps.fraction,.5);
const q=new ProgressTracker({target:5,now:()=>now});for(let d=1;d<=3;d++){q.begin(d,d-1);now+=1000*2**d;q.finish(d,{total:20n,scheduled:20n});}
assert.ok(q.forecast().conditionalNextDegrees);assert.equal(q.forecast().targetSeconds,null);q.target=20;assert.equal(q.forecast().conditionalNextDegrees,undefined);q.target=null;assert.equal(q.forecast().targetSeconds,null);
const h=new ProgressTracker({target:4,now:()=>now});
for(let d=1;d<=3;d++){h.begin(d,d-1);now+=1000*2**d;h.finish(d,{total:20n,scheduled:20n});}
h.begin(4,3);h.setPhase('reducing');h.sample(raw(0n));now+=100000;
x=h.sample(raw(10n));assert.equal(x.forecast.conditionalNextDegrees,undefined);assert.match(x.forecast.reason,/withdrawn/);
assert.equal(h.forecastForSample({reason:'Observed overlap costs are too heterogeneous'},now).conditionalNextDegrees,undefined);
fs.writeFileSync(new URL('../results/progress-unit-tests.json',import.meta.url),JSON.stringify({passed:true,checks:['previous-degree counters hidden during input/indexing','exact count fraction not time fraction','ETA warmup','stall withdraws ETA while reductions remain active','replay resets ETA','BigInt counters beyond 2^53','no far-future or unconditional total ETA']},null,2));console.log('Progress model tests passed');
