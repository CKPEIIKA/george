import fs from 'node:fs';
import crypto from 'node:crypto';
const directory = 'web/engine/fomkyr';
const names = fs.readdirSync(directory).filter(name => /\.(?:js|wasm)$/.test(name) || name === 'LICENSE.txt').sort();
const files = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(directory + '/' + name);
  return [name, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];
}));
fs.writeFileSync(directory + '/build.json', JSON.stringify({
  backend: 'fomkyr', name: 'fomkyr', upstreamName: 'fomkyr', version: '0.4.0',
  appVersion: JSON.parse(fs.readFileSync('package.json')).version, license: 'MIT',
  compiler: {language: 'C', libraryOptimization: 'O3', linkOptimization: 'O3', lto: true},
  variants: ['wasm32-shared', 'wasm32-single', 'wasm64-shared', 'wasm64-single'],
  memory: {defaultHeapMiB: 512, maximumHeapMiB: 14304},
  provenance: {archiveSha256: 'd6feec734d25a1901d2cb3c582caa150d0e91bdfb22b541f1c2da06e9739c20a', kernelChanged: false, hostAdapted: true},
  files,
}, null, 2) + '\n');
