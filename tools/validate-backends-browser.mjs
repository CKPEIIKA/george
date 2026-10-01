// Replay a completed Node parity report through ordinary Chromium workers.
// No DevTools, Runtime, Debugger or Profiler attachment during calculations.
// node tools/validate-backends-browser.mjs NODE_REPORT [OUTPUT] [--resume]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {staticServer} from './serve.mjs';
import {buildJob} from '../web/src/bergman-syntax.js';
import {deadline, validateTimeoutMs} from '../web/src/time-limit.js';

const [referencePath, output = `build/validation/backends-browser-${Date.now()}`] = process.argv.slice(2);
assert.ok(referencePath, 'Supply a completed Node parity report.');
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
assert.equal(reference.state, 'complete');
const out = path.resolve(output), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(out, {recursive: true});
const referenceSha256 = sha(fs.readFileSync(referencePath));
let previous;
if (process.argv.includes('--resume')) {
  previous = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  assert.equal(previous.reference, path.resolve(referencePath));
  if (previous.referenceSha256) assert.equal(previous.referenceSha256, referenceSha256);
  else assert.ok(fs.statSync(referencePath).mtimeMs < Date.parse(previous.startedAt), 'Reference changed after browser replay started');
  for (const [id, engine] of Object.entries(reference.engines)) assert.deepEqual(previous.engines[id].hashes, engine.hashes);
  const seen = new Set();
  for (const row of previous.results) {
    const c = reference.cases.find(c => c.id === row.id); assert.ok(c);
    assert.ok(Object.hasOwn(reference.engines, row.backend));
    const key = row.id + '/' + row.backend; assert.ok(!seen.has(key)); seen.add(key);
    const raw = JSON.parse(fs.readFileSync(path.join(out, c.id, row.backend + '.json'), 'utf8'));

    assert.equal(row.outcome, 'success');
    const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath), c.id, row.backend + '.outputs.json'), 'utf8'));
    assert.deepEqual(raw.result.files, expected, key + ': cached Node/browser equality');
    assert.deepEqual(row.hashes, Object.fromEntries(Object.entries(expected).map(([n, s]) => [n, sha(s)])));
  }
  fs.writeFileSync(path.join(out, `report-before-resume-${Date.now()}.json`), JSON.stringify(previous, null, 2) + '\n');
}
for (const engine of Object.values(reference.engines)) for (const [name, hash] of Object.entries(engine.hashes))
  assert.equal(sha(fs.readFileSync(path.join(engine.directory, name))), hash, 'Engine changed since Node parity check');
const backendIds = Object.keys(reference.engines);
const timeoutMs = validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS ?? reference.perCaseTimeoutMs ?? 60000));
const data = {backendIds, timeoutMs, completed: (previous?.results || []).map(r => r.id + '/' + r.backend),
  cases: reference.cases.map(c => ({id: c.id, job: {...buildJob(c.form), timeoutMs}}))};
const report = {state: 'running', startedAt: new Date().toISOString(), reference: path.resolve(referencePath),
  referenceSha256, resumedResults: previous?.results.length || 0,
  previousAttempt: previous ? {state: previous.state, startedAt: previous.startedAt, finishedAt: previous.finishedAt, error: previous.error} : undefined,
  debuggerDuringCalculations: false, concurrentBackends: true, timingIsDiagnosticOnly: true,
  mount: '/george/', seed: reference.sampling.seed,
  perCaseTimeoutMs: timeoutMs, engines: reference.engines, results: previous?.results || [], errors: []};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();

async function replay() {
  const {EclEngine} = await import('./src/engine.js');
  const data = await (await fetch('./__parity/data')).json();
  const engines = new Map(data.backendIds.map(backend => [backend, new EclEngine({getBackend: () => backend})]));
  const cancelAll = () => {for (const engine of engines.values()) engine.cancel();};
  const post = async (kind, value) => {
    const response = await fetch('./__parity/' + kind, {method: 'POST', body: JSON.stringify(value)});
    if (!response.ok) throw Error(await response.text());
  };
  try {
    for (const c of data.cases) await Promise.all(data.backendIds.map(async backend => {
      if (data.completed.includes(c.id + '/' + backend)) return;
      await post('active', {id: c.id, backend});
      let result, failure;
      try { result = await engines.get(backend).run(c.job); }
      catch (error) { failure = {message: error.message, code: error.code}; }
      await post('result', {id: c.id, backend, result, failure});
    }));
    cancelAll(); await post('done', {errors: window.parityErrors});
  } catch (error) {
    cancelAll(); await post('failure', {message: String(error.stack || error), errors: window.parityErrors});
  }
}

const mount = '/george/', server = staticServer('web', mount), serve = server.listeners('request')[0];
server.removeAllListeners('request');
let resolve, reject;
const done = new Promise((a, b) => { resolve = a; reject = b; });
server.on('request', async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'), endpoint = mount + '__parity/';
    if (url.pathname === endpoint + 'data') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return; }
    if (req.method === 'POST' && url.pathname.startsWith(endpoint)) {
      let body = ''; for await (const bytes of req) body += bytes;
      const value = JSON.parse(body), kind = url.pathname.slice(endpoint.length);
      if (kind === 'active') { report.activeCase = value; save(); }
      else if (kind === 'failure') { throw Error(value.message); }
      else if (kind === 'done') {
        assert.deepEqual(value.errors, []);
        assert.equal(report.results.length, data.cases.length * backendIds.length);
        report.state = 'complete'; delete report.activeCase;
        report.summary = {cases: data.cases.length, backendRuns: report.results.length,
          successfulRuns: report.results.filter(r => r.outcome === 'success').length};
        save(); res.end('ok'); resolve(); return;
      } else if (kind === 'result') {
        const c = reference.cases.find(c => c.id === value.id); assert.ok(c);
        assert.ok(backendIds.includes(value.backend));
        const directory = path.join(out, c.id); fs.mkdirSync(directory, {recursive: true});
        assert.ok(!value.failure, c.id + ': ' + value.failure?.message);
        const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath), c.id, value.backend + '.outputs.json'), 'utf8'));
        assert.deepEqual(value.result.files, expected, c.id + ': exact Node/browser output parity');
        const row = {id: c.id, backend: value.backend, outcome: 'success', exactEquality: true,
          hashes: Object.fromEntries(Object.entries(value.result.files).map(([n, s]) => [n, sha(s)])),
          elapsedMs: value.result.elapsedMs, memoryBytes: value.result.memoryBytes};
        fs.writeFileSync(path.join(directory, value.backend + '.log'), value.result.stdout);
        fs.writeFileSync(path.join(directory, value.backend + '.json'), JSON.stringify(value, null, 2) + '\n');
        report.results.push(row); save();
        if (report.results.filter(r => r.id === c.id).length === backendIds.length) console.log(c.id, row.outcome, 'PASS');
      } else throw Error('Unknown parity endpoint');
      res.end('ok'); return;
    }
    if (url.pathname === mount) {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><meta charset="utf-8"><title>George backend parity</title>
        <script>window.parityErrors=[];addEventListener('error',e=>parityErrors.push(e.message));addEventListener('unhandledrejection',e=>parityErrors.push(String(e.reason)));</script>
        <script type="module">(${replay.toString()})();</script>`); return;
    }
    serve(req, res);
  } catch (error) { res.writeHead(500).end(String(error)); reject(error); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'george-browser-parity-'));
const browser = spawn(process.env.CHROMIUM || '/usr/bin/chromium', ['--headless', '--no-sandbox', '--no-first-run',
  `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}${mount}`], {stdio: ['ignore', 'ignore', 'pipe']});
let stderr = ''; browser.stderr.on('data', bytes => { stderr += bytes; }); browser.on('error', reject);
browser.on('exit', code => { if (report.state === 'running') reject(Error('Chromium exited early: ' + code)); });
// Fresh-worker startup dominates large matrices; every individual run still
// has its own configurable watchdog (0 disables it). A resume runs only verified missing pairs.
const overallTimeoutMs = validateTimeoutMs(Number(process.env.GEORGE_TEST_OVERALL_TIMEOUT_MS ?? (timeoutMs ? Math.max(900000, (data.cases.length * backendIds.length - report.results.length) * 10000) : 0)));
report.overallTimeoutMs = overallTimeoutMs;
const clearOverall = deadline(overallTimeoutMs, () => reject(Error('Browser parity timed out')));
try { await done; console.log(out, 'PASS'); }
catch (error) { report.state = 'failed'; report.error = String(error.stack || error); console.error(error); process.exitCode = 1; }
finally {
  clearOverall(); browser.kill('SIGTERM'); server.close();
  report.finishedAt = new Date().toISOString(); save(); fs.writeFileSync(path.join(out, 'browser.log'), stderr);
}
