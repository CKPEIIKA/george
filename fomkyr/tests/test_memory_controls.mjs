import assert from 'node:assert/strict';
// Upgrade keeps settings stored but auto mode no longer lets an old tiny scratch
// silently defeat a newly increased global ceiling.
globalThis.localStorage={getItem:()=>JSON.stringify({scratchMiB:16,rowReserveMiB:0,workers:4,radixHeap:false,monomialPruning:false}),setItem(){}};
const {readFomkyrOptions}=await import('../web/controls.js');const o=readFomkyrOptions();
assert.equal(o.memoryPolicy,'auto');assert.equal(o.scratchBytes,undefined);assert.equal(o.rowReserveBytes,undefined);
assert.equal(o.workers,4);assert.equal(o.radixHeap,false);assert.equal(o.monomialPruning,false);console.log('AUTOMATIC MEMORY CONTROLS PASS');
