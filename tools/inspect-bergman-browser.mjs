// Bounded, ordinary-browser inspection of ECL code and collection counters.
// No debugger or profiler is attached; run separately from resource benchmarks.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
import {buildJob,readInputFile} from '../web/src/bergman-syntax.js';
const arg=(key,fallback)=>{const at=process.argv.indexOf(key);return at<0?fallback:process.argv[at+1];};
const out=path.resolve(arg('--out','local/benchmarks/bergman-inspection'));
const backend=arg('--backend','compiled'),degree=Number(arg('--degree','7'));
const memoryMiB=Number(arg('--memory-mib',backend==='compiled'?'4095':'4096'));
const fixture=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+fixture.inputText);
const job=buildJob({task:'gb',backend,ring:'noncomm',order:'degleftlex',field:'0',vars,rels,
  maxdeg:String(degree),memoryMiB,lowterms:'quick',nonhomog:'degreewise',monomialPruning:true,timeoutMinutes:2});
const inspect=`(LET ((BC NIL) (NC NIL) (PKG (FIND-PACKAGE "Bergman")))
  (CL:DO-SYMBOLS (S PKG)
    (WHEN (AND (EQ (SYMBOL-PACKAGE S) PKG) (FBOUNDP S) (NOT (MACRO-FUNCTION S)))
      (IF (NTH-VALUE 1 (SI::BC-SPLIT (SYMBOL-FUNCTION S)))
          (PUSH (SYMBOL-NAME S) BC) (PUSH (SYMBOL-NAME S) NC))))
  (FORMAT T "BYTECODE:[~{~S~^,~}]~%" (SORT BC #'STRING<))
  (FORMAT T "NONBYTECODE:[~{~S~^,~}]~%" (SORT NC #'STRING<))
  (MULTIPLE-VALUE-BIND (BYTES COLLECTIONS) (SI::GC-STATS T)
    (FORMAT T "ALLOCATION:~D COLLECTIONS:~D~%" BYTES COLLECTIONS)))`;
fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));
async function browserJob(){
  const {job,inspect}=await(await fetch('/__inspect/data')).json();
  const {EclEngine}=await import('/src/engine.js');
  const engine=new EclEngine({backend:job.backend});
  try{
    await engine.init();
    const before=await engine.eval(inspect);
    await engine.eval('(PROGN (SI::GC-STATS 0) (SI::GC-STATS T))');
    const start=performance.now();
    // Keep this initialized instance so its counters describe this job.
    const result=await engine.execute('eval',{job},undefined,false);
    const jobSeconds=(performance.now()-start)/1000;
    const after=await engine.eval(inspect);
    await fetch('/__inspect/end',{method:'POST',body:JSON.stringify({before:before.stdout,after:after.stdout,
      jobSeconds,memoryBytes:result.memoryBytes,basis:result.files['result.gb'],stdout:result.stdout})});
  }catch(error){await fetch('/__inspect/end',{method:'POST',body:JSON.stringify({error:error.stack})});}
  finally{engine.cancel();}
}
let finish;
const done=new Promise(resolve=>{finish=resolve;});
const server=staticServer('web','/',{isolate:true});
const serve=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
  if(!req.url.startsWith('/__inspect/'))return serve(req,res);
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  if(req.url==='/__inspect/data'){res.setHeader('content-type','application/json');res.end(JSON.stringify({job,inspect}));return;}
  if(req.url==='/__inspect/page'){res.setHeader('content-type','text/html');res.end(`<script type="module">(${browserJob})();</script>`);return;}
  let body='';for await(const chunk of req)body+=chunk;
  const result=JSON.parse(body);
  if(result.basis){fs.writeFileSync(path.join(out,'result.gb'),result.basis);delete result.basis;}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({backend,degree,memoryMiB,...result},null,2)+'\n');
  res.end('ok');finish(result);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const child=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-background-networking','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,
  `http://127.0.0.1:${server.address().port}/__inspect/page`],{detached:true,stdio:'ignore'});
const exited=new Promise(resolve=>child.once('exit',resolve));
child.once('error',error=>finish({error:error.message}));
const watchdog=setTimeout(()=>finish({error:'Inspection exceeded its bounded watchdog'}),180000);
try{
  const result=await done;
  if(result.error)throw new Error(result.error);
  const names=(text,prefix)=>JSON.parse(text.match(new RegExp('^'+prefix+':(.+)$','m'))[1]);
  const bytecodeBefore=names(result.before,'BYTECODE'),bytecodeAfter=names(result.after,'BYTECODE');
  const demoted=bytecodeAfter.filter(name=>!bytecodeBefore.includes(name));
  console.log(JSON.stringify({backend,degree,jobSeconds:result.jobSeconds,bytecodeBefore:bytecodeBefore.length,
    bytecodeAfter:bytecodeAfter.length,nonBytecodeAfter:names(result.after,'NONBYTECODE').length,
    demotedToBytecode:demoted,gc:result.after.match(/^ALLOCATION:.+$/m)?.[0]},null,2));
}finally{
  clearTimeout(watchdog);
  try{process.kill(-child.pid,'SIGTERM');}catch{}
  const force=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},3000);
  await exited;clearTimeout(force);
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
