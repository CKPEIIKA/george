import fs from 'node:fs';
import crypto from 'node:crypto';
const directory = 'web/engine/fomkyr';
const names = fs.readdirSync(directory).filter(name => /\.(?:js|wasm)$/.test(name) || name === 'LICENSE.txt').sort();
const files = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(directory + '/' + name);
  return [name, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];
}));
fs.writeFileSync(directory + '/build.json', JSON.stringify({
  backend: 'fomkyr', name: 'fomkyr', upstreamName: 'fomkyr', version: '0.6.1',
  appVersion: JSON.parse(fs.readFileSync('package.json')).version, license: 'MIT',
  compiler: {language: 'C', libraryOptimization: 'O3', linkOptimization: 'O3', lto: true},
  variants: ['wasm32-shared', 'wasm32-single', 'wasm64-shared', 'wasm64-single'],
  memory: {defaultHeapMiB: 512, maximumHeapMiB: 14304},
  provenance: {archiveSha256: 'ee286ecc55dea5275f7568abfd721bb380cc57b9df9772ab4348aad7ca411492', kernelChanged: false, hostAdapted: true,
    upstreamManifestStale:true,importAudit:'docs/development/validation/fomkyr-061-import.json'},
  files,
}, null, 2) + '\n');
