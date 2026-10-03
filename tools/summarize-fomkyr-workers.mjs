// Exact output audit and local worker-scaling summaries, run after measurements.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {algebra} from '../test/support/algebra.mjs';
import {readInputFile} from '../web/src/bergman-syntax.js';

const [out,...directories]=process.argv.slice(2);
assert.ok(out&&directories.length,'Provide an output directory and measured report directories.');
const input=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).inputText;
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input),a=algebra(vars);
const canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([word,[n,d]])=>[word,n.toString(),d.toString()]));
const median=values=>{const s=[...values].sort((x,y)=>x-y),n=s.length;return n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2;};
const referenceFiles=Object.fromEntries([8,9,10].map(degree=>[degree,`test/fixtures/fk6-bases/d${degree}.gb`]));
const references=new Map(),membershipCache=new Set(),audits=[],summaries=[];
for(const directory of directories){
  const report=JSON.parse(fs.readFileSync(path.join(directory,'report.json')));
  assert.equal(report.state,'complete');assert.equal(report.errors.length,0);
  assert.equal(report.inputSha256,crypto.createHash('sha256').update(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).digest('hex'));
  for(const row of report.rows){
    if(row.status!=='complete'){audits.push({file:null,browser:row.browser,degree:row.degree,status:row.status});continue;}
    const file=path.join(directory,row.basisFile),text=fs.readFileSync(file,'utf8'),basis=a.basis(text);
    assert.ok(['0.4.0','0.6.0','0.6.1','0.6.2','0.6.3'].includes(row.native.version));assert.equal(row.native.bits,64);assert.equal(row.native.shared,true);
    assert.equal(row.outputHasDone,true);assert.equal(row.native.completedThroughDegree,row.degree);
    const expected=row.requestedWorkers||Math.min(32,Math.max(1,row.environment.hardwareConcurrency-1));
    assert.equal(row.native.workers,expected);
    assert.equal(row.native.lanePairs.length,expected);assert.ok(row.native.lanePairs.every(pairs=>pairs>0));
    if(!references.has(row.degree)){
      const refFile=referenceFiles[row.degree];assert.ok(refFile,'Only degrees 8–10 have archived references.');
      const gb=a.basis(fs.readFileSync(refFile,'utf8'));
      references.set(row.degree,{file:refFile,basis:gb,heads:gb.map(a.lead).sort(),byHead:new Map(gb.map(p=>[a.lead(p),p]))});
    }
    const reference=references.get(row.degree);assert.deepEqual(basis.map(a.lead).sort(),reference.heads);
    const polynomials=basis.map(canonical).sort(),hash=crypto.createHash('sha256').update(JSON.stringify(polynomials)).digest('hex');
    const changed=basis.filter(p=>canonical(p)!==canonical(reference.byHead.get(a.lead(p))));
    const key=row.degree+':'+hash;
    if(!membershipCache.has(key)){
      for(const relation of rels)assert.equal(a.nf(a.parse(relation),basis).size,0,'Exact input membership.');
      for(const p of changed){
        assert.equal(a.nf(p,reference.basis).size,0,'Changed polynomial reduces against reference.');
        assert.equal(a.nf(reference.byHead.get(a.lead(p)),basis).size,0,'Reference reduces against changed basis.');
      }
      membershipCache.add(key);
    }
    audits.push({file,sha256:crypto.createHash('sha256').update(text).digest('hex'),reference:reference.file,
      browser:row.browser,version:row.native.version,degree:row.degree,trial:row.trial,requestedWorkers:row.requestedWorkers,
      actualWorkers:row.native.workers,rules:basis.length,inputMembership:true,leadingWordsMatch:true,
      mutualIdealMembership:true,differingTails:changed.length,lanePairs:row.native.lanePairs,eachLaneReducedPairs:true});
  }
  for(const config of report.configurations)for(const degree of report.degrees){
    const rows=report.rows.filter(row=>row.id===config.id&&row.degree===degree),completed=rows.filter(row=>row.status==='complete');
    if(!completed.length)continue;
    const one=report.rows.filter(row=>row.browser===config.browser&&row.degree===degree&&row.requestedWorkers===1&&row.status==='complete');
    const coldMedianSeconds=median(completed.map(row=>row.coldWallSeconds));
    summaries.push({report:path.join(directory,'report.json'),browser:config.browser,version:completed[0].native.version,degree,batchPairs:report.batchPairs,
      requestedWorkers:config.workers,actualWorkers:completed[0].native.workers,trials:completed.length,
      coldMedianSeconds,coldRangeSeconds:[Math.min(...completed.map(row=>row.coldWallSeconds)),Math.max(...completed.map(row=>row.coldWallSeconds))],
      speedupVsOneWorker:one.length?median(one.map(row=>row.coldWallSeconds))/coldMedianSeconds:null,
      medianCpuCoreSeconds:median(completed.map(row=>row.cpuSeconds)),
      medianAdditionalPeakPssMiB:median(completed.map(row=>row.peakPssMiB-row.baselinePssMiB)),
      medianReduceSeconds:median(completed.map(row=>row.native.scheduler.reduceMs/1000)),
      medianCommitSeconds:median(completed.map(row=>row.native.scheduler.commitMs/1000)),
      censored:rows.filter(row=>row.status!=='complete').map(row=>({status:row.status,capSeconds:row.timeLimitSeconds}))});
  }
}
const first=JSON.parse(fs.readFileSync(path.join(directories[0],'report.json')));
const physicalCores=new Set(fs.readFileSync('/proc/cpuinfo','utf8').split('\n\n').filter(Boolean)
  .map(block=>[block.match(/^physical id\s*:\s*(.+)$/m)?.[1],block.match(/^core id\s*:\s*(.+)$/m)?.[1]].join(':'))).size;
const report={state:'complete',date:new Date().toISOString(),machine:{...first.machine,physicalCores},inputSha256:first.inputSha256,
  summaries,audits,method:'Serial cold profiles and engines, memory64, 2048 MiB, pruning/optimizers on, Hilbert/resume off. Controlled runs hold batch size 32; default probes use automatic batch size. All completed bases pass exact leading words and mutual ideal membership against archived outputs, with changed tails reduced both ways. High-degree checks establish consistency. Independent critical-pair/Singular certificates are available in the small-degree suite. Desktop load and frequency variation affect local timings; medians/ranges are retained.'};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({state:report.state,completedOutputs:audits.filter(a=>a.file).length,machine:report.machine,summaries},null,2));
