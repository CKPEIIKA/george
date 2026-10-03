// Output checks after matched browser timings; no mathematics runs during timing.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readInputFile} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';
const out=path.resolve(process.argv[2]);
const summary={state:'running',scenarios:[]};
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length%2?sorted[sorted.length>>1]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;};
for(const scenario of ['fk6','scaled-fk6','q-serre-q2','q-serre-q3']) {
 const directory=path.join(out,scenario),report=JSON.parse(fs.readFileSync(path.join(directory,'report.json')));
 assert.equal(report.state,'complete');
 const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+JSON.parse(fs.readFileSync(report.inputFile)).inputText),a=algebra(vars);
 const input=rels.map(a.parse),canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([w,[n,d]])=>[w,n.toString(),d.toString()]));
 const references=new Map(),checked=new Map(),audits=[];
 for(const row of report.rows) {
  if(row.status!=='complete')continue;
  const basis=a.basis(fs.readFileSync(path.join(directory,row.basisFile),'utf8')),heads=basis.map(a.lead).sort();
  assert.equal(basis.length,row.basisSize);assert.equal(row.native.completedThroughDegree,row.degree);
  assert.equal(row.native.workers,4);assert.equal(row.native.bits,64);assert.equal(row.native.shared,true);
  if(!references.has(row.degree))references.set(row.degree,basis);
  const reference=references.get(row.degree);assert.deepEqual(heads,reference.map(a.lead).sort());
  const fingerprint=JSON.stringify(basis.map(canonical).sort()),key=row.degree+':'+fingerprint;
  let proof=checked.get(key);
  if(!proof){
   for(const p of input.filter(p=>a.degree(a.lead(p))<=row.degree))assert.equal(a.nf(p,basis).size,0);
   for(const p of basis)assert.equal(a.nf(p,reference).size,0);
   for(const p of reference)assert.equal(a.nf(p,basis).size,0);
   const ambiguities=scenario.startsWith('q-serre')?a.certify(input.filter(p=>a.degree(a.lead(p))<=row.degree),basis,row.degree):null;
   proof={inputMembership:true,mutualIdealMembership:true,ambiguities};checked.set(key,proof);
  }
  audits.push({id:row.id,degree:row.degree,trial:row.trial,rules:basis.length,version:row.native.version,...proof});
 }
 const comparisons=[];
 for(const browser of ['chromium','firefox'])for(const degree of report.degrees){
  const rows=report.rows.filter(row=>row.degree===degree&&row.browser===browser),previous=rows.filter(r=>r.id.includes('previous')),current=rows.filter(r=>!r.id.includes('previous'));
  const describe=rows=>{const completed=rows.filter(r=>r.status==='complete');return {trials:completed.length,censored:rows.filter(r=>r.status!=='complete').map(r=>({status:r.status,capSeconds:r.timeLimitSeconds})),medianSeconds:completed.length?median(completed.map(r=>r.coldWallSeconds)):null,rangeSeconds:completed.length?[Math.min(...completed.map(r=>r.coldWallSeconds)),Math.max(...completed.map(r=>r.coldWallSeconds))]:null};};
  const old=describe(previous),fresh=describe(current);
  comparisons.push({browser,degree,previous:old,current:fresh,speedRatio:old.medianSeconds&&fresh.medianSeconds?old.medianSeconds/fresh.medianSeconds:null});
 }
 summary.scenarios.push({scenario,completedOutputs:audits.length,audits,comparisons});
}
summary.state='complete';fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(summary,null,2)+'\n');
console.log('Matched outputs and bounded q-Serre critical compositions PASS');
