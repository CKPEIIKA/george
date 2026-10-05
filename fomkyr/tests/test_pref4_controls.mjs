import fs from 'node:fs';import assert from 'node:assert/strict';
let saved={};globalThis.localStorage={getItem:()=>JSON.stringify(saved),setItem(){}};
let m=await import('../web/controls.js?pref4=0');assert.equal(m.readFomkyrOptions().commitReduction,'full');
saved={commitReduction:'delta',pairOrder:'sparse',workers:6,memoryPolicy:'manual',scratchMiB:12228,rowReserveMiB:2560,largeRowWorkspaces:4,monomialPruning:false};m=await import('../web/controls.js?pref4=1');let r=m.readFomkyrOptions();assert.equal(r.commitReduction,'delta');assert.equal(r.workers,6);assert.equal(r.pairOrder,'sparse');assert.equal(r.scratchBytes,12228*1048576);assert.equal(r.rowReserveBytes,2560*1048576);assert.equal(r.largeRowWorkspaces,4);assert.equal(r.monomialPruning,false);
fs.writeFileSync('results/pref4/control-options.json',JSON.stringify({passed:true,fullDefault:true,deltaSelectable:true,existingWorkerPlannerMemoryPruningOptionsRetained:true},null,2));console.log('PREF4 CONTROLS PASS');
