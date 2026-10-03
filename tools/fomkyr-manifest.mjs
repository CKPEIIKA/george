import fs from 'node:fs';
import crypto from 'node:crypto';
import {VERSION} from '../web/engine/fomkyr/storage.js';
const sourceDirectory='vendor/fomkyr-'+VERSION;
const inventory=JSON.parse(fs.readFileSync(sourceDirectory+'/SOURCE.json'));
const directory = 'web/engine/fomkyr';
const names = fs.readdirSync(directory).filter(name => /\.(?:js|wasm)$/.test(name) || name === 'LICENSE.txt').sort();
const files = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(directory + '/' + name);
  return [name, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];
}));
fs.writeFileSync(directory + '/build.json', JSON.stringify({
  backend: 'fomkyr', name: 'fomkyr', upstreamName: 'fomkyr', version: VERSION,
  appVersion: JSON.parse(fs.readFileSync('package.json')).version, license: 'MIT',
  compiler: {language: 'C', libraryOptimization: 'O3', linkOptimization: 'O3', lto: true},
  variants: ['wasm32-shared', 'wasm32-single', 'wasm64-shared', 'wasm64-single'],
  memory: {defaultHeapMiB: 3584, maximumHeapMiB: 14304},
  defaults: {arithmeticMode:'exact',budgetBytes:3584*1048576,scratchBytes:2048*1048576,
    rowReserveBytes:512*1048576,batchPairs:128,radixHeap:true,reserveInPlace:true,
    smallerBudgets:'Automatic workspaces scale down; explicit saved choices are retained.'},
  provenance: {archiveSha256: inventory.archiveSha256, kernelChanged: false, hostAdapted: true,
    curatedSources:true,sourceInventory:sourceDirectory+'/SOURCE.json'},
  files,
}, null, 2) + '\n');
