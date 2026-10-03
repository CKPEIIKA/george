// Evaluate newly introduced exact-arithmetic paths using the production adapter.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import {stageBoundedReserveTests} from './stage-fomkyr-tests.mjs';
import {copyFomkyrSource} from './fomkyr-source.mjs';
import {CheckTimings, engineHashes, validationSnapshot, writeJSON, fileHash} from './release-support.mjs';

const out=path.resolve(process.argv[2]??'local/validation/fomkyr-'+VERSION+'-exact');
const stage=path.join(out,'source');fs.mkdirSync(out,{recursive:true});
const previous=process.argv.includes('--resume')&&fs.existsSync(path.join(out,'report.json'))?JSON.parse(fs.readFileSync(path.join(out,'report.json'))):null;
const sourceHashes=validationSnapshot(),hashes=engineHashes(),timings=new CheckTimings(out);
if(previous){
  assert.equal(previous.version,VERSION);
  assert.deepEqual(previous.validationSourceHashes,sourceHashes,'Validation sources changed; use a new output directory.');
  for(const name of fs.readdirSync('web/engine/fomkyr').filter(n=>/\.(js|wasm)$/.test(n)))
    assert.deepEqual(fs.readFileSync(path.join(stage,'web',name)),fs.readFileSync('web/engine/fomkyr/'+name),'Production snapshot changed: '+name);
  const inventory=JSON.parse(fs.readFileSync('fomkyr/SOURCE.json'));
  for(const [name,record] of Object.entries(inventory.retainedBuildAndTestFiles).filter(([n])=>n.startsWith('src/')))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,name))).digest('hex'),record.sha256,'Native source changed: '+name);
}
copyFomkyrSource(stage);
fs.cpSync('web/engine/fomkyr',path.join(stage,'web'),{recursive:true});
stageBoundedReserveTests(stage);
fs.mkdirSync(path.join(stage,'results','0.6.2'),{recursive:true});
fs.mkdirSync(path.join(stage,'results','0.6.3'),{recursive:true});
fs.mkdirSync(path.join(stage,'results','0.6.4'),{recursive:true});
const report={state:'running',version:VERSION,tests:previous?.tests??[],scope:'Actual production Wasm coordinator and unchanged C kernel. Native integer/Fraction references and independent serialized-basis completion; Node filesystem emulates OPFS. Browser evidence is separate. Reserve degree 16 retains overflow rescue; independent oracle cases each have a 120-second deadline. Cancellation latency is measured from the observed active lease.'};
Object.assign(report,{startedAt:previous?.startedAt??new Date().toISOString(),engineHashes:hashes,validationSourceHashes:sourceHashes});
const save=()=>writeJSON(path.join(out,'report.json'),report);
const upstreamAt=process.argv.indexOf('--upstream-report');
let upstream;
if(upstreamAt>=0){
  const file=process.argv[upstreamAt+1];upstream=JSON.parse(fs.readFileSync(file));
  assert.equal(upstream.state,'complete');assert.equal(upstream.upstreamVersion,VERSION);
  assert.equal(upstream.upstreamHost,'production');
  assert.ok(upstream.upstreamTests.length>=25&&upstream.upstreamTests.every(test=>test.passed));
  assert.deepEqual(upstream.engineHashes,hashes);assert.deepEqual(upstream.validationSourceHashes,sourceHashes);
  assert.equal(upstream.importedArchiveSha256,JSON.parse(fs.readFileSync('fomkyr/SOURCE.json')).archiveSha256);
  report.upstreamEvidence={sha256:fileHash(file)};
}
save();
const run=(name,command,args)=>{
  if(report.tests.some(t=>t.name===name&&t.passed))return;
  if(name==='native-build'&&upstream){report.tests.push({name,passed:true,reusedFromUpstream:true});save();return;}
  const inherited=upstream?.upstreamTests.find(test=>test.name===name&&test.passed);
  if(inherited){
    report.tests.push({name,passed:true,reusedFromUpstream:true,summary:inherited.report});save();
    console.log(name,'PASS (already checked upstream)');return;
  }
  // This script runs several separately bounded calculations. The group's
  // deadline must allow their combined duration and independent certificates.
  const timeout=name==='automatic-four-wasm-and-certificate'?600000
    :['four-wasm-overflow-reserve','cancel-acquired-reserve'].includes(name)?1800000:120000;
  const stdout=timings.run(name,command,args,{cwd:stage,timeout});
  let summary;try{summary=JSON.parse(stdout.trim().split('\n').at(-1));}catch{}
  report.tests.push({name,passed:true,...(summary?{summary}:{})});save();console.log(name,'PASS');
};
try{
  run('native-build','/usr/bin/clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared','src/kernel.c','tests/host.c','-fuse-ld=lld','-o','dist/libfomkyr.so']);
  run('big-integer-division','python3',['tests/test_big_division.py']);
  run('big-exact-fractions','python3',['tests/test_big_fraction.py']);
  run('held-out-presentations','python3',['tests/test_062_presentations.py']);
  run('four-wasm-exact-paths',process.execPath,['tests/test_062_wasm.mjs']);
  const copyEvidence=(version,files)=>{for(const file of files){
    const local=path.join(stage,'results',version,file);
    const source=fs.existsSync(local)?local:path.join(path.dirname(process.argv[upstreamAt+1]??''),'upstream/results',version,file);
    fs.copyFileSync(source,path.join(out,file));
  }};
  copyEvidence('0.6.2',['presentation-regressions.json','wasm-exact.json','wasm-exact-oracle.json']);
  if(fs.existsSync(path.join(stage,'tests/test_063_wasm.mjs'))) {
    run('radix-property-build','/usr/bin/clang',['-std=c11','-O2','-fsanitize=undefined','-fno-sanitize-recover=all','tests/radix_property_063.c','-o','dist/radix-property-063']);
    run('radix-properties',path.join(stage,'dist/radix-property-063'),[]);
    run('nearby-fk-queue-parity','python3',['tests/test_063_native.py']);
    run('four-wasm-overflow-reserve',process.execPath,['tests/test_063_wasm.mjs']);
    run('cancel-acquired-reserve',process.execPath,['tests/test_063_cancel_leased.mjs']);
    run('upstream-control-roundtrip',process.execPath,['tests/test_063_controls.mjs']);
    copyEvidence('0.6.3',['fk-nearby.json','reserve-wasm.json','reserve-wasm-oracle.json','cancel-leased.json']);
  }
  if(fs.existsSync(path.join(stage,'tests/test_064_wasm.mjs'))) {
    run('automatic-memory-planner',process.execPath,['tests/test_memory_policy.mjs']);
    run('automatic-control-upgrade',process.execPath,['tests/test_memory_controls.mjs']);
    run('pending-suffix-exact-parity','python3',['tests/test_064_native.py']);
    run('pending-suffix-ubsan','bash',['tools/test_064_ubsan.sh']);
    run('automatic-four-wasm-and-certificate',process.execPath,['tests/test_064_wasm.mjs']);
    run('cancel-automatic-retry',process.execPath,['tests/test_064_cancel.mjs']);
    run('automatic-large-record-restore',process.execPath,['tests/test_064_restore.mjs']);
    run('automatic-small-budgets',process.execPath,['tests/test_064_small_budget.mjs']);
    copyEvidence('0.6.4',['planner.json','batch-retry-native.json','auto-wasm.json',
      'auto-wasm-manifest.json','auto-wasm-oracle.json','auto-cancellation.json','auto-restore.json','small-budget.json']);
  }
  report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
