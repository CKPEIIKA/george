import fs from 'node:fs';
import crypto from 'node:crypto';
const directory = 'web/engine/fomkyr';
const names = fs.readdirSync(directory).filter(name => /\.(?:js|wasm)$/.test(name) || name === 'LICENSE.txt').sort();
const files = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(directory + '/' + name);
  return [name, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];
}));
fs.writeFileSync(directory + '/build.json', JSON.stringify({
  backend: 'fomkyr', name: 'fomkyr', upstreamName: 'fomkyr', version: '0.3.0',
  appVersion: JSON.parse(fs.readFileSync('package.json')).version, license: 'MIT',
  compiler: {language: 'C', libraryOptimization: 'O3', linkOptimization: 'O3', lto: true},
  variants: ['wasm32-shared', 'wasm32-single', 'wasm64-shared', 'wasm64-single'],
  memory: {defaultHeapMiB: 512, maximumHeapMiB: 14304},
  provenance: {archiveSha256: '1f616fa6f448c0c3b6feafc9a52a959474c9b61e26ab43a35aa591c3033061f0', kernelChanged: false, hostAdapted: true},
  files,
}, null, 2) + '\n');
