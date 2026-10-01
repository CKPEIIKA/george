// Independently audit the three shared LHS failures and their boundary grid.
// node tools/validate-backend-oracles.mjs NODE_REPORT SBCL_LAUNCHER [OUTPUT]
// SBCL must be built in its current directory: saved autoload paths are absolute.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildJob, parseBasis, parseRelation} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';
import {validateTimeoutMs} from '../web/src/time-limit.js';

const [referencePath, nativePath, output = `build/validation/backend-oracles-${Date.now()}`] = process.argv.slice(2);
assert.ok(referencePath && nativePath, 'Supply a completed Node parity report and a fresh SBCL launcher.');
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
assert.equal(reference.state, 'complete');
const fixture = JSON.parse(fs.readFileSync('test/fixtures/backend-oracles.json', 'utf8'));
const cases = reference.cases.filter(c => c.group === 'oracle' || fixture.cases.some(o => o.id === c.id));
assert.equal(cases.length, 19);
const out = path.resolve(output), native = path.resolve(nativePath);
fs.mkdirSync(out, {recursive: true});
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const oracleRoot = path.resolve('build/oracles/root');
const singular = process.env.SINGULAR_BIN || path.join(oracleRoot, 'usr/bin/Singular');
const env = {...process.env,
  LD_LIBRARY_PATH: `${oracleRoot}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH || ''}`,
  SINGULARPATH: `${oracleRoot}/usr/share/singular/LIB:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`};
const timeoutMs = validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS ?? 60000));
const report = {state: 'running', startedAt: new Date().toISOString(), reference: path.resolve(referencePath),
  referenceSha256: sha(fs.readFileSync(referencePath)), engines: reference.engines,
  native, nativeLauncherSha256: sha(fs.readFileSync(native)), singular, timeoutMs, results: []};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function run(executable, args, script, cwd, filename, environment = process.env) {
  fs.writeFileSync(path.join(cwd, filename), script);
  const started = performance.now();
  const r = spawnSync(executable, args, {cwd, input: script, encoding: 'utf8', env: environment,
    timeout: timeoutMs || undefined, killSignal: 'SIGKILL', maxBuffer: 16e6});
  fs.writeFileSync(path.join(cwd, filename + '.log'), (r.stdout || '') + (r.stderr || ''));
  assert.ifError(r.error); assert.equal(r.status, 0, filename + ': ' + (r.stdout + r.stderr).slice(-2000));
  return {stdout: r.stdout, elapsedMs: performance.now() - started};
}
try {
  for (const c of cases) {
    // A new directory avoids native overwrite prompts and stale output files.
    const dir = fs.mkdtempSync(path.join(out, c.id + '-')), job = buildJob(c.form);
    for (const [n, text] of Object.entries(job.files)) fs.writeFileSync(path.join(dir, n), text);
    const nativeRun = run(native, [], job.script + '\n(QUIT)\n', dir, 'native-session.lsp');
    const outputs = Object.fromEntries(Object.values(job.outputs).map(n => [n, fs.readFileSync(path.join(dir, n), 'utf8')]));
    for (const backend of Object.keys(reference.engines)) {
      const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath), c.id, backend + '.outputs.json'), 'utf8'));
      assert.deepEqual(outputs, expected, c.id + ': native/' + backend + ' exact output equality');
    }
    const p = c.form.field === '0' ? 0 : c.form.field === '2' ? 2 : Number(c.form.modulus);
    const comm = c.form.ring === 'comm';
    const weights = c.form.vars.map((_, i) => Number(String(c.form.weights || '').split(/\s+/)[i] || 1));
    const a = algebra(c.form.vars, comm, p, weights), basis = a.basis(outputs['result.gb']);
    // Every relation is a monomial: no ambiguity about different oracle orders.
    assert.ok(c.form.rels.every(r => parseRelation(r, c.form.vars).length === 1));
    const ambiguities = a.certify(c.form.rels.map(a.parse), basis, Number(c.form.maxdeg));
    const dimensions = a.hilbert(basis, 6);
    assert.deepEqual(dimensions, c.expectedDimensions, c.id + ': independently enumerated normal words');
    if (outputs['result.hs']) {
      const polynomial = outputs['result.hs'].split('\n').find(l => l.startsWith('Hilbert power series:')).split(':').slice(1).join(':').trim();
      const printed = Array(7).fill(0);
      for (const term of parseRelation(polynomial, ['t'])) {
        const degree = term.factors.reduce((d, f) => d + f.e, 0);
        if (degree < printed.length) printed[degree] += term.sign * Number(term.coef);
      }
      assert.deepEqual(printed, dimensions, c.id + ': printed Hilbert coefficients');
    }
    const gb = parseBasis(outputs['result.gb']).groups.flatMap(g => g.polys);
    const code = [comm ? '' : 'LIB "freealgebra.so";',
      `ring r=${p},(${(comm ? c.form.vars : [...c.form.vars].reverse()).join(',')}),Dp;`,
      ...(comm ? [] : ['def R=freeAlgebra(r,12);', 'setring R;']),
      `ideal I=${c.form.rels.join(',')};`, `ideal B=${gb.join(',')};`,
      `ideal G=${comm ? 'std' : 'twostd'}(I);`,
      'print("ORACLE:"+string(size(reduce(I,B)))+":"+string(size(reduce(B,G))));',
      ...(comm ? ['print("DIM:"+string(vdim(G)));', 'print(kbase(G));'] : []), 'quit;'].join('\n') + '\n';
    const singularRun = run(singular, ['-q'], code, dir, 'singular.sing', env);
    assert.doesNotMatch(singularRun.stdout, /^\s*\?/m, c.id + ': Singular error');
    assert.match(singularRun.stdout, /ORACLE:0:0/, c.id + ': mutual ideal membership');
    if (comm) assert.ok(singularRun.stdout.includes('DIM:' + dimensions.reduce((s,n)=>s+n,0)));
    report.results.push({id: c.id, form: c.form, jobSha256: sha(JSON.stringify(job)),
      nativeExactBackends: Object.keys(reference.engines), singularMutualIdealMembership: true,
      independentAmbiguities: ambiguities, dimensions, printedSeriesChecked: !!outputs['result.hs'],
      outputHashes: Object.fromEntries(Object.entries(outputs).map(([n,s])=>[n,sha(s)])),
      nativeElapsedMs: nativeRun.elapsedMs, singularElapsedMs: singularRun.elapsedMs});
    save(); console.log(c.id, 'native + Singular + normal-word dimensions PASS');
  }
  report.state = 'complete'; report.summary = {cases: report.results.length, formerlySharedFailures: fixture.cases.length,
    exactNativeBackendComparisons: report.results.length * Object.keys(reference.engines).length};
} catch (error) {report.state = 'failed'; report.error = String(error.stack || error); console.error(error); process.exitCode = 1;}
finally {report.finishedAt = new Date().toISOString(); save();}
