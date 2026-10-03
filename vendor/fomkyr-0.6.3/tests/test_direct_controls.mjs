// Exact mode remains the normal George path even with an old saved modular choice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.localStorage={getItem:()=>JSON.stringify({arithmeticMode:'modular-verified',compiledRewrites:false,sharedCacheMiB:0,monomialPruning:false,workers:3}),setItem(){}};
const {readFomkyrOptions}=await import('../web/controls.js');
const options=readFomkyrOptions();
assert.equal(options.arithmeticMode,'exact');
assert.equal(options.compiledRewrites,false);
assert.equal(options.sharedReducerCacheBytes,0);
assert.equal(options.monomialPruning,false);
assert.equal(options.workers,3);
assert.equal(options.rewriteDegree,4);
assert.equal(options.rewriteSupport,8);
assert.equal(options.rewriteBudgetBytes,8*1048576);
const source=fs.readFileSync(new URL('../web/controls.js',import.meta.url),'utf8');
assert(!source.includes("choice('arithmeticMode'"));
fs.mkdirSync('results/0.6',{recursive:true});
fs.writeFileSync('results/0.6/direct-controls-tests.json',JSON.stringify({passed:true,checks:9,scope:'Saved-option migration and original tuning preservation; not a full browser DOM test'},null,2));
console.log('DIRECT CONTROLS PASS');
