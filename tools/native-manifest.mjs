import fs from 'node:fs';
import crypto from 'node:crypto';
const directory='web/engine/native';
const names=['george32.wasm','george64.wasm','runtime.js','lane.js','engine.js','job-adapter.js',
  'george-entry.js','result-links.js','worker.js','LICENSE.txt'];
const files=Object.fromEntries(names.map(name=>{
  const data=fs.readFileSync(directory+'/'+name);
  return [name,{bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')}];
}));
const manifest={backend:'native',appVersion:JSON.parse(fs.readFileSync('package.json')).version,
  name:'George Native NC',version:'0.1.0-experimental',license:'MIT',
  compiler:{language:'C',libraryOptimization:'O3',linkOptimization:'O3',lto:true,sharedMemory:true},
  memory:{defaultHeapMiB:512,maximumHeapMiB:14304,wasm32MaximumBytes:4294901760,wasm64MaximumBytes:14999945216},
  provenance:{archiveSha256:'a517030392eb2db53fbf919817ce78132a8d45a1afefa907d718decc117ac1c9',kernelChanged:false,hostAdapted:true},files};
fs.writeFileSync(directory+'/build.json',JSON.stringify(manifest,null,2)+'\n');
