import assert from 'node:assert/strict';
let settings={};globalThis.localStorage={getItem:()=>JSON.stringify(settings),setItem(){}};
let m=await import('../web/controls.js?wordtest=0');let o=m.readFomkyrOptions();assert.equal(o.pairOrder,'legacy');assert.equal(o.commitReduction,'full');
settings={pairOrder:'word',planMinDegree:15,pairPlanMiB:32,workers:6,largeRowWorkspaces:4,monomialPruning:false,memoryPolicy:'auto',scratchMiB:123};
m=await import('../web/controls.js?wordtest=1');o=m.readFomkyrOptions();assert.equal(o.pairOrder,'word');assert.equal(o.planMinDegree,15);assert.equal(o.pairPlanBytes,32*1048576);assert.equal(o.workers,6);assert.equal(o.largeRowWorkspaces,4);assert.equal(o.monomialPruning,false);assert.equal(o.scratchBytes,undefined);console.log('WORD CONTROLS PASS');
