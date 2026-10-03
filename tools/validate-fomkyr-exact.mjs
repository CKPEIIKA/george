// Evaluate newly introduced exact-arithmetic paths using the production adapter.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import {stageBoundedReserveTests} from './stage-fomkyr-tests.mjs';

const out=path.resolve(process.argv[2]??'local/validation/fomkyr-'+VERSION+'-exact');
const stage=path.join(out,'source');fs.mkdirSync(out,{recursive:true});
const previous=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(path.join(out,'report.json'))):null;
if(previous){
  assert.equal(previous.version,VERSION);
  for(const name of fs.readdirSync('web/engine/fomkyr').filter(n=>/\.(js|wasm)$/.test(n)))
    assert.deepEqual(fs.readFileSync(path.join(stage,'web',name)),fs.readFileSync('web/engine/fomkyr/'+name),'Production snapshot changed: '+name);
  const inventory=JSON.parse(fs.readFileSync('vendor/fomkyr-'+VERSION+'/SOURCE.json'));
  for(const [name,record] of Object.entries(inventory.retainedBuildAndTestFiles).filter(([n])=>n.startsWith('src/')))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,name))).digest('hex'),record.sha256,'Native source changed: '+name);
}
fs.cpSync('vendor/fomkyr-'+VERSION,stage,{recursive:true});
fs.cpSync('web/engine/fomkyr',path.join(stage,'web'),{recursive:true});
stageBoundedReserveTests(stage);
fs.mkdirSync(path.join(stage,'results','0.6.2'),{recursive:true});
fs.mkdirSync(path.join(stage,'results','0.6.3'),{recursive:true});
const report={state:'running',version:VERSION,tests:previous?.tests??[],scope:'Actual production Wasm coordinator and unchanged C kernel. Native integer/Fraction references and independent serialized-basis completion; Node filesystem emulates OPFS. Browser evidence is separate. Reserve degree 16 retains overflow rescue; independent oracle cases each have a 120-second deadline. Cancellation latency is measured from the observed active lease.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();
const run=(name,command,args)=>{
  if(report.tests.some(t=>t.name===name&&t.passed))return;
  const result=spawnSync(command,args,{cwd:stage,encoding:'utf8',timeout:['four-wasm-overflow-reserve','cancel-acquired-reserve'].includes(name)?1800000:120000,maxBuffer:8*1024*1024,killSignal:'SIGKILL'});
  fs.writeFileSync(path.join(out,name+'.log'),(result.stdout??'')+(result.stderr??''));
  assert.ifError(result.error);assert.equal(result.status,0,name+': '+result.stderr);
  let summary;try{summary=JSON.parse(result.stdout.trim().split('\n').at(-1));}catch{}
  report.tests.push({name,passed:true,...(summary?{summary}:{})});save();console.log(name,'PASS');
};
try{
  run('native-build','/usr/bin/clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared','src/kernel.c','tests/host.c','-fuse-ld=lld','-o','dist/libfomkyr.so']);
  run('big-integer-division','python3',['tests/test_big_division.py']);
  run('big-exact-fractions','python3',['tests/test_big_fraction.py']);
  run('held-out-presentations','python3',['tests/test_062_presentations.py']);
  run('four-wasm-exact-paths',process.execPath,['tests/test_062_wasm.mjs']);
  for(const file of ['presentation-regressions.json','wasm-exact.json','wasm-exact-oracle.json'])fs.copyFileSync(path.join(stage,'results','0.6.2',file),path.join(out,file));
  if(fs.existsSync(path.join(stage,'tests/test_063_wasm.mjs'))) {
    run('radix-property-build','/usr/bin/clang',['-std=c11','-O2','-fsanitize=undefined','-fno-sanitize-recover=all','tests/radix_property_063.c','-o','dist/radix-property-063']);
    run('radix-properties',path.join(stage,'dist/radix-property-063'),[]);
    run('nearby-fk-queue-parity','python3',['tests/test_063_native.py']);
    run('four-wasm-overflow-reserve',process.execPath,['tests/test_063_wasm.mjs']);
    run('cancel-acquired-reserve',process.execPath,['tests/test_063_cancel_leased.mjs']);
    run('upstream-control-roundtrip',process.execPath,['tests/test_063_controls.mjs']);
    for(const file of ['fk-nearby.json','reserve-wasm.json','reserve-wasm-oracle.json','cancel-leased.json'])fs.copyFileSync(path.join(stage,'results','0.6.3',file),path.join(out,file));
  }
  report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{save();}
