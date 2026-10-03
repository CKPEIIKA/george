// Short fresh comparisons against a preserved compiled ECL engine directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {assessBergmanRegression} from './bergman-regression.mjs';
const arg=(key,fallback)=>{const at=process.argv.indexOf(key);return at<0?fallback:process.argv[at+1];};
if(process.argv.includes('--help')){
  console.log('Usage: npm run benchmark:bergman:regression -- --baseline-root <saved-engine-directory> [--degree 6] [--out <local-directory>] [--trials 3] [--memory-mib 4096] [--max-slowdown 1.15]');
  process.exit(0);
}
const baseline=arg('--baseline-root',null);assert.ok(baseline,'Provide a saved compiled ECL engine directory');
const degree=Number(arg('--degree','6')),trials=Number(arg('--trials','3')),slowdown=Number(arg('--max-slowdown','1.15'));
assert.ok(Number.isInteger(degree)&&degree>=2&&degree<=7);assert.ok(Number.isInteger(trials)&&trials>=3&&trials<=7);
assert.ok(Number.isFinite(slowdown)&&slowdown>1);
const out=path.resolve(arg('--out','local/benchmarks/bergman-regression-'+Date.now()));
const input='test/fixtures/fomin-kirillov-user.json';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const child=spawn(process.execPath,['tools/benchmark-backend-resources.mjs','--out',out,'--input-file',input,'--degrees',String(degree),
  '--configs','compiled-previous,compiled','--bergman-baseline-root',path.resolve(baseline),'--trials',String(trials),
  '--memory-mib',arg('--memory-mib','4096'),'--timeout-seconds','60','--sample-ms','250'],{stdio:'inherit'});
const interrupted=()=>child.kill('SIGTERM');process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);
assert.equal(code,0,'Measurement failed; raw observations are preserved in '+out);
const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
assert.equal(report.inputSha256,hash(input),'Input changed during measurement');
const anchor=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json')).degrees.find(row=>row.degree===degree);
assert.equal(hash(anchor.referenceFile),anchor.referenceSha256,'Saved exact basis changed');
for(const row of report.rows){
  if(row.status==='complete'&&row.basisFile)row.basisSha256=hash(path.join(out,row.basisFile));
  if(row.basisSha256)assert.equal(row.basisSha256,anchor.referenceSha256,'Output differs from the saved FK6 basis');
}
const result={...assessBergmanRegression(report,{maxSlowdown:slowdown}),
  inputSha256:report.inputSha256,sourceHashes:report.sourceHashes,method:'Fresh alternating versions; computation compared separately from cold startup. Exact saved basis SHA-256. CPU power and memory-pressure conditions must remain comparable. Timing variance yields an inconclusive result.'};
fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(result,null,2)+'\n');
console.log(result.state,JSON.stringify(result.groups.map(({degree,medianRatio})=>({degree,medianRatio}))),result.reasons.join('; '));
process.exitCode=result.state==='passed'?0:result.state==='regression'?1:2;
