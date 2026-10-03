// Measure isolated engines. CPU profiles are diagnostic runs, not benchmarks.
// node tools/profile-runtime.mjs ENGINE gb4 OUTPUT [REPEATS] [--cpu]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import inspector from 'node:inspector';
import {pathToFileURL} from 'node:url';
import {buildJob, readInputFile, parseBasis} from '../web/src/bergman-syntax.js';
import {runJob} from '../web/engine/runner.js';
import {regressionJob} from '../test/support/regression.mjs';

const [engineArgument, caseId, outputArgument, repeatArgument='1'] = process.argv.slice(2);
if (!engineArgument || !caseId || !outputArgument) throw Error('Supply ENGINE CASE OUTPUT [REPEATS] [--cpu].');
const engine = path.resolve(engineArgument), out = path.resolve(outputArgument);
const repeats = Number(repeatArgument), cpu = process.argv.includes('--cpu');
assert.ok(Number.isInteger(repeats) && repeats > 0 && repeats <= 20);
fs.mkdirSync(out, {recursive:true});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashes = Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(name => [name,sha(fs.readFileSync(path.join(engine,name)))]));
let stdout = '';
const print = line => {stdout += line+'\n';};
const {default:create} = await import(pathToFileURL(path.join(engine,'ecl.js')));
const startup = performance.now();
const m = await create({locateFile:name=>path.join(engine,name),print,printErr:print,stdin:()=>null});
assert.equal(m.ccall('george_init','number',[],[]),0,stdout);
m.FS.mkdirTree('/work'); m.FS.chdir('/work');
const evaluate = source => {
  const code = m.ccall('george_eval','number',['string','number'],[source,0]);
  assert.equal(code,0,stdout);
};
evaluate('(SETF CL:*DEFAULT-PATHNAME-DEFAULTS* #P"/work/")');
const report = {caseId,cpuProfile:cpu,engine,hashes,node:process.version,v8:process.versions.v8,
  flags:process.execArgv,startupMs:performance.now()-startup,profileCounters:typeof m._george_profile_start==='function',runs:[]};
fs.writeFileSync(path.join(out,'startup.log'),stdout);
let job, expected, expectedHash;
if (/^gb[34678]$/.test(caseId)) {
  const degree = Number(caseId.slice(2));
  const inputText=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json','utf8')).inputText;
  const parsed = readInputFile('(ALGFORMINPUT)\n'+inputText);
  job = buildJob({task:'gb',ring:'noncomm',field:'0',order:'degleftlex',maxdeg:String(degree),
    vars:parsed.vars,rels:parsed.rels,weights:'',memoryMiB:3584});
  const directory = degree===4?'native':`native-gb${degree}`;
  if (degree!==3) {
    const reference=`build/diagnosis-15-generators/${directory}/result.gb`;
    if(fs.existsSync(reference)) expected={'result.gb':fs.readFileSync(reference,'utf8')};
    else expectedHash=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json','utf8')).degrees.find(row=>row.degree===degree)?.referenceSha256;
  }
} else if (caseId==='legacy' || caseId==='fixed') {
  ({job,expected} = regressionJob(caseId==='legacy'));
} else if (caseId==='gc-small' || caseId==='gc-high') {
  const count = caseId==='gc-high'?100:4, bytes = 33554432;
  job = {files:{},outputs:{},memoryMiB:3584,script:`
(DEFPARAMETER CL-USER::*GEORGE-STRESS* (MAKE-ARRAY ${count}))
(DOTIMES (I ${count})
  (SETF (AREF CL-USER::*GEORGE-STRESS* I)
    (MAKE-ARRAY ${bytes} :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT (MOD I 251))))
(EXT:GC T)
(DOTIMES (I ${count})
  (LET ((A (AREF CL-USER::*GEORGE-STRESS* I)))
    (ASSERT (= (AREF A 0) (MOD I 251)))
    (ASSERT (= (AREF A ${bytes-1}) (MOD I 251)))
    (SETF (AREF A ${bytes-1}) (MOD (+ I 1) 251))))
(EXT:GC T)
(DOTIMES (I ${count})
  (ASSERT (= (AREF (AREF CL-USER::*GEORGE-STRESS* I) ${bytes-1}) (MOD (+ I 1) 251))))
(ASSERT (= (EXPT 7 120) (REDUCE #'* (MAKE-LIST 120 :INITIAL-ELEMENT 7))))
(SETF CL-USER::*GEORGE-STRESS* NIL)
(EXT:GC T)
`};
  report.liveArrayBytes = count*bytes;
} else if (caseId==='gc-limit') {
  job={memoryMiB:128,files:{'input.bg':'(ALGFORMINPUT)\nvars x,y; x*y,x^2-y^2;\n'},outputs:{gb:'result.gb'},script:`
(SETLEGACYMODE NIL) (NONCOMMIFY) (SETMAXDEG 4)
(SIMPLE "input.bg" "result.gb")
(DEFPARAMETER CL-USER::*GEORGE-STRESS* (MAKE-ARRAY 8))
(DOTIMES (I 8) (SETF (AREF CL-USER::*GEORGE-STRESS* I)
  (MAKE-ARRAY 33554432 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 1)))
`};
} else throw Error(`Unknown case: ${caseId}`);
fs.writeFileSync(path.join(out,'job.json'),JSON.stringify(job,null,2)+'\n');
report.state='running';
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const call = name => m.ccall(name,'number',[],[]);
let session;
const post = (method,params={}) => new Promise((resolve,reject)=>session.post(method,params,(error,value)=>error?reject(error):resolve(value)));
if (cpu) {session=new inspector.Session();session.connect();await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});}
try {
  for (let i=0;i<repeats;i++) {
    stdout='';
    // Exclude explicit pre-run collection from job statistics and timing.
    evaluate('(EXT:GC T)');
    if (cpu) await post('Profiler.start');
    if (report.profileCounters) m.ccall('george_profile_start',null,[],[]);
    const start = performance.now();
    let result, memoryRecovery;
    if(caseId==='gc-limit') {
      let failure;
      try{runJob(m,job);}catch(error){failure=error;}
      assert.equal(failure?.code,'memory-limit','allocation must hit the real heap limit');
      assert.match(failure.partialResult.files['result.gb'],/x\^3/);
      fs.writeFileSync(path.join(out,'partial.gb'),failure.partialResult.files['result.gb']);
      result=runJob(m,{memoryMiB:3584,files:{},outputs:{},script:`
(SETF CL-USER::*GEORGE-STRESS* NIL) (EXT:GC T) (CLEARRING)
(ASSERT (= (EXPT 7 120) (REDUCE #'* (MAKE-LIST 120 :INITIAL-ELEMENT 7))))
`});
      memoryRecovery={heapLimitMiB:128,returnedMemoryError:true,savedBasisPreserved:true,sameRuntimeRecovered:true};
    } else result = runJob(m,job);
    const elapsedMs = performance.now()-start;
    if (report.profileCounters) m.ccall('george_profile_stop',null,[],[]);
    if (cpu) {
      const {profile} = await post('Profiler.stop');
      fs.writeFileSync(path.join(out,`run-${i+1}.cpuprofile`),JSON.stringify(profile));
      const nodes = new Map(profile.nodes.map(n=>[n.id,n]));
      const samples = new Map();
      for (const id of profile.samples||[]) samples.set(id,(samples.get(id)||0)+1);
      const total = profile.samples?.length||0;
      const functions = new Map();
      for (const [id,count] of samples) {
        const {functionName:name,url} = nodes.get(id).callFrame, key=JSON.stringify([name,url]);
        const row=functions.get(key)||{name,url,samples:0}; row.samples+=count; functions.set(key,row);
      }
      report.cpu = {samples:total,top:[...functions.values()].map(row=>({...row,percent:100*row.samples/total}))
        .sort((a,b)=>b.samples-a.samples).slice(0,40)};
    }
    const row = {iteration:i+1,elapsedMs,memoryBytes:m.HEAPU8.length,processMemory:process.memoryUsage(),
      outputHashes:Object.fromEntries(Object.entries(result.files).map(([file,text])=>[file,sha(text)]))};
    if(memoryRecovery)Object.assign(row,memoryRecovery);
    if (report.profileCounters) Object.assign(row,{gcMs:call('george_profile_gc_ms'),collections:call('george_profile_collections'),
      allocatedBytes:call('george_profile_allocated_bytes'),heapBytes:call('george_profile_heap_bytes'),freeBytes:call('george_profile_free_bytes')});
    if (expected) {
      for (const [file,text] of Object.entries(expected)) assert.equal(result.files[file],text,file);
      row.equalOutputs=Object.keys(expected).length;
    }
    if(expectedHash){assert.equal(row.outputHashes['result.gb'],expectedHash);row.equalOutputs=1;row.nativeReference='sha256';}
    if (job.outputs.gb && result.files[job.outputs.gb]) row.basis = parseBasis(result.files[job.outputs.gb]).groups.map(g=>({degree:g.deg,count:g.polys.length}));
    fs.writeFileSync(path.join(out,`run-${i+1}.log`),stdout);
    for (const [file,text] of Object.entries(result.files)) fs.writeFileSync(path.join(out,path.basename(file)),text);
    report.runs.push(row);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    const {outputHashes,...summary}=row;
    console.log(JSON.stringify({...summary,outputCount:Object.keys(outputHashes).length}));
  }
  report.state='complete';
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
} catch(error) {
  report.state='failed';report.error={message:error.message,code:error.code};
  fs.writeFileSync(path.join(out,'failure.log'),stdout);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  throw error;
} finally {session?.disconnect();}
