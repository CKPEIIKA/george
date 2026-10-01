// Install a measured runtime beside the standard engine, with its manifest.
// node tools/install-runtime-variant.mjs VARIANT_DIRECTORY optimized
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {BACKENDS} from '../web/src/backends.js';

const [sourceArgument, backend] = process.argv.slice(2);
assert.ok(sourceArgument && Object.hasOwn(BACKENDS, backend) && backend !== 'standard', 'Supply a variant directory and a supported backend ID.');
const source = path.resolve(sourceArgument), destination = path.resolve('web/engine', backend);
const variant = JSON.parse(fs.readFileSync(path.join(source, 'build.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync('web/engine/build.json', 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = Object.fromEntries(['ecl.js', 'ecl.wasm', 'ecl.data'].map(name => {
  const bytes = fs.readFileSync(path.join(source, 'engine', name));
  assert.equal(sha(bytes), variant.files[name].sha256, `${name}: build hash`);
  return [name, {bytes: bytes.length, sha256: sha(bytes)}];
}));
assert.equal(files['ecl.data'].sha256, manifest.files['ecl.data'].sha256, 'Variants must use the standard Bergman package.');
assert.equal(variant.profile, false, 'Published variants cannot contain profiling hooks.');
assert.equal(variant.optimization, 'O3', 'The UI identifies this backend as O3.');
assert.equal(variant.linkOptimization ?? variant.optimization, 'O3', 'The UI identifies the final link as O3.');
assert.equal(variant.lto, true, 'The UI identifies this backend as LTO.');
assert.equal(!!variant.aot, backend === 'compiled', 'The backend label must match Lisp or C execution.');
fs.mkdirSync(destination, {recursive: true});
for (const name of Object.keys(files)) fs.copyFileSync(path.join(source, 'engine', name), path.join(destination, name));
fs.writeFileSync(path.join(destination, 'build.json'), JSON.stringify({...manifest, backend, files,
  compiler: {libraryOptimization: variant.optimization, linkOptimization: variant.linkOptimization ?? variant.optimization,
    lto: !!variant.lto, aot: !!variant.aot, longjmp: variant.longjmp ?? 'emscripten', pointerSpilling: true, profiling: false},
  ...(variant.compilation ? {compilation: variant.compilation} : {}),
}, null, 2) + '\n');
console.log(destination);
