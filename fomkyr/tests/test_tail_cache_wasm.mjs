// SPDX-License-Identifier: MIT
// Real Wasm modules; Node supplies a test filesystem, not a browser claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {setup} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';
import {hostFor} from '../web/runtime.js';

const [root,fixtureFile,manifestFile]=process.argv.slice(2);
assert.ok(root&&fixtureFile&&manifestFile);
fs.mkdirSync(root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync(fixtureFile));
const cases=[];
const base={timeoutMs:120000,budgetBytes:256*1048576,workers:2,
  resume:false,exportText:false,hilbert:false,progress:false,quantumMs:1,
  reducerTailCacheBytes:64*1048576,pairOrder:'word',planMinDegree:2};
for(const bits of [32,64])for(const execution of ['single','multicore']){
  const shared=execution==='multicore';
  const privateFile=path.join(root,`properties-${bits}-${execution}.wasm`);
  execFileSync(process.env.CLANG??'clang',[
    `--target=wasm${bits}`,'-std=c11','-O3','-flto','-ffreestanding','-fno-builtin',
    '-fvisibility=hidden','-mbulk-memory',
    ...(shared?['-matomics','-Wl,--shared-memory']:['-DGN_SINGLE']),'-nostdlib',
    'tests/test_tail_cache.c','-o',privateFile,
    '-Wl,--no-entry,--import-memory,--export-dynamic,--initial-memory=2097152,--max-memory=268435456,-z,stack-size=131072,--lto-O3'
  ],{timeout:120000,stdio:'pipe'});
  const pages=bits===64?4096n:4096,initial=bits===64?32n:32;
  const memory=new WebAssembly.Memory({initial,maximum:pages,shared,...(bits===64?{address:'i64'}:{})});
  const {instance}=await WebAssembly.instantiate(fs.readFileSync(privateFile),hostFor(memory,bits,256*1048576).imports);
  for(const [name,args] of [['test_tail_cache_budget',[]],['test_pair_replay_fallback',[]],
    ['test_tail_cache_generation',[0]],['test_tail_cache_generation',[1]]])
    assert.equal(instance.exports[name](...args),0,`${bits}/${execution}/${name}/${args}`);
  for(const prime of [0,2,101]){
    const key=`cache-${bits}-${execution}-${prime}`;
    const e=new FomkyrEngine({...base,bits,execution,runKey:key});
    let result;try{result=await e.compute(fixture,6,prime);}finally{await e.close();}
    assert.equal(result.completedThroughDegree,6);
    assert.ok(result.reducerTailCache.built>0&&result.reducerTailCache.hits>0);
    cases.push({bits,execution,prime,record:path.join(root,'fomkyr',key,'basis.gnb'),passed:true});
  }
}
// Stop at a saved pending frontier, then change runtime and disable the cache.
const key='cache-switch-resume';let writer,observed,error;
writer=new FomkyrEngine({...base,bits:32,execution:'multicore',runKey:key,
  checkpointIntervalMs:0,onEvent:event=>{
    if(event.type==='checkpoint'&&event.partial&&event.currentDegree>=3&&event.pendingPairs>0&&!observed){observed=event;writer.cancel();}
  }});
try{await writer.compute(fixture,6,0);}catch(e){error=e;}finally{await writer.close();}
assert.ok(observed);assert.equal(error?.code,'CANCELLED');
const reader=new FomkyrEngine({...base,bits:64,execution:'single',runKey:key,
  resume:true,reducerTailCacheBytes:0});
let result;try{result=await reader.compute(fixture,6,0);}finally{await reader.close();}
assert.equal(result.completedThroughDegree,6);assert.equal(result.reducerTailCache.enabled,false);
cases.push({bits:64,execution:'single',prime:0,partialResume:true,
  record:path.join(root,'fomkyr',key,'basis.gnb'),passed:true});
fs.writeFileSync(manifestFile,JSON.stringify({passed:true,cases},null,2));
console.log('WASM CACHE PASS',cases.length);
