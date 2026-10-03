// Matched, alternating cold browser comparisons of two core versions.
// CPU-heavy tests and output audits run outside the measurement phase.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import {VERSION} from '../web/engine/fomkyr/storage.js';
const arg=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const baseline=arg('--baseline-root',null);
const savedBaseline=arg('--baseline-report',null);
if(!baseline&&!savedBaseline)throw new Error('Provide --baseline-report to reuse saved timings, or --baseline-root for a fresh paired comparison.');
const savedProtocol=savedBaseline?JSON.parse(fs.readFileSync(path.join(savedBaseline,'protocol.json'))):null;
if(savedProtocol)assert.equal(savedProtocol.state,'complete');
const previous=savedProtocol?.current??JSON.parse(fs.readFileSync(path.join(baseline,'build.json'))).version;
const out=path.resolve(arg('--out',`local/benchmarks/fomkyr-${VERSION}-vs-${previous}${savedBaseline?'-saved':''}`));fs.mkdirSync(out,{recursive:true});
const run=(command,args)=>{const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(command+' exited '+r.status);};
const cases=[
 ['fk6','test/fixtures/fomin-kirillov-user.json','1,2,3,4,5,6,7,8,9','9','FK6'],
 ['scaled-fk6','test/fixtures/random-fk6-growing.json','1,2,3,4,5,6,7,8,9','9','Scaled FK6'],
 ['q-serre-q2','test/fixtures/coefficient-workloads/affine-q-serre-q2.json','4,8,12,15','15','Affine q-Serre, q = 2'],
 ['q-serre-q3','test/fixtures/coefficient-workloads/affine-q-serre-q3.json','4,8,12,15','15','Affine q-Serre, q = 3'],
];
// Reject an unsuitable saved baseline before starting any browser jobs.
if(savedBaseline){
 const machine={cpu:fs.readFileSync('/proc/cpuinfo','utf8').match(/^model name\s*:\s*(.+)$/m)?.[1],
  logicalCpus:os.cpus().length,totalRamMiB:os.totalmem()/1048576,platform:process.platform};
 for(const [name,input,degrees,repeated] of cases){
  const old=JSON.parse(fs.readFileSync(path.join(savedBaseline,name,'report.json')));
  assert.equal(old.state,'complete');assert.deepEqual(old.machine,machine,'Saved timings describe a different machine.');
  assert.equal(old.inputSha256,crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'));
  assert.equal(old.memoryMiB,2048);assert.equal(old.batchPairs,null);assert.equal(old.sampleIntervalSeconds,0.25);
  for(const browser of ['chromium','firefox'])for(const degree of degrees.split(',').map(Number)){
   const trials=repeated.split(',').map(Number).includes(degree)?[0,1,2]:[0];
   for(const trial of trials)assert.ok(old.rows.some(row=>['fomkyr','fomkyr-firefox'].includes(row.id)
    &&row.browser===browser&&row.degree===degree&&row.trial===trial),'Missing saved baseline for '+name+', '+browser+', degree '+degree+', trial '+trial);
  }
 }
}
for(const [name,input,degrees,repeated] of cases) {
 const common=['tools/benchmark-backend-resources.mjs','--out',path.join(out,name),'--input-file',input,
  ...(savedBaseline?[]:['--baseline-root',path.resolve(baseline)]),
  '--configs',savedBaseline?'fomkyr,fomkyr-firefox':'fomkyr-previous,fomkyr,fomkyr-previous-firefox,fomkyr-firefox',
  '--timeout-seconds','120','--skip-censored','--resume'];
 run(process.execPath,[...common,'--degrees',degrees,'--trials','1']);
 run(process.execPath,[...common,'--degrees',repeated,'--trials','3']);
}
if(savedBaseline)for(const [name] of cases){
 const directory=path.join(out,name),oldDirectory=path.join(savedBaseline,name);
 const report=JSON.parse(fs.readFileSync(path.join(directory,'report.json'))),old=JSON.parse(fs.readFileSync(path.join(oldDirectory,'report.json')));
 assert.equal(old.state,'complete');assert.equal(old.inputSha256,report.inputSha256);
 assert.equal(old.memoryMiB,report.memoryMiB);assert.equal(old.batchPairs,report.batchPairs);
 assert.equal(old.sampleIntervalSeconds,report.sampleIntervalSeconds);
 assert.deepEqual(old.machine,report.machine,'Saved timings describe a different machine. Use a fresh paired comparison.');
 assert.equal(report.machine.logicalCpus,os.cpus().length);
 const savedRows=old.rows.filter(row=>['fomkyr','fomkyr-firefox'].includes(row.id));assert.ok(savedRows.length);
 const rows=savedRows.map(row=>{
  if(row.status==='complete'){assert.equal(row.native.version,previous);assert.equal(row.native.bits,64);assert.equal(row.native.workers,4);}
  assert.equal(row.timeLimitSeconds,120);assert.equal(row.memoryMiB,2048);
  const copy={...row,id:row.id==='fomkyr'?'fomkyr-previous':'fomkyr-previous-firefox',savedTiming:true};
  if(row.basisFile){const file='saved-'+path.basename(row.basisFile);fs.copyFileSync(path.join(oldDirectory,row.basisFile),path.join(directory,file));copy.basisFile=file;}
  delete copy.samplesFile;return copy;
 });
 for(const row of report.rows)assert.ok(savedRows.some(oldRow=>oldRow.browser===row.browser&&oldRow.degree===row.degree&&oldRow.trial===row.trial),
   'Missing saved baseline for '+row.browser+', degree '+row.degree+', trial '+row.trial);
 const comparison={...report,rows:[...rows,...report.rows],
  configurations:[...old.configurations.filter(c=>['fomkyr','fomkyr-firefox'].includes(c.id)).map(c=>({...c,id:c.id==='fomkyr'?'fomkyr-previous':'fomkyr-previous-firefox',label:previous+' / '+c.browser+' (saved)'})),...report.configurations],
  comparisonBaseline:{version:previous,startedAt:old.startedAt,reportSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(oldDirectory,'report.json'))).digest('hex'),
   method:'Saved measurements on the same reported machine and allowances; measurement dates differ. Only the new engine is rerun.'}};
 fs.writeFileSync(path.join(directory,'comparison-report.json'),JSON.stringify(comparison,null,2)+'\n');
}
// All cases finish timing before any exact output certificate or plotting starts.
run(process.execPath,['tools/audit-fomkyr-update.mjs',out]);
for(const [name,,, ,title] of cases) {
 if(name.endsWith('fk6'))run(process.execPath,['tools/audit-backend-resources.mjs',path.join(out,name,'report.json')]);
 run('python3',['tools/plot-backend-resources.py',path.join(out,name,savedBaseline?'comparison-report.json':'report.json'),'--title',title]);
}
fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({state:'complete',previous,current:VERSION,scenarios:cases.map(([name,input,degrees,repeated])=>({name,input,degrees:degrees.split(',').map(Number),threeTrialDegrees:repeated.split(',').map(Number)})),serial:true,alternatingVersions:!savedBaseline,savedBaseline:!!savedBaseline,workers:4,memoryMiB:2048,bits:64,resume:false,timeLimitSeconds:120,plotScale:'linear'},null,2)+'\n');
console.log(out);
