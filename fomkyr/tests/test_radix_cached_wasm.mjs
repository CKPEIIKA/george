// Independent maximum-search property test, using the production queue include.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
fs.mkdirSync('dist/radix-properties',{recursive:true});
const cases=[];
for(const bits of [32,64])for(const shared of [false,true]){
 const file=`dist/radix-properties/queue-${bits}-${shared?'shared':'single'}.wasm`;
 execFileSync(process.env.CLANG??'clang',[
  `--target=wasm${bits}`,'-O3','-flto','-ffreestanding','-fno-builtin','-mbulk-memory',
  ...(shared?['-matomics','-Wl,--shared-memory']:[]),'-nostdlib',
  'tests/test_radix_cached.c','-o',file,
  '-Wl,--no-entry,--export-dynamic,--export-memory,--initial-memory=2097152,--max-memory=67108864,-z,stack-size=131072,--lto-O3',
 ],{timeout:120000,stdio:'pipe'});
 const {instance}=await WebAssembly.instantiate(fs.readFileSync(file));
 assert.equal(instance.exports.memory.buffer instanceof SharedArrayBuffer,shared);
 const digest=BigInt.asUintN(64,instance.exports.property(20,10000)).toString(16);
 assert.equal(digest,'f3abeb24f30d5fa6');
 cases.push({bits,shared,attemptedOperations:1600000,digest,passed:true});
}
console.log(JSON.stringify({passed:true,scope:'Task-private queues; independent linear maximum search, cancellation and storage relocation. Full engine validation is separate.',cases}));
