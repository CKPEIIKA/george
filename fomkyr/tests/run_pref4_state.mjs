// Run the actual C invariants under UBSan and each actual WASM variant.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {oldNodeMemory64Shim} from './node-host.mjs';oldNodeMemory64Shim();
const out=path.resolve('results/pref4/state');fs.mkdirSync(out,{recursive:true});const source='tests/pref4_state_bundle.c';
const tests=[['shared-cache','test_shared_cache',[]],...Array.from({length:4},(_,i)=>[`row-growth-${i}`,'test_big_row_growth',[i]]),...Array.from({length:2},(_,i)=>[`deep-row-${i}`,'test_deep_rows',[i]]),['commit-slices','test_commit_slices',[]],['output-wait','test_output_wait',[]],...Array.from({length:2},(_,i)=>[`helpers-${i}`,'test_coop_helpers',[i]]),...Array.from({length:2},(_,i)=>[`reserve-${i}`,'test_multi_reserves',[i]]),...Array.from({length:4},(_,i)=>[`delta-${i}`,'pref4_delta_state',[i>>1,i&1]])];
const run=(exe,args)=>execFileSync(exe,args,{encoding:'utf8',timeout:120000,maxBuffer:2*1048576});
const so=path.join(out,'properties.so');run('gcc',['-O2','-ffreestanding','-fno-builtin','-fPIC','-shared','-fsanitize=undefined','-fno-sanitize-recover=all',source,'tests/host.c','-o',so]);
const py=`import ctypes as C,sys,json,time
x=C.CDLL(sys.argv[1]);x.host_init.argtypes=[C.c_uint64,C.c_char_p];assert x.host_init(600<<20,None)
rows=[]
for name,fn,args in json.loads(sys.argv[2]):
 t=time.monotonic();rc=getattr(x,fn)(*args);assert not rc,(name,rc);rows.append(dict(name=name,passed=True,seconds=time.monotonic()-t))
print(json.dumps(rows))`;
let rows=[{runtime:'native-ubsan',tests:JSON.parse(run('python3',['-c',py,so,JSON.stringify(tests)]))}];console.log('native state PASS');
for(const bits of [32,64])for(const shared of [false,true]){
 const file=path.join(out,`state-${bits}-${shared?'shared':'single'}.wasm`);
 run('clang',[`--target=wasm${bits}`,'-std=c11','-O2','-ffreestanding','-fno-builtin','-fvisibility=hidden','-mbulk-memory',...(shared?['-matomics']:['-DGN_SINGLE']),'-nostdlib',source,'-o',file,'-Wl,--no-entry,--import-memory,--export-dynamic,--initial-memory=2097152,--max-memory=1073741824,-z,stack-size=131072',...(shared?['-Wl,--shared-memory']:[])]);
 const memory=new WebAssembly.Memory({address:bits===64?'i64':'i32',initial:bits===64?9600n:9600,maximum:bits===64?16384n:16384,shared});
 const module=await WebAssembly.compile(fs.readFileSync(file));const e=(await WebAssembly.instantiate(module,{env:{memory},host:{ensure:n=>Number(n)<=memory.buffer.byteLength?1:0,read:()=>0,write:()=>0,clock:()=>performance.now()}})).exports;
 const checks=[];for(const [name,fn,args]of tests){const t=performance.now();const code=e[fn](...args);assert.equal(code,0,`${bits}/${shared} ${name} failed at C line ${code}`);checks.push({name,passed:true,seconds:(performance.now()-t)/1000});}
 rows.push({runtime:'actual-wasm',bits,shared,tests:checks});console.log(bits,shared,'state PASS');
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({passed:true,groups:tests.length*rows.length,implementations:rows.length,nativeUBSan:true,rows},null,2));console.log('PREF4 STATE PASS',tests.length*rows.length);
