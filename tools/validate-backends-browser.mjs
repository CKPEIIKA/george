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
    if (c.expectedOutcome) {
      assert.equal(row.outcome, c.expectedOutcome.kind); assert.equal(row.message, raw.failure.message);
      if (c.expectedOutcome.messageIncludes) assert.ok(row.message.includes(c.expectedOutcome.messageIncludes));
    } else {
      assert.equal(row.outcome, 'success');
      const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath), c.id, row.backend + '.outputs.json'), 'utf8'));
      assert.deepEqual(raw.result.files, expected, key + ': cached Node/browser equality');
      assert.deepEqual(row.hashes, Object.fromEntries(Object.entries(expected).map(([n, s]) => [n, sha(s)])));
    }
  }
  fs.writeFileSync(path.join(out, `report-before-resume-${Date.now()}.json`), JSON.stringify(previous, null, 2) + '\n');
}
for (const engine of Object.values(reference.engines)) for (const [name, hash] of Object.entries(engine.hashes))
  assert.equal(sha(fs.readFileSync(path.join(engine.directory, name))), hash, 'Engine changed since Node parity check');
const backendIds = Object.keys(reference.engines);
const data = {backendIds, completed: (previous?.results || []).map(r => r.id + '/' + r.backend),
  cases: reference.cases.map(c => ({id: c.id, job: buildJob(c.form), expectedOutcome: c.expectedOutcome}))};
const report = {state: 'running', startedAt: new Date().toISOString(), reference: path.resolve(referencePath),
  referenceSha256, resumedResults: previous?.results.length || 0,
  previousAttempt: previous ? {state: previous.state, startedAt: previous.startedAt, finishedAt: previous.finishedAt, error: previous.error} : undefined,
  debuggerDuringCalculations: false, mount: '/george/', seed: reference.sampling.seed,
  engines: reference.engines, results: previous?.results || [], errors: []};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();

async function replay() {
  const {EclEngine} = await import('./src/engine.js');
  const data = await (await fetch('./__parity/data')).json();
  let backend = data.backendIds[0];
  const engine = new EclEngine({getBackend: () => backend});
  const post = async (kind, value) => {
    const response = await fetch('./__parity/' + kind, {method: 'POST', body: JSON.stringify(value)});
    if (!response.ok) throw Error(await response.text());
  };
  try {
    for (const c of data.cases) for (backend of data.backendIds) {
      if (data.completed.includes(c.id + '/' + backend)) continue;
      await post('active', {id: c.id, backend});
      let timer, result, failure;
      const timeoutMs = c.expectedOutcome?.timeoutMs ?? 60000;
      const timeout = new Promise((resolve, reject) => { timer = setTimeout(() => {
        reject(Error('Computation timed out after ' + timeoutMs / 1000 + ' seconds.')); engine.cancel();
      }, timeoutMs); });
      try { result = await Promise.race([engine.run(c.job), timeout]); }
      catch (error) { failure = {message: error.message, code: error.code}; }
      finally { clearTimeout(timer); }
      await post('result', {id: c.id, backend, result, failure});
    }
    engine.cancel(); await post('done', {errors: window.parityErrors});
  } catch (error) {
    engine.cancel(); await post('failure', {message: String(error.stack || error), errors: window.parityErrors});
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
          successfulRuns: report.results.filter(r => r.outcome === 'success').length,
          knownErrorRuns: report.results.filter(r => r.outcome === 'error').length,
          knownTimeoutRuns: report.results.filter(r => r.outcome === 'timeout').length};
        save(); res.end('ok'); resolve(); return;
      } else if (kind === 'result') {
        const c = reference.cases.find(c => c.id === value.id); assert.ok(c);
        assert.ok(backendIds.includes(value.backend));
        const directory = path.join(out, c.id); fs.mkdirSync(directory, {recursive: true});
        let row;
        if (c.expectedOutcome) {
          assert.ok(value.failure, c.id + ': expected known failure');
          const failureKind = value.failure.message.startsWith('Computation timed out after') ? 'timeout' : 'error';
          assert.equal(failureKind, c.expectedOutcome.kind);
          if (c.expectedOutcome.messageIncludes) assert.ok(value.failure.message.includes(c.expectedOutcome.messageIncludes), value.failure.message);
          row = {id: c.id, backend: value.backend, outcome: failureKind, expectedFailure: true, message: value.failure.message};
          const previous = report.results.find(r => r.id === c.id);
          if (previous) assert.equal(row.message, previous.message, c.id + ': browser error parity');
        } else {
          assert.ok(!value.failure, c.id + ': ' + value.failure?.message);
          const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath), c.id, value.backend + '.outputs.json'), 'utf8'));
          assert.deepEqual(value.result.files, expected, c.id + ': exact Node/browser output parity');
          row = {id: c.id, backend: value.backend, outcome: 'success', exactEquality: true,
            hashes: Object.fromEntries(Object.entries(value.result.files).map(([n, s]) => [n, sha(s)])),
            elapsedMs: value.result.elapsedMs, memoryBytes: value.result.memoryBytes};
          fs.writeFileSync(path.join(directory, value.backend + '.log'), value.result.stdout);
        }
        fs.writeFileSync(path.join(directory, value.backend + '.json'), JSON.stringify(value, null, 2) + '\n');
        report.results.push(row); save();
        if (value.backend === backendIds.at(-1)) console.log(c.id, row.outcome, 'PASS');
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
// has its own 60-second watchdog. A resume runs only verified missing pairs.
const overallTimeoutMs = Math.max(600000, (data.cases.length * backendIds.length - report.results.length) * 8000);
report.overallTimeoutMs = overallTimeoutMs;
const timer = setTimeout(() => reject(Error('Browser parity timed out')), overallTimeoutMs);
try { await done; console.log(out, 'PASS'); }
catch (error) { report.state = 'failed'; report.error = String(error.stack || error); console.error(error); process.exitCode = 1; }
finally {
  clearTimeout(timer); browser.kill('SIGTERM'); server.close();
  report.finishedAt = new Date().toISOString(); save(); fs.writeFileSync(path.join(out, 'browser.log'), stderr);
}
