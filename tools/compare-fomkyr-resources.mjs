// Audit completed cold runs after timing and summarize medians/censored jobs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {algebra} from '../test/support/algebra.mjs';
import {readInputFile} from '../web/src/bergman-syntax.js';

const out=process.argv[2]||'build/validation/fomkyr-04-speed-comparison';
const directories=process.argv.slice(3);
assert.equal(directories.length,3,'Provide baseline, current degree-8/9, and current degree-10 directories.');
fs.mkdirSync(out,{recursive:true});
const reports=directories.map(directory=>JSON.parse(fs.readFileSync(path.join(directory,'report.json'))));
for(const report of reports){
  assert.equal(report.state,'complete');
  assert.equal(report.inputSha256,reports[0].inputSha256);
  assert.equal(report.memoryMiB,2048);
  assert.equal(report.timeLimitSeconds,120);
  assert.deepEqual(report.machine,reports[0].machine);
}
const input=JSON.parse(fs.readFileSync(reports[0].inputFile)).inputText;
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input),a=algebra(vars);
const canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([word,[n,d]])=>[word,n.toString(),d.toString()]));
const references=new Map(),audits=[],membershipCache=new Set();
for(let i=0;i<reports.length;i++)for(const row of reports[i].rows){
  if(row.status!=='complete')continue;
  const file=path.join(directories[i],row.basisFile),text=fs.readFileSync(file,'utf8');
  assert.equal(row.outputHasDone,true);assert.equal(row.native.workers,4);assert.equal(row.native.bits,64);
  assert.equal(row.native.version,i===0?'0.3.0':'0.4.0');
  assert.equal(row.native.completedThroughDegree,row.degree);
  const basis=a.basis(text),heads=basis.map(a.lead).sort(),polynomials=basis.map(canonical).sort();
  assert.equal(basis.length,row.basisSize);assert.equal(basis.length,{8:990,9:1451,10:2155}[row.degree]);
  for(const relation of rels)assert.equal(a.nf(a.parse(relation),basis).size,0,'Input relation must reduce to zero.');
  if(!references.has(row.degree))references.set(row.degree,{file,heads,polynomials,basis,
    byHead:new Map(basis.map(p=>[a.lead(p),p]))});
  const reference=references.get(row.degree);assert.deepEqual(heads,reference.heads,'Leading words agree across runs.');
  const polynomialEquality=JSON.stringify(polynomials)===JSON.stringify(reference.polynomials);
  const changed=basis.filter(p=>canonical(p)!==canonical(reference.byHead.get(a.lead(p))));
  const membershipKey=row.degree+':'+crypto.createHash('sha256').update(JSON.stringify(polynomials)).digest('hex');
  if(!polynomialEquality&&!membershipCache.has(membershipKey)){
    // Shared polynomials are already members; check both directions for changed tails.
    for(const p of changed){
      assert.equal(a.nf(p,reference.basis).size,0,'Changed polynomial reduces against reference.');
      assert.equal(a.nf(reference.byHead.get(a.lead(p)),basis).size,0,'Reference reduces against changed basis.');
    }
    membershipCache.add(membershipKey);
  }
  audits.push({version:row.native.version,browser:row.browser,degree:row.degree,trial:row.trial,
    file,sha256:crypto.createHash('sha256').update(text).digest('hex'),rules:basis.length,
    inputMembership:true,leadingWordsMatch:true,monicPolynomialSetMatches:polynomialEquality,
    differingTails:changed.length,mutualIdealMembership:true,reference:reference.file});
}
const median=values=>{const s=[...values].sort((x,y)=>x-y),n=s.length;return n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2;};
const summarize=rows=>rows.length?{
  trials:rows.length,coldMedianSeconds:median(rows.map(r=>r.coldWallSeconds)),
  coldRangeSeconds:[Math.min(...rows.map(r=>r.coldWallSeconds)),Math.max(...rows.map(r=>r.coldWallSeconds))],
  medianCpuCoreSeconds:median(rows.map(r=>r.cpuSeconds)),
  medianAdditionalPeakPssMiB:median(rows.map(r=>r.peakPssMiB-r.baselinePssMiB)),
}:null;
const comparisons=[];
for(const browser of ['chromium','firefox'])for(const degree of [8,9,10]){
  const oldRows=reports[0].rows.filter(r=>r.browser===browser&&r.degree===degree);
  const newRows=reports.slice(1).flatMap(r=>r.rows).filter(r=>r.browser===browser&&r.degree===degree);
  const old=summarize(oldRows.filter(r=>r.status==='complete')),current=summarize(newRows.filter(r=>r.status==='complete'));
  comparisons.push({browser,degree,baseline:old,current,
    baselineCensored:oldRows.filter(r=>r.status!=='complete').map(r=>({status:r.status,capSeconds:r.timeLimitSeconds,coldWallSeconds:r.coldWallSeconds})),
    speedRatio:old&&current?old.coldMedianSeconds/current.coldMedianSeconds:null});
}
const report={state:'complete',date:new Date().toISOString(),inputSha256:reports[0].inputSha256,
  sources:directories.map(directory=>path.join(directory,'report.json')),comparisons,audits,
  method:'Serial grouped cold runs; 3 trials at degrees 8/9, 1 upgraded trial at degree 10. Completed outputs have equal leading words and mutual ideal membership; changed tails are checked by two-way exact reductions, identical polynomials require no reduction. Every input relation reduces to zero. This is consistency evidence, not a new high-degree critical-pair certificate. Degree-10 baseline timeouts do not supply an exact speed ratio. CPU/PSS includes the post-timer full OPFS read; wall time excludes it. Variable desktop load limits generalization.'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({state:report.state,completedOutputs:audits.length,comparisons},null,2));
