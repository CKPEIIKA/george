// Bounded upgrade checks for the standalone C CLI and portable native/Wasm jobs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {copyFomkyrSource} from './fomkyr-source.mjs';
import {validationSnapshot,engineHashes,writeJSON} from './release-support.mjs';
import {VERSION} from '../web/engine/fomkyr/storage.js';

const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const out=path.resolve(arg('--out','local/validation/fomkyr-'+VERSION+'-native'));
const stage=path.join(out,'source'),reportFile=path.join(out,'report.json');
const sourceHashes=validationSnapshot(),hashes=engineHashes();
const prior=process.argv.includes('--resume')&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):null;
if(prior){assert.equal(prior.version,VERSION);assert.deepEqual(prior.sourceHashes,sourceHashes);assert.deepEqual(prior.engineHashes,hashes);}
else{
 copyFomkyrSource(stage);fs.cpSync('web/engine/fomkyr',path.join(stage,'web'),{recursive:true});
 for(const v of ['0.6.5','0.6.6'])fs.mkdirSync(path.join(stage,'results',v),{recursive:true});
}
const report=prior??{state:'running',version:VERSION,sourceHashes,engineHashes:hashes,tests:[],
 scope:'Production C sources and George Wasm adapter; standalone pthread CLI, partial checkpoints, cross-runtime resume, exact independent small-case oracles and optional Hilbert authority rejection. Serial checks; each process group has a 120-second cap. No Singular reruns.'};
report.state='running';const save=()=>writeJSON(reportFile,report);save();
const checks=[
 ['native-build','make',['native']],
 ['kernel-reference-build','clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared','src/kernel.c','tests/host.c','-fuse-ld=lld','-o','dist/libfomkyr.so']],
 ['native-frontier','python3',['tests/test_frontier_native_065.py']],
 ['wasm-frontier',process.execPath,['--experimental-wasm-memory64','tests/test_frontier_wasm.mjs']],
 ['cli-resume','python3',['tests/test_cli_065.py']],
 ['cli-edges','python3',['tests/test_cli_edges_065.py']],
 ['hilbert-native','python3',['tests/test_hilbert_closure.py']],
 ['hilbert-wasm',process.execPath,['--experimental-wasm-memory64','tests/test_hilbert_closure_wasm.mjs']],
 ['hilbert-resume','python3',['tests/test_hilbert_closure_resume.py']],
 ['hilbert-authority','python3',['tests/test_hilbert_authority_edges.py']],
];
const memory64Flags=execFileSync(process.execPath,['--v8-options'],{encoding:'utf8'}).includes('--experimental-wasm-memory64')?['--experimental-wasm-memory64']:[];
for(const [,command,args] of checks)if(command===process.execPath){const i=args.indexOf('--experimental-wasm-memory64');if(i>=0)args.splice(i,1,...memory64Flags);}
const selected=arg('--tests',checks.map(([name])=>name).join(',')).split(',');
assert.ok(selected.every(name=>checks.some(([n])=>n===name)),'Unknown check');
try{
 for(const [name,command,args] of checks){
  if(!selected.includes(name)||report.tests.some(row=>row.name===name&&row.passed))continue;
  const start=performance.now(),log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
  console.log(name,'started');
  try{
   await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:stage,stdio:['ignore',fd,fd],detached:true});
    const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
    const timer=setTimeout(()=>{stop();reject(new Error(name+' exceeded 120 seconds: '+log));},120000);
    const heartbeat=setInterval(()=>console.log(name,((performance.now()-start)/1000).toFixed(0)+' s'),30000);
    const interrupt=()=>{stop();reject(new Error('Interrupted '+name));};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    const cleanup=()=>{clearTimeout(timer);clearInterval(heartbeat);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);};
    child.once('error',e=>{cleanup();reject(e);});
    child.once('exit',(code,signal)=>{cleanup();code===0?resolve():reject(new Error(name+' exited '+(signal||code)+': '+log));});
   });
   report.tests.push({name,passed:true,elapsedSeconds:(performance.now()-start)/1000});save();console.log(name,'PASS');
  }finally{fs.closeSync(fd);}
 }
 report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{save();}
