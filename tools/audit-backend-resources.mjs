// Exact output audit, run after resource measurements.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {algebra} from '../test/support/algebra.mjs';
import {readInputFile} from '../web/src/bergman-syntax.js';
import {oraclePolynomial} from '../fomkyr/tools/oracle-format.mjs';
import {normalWordCounts} from '../test/support/normal-word-counts.mjs';
import {randomGrowingForm} from '../test/support/random-growing-form.mjs';

const reportFile = path.resolve(process.argv[2] || 'build/validation/backend-resources-degree8/report.json');
const directory = path.dirname(reportFile);
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
assert.equal(report.state, 'complete', 'Finish the serial benchmark first');
const inputFixture=JSON.parse(fs.readFileSync(report.inputFile,'utf8'));
const {vars,rels} = readInputFile('(ALGFORMINPUT)\n' + inputFixture.inputText);
const bergman = algebra(vars, false, 0);
const singular = algebra(vars.map((_, i) => 'fk_var_' + i), false, 0);
function basisFor(row) {
  if (row.id === 'singular') {
    const text = fs.readFileSync(path.join(directory, row.stdoutFile), 'utf8');
    return [...text.matchAll(/^POLY:(.+)$/gm)].map(match => singular.monic(oraclePolynomial(match[1],singular,vars.map((_,i)=>'fk_var_'+i))));
  }
  const basis = bergman.basis(fs.readFileSync(path.join(directory, row.basisFile), 'utf8'));
  return basis;
}
const results = [];
const anchors=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json'));
const baseFixture=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
const scaled=inputFixture.construction==='random-invertible-FK6-generator-scalings';
if(scaled)assert.deepEqual(inputFixture,randomGrowingForm(baseFixture.inputText,inputFixture.seed));
const archiveEligible=scaled||inputFixture.inputText===baseFixture.inputText;
const canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([w,[n,d]])=>[w,n.toString(),d.toString()]));
const audited=new Map();
for (const degree of report.degrees) {
  const completed=report.rows.filter(row=>row.degree===degree&&row.status==='complete');
  if(!completed.length)continue;
  let reference = ['compiled','singular','sbcl','memory64'].map(id=>completed.find(row=>row.id===id)).find(Boolean);
  let referenceBasis;
  if(reference)referenceBasis=basisFor(reference);
  else if(archiveEligible&&degree<=9){
    const anchor=anchors.degrees.find(row=>row.degree===degree);
    if(anchor.referenceFile)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(anchor.referenceFile)).digest('hex'),anchor.referenceSha256);
    referenceBasis=anchor.referenceFile?bergman.basis(fs.readFileSync(anchor.referenceFile,'utf8')):[];
    if(scaled)referenceBasis=referenceBasis.map(p=>bergman.monic(new Map([...p].map(([word,[n,d]])=>[word,[n*[...word].reduce((s,c)=>s*BigInt(inputFixture.scalings[vars[c.charCodeAt(0)-65]]),1n),d]]))));
    reference={id:scaled?'exactly-scaled-archived-FK6':'archived-FK6',basisFile:anchor.referenceFile};
  }else {reference=completed[0];referenceBasis=basisFor(reference);}
  const expected=referenceBasis.map(bergman.lead).sort();
  const byHead=new Map(referenceBasis.map(p=>[bergman.lead(p),p]));
  const input=rels.map(bergman.parse).filter(p=>bergman.degree(bergman.lead(p))<=degree);
  for (const row of report.rows.filter(row => row.degree === degree && row.status === 'complete')) {
    const basis=basisFor(row),actual=basis.map(bergman.lead).sort();
    assert.equal(actual.length, row.basisSize, row.id + ' basis count');
    assert.deepEqual(actual, expected, row.id + ' degree ' + degree + ' leading words');
    const key=degree+':'+JSON.stringify(basis.map(canonical).sort());
    const previousProof=audited.get(key);
    if(previousProof){results.push({...previousProof,id:row.id,reusedExactPolynomialCertificate:true,ambiguities:null});continue;}
    for(const p of input)assert.equal(bergman.nf(p,basis).size,0,'Input membership');
    let differingTails=0;
    for(const p of basis){const old=byHead.get(bergman.lead(p));if(canonical(p)!==canonical(old)){differingTails++;assert.equal(bergman.nf(p,referenceBasis).size,0,'Forward ideal membership');assert.equal(bergman.nf(old,basis).size,0,'Reverse ideal membership');}}
    let ambiguities=null;
    if(degree<=4)ambiguities=bergman.certify(input,basis,degree);
    const proof={id: row.id, degree, basisSize: actual.length, reference:reference.id,leadingWordsMatch: true,inputMembership:true,mutualIdealMembership:true,differingTails,ambiguities,hilbert:normalWordCounts(vars.length,actual,degree),
      leadingWordsSha256: crypto.createHash('sha256').update(actual.join('\n')).digest('hex')};
    results.push(proof);audited.set(key,proof);
  }
}
fs.writeFileSync(path.join(directory, 'leading-word-audit.json'), JSON.stringify({
  state: 'complete',
  method: 'Every completed output passes exact leading words, input membership and mutual ideal membership against available C/ECL, Singular or SBCL references. If these are censored, recorded FK6 bases supply the reference; for the scaled fixture, every archived coefficient is transformed by the checked invertible generator map. Other fallbacks are explicitly named. Rational Singular coefficients are parsed exactly. Independent normal-word BigInt DP; critical-pair certificates for distinct monic bases through degree 4. Higher degrees are consistency evidence. Censored computations are omitted.',
  runs: results.length, results,
}, null, 2) + '\n');
console.log(results.length + ' completed runs have matching leading-word sets.');
