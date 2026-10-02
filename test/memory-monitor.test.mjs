import test from 'node:test';
import assert from 'node:assert/strict';
import {observeWasmMemory,formatMemorySize} from '../web/src/memory-monitor.js';
import {EclEngine} from '../web/src/engine.js';

test('memory view updates report growth without replacing the runtime heap',()=>{
  const updates=[],module=observeWasmMemory({other:1},bytes=>updates.push(bytes));
  const first=new Uint8Array(64),second=new Uint8Array(128);
  module.HEAPU8=first;assert.equal(module.HEAPU8,first);
  module.HEAPU8=first;module.HEAPU8=second;
  assert.equal(module.HEAPU8,second);assert.deepEqual(updates,[64,128]);assert.equal(module.other,1);
});

test('memory display uses exact binary units with EN/RU formatting',()=>{
  assert.deepEqual(formatMemorySize(128*1048576),{amount:'128',unit:'MiB'});
  assert.deepEqual(formatMemorySize(4.21875*1073741824),{amount:'4.22',unit:'GiB'});
  assert.deepEqual(formatMemorySize(4.21875*1073741824,'ru'),{amount:'4,22',unit:'GiB'});
  assert.equal(formatMemorySize(undefined),null);assert.equal(formatMemorySize(-1),null);
});

test('memory events stream while a computation is still pending',async()=>{
  const original=globalThis.Worker,updates=[];
  class Stub {
    postMessage(m) {this.last=m;if(m.command==='init')queueMicrotask(()=>this.onmessage({data:{id:m.id,result:{ready:true}}}));}
    terminate() {}
  }
  globalThis.Worker=Stub;
  const engine=new EclEngine({onMemory:bytes=>updates.push(bytes)});
  try {
    const pending=engine.run({});await new Promise(r=>setTimeout(r,0));
    const worker=engine.worker,id=worker.last.id;
    worker.onmessage({data:{id,event:{type:'memory',bytes:67108864}}});
    worker.onmessage({data:{id,event:{type:'memory',bytes:134217728}}});
    assert.deepEqual(updates,[67108864,134217728]);assert.equal(engine.busy,true);
    worker.onmessage({data:{id,result:{files:{}}}});await pending;
  }finally{engine.cancel();globalThis.Worker=original;}
});
