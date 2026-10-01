// Exact parity on seeded LHS samples, explicit edge cases and the upstream
// sequential sessions. Timing here is diagnostic; use profile-browser.mjs
// for performance measurements without a debugger or concurrent builds.
// node tools/validate-backends.mjs [OUTPUT] [LHS_BASIS_COUNT=64]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {BACKENDS} from '../web/src/backends.js';
import {buildJob, exampleForm, readInputFile, parseRelation, isHomogeneous, TASK_BY_ID} from '../web/src/bergman-syntax.js';
import {TUTORIALS, tutorialForm} from '../web/src/tutorials.js';
import {EXAMPLES} from '../web/src/examples.js';
import {backendSamples, largeBackendAnchors, oracleBackendAnchors} from '../test/support/backend-lhs.mjs';
import {regressionJob} from '../test/support/regression.mjs';
import {BackendClient} from '../test/support/backend-client.mjs';
import {validateTimeoutMs} from '../web/src/time-limit.js';
import {algebra} from '../test/support/algebra.mjs';
import {certifyResolution} from '../test/support/resolution.mjs';

const [output = `build/validation/backends-${Date.now()}`, count = '64'] = process.argv.slice(2);
const out = path.resolve(output), design = backendSamples(Number(count));
fs.mkdirSync(out, {recursive: true});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cases = [...design.cases, ...TUTORIALS.map(t => ({id: `tutorial-${t.id}`, group: 'anchor', form: tutorialForm(t.id)})),
  ...EXAMPLES.filter(e => TASK_BY_ID.get(e.task)?.module || ['factalg', 'hochschild'].includes(e.task))
    .map(e => ({id: `example-${e.id}`, group: 'module', form: exampleForm(e)})), ...largeBackendAnchors(), ...oracleBackendAnchors()];
const input = JSON.parse(fs.readFileSync('docs/development/validation/memory.json', 'utf8')).presentationAssessment.inputText;
const parsed = readInputFile('(ALGFORMINPUT)\n' + input);
cases.push({id: 'submitted-15-generators-100-relations', group: 'anchor', form: {
  task: 'gb', ring: 'noncomm', field: '0', order: 'degleftlex', maxdeg: '4', memoryMiB: 3584,
  vars: parsed.vars, rels: parsed.rels,
}, expectedBasisSha256: '90330a9064c82eed277c35533a9f90e79acebf681d2433c89f970abab2315f2d'});
const largeOnly = process.argv.includes('--large-only');
if (largeOnly) cases.splice(0, cases.length, ...cases.filter(c => c.group === 'large'));
const directories = Object.fromEntries(Object.entries(BACKENDS).map(([id, backend]) => [id,
  path.resolve('web/src', backend.directory)]));
// These formerly shared failures now have independent oracle expectations.
const oracleCases = JSON.parse(fs.readFileSync('test/fixtures/backend-oracles.json', 'utf8')).cases;
for (const c of cases) {
  const expected = oracleCases.find(o => o.jobSha256 === sha(JSON.stringify(buildJob(c.form))));
  if (expected) c.expectedDimensions = expected.expectedDimensions;
}
const report = {state: 'running', startedAt: new Date().toISOString(), node: process.version,
  scope: largeOnly ? 'large anchors only' : 'full LHS and anchors',
  sampling: {method: 'Latin hypercube; stratification before discrete mapping', ...design, cases: undefined},
  cases, engines: {}, sequentialSessions: [], results: []};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const runtimes = new Map(), timeoutMs = validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS ?? 60000));
report.perCaseTimeoutMs = timeoutMs;
for (const [id, directory] of Object.entries(directories)) {
  report.engines[id] = {directory, manifest: JSON.parse(fs.readFileSync(path.join(directory, 'build.json'), 'utf8')),
    hashes: Object.fromEntries(['ecl.js', 'ecl.wasm', 'ecl.data'].map(n => [n, sha(fs.readFileSync(path.join(directory, n)))]))};
}
save();
try {
  // Console regressions share their session. Independent form jobs use
  // fresh workers, matching EclEngine.run and the browser's session policy.
  for (const legacy of largeOnly ? [] : [false, true]) {
    const {job, expected} = regressionJob(legacy);
    for (const [id, directory] of Object.entries(directories)) {
      const runtime = new BackendClient(directory, {timeoutMs});
      let result;
      try { result = await runtime.run(job); } finally { await runtime.close(); }
      assert.deepEqual(result.files, expected, `${id}: upstream ${legacy ? 'legacy' : 'fixed'}`);
      report.sequentialSessions.push({backend: id, legacy, equalOutputs: Object.keys(expected).length});
      console.log(`${id} upstream ${legacy ? 'legacy' : 'fixed'}: ${Object.keys(expected).length} exact outputs`);
      save();
    }
  }
  report.formSessionPolicy = 'fresh worker per case and backend';
  for (const c of cases) {
    const directory = path.join(out, c.id); fs.mkdirSync(directory, {recursive: true});
    const job = buildJob(c.form), row = {id: c.id, group: c.group, backends: {}};
    fs.writeFileSync(path.join(directory, 'job.json'), JSON.stringify(job, null, 2) + '\n');
    let reference;
    for (const [id, engineDirectory] of Object.entries(directories)) {
      report.activeCase = {id: c.id, backend: id}; save();
      const runtime = new BackendClient(engineDirectory, {timeoutMs});
      runtimes.set(id, runtime);
      runtime.onOutput = text => fs.appendFileSync(path.join(directory, `${id}.partial.log`), text + '\n');
      let result, failure;
      try { result = await runtime.run(job); } catch (error) { failure = error; }
      finally { await runtime.close(); runtimes.delete(id); }
      if (failure) throw failure;
      fs.writeFileSync(path.join(directory, `${id}.log`), result.stdout);
      fs.writeFileSync(path.join(directory, `${id}.outputs.json`), JSON.stringify(result.files, null, 2) + '\n');
      if (reference) assert.deepEqual(result.files, reference.files, `${c.id}: ${id} output parity`);
      else reference = result;
      if (c.expectedBasisSha256) assert.equal(sha(result.files['result.gb']), c.expectedBasisSha256, `${c.id}: native reference`);
      row.backends[id] = {exactEquality: true, outputCount: Object.keys(result.files).length,
        hashes: Object.fromEntries(Object.entries(result.files).map(([name, text]) => [name, sha(text)])),
        elapsedMs: result.elapsedMs, memoryBytes: result.memoryBytes};
    }
    // Add independent certificates where this checker's order matches the
    // requested Bergman order. Parity alone cannot prove mathematical truth.
    const weights = c.form.vars.map((_, i) => Number(String(c.form.weights || '').split(/\s+/)[i] || 1));
    const weightMap = new Map(c.form.vars.map((v, i) => [v, weights[i]]));
    const homogeneous = c.form.rels.every(r => isHomogeneous(parseRelation(r, c.form.vars), weightMap));
    const monomial = c.form.rels.every(r => parseRelation(r, c.form.vars).length === 1);
    if (['gb', 'hilbert'].includes(c.form.task) && homogeneous && (monomial || ['degleftlex', 'deglex'].includes(c.form.order))) {
      const vars = c.form.reverseVars ? [...c.form.vars].reverse() : c.form.vars;
      const a = algebra(vars, c.form.ring === 'comm', c.form.field === '2' ? 2 : c.form.field === 'p' ? c.form.modulus : 0,
        vars.map(v => weightMap.get(v)));
      const input = c.form.rels.map(a.parse), bound = Number(c.form.maxdeg);
      // A degree bound may omit input relations whose own degree is larger.
      if (input.every(f => [...f.keys()].every(w => a.degree(w) <= bound))) {
        row.certifiedAmbiguities = a.certify(input, a.basis(reference.files['result.gb']), bound);
        if (c.expectedDimensions) assert.deepEqual(a.hilbert(a.basis(reference.files['result.gb']), bound), c.expectedDimensions.slice(0, bound + 1), c.id + ': independent quotient dimensions');
      }
    }
    if (reference.files['resolution.jsonl']) {
      row.resolutionIdentities = certifyResolution(reference.files['resolution.jsonl'],
        reference.files['resolution.gb'] || reference.files['result.gb'], c.form.vars,
        c.form.field === '2' ? 2 : c.form.field === 'p' ? c.form.modulus : 0);
    }
    row.outcome = 'success'; report.results.push(row); save();
    console.log(`${c.id}: ${Object.keys(directories).length} backends match`);
  }
  report.state = 'complete';
  report.summary = {cases: report.results.length, backends: Object.keys(directories).length,
    successfulCases: report.results.filter(r => r.outcome === 'success').length,
    oracleDimensionCases: report.results.filter(r => cases.find(c => c.id === r.id).expectedDimensions).length,
    sequentialExactOutputs: report.sequentialSessions.reduce((s, r) => s + r.equalOutputs, 0)};
  delete report.activeCase;
} catch (error) {
  report.state = 'failed'; report.error = {message: error.message, stack: error.stack};
  console.error(error); process.exitCode = 1;
} finally {
  await Promise.all([...runtimes.values()].map(r => r.close()));
  report.finishedAt = new Date().toISOString(); save();
}
