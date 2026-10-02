// Drive production workers without attaching a debugger during allocation.
// node tools/validate-memory-allowance.mjs [OUTPUT] [BACKEND] [ALLOWANCE_MIB] [ARRAYS]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {getBackend} from '../web/src/backends.js';
import {spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
const [output=`build/validation/memory-allowance-${Date.now()}`,backend='compiled',allowance='4095',arrays='32']=process.argv.slice(2);
const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
assert.match(backend,/^[a-z0-9]+$/);assert.match(allowance,/^\d+$/);assert.match(arrays,/^\d+$/);
const report={date:new Date().toISOString(),debuggerDuringCalculation:false,backend,allowanceMiB:Number(allowance),
  bytesPerArray:125829120,targetArrays:Number(arrays),rows:[]};
const engineDirectory=path.resolve('web/src',getBackend(backend).directory);
report.engineHashes=Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(name=>[name,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(engineDirectory,name))).digest('hex')]));
report.workerSourceHashes=Object.fromEntries(['web/engine/worker.js','web/engine/runner.js','web/src/engine.js','web/src/memory-monitor.js'].map(name=>[name,
  crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')]));
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const script=async function(){
  const {EclEngine}=await import('/src/engine.js');
  let phase='init';const memoryEvents=[];
  const engine=new EclEngine({backend:BACKEND,onMemory:bytes=>memoryEvents.push({phase,bytes,pending:engine.busy})});
  const post=async(kind,value)=>fetch('/__memory/'+kind,{method:'POST',body:JSON.stringify(value)});
  try{
    await engine.init();
    const configured=await engine.eval(`(EXT:SET-LIMIT 'EXT:HEAP-SIZE ${ALLOWANCE*1048576})`);
    await post('configured',{stdout:configured.stdout});
    for(let i=1;i<=ARRAYS;i++){
      phase=`array-${i}`;
      const r=await engine.eval(`(PROGN (PUSH (MAKE-ARRAY 125829120 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 7) GEORGE-MEMORY-ARRAYS) (LIST (LENGTH GEORGE-MEMORY-ARRAYS) (AREF (FIRST GEORGE-MEMORY-ARRAYS) 125829119)))`.replace('(PROGN','(PROGN (UNLESS (BOUNDP \'GEORGE-MEMORY-ARRAYS) (SETQ GEORGE-MEMORY-ARRAYS NIL))'));
      await post('row',{arrays:i,liveArrayBytes:i*125829120,wasmBytes:r.memoryBytes,stdout:r.stdout,
        memoryEvents:memoryEvents.filter(e=>e.phase===phase)});
    }
    const roots=await engine.eval("(LET ((KEEP (LOOP FOR I BELOW 10000 COLLECT (CONS I (EXPT 3 40))))) (DOTIMES (I 10) (MAKE-LIST 100000 :INITIAL-ELEMENT (EXPT 7 30)) (EXT:GC)) (PRINT (AND (= (LENGTH KEEP) 10000) (LOOP FOR P IN KEEP FOR I FROM 0 ALWAYS (AND (= (CAR P) I) (= (CDR P) 12157665459056928801))))))");
    await post('roots',{stdout:roots.stdout,wasmBytes:roots.memoryBytes});
    const r=await engine.eval("(PROGN (EXT:GC) (PRINT (EVERY (LAMBDA (A) (AND (= 7 (AREF A 0)) (= 7 (AREF A 125829119)))) GEORGE-MEMORY-ARRAYS)) (SETQ GEORGE-MEMORY-ARRAYS NIL) (EXT:GC) (EXPT 3 40))");
    await post('done',{stdout:r.stdout,wasmBytes:r.memoryBytes});
  }catch(error){await post('failure',{code:error.code,message:error.message});}
  finally{engine.cancel();}
};
const html=`<!doctype html><script type="module">const BACKEND=${JSON.stringify(backend)},ALLOWANCE=${Number(allowance)},ARRAYS=${Number(arrays)};(${script})();</script>`;
const server=staticServer('web'),serve=server.listeners('request')[0];server.removeAllListeners('request');
let resolve;const done=new Promise(r=>resolve=r);
server.on('request',async(req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(req.url.startsWith('/__memory/')){
    let text='';for await(const b of req)text+=b;const value=JSON.parse(text),kind=req.url.slice('/__memory/'.length);
    if(kind==='row'){report.rows.push(value);console.log(value.arrays,'arrays',value.wasmBytes/1048576,'MiB Wasm');}
    else report[kind]=value;
    save();res.end('ok');if(kind==='done'||kind==='failure')resolve();return;
  }
  serve(req,res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'george-memory-allowance-'));
const browser=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage',`--user-data-dir=${profile}`,
  `http://127.0.0.1:${server.address().port}/`],{stdio:'ignore'});
const timer=setTimeout(()=>{report.failure={message:'Allocation check timed out.'};save();resolve();},180000);
try{
  await done;
  assert.ok(report.configured.stdout.includes(String(Number(allowance)*1048576)),'ECL accepts the selected allowance');
  if(report.done){
    assert.match(report.roots.stdout,/T/);assert.match(report.done.stdout,/T/);assert.match(report.done.stdout,/12157665459056928801/);
    for(const row of report.rows) {
      assert.ok(row.memoryEvents.length>0,'Allocation publishes memory before returning');
      assert.ok(row.memoryEvents.every(e=>e.pending),'Updates arrive during synchronous calculation');
      assert.equal(row.memoryEvents.at(-1).bytes,row.wasmBytes);
    }
    assert.ok(report.rows.some(row=>new Set(row.memoryEvents.map(e=>e.bytes)).size>1),'Live growth update before allocation completes');
    report.memoryGrowthStreamingPassed=true;save();
  }
  else assert.equal(report.failure.code,'memory-limit',report.failure.message);
}finally{
  clearTimeout(timer);browser.kill('SIGTERM');await new Promise(r=>browser.once('exit',r));server.close();fs.rmSync(profile,{recursive:true,force:true});
}
console.log(report.done?'allocation + GC + exact arithmetic PASS':'handled OOM at '+report.rows.length+' arrays');
