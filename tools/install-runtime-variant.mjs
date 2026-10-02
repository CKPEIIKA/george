// Install a measured runtime beside the standard engine, with its manifest.
// node tools/install-runtime-variant.mjs VARIANT_DIRECTORY optimized
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {BERGMAN_BACKENDS as BACKENDS} from '../web/src/backends.js';
import {wasmMemories} from './wasm-memory.mjs';

const [sourceArgument, backend] = process.argv.slice(2);
assert.ok(sourceArgument && Object.hasOwn(BACKENDS, backend) && backend !== 'standard', 'Supply a variant directory and a supported backend ID.');
const source = path.resolve(sourceArgument), destination = path.resolve('web/engine', backend);
const variant = JSON.parse(fs.readFileSync(path.join(source, 'build.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync('web/engine/build.json', 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = Object.fromEntries(['ecl.js', 'ecl.wasm', 'ecl.data'].map(name => {
  const bytes = fs.readFileSync(path.join(source, 'engine', name));
  // Emscripten legitimately creates /home/web_user inside its virtual FS.
  assert.ok(!/\/home\/(?!web_user(?:["'\0]|$))/.test(bytes.toString('latin1')), `${name}: use neutral build paths before publishing`);
  assert.equal(sha(bytes), variant.files[name].sha256, `${name}: build hash`);
  return [name, {bytes: bytes.length, sha256: sha(bytes)}];
}));
assert.equal(files['ecl.data'].sha256, manifest.files['ecl.data'].sha256, 'Variants must use the standard Bergman package.');
assert.equal(variant.profile, false, 'Published variants cannot contain profiling hooks.');
assert.equal(variant.optimization, 'O3', 'The UI identifies this backend as O3.');
assert.equal(variant.linkOptimization ?? variant.optimization, 'O3', 'The UI identifies the final link as O3.');
assert.equal(variant.lto, true, 'The UI identifies this backend as LTO.');
assert.equal(!!variant.aot, ['compiled', 'memory64'].includes(backend), 'The backend label must match Lisp or C execution.');
assert.equal(!!variant.memory64, backend === 'memory64', 'The backend label must match the pointer width.');
const [memory] = wasmMemories(fs.readFileSync(path.join(source, 'engine', 'ecl.wasm')));
assert.equal(memory.memory64, backend === 'memory64', 'Check pointer width in the actual Wasm binary.');
assert.equal(memory.maximumBytes, backend === 'memory64' ? 17179869184 : 4294967296);
fs.mkdirSync(destination, {recursive: true});
for (const name of Object.keys(files)) fs.copyFileSync(path.join(source, 'engine', name), path.join(destination, name));
fs.writeFileSync(path.join(destination, 'build.json'), JSON.stringify({...manifest, backend, files,
  memory: {wasmMaximumBytes: backend === 'memory64' ? 17179869184 : 4294967296,
    defaultHeapMiB: BACKENDS[backend].defaultHeapMiB, maximumHeapMiB: BACKENDS[backend].maximumHeapMiB,
    ...(backend === 'memory64' ? {uncappedHeap: true} : {})},
  compiler: {libraryOptimization: variant.optimization, linkOptimization: variant.linkOptimization ?? variant.optimization,
    lto: !!variant.lto, aot: !!variant.aot, memory64: !!variant.memory64,
    longjmp: variant.longjmp ?? 'emscripten', pointerSpilling: true, profiling: false},
  ...(variant.binaryen ? {binaryen: variant.binaryen} : {}),
  ...(variant.compilation ? {compilation: variant.compilation} : {}),
}, null, 2) + '\n');
console.log(destination);
