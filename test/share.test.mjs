import test from 'node:test';
import assert from 'node:assert/strict';
import {createShareLink, readShareLink} from '../web/src/share.js';
import {BACKENDS} from '../web/src/backends.js';

test('share links reproduce every backend along with the computation settings', async () => {
  for (const backend of Object.keys(BACKENDS)) {
    const url = await createShareLink({backend, varsText: 'x,y', relsText: 'x^2,y^2', maxdeg: '7',
      memoryMiB: 3584, timeoutMinutes: 0.5, monomialPruning: true, language: 'ru', theme: 'dark'}, 'https://example.org/george/');
    const state = await readShareLink(new URL(url).hash);
    assert.equal(state.backend, backend); assert.equal(state.maxdeg, '7');
    assert.equal(state.memoryMiB, 3584); assert.equal(state.language, 'ru');
    assert.equal(state.timeoutMinutes,0.5);
    assert.equal(state.monomialPruning,true);
    assert.equal(state.theme, 'dark'); assert.equal(state.varsText, 'x,y');
  }
});
test('memory64 links preserve larger and uncapped allowances',async()=>{
 for(const memoryMiB of [0,4096,6144,8192,12000,12288,16077,16384]){
  const url=await createShareLink({backend:'memory64',memoryMiB},'https://example.org/george/');
  const state=await readShareLink(new URL(url).hash);
  assert.equal(state.memoryMiB,memoryMiB);assert.equal(state.backend,'memory64');
 }
 for(const memoryMiB of [0,8192])await assert.rejects(createShareLink({backend:'compiled',memoryMiB},'https://example.org/'),/share.invalid/);
 await assert.rejects(createShareLink({backend:'memory64',memoryMiB:16385},'https://example.org/'),/share.invalid/);
});
test('old links retain the original O2 backend and unknown backends are rejected', async () => {
  // An original version-1 uncompressed token with no changed fields.
  const state = await readShareLink('#s=1u' + btoa('["0"]').replace(/=+$/, ''));
  assert.equal(state.backend, 'standard');
  assert.equal(state.timeoutMinutes,0);
  assert.equal(state.monomialPruning,false);
  assert.equal(await readShareLink('#guide'), null);
  await assert.rejects(createShareLink({backend: '__proto__'}, 'https://example.org/'), /share.invalid/);
});
test('share links reject negative and nonfinite time limits', async () => {
 for(const timeoutMinutes of [-1,NaN,Infinity])await assert.rejects(createShareLink({timeoutMinutes},'https://example.org/'),/share.invalid/);
 await assert.rejects(createShareLink({monomialPruning:'true'},'https://example.org/'),/share.invalid/);
});
test('higher wasm32 allowances round-trip without changing old links',async()=>{
 for(const memoryMiB of [3584,3789,3994,4095]){
  const url=await createShareLink({memoryMiB},'https://example.org/george/');
  assert.equal((await readShareLink(new URL(url).hash)).memoryMiB,memoryMiB);
 }
 await assert.rejects(createShareLink({memoryMiB:4096},'https://example.org/george/'),/share.invalid/);
});
