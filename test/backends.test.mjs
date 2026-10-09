import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BACKENDS, BERGMAN_BACKENDS, DEFAULT_BACKEND, getBackend, validMemoryMiB, defaultMemoryMiB, preferredBackend} from '../web/src/backends.js';
import {wasmMemories} from '../tools/wasm-memory.mjs';
import {publicationAssets} from '../tools/publication-assets.mjs';

test('published backend labels match compiler settings and asset hashes', () => {
  assert.equal(DEFAULT_BACKEND, 'memory64');
  let dataHash;
  for (const [id, backend] of Object.entries(BERGMAN_BACKENDS)) {
    const directory = new URL(backend.directory, new URL('../web/src/backends.js', import.meta.url));
    const manifest = JSON.parse(fs.readFileSync(new URL('build.json', directory)));
    assert.equal(manifest.backend, id); assert.equal(manifest.appVersion, JSON.parse(fs.readFileSync('package.json')).version);
    assert.equal(manifest.compiler.libraryOptimization, id === 'standard' ? 'O2' : 'O3');
    assert.equal(manifest.compiler.linkOptimization, id === 'standard' ? 'O2' : 'O3');
    assert.equal(!!manifest.compiler.lto, id !== 'standard');
    assert.equal(!!manifest.compiler.aot, ['compiled','memory64'].includes(id));
    assert.equal(!!manifest.compiler.memory64, id === 'memory64');
    const [memory] = wasmMemories(fs.readFileSync(new URL('ecl.wasm', directory)));
    assert.equal(memory.memory64, id === 'memory64');
    assert.equal(memory.maximumBytes, manifest.memory.wasmMaximumBytes);
    assert.equal(manifest.memory.maximumHeapMiB, backend.maximumHeapMiB);
    assert.equal(manifest.memory.defaultHeapMiB, backend.defaultHeapMiB);
    assert.equal(manifest.compiler.profiling, false); assert.equal(manifest.compiler.pointerSpilling, true);
    for (const [name, file] of Object.entries(manifest.files)) {
      const bytes = fs.readFileSync(new URL(name, directory));
      assert.equal(bytes.length, file.bytes);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, id + '/' + name);
    }
    const hash = manifest.files['ecl.data'].sha256;
    if (dataHash) assert.equal(hash, dataHash); else dataHash = hash;
  }
});

test('new installations prefer memory64 and 15.7 GiB with a wasm32 fallback',()=>{
  assert.equal(preferredBackend(true),'memory64');assert.equal(defaultMemoryMiB('memory64'),16077);
  assert.equal(preferredBackend(false),'compiled');assert.equal(defaultMemoryMiB('compiled'),2048);
});

test('only memory64 accepts large allowances and no heap cap',()=>{
 for(const id of Object.keys(BERGMAN_BACKENDS)){
  assert.equal(validMemoryMiB(4095,id),true);
  for(const mib of [0,4096,8192,16384])assert.equal(validMemoryMiB(mib,id),id==='memory64');
  for(const mib of [-1,1,127,16385,Infinity,NaN,4095.5])assert.equal(validMemoryMiB(mib,id),false);
 }
});

test('backend selection accepts only declared own IDs', () => {
  for (const id of Object.keys(BACKENDS)) assert.equal(getBackend(id), BACKENDS[id]);
  for (const id of ['other', '../engine', '__proto__', 'constructor']) assert.throws(() => getBackend(id), /Unknown/);
});

test('deployment verification includes UI sources and every backend asset', () => {
  const required = ['index.html', 'style.css', 'isolation-worker.js', 'engine/build.json', 'engine/worker.js', 'engine/runner.js', 'sources/george-source.tar.gz', 'fomkyr/index.html'];
  const paths = [...required, 'src/app.js', 'src/backends.js', ...['', 'optimized/', 'compiled/', 'memory64/']
    .flatMap(dir => ['build.json', 'ecl.js', 'ecl.wasm', 'ecl.data'].map(name => 'engine/' + dir + name)),
    'sources/fomkyr-source.tar.gz','sources/ecl-source.tar.gz','README.md'];
  const assets = publicationAssets(paths);
  assert.equal(new Set(assets).size, assets.length);
  for (const file of paths.filter(p => p !== 'README.md')) assert.ok(assets.includes(file), file);
  assert.ok(!assets.includes('README.md'));
  assert.throws(() => publicationAssets([]), /Missing publication asset/);
});
