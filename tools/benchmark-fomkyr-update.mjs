// Matched, alternating cold browser comparisons of two core versions.
// CPU-heavy tests and output audits run outside the measurement phase.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {VERSION} from '../web/engine/fomkyr/storage.js';
const arg=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const baseline=arg('--baseline-root',null);
if(!baseline)throw new Error('Provide --baseline-root with a saved production engine directory.');
const previous=JSON.parse(fs.readFileSync(path.join(baseline,'build.json'))).version;
const out=path.resolve(arg('--out',`local/benchmarks/fomkyr-${VERSION}-vs-${previous}`));fs.mkdirSync(out,{recursive:true});
const run=(command,args)=>{const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(command+' exited '+r.status);};
const cases=[
 ['fk6','test/fixtures/fomin-kirillov-user.json','1,2,3,4,5,6,7,8,9','9','FK6'],
 ['scaled-fk6','test/fixtures/random-fk6-growing.json','1,2,3,4,5,6,7,8,9','9','Scaled FK6'],
 ['q-serre-q2','test/fixtures/coefficient-workloads/affine-q-serre-q2.json','4,8,12,15','15','Affine q-Serre, q = 2'],
 ['q-serre-q3','test/fixtures/coefficient-workloads/affine-q-serre-q3.json','4,8,12,15','15','Affine q-Serre, q = 3'],
];
for(const [name,input,degrees,repeated] of cases) {
 const common=['tools/benchmark-backend-resources.mjs','--out',path.join(out,name),'--input-file',input,
  '--baseline-root',path.resolve(baseline),'--configs','fomkyr-previous,fomkyr,fomkyr-previous-firefox,fomkyr-firefox',
  '--timeout-seconds','120','--skip-censored','--resume'];
 run(process.execPath,[...common,'--degrees',degrees,'--trials','1']);
 run(process.execPath,[...common,'--degrees',repeated,'--trials','3']);
}
// All cases finish timing before any exact output certificate or plotting starts.
run(process.execPath,['tools/audit-fomkyr-update.mjs',out]);
for(const [name,,, ,title] of cases) {
 if(name.endsWith('fk6'))run(process.execPath,['tools/audit-backend-resources.mjs',path.join(out,name,'report.json')]);
 run('python3',['tools/plot-backend-resources.py',path.join(out,name,'report.json'),'--title',title]);
}
fs.writeFileSync(path.join(out,'protocol.json'),JSON.stringify({state:'complete',previous,current:VERSION,scenarios:cases.map(([name,input,degrees,repeated])=>({name,input,degrees:degrees.split(',').map(Number),threeTrialDegrees:repeated.split(',').map(Number)})),serial:true,alternatingVersions:true,workers:4,memoryMiB:2048,bits:64,resume:false,timeLimitSeconds:120,plotScale:'linear'},null,2)+'\n');
console.log(out);
