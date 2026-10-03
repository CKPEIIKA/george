import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {setup} from './node-host.mjs';import {NativeEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'george-wasm-'));setup(root);
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url)));const reports=[];
for(const [bits,workers,spill] of [[32,1,false],[32,4,true],[64,3,true]]){
  const e=new NativeEngine({bits,workers,spill,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,runKey:`wasm${bits}-${workers}`,onEvent:x=>{if(x.type==='degree')console.log('degree',bits,workers,x.completedThroughDegree,x.basisSize);}});
  try {
    const r=await e.compute(fixture,7,0);assert.equal(r.basisSize,695);assert.equal(r.completedThroughDegree,7);assert.ok(r.complete);
    // Record counts agree, but batched insertion can change polynomial tails.
    assert.ok(r.preview.includes('% 7'));assert.ok(r.preview.endsWith('Done\n')||r.previewTruncated);
    delete r.preview;reports.push({test:'actual-WASM-shared-workers',host:'Node22; OPFS emulated by node:fs',...r});console.log(JSON.stringify(reports.at(-1)));
  } finally {await e.close();}
}
// Internal arbitrary precision is exercised in actual WASM, not just the native ABI.
const big=JSON.parse(fs.readFileSync(new URL('../fixtures/big-coefficients.json',import.meta.url)));
for(const bits of [32,64]) {
  const e=new NativeEngine({bits,workers:2,spill:true,budgetBytes:64*1048576,scratchBytes:16*1048576,runKey:`big-${bits}`});
  try {
    const r=await e.compute(big,5,0);
    const coefficients=[...r.preview.matchAll(/(?:^|[+\-\n,])(\d+)\*/g)].map(m=>BigInt(m[1]));
    assert.ok(coefficients.some(c=>c.toString(2).length===155));
    reports.push({test:'WASM-arbitrary-precision-155-bits',bits,passed:true});
  } finally {await e.close();}
}
// Real shared-memory cancellation (no termination / no kernel trap).
const e=new NativeEngine({bits:32,workers:4,spill:true,budgetBytes:128*1048576,scratchBytes:32*1048576,runKey:'cancel-resume',onEvent:x=>{if(x.type==='degree'&&x.completedThroughDegree===4)e.cancel();}});
try{await e.compute(fixture,7);assert.fail('must cancel');}catch(error){assert.equal(error.code,'CANCELLED');assert.equal(error.native.completedThroughDegree,4);reports.push({test:'wasm-cancel',passed:true,checkpoint:4});}finally{await e.close();}
const rengine=new NativeEngine({bits:64,workers:2,spill:true,resume:true,budgetBytes:128*1048576,scratchBytes:32*1048576,runKey:'cancel-resume'});
try{const r=await rengine.compute(fixture,7);assert.equal(r.completedThroughDegree,7);assert.equal(r.basisSize,695);reports.push({test:'cross-ABI-resume',passed:true});}finally{await rengine.close();}
fs.writeFileSync(new URL('../results/wasm-tests.json',import.meta.url),JSON.stringify(reports,null,2));fs.rmSync(root,{recursive:true,force:true});
