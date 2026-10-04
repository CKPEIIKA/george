import fs from 'node:fs';
import crypto from 'node:crypto';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import {WASM_COMPILER} from '../web/engine/fomkyr/build-info.js';
const sourceDirectory='fomkyr';
const inventory=JSON.parse(fs.readFileSync(sourceDirectory+'/SOURCE.json'));
const directory = 'web/engine/fomkyr';
const names = [...fs.readdirSync(directory).filter(name => /\.(?:js|wasm)$/.test(name) || name === 'LICENSE.txt'),
  ...fs.readdirSync(directory+'/verification').map(name=>'verification/'+name)].sort();
const files = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(directory + '/' + name);
  return [name, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];
}));
fs.writeFileSync(directory + '/build.json', JSON.stringify({
  backend: 'fomkyr', name: 'fomkyr', upstreamName: 'fomkyr', version: VERSION,
  appVersion: JSON.parse(fs.readFileSync('package.json')).version, license: 'MIT',
  compiler: {language: 'C', libraryOptimization: 'O3', linkOptimization: 'O3', ...WASM_COMPILER},
  variants: ['wasm32-shared', 'wasm32-single', 'wasm64-shared', 'wasm64-single'],
  memory: {defaultHeapMiB: 3584, maximumHeapMiB: 14304},
  defaults: {hilbertGate:false,hilbertSectors:true,gateBudgetBytes:128*1048576,scheduler:'cooperative',quantumMs:250,lookahead:128,maxLookahead:512,elasticWindow:true,sectorPriority:true,radixMaxCache:true,arithmeticMode:'exact',memoryPolicy:'auto',budgetBytes:3584*1048576,scratchBytes:2048*1048576,
    rowReserveBytes:512*1048576,bigRowMaxTerms:0,batchPairs:128,radixHeap:true,reserveInPlace:true,
    smallerBudgets:'Automatic scratch uses 4/7 of the effective budget; rational overflow reserve uses 1/7. Saved workspace choices apply in manual mode.'},
  provenance: {archiveSha256: inventory.archiveSha256, kernelChanged: inventory.kernelChanged, hostAdapted: true,
    curatedSources:true,sourceInventory:sourceDirectory+'/SOURCE.json'},
  files,
}, null, 2) + '\n');
