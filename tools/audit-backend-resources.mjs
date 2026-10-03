// Exact output audit, run after resource measurements.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {algebra} from '../test/support/algebra.mjs';
import {buildJob,readInputFile} from '../web/src/bergman-syntax.js';
import {parseNativeJob} from '../web/engine/fomkyr/job-adapter.js';
import {identityOf} from '../web/engine/fomkyr/storage.js';
import {oraclePolynomial} from '../fomkyr/tools/oracle-format.mjs';
import {normalWordCounts} from '../test/support/normal-word-counts.mjs';
import {randomGrowingForm} from '../test/support/random-growing-form.mjs';

const reportFile = path.resolve(process.argv[2] || 'build/validation/backend-resources-degree8/report.json');
const directory = path.dirname(reportFile);
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
assert.equal(report.state, 'complete', 'Finish the serial benchmark first');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(report.inputFile)).digest('hex'),report.inputSha256,'Input changed after measurements');
const inputFixture=JSON.parse(fs.readFileSync(report.inputFile,'utf8'));
const {vars,rels} = readInputFile('(ALGFORMINPUT)\n' + inputFixture.inputText);
const bergman = algebra(vars, false, 0);
const singular = algebra(vars.map((_, i) => 'fk_var_' + i), false, 0);
function basisFor(row) {
  if(row.native?.engine==='fomkyr-native'){
    // The standalone CLI streams polynomials without Bergman's degree headers.
    return fs.readFileSync(path.join(directory,row.basisFile),'utf8')
      .replace(/^%.*$/gm,'').replace(/\bDone\s*$/,'').split(',')
      .map(text=>text.trim()).filter(Boolean).map(text=>bergman.monic(bergman.parse(text)));
  }
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
async function historicalDegreeTen() {
  // This supplies a previous-version consistency reference when every fresh
  // independent oracle was censored. It is not a new critical-pair certificate.
  const root='fomkyr/fixtures/compatibility';
  const fixture=JSON.parse(fs.readFileSync('fomkyr/fixtures/fk6.json'));
  const current=parseNativeJob(buildJob({task:'gb',backend:'fomkyr',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,maxdeg:'10'})).fixture;
  assert.deepEqual(current,{variables:fixture.variables,relations:fixture.relations});
  const checkpoint=JSON.parse(fs.readFileSync(path.join(root,'checkpoint-v0.3.json')));
  assert.equal(await identityOf(current,0),checkpoint.result.identity,'Historical FK6 presentation identity');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  const entry=manifest.records['d10-optimized-w4-p0-r0.gnb'];
  const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const compressed=fs.readFileSync(path.join(root,entry.file));
  assert.equal(sha(compressed),entry.compressedSha256);
  const raw=gunzipSync(compressed);assert.equal(raw.length,entry.bytes);assert.equal(sha(raw),entry.sha256);
  const rawFile=path.join(directory,'historical-degree10.gnb');
  const decodedFile=path.join(directory,'historical-degree10.json');
  fs.writeFileSync(rawFile,raw);
  // Independently decode/check each record in Python; never use the C kernel's
  // reader. Output goes to a local file rather than a bounded subprocess pipe.
  execFileSync('python3',['-c',[
    'import json, sys',
    'from pathlib import Path',
    'sys.path.insert(0, sys.argv[1])',
    'from canonical_audit import records',
    'polys = [[[list(w), str(c)] for w,c in p.items()] for p in records(Path(sys.argv[2]),10,15)]',
    'Path(sys.argv[3]).write_text(json.dumps(polys))',
  ].join('\n'),path.resolve('fomkyr/tools'),rawFile,decodedFile],{timeout:120000,stdio:['ignore','ignore','inherit']});
  const basis=JSON.parse(fs.readFileSync(decodedFile)).map(p=>bergman.monic(new Map(p.map(([w,c])=>[w.map(i=>String.fromCharCode(65+i)).join(''),bergman.q(c)]))));
  return {reference:{id:'historical-Fomkyr-'+manifest.sourceVersion,basisFile:entry.file,recordSha256:entry.sha256},basis};
}
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
  }else if(!scaled&&archiveEligible&&degree===10){
    const historical=await historicalDegreeTen();reference=historical.reference;referenceBasis=historical.basis;
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
  method: 'Every completed output passes exact leading words, input membership and mutual ideal membership against available C/ECL, Singular or SBCL references. If these are censored, recorded FK6 bases supply the reference; for the scaled fixture, every archived coefficient is transformed by the checked invertible generator map. Degree 10 can use historical Fomkyr 0.3 records with verified presentation identity, SHA-256 and independent Python record decoding. This is previous-version consistency evidence, not an independent Groebner certificate. Other fallbacks are explicitly named. Rational Singular coefficients are parsed exactly. Independent normal-word BigInt DP; critical-pair certificates for distinct monic bases through degree 4. Higher degrees are consistency evidence. Censored computations are omitted.',
  runs: results.length, results,
}, null, 2) + '\n');
console.log(results.length + ' completed runs have matching leading-word sets.');
