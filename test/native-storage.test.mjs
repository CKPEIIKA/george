import test from 'node:test';
import assert from 'node:assert/strict';
import {openBasisHandle,acquireRunLock} from '../web/engine/native/storage.js';
import {NativeEngine} from '../web/engine/native/engine.js';
import {setLanguage,t,translateMessage} from '../web/src/i18n.js';

test('shared file access is proved by opening two handles, closing only the probe',async()=>{
  const handles=[];
  const file={async createSyncAccessHandle(){const h={close(){this.closed=true;}};handles.push(h);return h;}};
  const r=await openBasisHandle(file);assert.equal(r.shared,true);assert.equal(handles[0].closed,undefined);assert.equal(handles[1].closed,true);
  r.handle.close();
});
test('ignored or rejected OPFS mode selects exclusive access without discarding data',async()=>{
  for(const rejected of [false,true]) {
    let active=false;
    const file={async createSyncAccessHandle(options){
      if(rejected&&options)throw new TypeError('unsupported mode');
      if(active)throw new DOMException('No modification allowed.','NoModificationAllowedError');
      active=true;return {close(){active=false;}};
    }};
    const r=await openBasisHandle(file);assert.equal(r.shared,false);assert.equal(active,true);
    r.handle.close();assert.equal(active,false);
  }
});
test('unrelated storage failures close the acquired handle and propagate',async()=>{
  let calls=0,closed=false;
  const file={async createSyncAccessHandle(){if(calls++)throw new DOMException('quota','QuotaExceededError');return {close(){closed=true;}};}};
  await assert.rejects(openBasisHandle(file),{name:'QuotaExceededError'});assert.equal(closed,true);
});
test('an existing run lock gets a clear error rather than a destructive reset',async()=>{
  await assert.rejects(acquireRunLock({async getFileHandle(){return {async createSyncAccessHandle(){throw new DOMException('locked','NoModificationAllowedError');}};}}),e=>e.code==='RUN_LOCKED'&&/already open/.test(e.message));
});
test('exclusive reductions restore the coordinator stack, even after an error',()=>{
  const engine=new NativeEngine();engine.localReduction=true;engine.bits=32;
  engine.e={__stack_pointer:{value:120},gn_stack_top:()=>240,gn_reduce_pair:()=>{assert.equal(engine.e.__stack_pointer.value,240);return 0;}};
  assert.equal(engine.reduce(0),0);assert.equal(engine.e.__stack_pointer.value,120);
  engine.e.gn_reduce_pair=()=>{throw Error('cancelled');};assert.throws(()=>engine.reduce(0),/cancelled/);assert.equal(engine.e.__stack_pointer.value,120);
});
test('status messages identify Native NC and localize run-lock errors',()=>{
  for(const language of ['en','ru']) {
    setLanguage(language);assert.ok(t('status.error',{engine:'Native NC',msg:'test'}).startsWith('Native NC'));
    assert.ok(t('engine.ready',{engine:'Native NC',version:'test'}).startsWith('Native NC'));
  }
  assert.match(translateMessage('This input is already open in another George computation. Stop or close that run, then retry.'),/другом вычислении/);
  setLanguage('en');
});
