// Serial cold POSIX C runs. Raw host diagnostics and results belong in local/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Sampler} from './linux-resource-sampler.mjs';
import {EnvironmentMonitor} from './benchmark-environment.mjs';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const out=path.resolve(arg('--out','local/benchmarks/fomkyr-native'));
const input=path.resolve(arg('--input','fomkyr/fixtures/fk6.json'));
const degrees=arg('--degrees','8,9,10').split(',').map(Number);
const trials=Number(arg('--trials','3')),workers=Number(arg('--workers','4'));
const memoryMiB=Number(arg('--memory-mib','4096')),timeoutSeconds=Number(arg('--timeout-seconds','120'));
const configurations=JSON.parse(fs.readFileSync(arg('--builds','local/benchmarks/fomkyr-0.6.6-native-builds/builds.json')));
assert.ok(degrees.every(n=>Number.isInteger(n)&&n>=1&&n<=32));
assert.ok(Number.isInteger(trials)&&trials>=1&&trials<=20);
assert.ok(Number.isInteger(workers)&&workers>=1&&workers<=32);
assert.ok(Number.isInteger(memoryMiB)&&memoryMiB>=16);
assert.ok(Number.isFinite(timeoutSeconds)&&timeoutSeconds>0&&timeoutSeconds<=120);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={state:'running',version:JSON.parse(fs.readFileSync('fomkyr/package.json')).version,
  startedAt:new Date().toISOString(),inputSha256:sha(input),workers,memoryMiB,timeoutSeconds,
  configurations:configurations.map(c=>({...c,executableSha256:sha(c.executable)})),
  method:{wall:'Cold process wall time: input parsing, kernel initialization, ordinary exact completion, durable checkpoints and complete text export. Fresh workdir per run.',
    job:'Four workers by default, 128 pairs per batch, automatic workspace, monomial pruning and ordinary exact completion. Hilbert counting/closure disabled; no checkpoint resume.',
    ram:'PSS sampled every 0.25 seconds; GNU time peak RSS and CPU also recorded. Allocation capacity is separate. Native has no browser baseline.',
    trials:'Configurations alternate their order between trials. Builds, output audits and plotting occur separately from timing.'},rows:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();let interrupted=false,active;
const stop=(child,signal='SIGTERM')=>{if(child)try{process.kill(-child.pid,signal);}catch{}};
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{interrupted=true;stop(active);});
try{
 for(const degree of degrees)for(let trial=0;trial<trials&&!interrupted;trial++){
  const ordered=trial%2?[...configurations].reverse():configurations;
  for(const c of ordered){
   if(interrupted)break;
   const name=`${c.id}-d${degree}-t${trial}`,directory=path.join(out,name);
   assert.ok(!fs.existsSync(directory),'Fresh measurements require a new output directory: '+directory);
   fs.mkdirSync(directory);
   const metrics=path.join(directory,'time.txt');
   const command=[c.executable,'-i',input,'-d',String(degree),'-j',String(workers),
    '--memory',memoryMiB+'M','--batch-pairs','128','--time-limit',String(timeoutSeconds),
    '--workdir',path.join(directory,'job'),'--export','--quiet'];
   const host=new EnvironmentMonitor();host.start();
   const start=performance.now(),child=spawn('/usr/bin/time',['-f','%U %S %M','-o',metrics,...command],{stdio:['ignore','pipe','pipe'],detached:true});
   active=child;let stdout='',stderr='';
   child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
   const sampler=new Sampler(child.pid,{intervalMs:250});sampler.start();
   let hardStop;
   const watchdog=setTimeout(()=>{stop(child);hardStop=setTimeout(()=>stop(child,'SIGKILL'),5000);},(timeoutSeconds+5)*1000);
   let status;
   try{status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}
   finally{clearTimeout(watchdog);clearTimeout(hardStop);active=null;}
   const wallSeconds=(performance.now()-start)/1000,resources=sampler.stop(),hostEnvironment=host.stop();
   fs.writeFileSync(path.join(directory,'stdout.json'),stdout);fs.writeFileSync(path.join(directory,'stderr.txt'),stderr);
   const time=fs.readFileSync(metrics,'utf8').trim().split('\n').at(-1).split(' ').map(Number);
   let result;try{result=JSON.parse(stdout);}catch{}
   const basisDirectory=path.join(directory,'job','fomkyr');
   const run=fs.existsSync(basisDirectory)?fs.readdirSync(basisDirectory)[0]:null;
   const basisFile=run?path.join(basisDirectory,run,'result.gb'):null;
   const recordFile=run?path.join(basisDirectory,run,'basis.gnb'):null;
   const row={id:c.id,degree,trial,status:result?.complete?'complete':interrupted?'interrupted':'failed',...status,
    wallSeconds,jobWallSeconds:result?.elapsedSeconds,cpuSeconds:time[0]+time[1],
    peakRssMiB:time[2]/1024,peakPssMiB:resources.peakPssMiB,
    requestedWorkers:workers,memoryMiB,native:result,hostEnvironment,
    ...(basisFile&&fs.existsSync(basisFile)?{basisFile:path.relative(out,basisFile),basisSha256:sha(basisFile)}:{}),
    ...(recordFile&&fs.existsSync(recordFile)?{recordFile:path.relative(out,recordFile),recordSha256:sha(recordFile)}:{})};
   report.rows.push(row);save();
   console.log(c.id,'degree',degree,'trial',trial,row.status,wallSeconds.toFixed(3)+' s');
   if(!interrupted){assert.equal(status.code,0,stderr);assert.equal(result?.complete,true);assert.equal(result.workers,workers);assert.equal(result.resumedFromDegree,0);assert.equal(result.budgetBytes,memoryMiB*1048576);}
  }
 }
 report.state=interrupted?'stopped-by-user':'complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{save();}
if(interrupted)process.exitCode=130;
