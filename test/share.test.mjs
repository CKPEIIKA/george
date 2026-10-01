import test from 'node:test';
import assert from 'node:assert/strict';
import {createShareLink, readShareLink} from '../web/src/share.js';
import {BACKENDS} from '../web/src/backends.js';

test('share links reproduce every backend along with the computation settings', async () => {
  for (const backend of Object.keys(BACKENDS)) {
    const url = await createShareLink({backend, varsText: 'x,y', relsText: 'x^2,y^2', maxdeg: '7',
      memoryMiB: 3584, timeoutMinutes: 0.5, language: 'ru', theme: 'dark'}, 'https://example.org/george/');
    const state = await readShareLink(new URL(url).hash);
    assert.equal(state.backend, backend); assert.equal(state.maxdeg, '7');
    assert.equal(state.memoryMiB, 3584); assert.equal(state.language, 'ru');
    assert.equal(state.timeoutMinutes,0.5);
    assert.equal(state.theme, 'dark'); assert.equal(state.varsText, 'x,y');
  }
});
test('old links retain the original O2 backend and unknown backends are rejected', async () => {
  // An original version-1 uncompressed token with no changed fields.
  const state = await readShareLink('#s=1u' + btoa('["0"]').replace(/=+$/, ''));
  assert.equal(state.backend, 'standard');
  assert.equal(state.timeoutMinutes,0);
  assert.equal(await readShareLink('#guide'), null);
  await assert.rejects(createShareLink({backend: '__proto__'}, 'https://example.org/'), /share.invalid/);
});
test('share links reject negative and nonfinite time limits', async () => {
 for(const timeoutMinutes of [-1,NaN,Infinity])await assert.rejects(createShareLink({timeoutMinutes},'https://example.org/'),/share.invalid/);
});
