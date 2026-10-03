import assert from 'node:assert/strict';
// Preserve unrelated saved user preferences on upgrade. New controls default on;
// the reserve budget remains automatic until the user requests an explicit size.
globalThis.localStorage={getItem:()=>JSON.stringify({workers:3,scratchMiB:2048,rowReserveMiB:512,radixHeap:false,reserveInPlace:false,monomialPruning:false}),setItem(){}};
const {readFomkyrOptions}=await import('../web/controls.js');const o=readFomkyrOptions();
assert.equal(o.workers,3);assert.equal(o.scratchBytes,2147483648);assert.equal(o.rowReserveBytes,536870912);
assert.equal(o.radixHeap,false);assert.equal(o.reserveInPlace,false);assert.equal(o.monomialPruning,false);
assert.equal(o.arithmeticMode,'exact');assert.equal(o.rewriteDegree,4);console.log('0.6.3 CONTROL ROUNDTRIP PASS');
