// Targeted sparse big-row invariants; reports and compiled products stay local.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
const out=path.resolve(process.argv[2]??'local/validation/fomkyr-row-growth');
const browserAt=process.argv.indexOf('--browsers');
const browsers=browserAt<0?[]:process.argv[browserAt+1].split(',');
assert.ok(browsers.every(x=>['chromium','firefox'].includes(x)));
fs.mkdirSync(out,{recursive:true});
const rows=[],run=(command,args)=>execFileSync(command,args,{encoding:'utf8',timeout:60000,maxBuffer:1048576});
const c='fomkyr/tests/test_big_row_growth.c';
const native=path.join(out,'growth.so');
run(process.env.CC??'cc',['-O2','-ffreestanding','-fno-builtin','-fPIC','-shared','-fsanitize=undefined','-fno-sanitize-recover=all',c,'fomkyr/tests/host.c','-o',native]);
const python=`import ctypes as C,json,time,sys
x=C.CDLL(sys.argv[1]);x.host_init.argtypes=[C.c_uint64,C.c_char_p];assert x.host_init(600<<20,None)
rows=[]
code=x.test_shared_cache();assert not code,code
rows.append(dict(property='explicit-shared-cache',code=code))
for n in [0,1,2,3]:
 t=time.monotonic();code=x.test_big_row_growth(n);assert not code,code
 rows.append(dict(large=bool(n&1),queue='radix' if n&2 else 'binary',code=code,seconds=time.monotonic()-t))
for n in [0,1]:
 code=x.test_deep_rows(n);assert not code,code
 rows.append(dict(property='deep-rows',queue='radix' if n else 'binary',code=code))
code=x.test_commit_slices();assert not code,code
rows.append(dict(property='commit-slices',code=code))
code=x.test_output_wait();assert not code,code
rows.append(dict(property='output-backpressure',code=code))
for n in [0,1]:
 code=x.test_coop_helpers(n);assert not code,code
 rows.append(dict(property='reserve-wait-helpers',queue='radix' if n else 'binary',code=code))
for n in [0,1]:
 code=x.test_multi_reserves(n);assert not code,code
 rows.append(dict(property='multiple-large-row-reserves',queue='radix' if n else 'binary',code=code))
print(json.dumps(rows))`;
rows.push({runtime:'native-ubsan',tests:JSON.parse(run('python3',['-c',python,native]))});
for(const bits of [32,64])for(const shared of [false,true]){
 const file=path.join(out,`growth-${bits}-${shared?'shared':'single'}.wasm`);
 run(process.env.CLANG??'clang',[`--target=wasm${bits}`,'-std=c11','-O2','-ffreestanding','-fno-builtin','-fvisibility=hidden','-mbulk-memory',...(shared?['-matomics']:['-DGN_SINGLE']),'-nostdlib',c,'-o',file,'-Wl,--no-entry,--import-memory,--export-dynamic,--initial-memory=2097152,--max-memory=1073741824,-z,stack-size=131072',...(shared?['-Wl,--shared-memory']:[])]);
}
async function properties(url,bits,shared){
 const memory=new WebAssembly.Memory({address:bits===64?'i64':'i32',initial:bits===64?9600n:9600,maximum:bits===64?16384n:16384,shared});
 const module=await WebAssembly.compile(await(await fetch(url)).arrayBuffer());
 const e=(await WebAssembly.instantiate(module,{env:{memory},host:{ensure:end=>Number(end)<=memory.buffer.byteLength?1:0,read:()=>0,write:()=>0,clock:()=>performance.now()}})).exports;
 const tests=[];let cacheCode=e.test_shared_cache();if(cacheCode)throw Error('Shared cache property failure '+cacheCode);tests.push({property:'explicit-shared-cache',code:cacheCode});for(const mode of [0,1,2,3]){const t=performance.now(),code=e.test_big_row_growth(mode);if(code)throw Error(`Property failure at C line ${code}, mode ${mode}`);tests.push({large:!!(mode&1),queue:mode&2?'radix':'binary',code,seconds:(performance.now()-t)/1000});}
 for(const mode of [0,1]){const code=e.test_deep_rows(mode);if(code)throw Error(`Deep-row property failure at C line ${code}, mode ${mode}`);tests.push({property:'deep-rows',queue:mode?'radix':'binary',code});}
 let code=e.test_commit_slices();if(code)throw Error(`Commit-slice property failure at C line ${code}`);tests.push({property:'commit-slices',code});
 code=e.test_output_wait();if(code)throw Error(`Output-backpressure property failure at C line ${code}`);tests.push({property:'output-backpressure',code});
 for(const mode of [0,1]){code=e.test_coop_helpers(mode);if(code)throw Error(`Helper property failure at C line ${code}`);tests.push({property:'reserve-wait-helpers',queue:mode?'radix':'binary',code});}
 for(const mode of [0,1]){code=e.test_multi_reserves(mode);if(code)throw Error(`Multiple-reserve property failure at C line ${code}`);tests.push({property:'multiple-large-row-reserves',queue:mode?'radix':'binary',code});}return tests;
}
const server=staticServer('.', '/', {isolate:true}),serve=server.listeners('request')[0];server.removeAllListeners('request');
let reportBrowser;
server.on('request',async(req,res)=>{
 if(req.url==='/__growth/report'){
  let body='';for await(const p of req)body+=p;reportBrowser?.(JSON.parse(body));res.end('ok');return;
 }
 if(req.url==='/__growth/page'){
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('content-type','text/html');
  res.end(`<script type="module">try {const properties=${properties.toString()};const rows=[];for(const bits of [32,64])for(const shared of [false,true]){const tests=await properties(${JSON.stringify('/'+path.relative('.',out).split(path.sep).join('/'))}+'/growth-'+bits+'-'+(shared?'shared':'single')+'.wasm',bits,shared);rows.push({bits,shared,tests});}await fetch('/__growth/report',{method:'POST',body:JSON.stringify({rows})});}catch(error){await fetch('/__growth/report',{method:'POST',body:JSON.stringify({error:String(error.stack??error)})});}</script>`);return;
 }serve(req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try{
 for(const bits of [32,64])for(const shared of [false,true]){
  const file=path.relative('.',path.join(out,`growth-${bits}-${shared?'shared':'single'}.wasm`)).split(path.sep).join('/');
  rows.push({runtime:'node-wasm',bits,shared,tests:await properties(base+'/'+file,bits,shared)});
 }
 for(const browser of browsers){
  const profile=path.join(out,`${browser}-profile`);fs.mkdirSync(profile,{recursive:true});
  const binary=browser==='chromium'?(process.env.CHROMIUM??'/usr/bin/chromium'):(process.env.FIREFOX??path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox'));
  const args=browser==='chromium'?['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${profile}`,base+'/__growth/page']:['-headless','--no-remote','-profile',profile,base+'/__growth/page'];
  let timer;const response=new Promise((resolve,reject)=>{reportBrowser=resolve;timer=setTimeout(()=>reject(Error(browser+' watchdog')),60000);});
  const child=spawn(binary,args,{stdio:['ignore','ignore','pipe']});
  const exit=new Promise(resolve=>child.once('close',resolve));child.once('error',error=>reportBrowser({error:String(error)}));
  let log='';child.stderr.on('data',b=>log=(log+b).slice(-16000));
  try{const result=await response;assert.ok(!result.error,result.error);rows.push({runtime:browser,...result});}
  finally{clearTimeout(timer);child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),2000);await exit;clearTimeout(force);fs.writeFileSync(path.join(out,browser+'.log'),log);fs.rmSync(profile,{recursive:true,force:true});reportBrowser=null;}
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({state:'complete',passed:true,rows},null,2)+'\n');
 console.log(JSON.stringify({passed:true,runtimes:rows.length,report:path.join(out,'report.json')}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
