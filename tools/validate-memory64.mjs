// Replay independently checked backend cases against the new pointer width.
// node tools/validate-memory64.mjs COMPLETED_REPORT OUTPUT [--resume]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {buildJob} from '../web/src/bergman-syntax.js';
import {BackendClient} from '../test/support/backend-client.mjs';
import {regressionJob} from '../test/support/regression.mjs';

const [referenceArgument, output] = process.argv.slice(2);
assert.ok(referenceArgument && output, 'Supply a completed reference report and output directory.');
const referencePath = path.resolve(referenceArgument), out = path.resolve(output);
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
assert.equal(reference.state, 'complete');
const directory = path.resolve('web/engine/memory64');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const hashes = Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(n => [n, sha(fs.readFileSync(path.join(directory,n)))]));
const cases = reference.cases.map(c => ({...c, form: {...c.form, backend: 'memory64', memoryMiB: 0}}));
const timeoutMs = Number(process.env.GEORGE_TEST_TIMEOUT_MS ?? 180000);
fs.mkdirSync(out,{recursive:true});
const report = {state:'running',startedAt:new Date().toISOString(),reference:referencePath,
  referenceSha256:sha(fs.readFileSync(referencePath)),sampling:reference.sampling,cases,
  perCaseTimeoutMs:timeoutMs,engines:{memory64:{directory,hashes,
    manifest:JSON.parse(fs.readFileSync(path.join(directory,'build.json'),'utf8'))}},
  results:[],sequentialSessions:[],parityAgainstSavedBackends:Object.keys(reference.engines),timingIsDiagnosticOnly:true};
if (process.argv.includes('--resume')) {
  const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.equal(previous.referenceSha256,report.referenceSha256);
  assert.deepEqual(previous.engines.memory64.hashes,hashes);
  assert.deepEqual(previous.cases,cases);
  report.results=previous.results;
  report.sequentialSessions=previous.sequentialSessions;
}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();
try {
  for (const legacy of [false,true]) {
    if(report.sequentialSessions.some(r=>r.legacy===legacy))continue;
    const {job,expected}=regressionJob(legacy);
    const client=new BackendClient(directory,{timeoutMs});
    try { const result=await client.run({...job,backend:'memory64',memoryMiB:0});
      assert.deepEqual(result.files,expected,'memory64 sequential '+legacy);
      report.sequentialSessions.push({legacy,equalOutputs:Object.keys(expected).length});save();
    } finally {await client.close();}
  }
  for (const c of cases) {
    const caseDirectory=path.join(out,c.id);fs.mkdirSync(caseDirectory,{recursive:true});
    const expected=JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath),c.id,'compiled.outputs.json'),'utf8'));
    const pinned=reference.results.find(r=>r.id===c.id).backends.compiled.hashes;
    assert.deepEqual(Object.fromEntries(Object.entries(expected).map(([n,s])=>[n,sha(s)])),pinned,c.id+': pinned reference output hashes');
    const completed=report.results.find(r=>r.id===c.id);
    if(completed){assert.deepEqual(JSON.parse(fs.readFileSync(path.join(caseDirectory,'memory64.outputs.json'),'utf8')),expected);continue;}
    report.activeCase=c.id;save();
    const client=new BackendClient(directory,{timeoutMs,onOutput:s=>fs.appendFileSync(path.join(caseDirectory,'memory64.partial.log'),s+'\n')});
    let result;
    try {result=await client.run(buildJob(c.form));} finally {await client.close();}
    fs.writeFileSync(path.join(caseDirectory,'memory64.log'),result.stdout);
    fs.writeFileSync(path.join(caseDirectory,'memory64.outputs.json'),JSON.stringify(result.files,null,2)+'\n');
    assert.deepEqual(result.files,expected,c.id+': exact 32/64 parity');
    report.results.push({id:c.id,outcome:'success',backends:{memory64:{exactEquality:true,elapsedMs:result.elapsedMs,
      memoryBytes:result.memoryBytes,hashes:Object.fromEntries(Object.entries(result.files).map(([n,s])=>[n,sha(s)]))}}});
    console.log(c.id,'PASS');save();
  }
  report.state='complete';report.summary={cases:cases.length,backendRuns:report.results.length,
    successfulRuns:report.results.length,sequentialOutputs:report.sequentialSessions.reduce((n,r)=>n+r.equalOutputs,0)};
  delete report.activeCase;
} catch(error) {report.state='failed';report.error=String(error.stack||error);throw error;}
finally {report.finishedAt=new Date().toISOString();save();}
console.log('memory64 exact parity PASS:',cases.length,'cases');
