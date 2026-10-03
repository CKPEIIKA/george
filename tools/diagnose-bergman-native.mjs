// Small serial controls for the historical SBCL build/heap/pruning changes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {buildJob,readInputFile} from '../web/src/bergman-syntax.js';
import {EnvironmentMonitor} from './benchmark-environment.mjs';

const arg=(key,fallback)=>{const at=process.argv.indexOf(key);return at<0?fallback:process.argv[at+1];};
const out=path.resolve(arg('--out','local/benchmarks/bergman-native-controls-'+Date.now()));
const current=arg('--sbcl-root','build/sbcl-oracle-fixed-v4-04-20261001');
const historical=arg('--historical-root','build/sbcl-reader-02-v2-20260930');
const degree=Number(arg('--degree','7')),cap=Number(arg('--timeout-seconds','60'));
assert.ok(Number.isInteger(degree)&&degree>=2&&degree<=7,'Use bounded degrees 2–7 for this diagnostic');
assert.ok(Number.isFinite(cap)&&cap>0&&cap<=120);
const inputFile='test/fixtures/fomin-kirillov-user.json';
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+JSON.parse(fs.readFileSync(inputFile)).inputText);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const definitions=[
  {id:'historical-512-retained',root:historical,memoryMiB:512,pruning:false},
  {id:'historical-4096-pruned',root:historical,memoryMiB:4096,pruning:true},
  {id:'current-512-retained',root:current,memoryMiB:512,pruning:false},
  {id:'current-4096-retained',root:current,memoryMiB:4096,pruning:false},
  {id:'current-4096-pruned',root:current,memoryMiB:4096,pruning:true},
];
const requested=arg('--cases',null)?.split(',');
const cases=requested?requested.map(id=>{const row=definitions.find(row=>row.id===id);assert.ok(row,'Unknown control: '+id);return row;}):definitions;
const report={state:'running',startedAt:new Date().toISOString(),degree,timeLimitSeconds:cap,
  inputSha256:hash(inputFile),method:'One serial cold run per control. Same mathematical input/order; native CL:TIME records GC and allocations. No builds, debugger or browser calculations alongside.',rows:[]};
const save=()=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
save();let expected;
for(const c of cases){
  const directory=path.join(out,c.id);fs.mkdirSync(directory,{recursive:true});
  const job=buildJob({task:'gb',backend:'memory64',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,
    maxdeg:String(degree),memoryMiB:c.memoryMiB,lowterms:'quick',monomialPruning:c.pruning});
  for(const [name,text]of Object.entries(job.files))fs.writeFileSync(path.join(directory,name),text);
  const source='(CL:TIME (CL:PROGN\n'+job.script+'))\n(QUIT)\n';
  fs.writeFileSync(path.join(directory,'session.lsp'),source);
  const timing=path.join(directory,'time.txt'),logFile=path.join(directory,'stdout.txt'),fd=fs.openSync(logFile,'w');
  const monitor=new EnvironmentMonitor();monitor.start();const start=performance.now();
  const child=spawn('/usr/bin/time',['-f','%U %S %e %M','-o',timing,'--','/usr/bin/timeout','--signal=KILL',String(cap),
    path.resolve(c.root+'/bin/clisp/unix/bergman'),'--dynamic-space-size',String(c.memoryMiB)],
    {cwd:directory,detached:true,stdio:['pipe',fd,fd]});
  fs.closeSync(fd);child.stdin.on('error',()=>{});child.stdin.end(source);
  const interrupted=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
  process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);
  const elapsedSeconds=(performance.now()-start)/1000,environment=monitor.stop();
  const log=fs.readFileSync(logFile,'utf8'),times=fs.readFileSync(timing,'utf8').trim().split('\n').at(-1).split(/\s+/).map(Number);
  const basisFile=path.join(directory,'result.gb'),basisSha256=fs.existsSync(basisFile)?hash(basisFile):null;
  const row={...c,elapsedSeconds,exitCode:code,cpuSeconds:times[0]+times[1],peakRssMiB:times[3]/1024,
    imageSha256:hash(c.root+'/bin/clisp/unix/bergman.exe'),basisSha256,hostEnvironment:environment,
    gcSeconds:Number(log.match(/Real times consist of ([\d.]+) seconds GC time/)?.[1]??NaN),
    bytesConsed:Number(log.match(/([\d,]+) bytes consed/)?.[1]?.replaceAll(',','')??NaN)};
  report.rows.push(row);save();
  assert.equal(code,0,c.id+': see '+logFile);assert.ok(basisSha256);
  expected??=basisSha256;assert.equal(basisSha256,expected,c.id+' changed the exact output');
  console.log(c.id,elapsedSeconds.toFixed(2)+' s',row.cpuSeconds.toFixed(2)+' core-s',row.gcSeconds+' GC-s');
}
report.state='complete';report.finishedAt=new Date().toISOString();save();console.log(out);
