// Ordinary Chromium timings, using the real worker without DevTools.
// node tools/profile-browser.mjs ENGINE DEGREE OUTPUT [REPEATS] [TIMEOUT_SECONDS]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {buildJob,readInputFile,parseBasis} from '../web/src/bergman-syntax.js';

const [engineArgument,degreeArgument,outputArgument,repeatArgument='3',timeoutArgument]=process.argv.slice(2);
if (!engineArgument || !degreeArgument || !outputArgument) throw Error('Supply ENGINE DEGREE OUTPUT [REPEATS] [TIMEOUT_SECONDS].');
const engine=path.resolve(engineArgument),out=path.resolve(outputArgument),degree=Number(degreeArgument),repeats=Number(repeatArgument);
assert.ok([4,6,7,8].includes(degree)); assert.ok(Number.isInteger(repeats)&&repeats>0&&repeats<=20);
const timeoutMs=timeoutArgument===undefined?repeats*240000+60000:Number(timeoutArgument)*1000;
assert.ok(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=7200000);
const snapshots=process.env.GEORGE_BROWSER_SNAPSHOTS==='1';
fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const inputText=JSON.parse(fs.readFileSync('docs/development/validation/memory.json','utf8')).presentationAssessment.inputText;
const parsed=readInputFile('(ALGFORMINPUT)\n'+inputText);
const job=buildJob({task:'gb',ring:'noncomm',field:'0',order:'degleftlex',maxdeg:String(degree),vars:parsed.vars,rels:parsed.rels,weights:'',memoryMiB:3584});
const directory=degree===4?'native':`native-gb${degree}`;
const reference=`build/diagnosis-15-generators/${directory}/result.gb`;
const expected=fs.existsSync(reference)?fs.readFileSync(reference,'utf8'):null;
const expectedHash=expected===null?JSON.parse(fs.readFileSync('docs/development/validation/performance.json','utf8')).nativeOutputs[String(degree)].sha256:sha(expected);
const browserExecutable=process.env.CHROMIUM||'/usr/bin/chromium';
const version=spawnSync(browserExecutable,['--version'],{encoding:'utf8'});assert.ifError(version.error);assert.equal(version.status,0);
const tier=process.env.GEORGE_BROWSER_TIER||'default';assert.ok(['default','turbofan'].includes(tier));
const report={state:'running',startedAt:new Date().toISOString(),timeoutMs,savedBasisSnapshots:snapshots,devtools:false,degree,freshWorkerEachRun:true,engine,browser:version.stdout.trim(),tier,inputSha256:sha(inputText),
  hashes:Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(n=>[n,sha(fs.readFileSync(path.join(engine,n)))])),runs:[]};
let resolveDone,rejectDone;
const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
const html=`<!doctype html><title>George runtime measurement</title><script type="module">
import {EclEngine} from '/src/engine.js';
try {
  const job=await (await fetch('/job.json')).json();let ticks=0;setInterval(()=>ticks++,20);
  for(let i=0;i<${repeats};i++) {
    const e=new EclEngine(),start=performance.now();await e.init();const startupMs=performance.now()-start,tick=ticks;
    const r=await e.run(job,event=>{if(event.type==='saved-basis')fetch('/progress',{method:'POST',body:JSON.stringify(event)});});e.cancel();
    const response=await fetch('/result',{method:'POST',body:JSON.stringify({...r,iteration:i+1,startupMs,ticks:ticks-tick})});
    if(!response.ok)throw Error(await response.text());
  }
  await fetch('/done',{method:'POST'});
}catch(e){await fetch('/error',{method:'POST',body:String(e.stack||e)});}
</script>`;
let worker=fs.readFileSync('web/engine/worker.js','utf8');
if(snapshots){
  const initialize="      runtime.FS.chdir('/work');";
  assert.ok(worker.includes(initialize));
  worker=worker.replace(initialize,initialize+`
      const write=runtime.FS.write;let lastSnapshot=0;
      runtime.FS.write=function(stream,...args){
        const count=write.call(this,stream,...args);
        if(stream.path==='/work/result.gb'&&performance.now()-lastSnapshot>1000){
          lastSnapshot=performance.now();
          const text=runtime.FS.readFile('/work/result.gb',{encoding:'utf8'});
          postMessage({id:activeId,event:{type:'saved-basis',text,memoryBytes:runtime.HEAPU8.length}});
        }
        return count;
      };`);
}
assert.ok(worker.includes('    let result;'));
worker=worker.replace('    let result;',`    let result;
    const profiling=typeof runtime._george_profile_start==='function';
    if(profiling)runtime.ccall('george_profile_start',null,[],[]);`);
const success="    postMessage({ id, result: { ...result, stdout: output, connected: true, elapsedMs: performance.now() - start, memoryBytes: runtime.HEAPU8.length } });";
assert.ok(worker.includes(success));
worker=worker.replace(success,`    const elapsedMs=performance.now()-start;let profile;
    if(profiling){runtime.ccall('george_profile_stop',null,[],[]);
      const get=name=>runtime.ccall(name,'number',[],[]);
      profile={gcMs:get('george_profile_gc_ms'),collections:get('george_profile_collections'),
        allocatedBytes:get('george_profile_allocated_bytes'),heapBytes:get('george_profile_heap_bytes'),freeBytes:get('george_profile_free_bytes')};}
    postMessage({id,result:{...result,stdout:output,connected:true,elapsedMs,memoryBytes:runtime.HEAPU8.length,profile}});`);
const server=http.createServer(async(req,res)=>{
  try {
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
    if(req.url==='/job.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(job));return;}
    if(req.url==='/engine/worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
    if(req.method==='POST') {
      let body='';for await(const chunk of req)body+=chunk;
      if(req.url==='/error')throw Error(body);
      if(req.url==='/done'){res.end('ok');resolveDone();return;}
      if(req.url==='/progress'){
        const event=JSON.parse(body);
        assert.ok(expected!==null&&expected.startsWith(event.text),'Saved output must be an exact native prefix.');
        const groups=parseBasis(event.text).groups;
        report.savedBasis={receivedAt:new Date().toISOString(),bytes:Buffer.byteLength(event.text),memoryBytes:event.memoryBytes,
          nativePrefixEquality:true,completedGroups:groups.slice(0,-1).map(g=>({degree:g.deg,count:g.polys.length}))};
        fs.writeFileSync(path.join(out,'partial.gb'),event.text);
        fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({savedBasis:report.savedBasis}));res.end('ok');return;
      }
      assert.equal(req.url,'/result');const r=JSON.parse(body);
      if(expected!==null)assert.equal(r.files['result.gb'],expected);
      assert.equal(sha(r.files['result.gb']),expectedHash);assert.ok(r.ticks>0);
      const row={iteration:r.iteration,elapsedMs:r.elapsedMs,startupMs:r.startupMs,memoryBytes:r.memoryBytes,
        ticks:r.ticks,nativeEquality:true,outputSha256:sha(r.files['result.gb']),...r.profile,
        basis:parseBasis(r.files['result.gb']).groups.map(g=>({degree:g.deg,count:g.polys.length}))};
      report.runs.push(row);fs.writeFileSync(path.join(out,`run-${r.iteration}.log`),r.stdout);
      fs.writeFileSync(path.join(out,`run-${r.iteration}.gb`),r.files['result.gb']);
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
      console.log(JSON.stringify(row));res.end('ok');return;
    }
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=/^\/engine\/ecl\.(js|wasm|data)$/.test(pathname)?path.join(engine,path.basename(pathname)):path.resolve('web','.'+pathname);
    if(!file.startsWith(engine+path.sep)&&!file.startsWith(path.resolve('web')+path.sep)){res.writeHead(403).end();return;}
    if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');
    res.end(fs.readFileSync(file));
  }catch(error){res.writeHead(500).end(String(error));rejectDone(error);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browserProfile=fs.mkdtempSync(path.join(os.tmpdir(),'george-runtime-bench-'));
const browser=spawn(browserExecutable,['--headless','--no-sandbox','--no-first-run',...(tier==='turbofan'?['--js-flags=--no-liftoff']:[]),
  `--user-data-dir=${browserProfile}`,`http://127.0.0.1:${server.address().port}/`],{stdio:['ignore','ignore','pipe']});
let stderr='';browser.stderr.on('data',chunk=>stderr+=chunk);browser.on('error',rejectDone);
report.processes={node:process.pid,browser:browser.pid};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
browser.on('exit',(code,signal)=>rejectDone(Error(`Browser exited before completion (${code}, ${signal})`)));
const timeout=setTimeout(()=>rejectDone(Error('Browser measurement exceeded its external time limit')),timeoutMs);
try{await done;assert.equal(report.runs.length,repeats);report.state='complete';}
catch(error){report.state='failed';report.error=String(error);console.error(error);process.exitCode=1;}
finally{clearTimeout(timeout);browser.kill('SIGTERM');server.close();
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,'browser.log'),stderr);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
