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
 for(const v of ['0.6.5','0.6.6','0.6.7','0.6.8'])fs.mkdirSync(path.join(stage,'results',v),{recursive:true});
}
const report=prior??{state:'running',version:VERSION,sourceHashes,engineHashes:hashes,tests:[],
 scope:'Production C sources and George Wasm adapter; standalone pthread CLI, partial checkpoints, cross-runtime resume, exact independent small-case oracles and optional Hilbert authority rejection. Serial checks; individual calculations retain their deadlines. Multi-job CLI recovery suites have a 600-second aggregate cap; other process groups have a 120-second cap. No Singular reruns.'};
const reusableInputs=new Set(['tools/release.mjs','tools/validate-fomkyr-native.mjs','fomkyr/SOURCE.json',
 'fomkyr/tests/test_cooperative_pressure_067.mjs','fomkyr/tests/test_cooperative_reserve_067.mjs',
 'fomkyr/tests/test_fk_gate_wasm_068.mjs','fomkyr/tests/audit_fk_gate_wasm_068.py',
 'fomkyr/tests/test_cli_065.py','docs/development/RELEASING.md']);
function previousNativeEvidence(){
 if(!fs.existsSync('local/releases'))return null;
 const candidates=[];
 for(const entry of fs.readdirSync('local/releases')){
  const file=path.resolve('local/releases',entry,'native-cli/report.json');
  if(file===reportFile||!fs.existsSync(file))continue;
  const r=JSON.parse(fs.readFileSync(file));
  if(r.version!==VERSION||JSON.stringify(r.engineHashes)!==JSON.stringify(hashes))continue;
  const changed=[...new Set([...Object.keys(r.sourceHashes),...Object.keys(sourceHashes)])]
   .filter(name=>r.sourceHashes[name]!==sourceHashes[name]);
  if(changed.every(name=>reusableInputs.has(name)))candidates.push({file,passed:r.tests.filter(t=>t.passed).length});
 }
 return candidates.sort((a,b)=>b.passed-a.passed)[0]?.file??null;
}
const reuseFile=arg('--reuse-report',previousNativeEvidence());
if(!prior&&reuseFile){
 const previous=JSON.parse(fs.readFileSync(reuseFile));
 assert.equal(previous.version,VERSION);assert.deepEqual(previous.engineHashes,hashes);
 const allowed=reusableInputs;
 const changed=[...new Set([...Object.keys(previous.sourceHashes),...Object.keys(sourceHashes)])]
  .filter(file=>previous.sourceHashes[file]!==sourceHashes[file]);
 assert.ok(changed.every(file=>allowed.has(file)),'Core or shared inputs changed; completed native checks cannot be reused.');
 const excluded=new Set([
  ...(changed.includes('fomkyr/tests/test_cooperative_pressure_067.mjs')?['cooperative-pressure']:[]),
  ...(changed.includes('fomkyr/tests/test_cooperative_reserve_067.mjs')?['cooperative-reserve']:[]),
  ...(changed.includes('fomkyr/tests/test_cli_065.py')?['cli-resume']:[]),
  ...(changed.some(file=>file==='fomkyr/tests/test_fk_gate_wasm_068.mjs'||file==='fomkyr/tests/audit_fk_gate_wasm_068.py')?['fk-gate-wasm']:[])]);
 report.tests=previous.tests.filter(test=>test.passed&&!excluded.has(test.name)).map(test=>({...test,
  reusedFrom:{report:path.resolve(reuseFile),changedInputs:changed}}));
 // Retain the previously built local executables; their source and every
 // production Wasm/host input matched above. Historical reports stay intact.
 fs.cpSync(path.join(path.dirname(reuseFile),'source','dist'),path.join(stage,'dist'),{recursive:true});
 report.previousEvidence={report:path.resolve(reuseFile),sourceHashes:previous.sourceHashes};
}
report.state='running';const save=()=>writeJSON(reportFile,report);save();
const checks=[
 ['cached-radix-property-build','clang',['-std=c11','-O2','-fsanitize=address,undefined','-fno-sanitize-recover=all','tests/test_radix_cached.c','-o','dist/cached-radix-properties']],
 ['cached-radix-properties','env',['ASAN_OPTIONS=detect_leaks=0','./dist/cached-radix-properties']],
 ['cached-radix-wasm',process.execPath,['--experimental-wasm-memory64','tests/test_radix_cached_wasm.mjs']],
 ['worker-progress-build','clang',['-std=c11','-O2','-Werror=format','-fno-builtin','-pthread','tests/test_native_pool_progress.c','src/kernel.c','native/host.c','native/support.c','native/fixture.c','-o','dist/worker-progress']],
 ['worker-progress','./dist/worker-progress',[]],
 ['packed-word-property-build','clang',['-std=c11','-O2','-fsanitize=undefined','-fno-sanitize-recover=all','tests/test_packed_words.c','-o','dist/packed-word-properties']],
 ['packed-word-properties','./dist/packed-word-properties',[]],
 ['native-build','make',['native']],
 ['kernel-reference-build','clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared','src/kernel.c','tests/host.c','-fuse-ld=lld','-o','dist/libfomkyr.so']],
 ['fk-profile-identity','python3',['tests/test_fk_profile_identity_068.py']],
 ['fk-gate-native','python3',['tests/test_fk_gate_068.py']],
 ['fk-gate-wasm',process.execPath,['--experimental-wasm-memory64','tests/test_fk_gate_wasm_068.mjs']],
 ['fk-gate-cli','python3',['tests/test_fk_gate_cli_068.py']],
 ['fk-gate-ubsan','bash',['tools/test_gate_ubsan_068.sh']],
 ['cooperative-native','python3',['tests/test_cooperative_067.py']],
 ['cooperative-wasm',process.execPath,['--experimental-wasm-memory64','tests/test_cooperative_wasm_067.mjs']],
 ['cooperative-pressure',process.execPath,['--experimental-wasm-memory64','tests/test_cooperative_pressure_067.mjs']],
 ['cooperative-reserve',process.execPath,['--experimental-wasm-memory64','tests/test_cooperative_reserve_067.mjs']],
 ['native-frontier','python3',['tests/test_frontier_native_065.py']],
 ['wasm-frontier',process.execPath,['--experimental-wasm-memory64','tests/test_frontier_wasm.mjs']],
 ['cli-resume','python3',['tests/test_cli_065.py']],
 ['cli-edges','python3',['tests/test_cli_edges_065.py']],
 ['human-cli','python3',['tests/test_human_cli.py']],
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
  // These scripts contain several separately bounded solver jobs (up to 120 s
  // each). Their aggregate runtime is not the runtime of one calculation.
  const deadlineSeconds=['cli-resume','cli-edges','cooperative-wasm','cooperative-pressure','cooperative-reserve','fk-gate-wasm','fk-gate-cli'].includes(name)?600:120;
  const start=performance.now(),log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
  console.log(name,'started');
  try{
   await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:stage,stdio:['ignore',fd,fd],detached:true});
    const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
    const timer=setTimeout(()=>{stop();reject(new Error(name+' exceeded '+deadlineSeconds+' seconds: '+log));},deadlineSeconds*1000);
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
