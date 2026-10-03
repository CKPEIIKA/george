// Actual new rational-rewrite execution in all four builds, independent Python checking.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {parseNativeJob} from '../web/job-adapter.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-061-rational-'));setup(root);
const {fixture}=parseNativeJob({task:'gb',script:'(NONCOMMIFY)\n(DEGLEFTLEXIFY)\n(SETMODULUS 0)\n(SETMAXDEG 6)\n(SIMPLE "input.bg" "result.gb")',files:{'input.bg':'(ALGFORMINPUT)\nvars t,b,a;\na*b-b*a-t*t,a*t-t*a,b*t-t*b,2*a^4+3*b^4;'}});
fixture.name='homogeneous-oscillator-quartic-quotient-arithmetic-test';const rows=[];
try{
 const modes=[];for(const bits of [32,64])for(const execution of ['single','multicore'])modes.push({bits,execution});
 modes.push({rationalRewrites:false},{compiledRewrites:false},{rewriteBudgetBytes:0},{monomialPruning:false},{modulus:2},{modulus:5});
 for(const o of modes){
  const key='case-'+rows.length,e=new FomkyrEngine({bits:32,execution:'multicore',workers:4,ioMode:'broker',spill:true,runKey:key,resume:false,heapThreshold:1,budgetBytes:128*1048576,scratchBytes:16*1048576,...o});let r;
  try{r=await e.compute(fixture,6,o.modulus??0);}finally{await e.close();}
  if(!o.modulus&&o.rationalRewrites!==false&&o.compiledRewrites!==false&&o.rewriteBudgetBytes!==0)assert.ok(r.rationalCompiledRewriteHits>0,'new rational macro tier not exercised');
  assert.equal(r.modulus,o.modulus??0);if(o.modulus)assert.equal(r.rationalCompiledRewriteHits,0);
  rows.push({name:key,fixture,degree:6,modulus:o.modulus??0,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients,bits:r.bits,shared:r.shared,workers:r.workers,progressError:r.progressError,rationalMacroHits:r.rationalCompiledRewriteHits});
 }
 const file=path.join(root,'manifest.json');fs.writeFileSync(file,JSON.stringify(rows));
 const check=spawnSync('python3',['tests/verify_physics_wasm.py',file,'results/0.6.1/deep-polish-wasm-oracle.json'],{encoding:'utf8',timeout:120000});
 assert.equal(check.status,0,check.stdout+check.stderr);
 fs.writeFileSync('results/0.6.1/deep-polish-wasm.json',JSON.stringify({passed:true,reports:rows.map(({fixture,record,...r})=>r)},null,2));
 console.log(JSON.stringify({passed:true,cases:rows.length}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
