// Longer and overlapping identifiers: native equality, renaming invariance,
// independent basis and full d² checks, then exact augmented homology.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildJob, resolutionJob, parseRelation, toBergman, readInputFile, FAMILIES } from '../web/src/bergman-syntax.js';
import { readResolution } from '../web/src/resolution-data.js';
import { augmentedHomology } from '../web/src/homology.js';
import { wasmRuntime } from '../test/support/regression.mjs';
import { algebra } from '../test/support/algebra.mjs';
import { certifyResolution } from '../test/support/resolution.mjs';
const out = path.resolve(process.argv[2] || `build/validation/resolution-names-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
const candidates = fs.readdirSync('build').filter(n => /^sbcl-/.test(n) && fs.existsSync(`build/${n}/bin/clisp/unix/bergman`)).sort().reverse();
assert.ok(candidates.length, 'Build the native reference first.');
const native = path.resolve(process.env.BERGMAN_SBCL || `build/${candidates[0]}/bin/clisp/unix/bergman`);
const rename = (rels, from, to) => rels.map(s => toBergman(parseRelation(s, from).map(term => ({ ...term, factors: term.factors.map(f => ({ ...f, v: to[from.indexOf(f.v)] })) }))));
const canonical = (text, vars) => [...readResolution(text, vars).diffs].sort(([a], [b]) => a - b).map(([degree, rows]) => [degree,
  rows.map(row => JSON.stringify({chain: row.chain.map(v => vars.indexOf(v)), terms: row.terms.map(t => ({
    target: t.target.map(v => vars.indexOf(v)), word: t.word.map(v => vars.indexOf(v)), coefficient: t.coefficient
  }))})).sort()
]);
const cases = [];
for (const p of [0, 2, 5]) cases.push(
  { id: `idempotent-F${p}`, vars: ['a', 'aa'], rels: ['a^2-a'], p, expected: [1, 1, 0, 0, 0] },
  { id: `collision-F${p}`, vars: ['a', 'ab', 'bc', 'c'], rels: ['a*bc-a', 'ab*c-ab'], p, expected: [1, 2, 0], collision: true },
  { id: `monoid-F${p}`, vars: ['x1', 'x11'], rels: ['x1^2-1'], augmentation: 'monoid', p, expected: [1, p === 2 ? 2 : 1, p === 2 ? 1 : 0] },
  { id: `cubic-F${p}`, vars: ['alpha', 'alpha2'], rels: ['alpha^3'], p, checkLegacy: true, expected: [1, 2, 1, 1] }
);
cases.push(
  { id: 'rational', vars: ['x1', 'x11'], rels: ['7*x1^2-3*x1'], expected: [1, 1, 0, 0] },
  { id: 'large-rational', vars: ['a', 'aa'], rels: ['7*a^2+12157665459056928801*a'], expected: [1, 1, 0, 0] },
  { id: 'weighted-reversed', vars: ['x_1', 'x_11'], rels: ['x_1^2-x_1'], weights: '2 3', reverseVars: true, maxdeg: 12, expected: [1, 1, 0, 0] },
  { id: 'weighted-collision', vars: ['a', 'ab', 'bc', 'c'], rels: ['a*bc-a', 'ab*c-ab'], maxdeg: 6, weights: '1 1 2 2', expected: [1, 2, 0], collision: true },
  { id: 'case-and-underscore', vars: ['X_1', 'x_11'], rels: ['X_1^2-X_1'], expected: [1, 1, 0, 0] },
  { id: 'exterior-prefixes', vars: ['a', 'aa', 'aaa'], rels: rename(FAMILIES.exterior.build(3).rels, ['a', 'b', 'c'], ['a', 'aa', 'aaa']), expected: [1, 3, 6, 10, 15] },
  { id: 'monoid-weighted-reversed', vars: ['x_1', 'x_11'], rels: ['x_1^2-1'], augmentation: 'monoid', weights: '2 3', reverseVars: true, maxdeg: 12, p: 101, expected: [1, 1, 0, 0] },
  { id: 'ocaml-mirai-renamed', vars: ['gen_g', 'gen_f', 'gen_e', 'gen_d', 'gen_c', 'gen_b', 'gen_a'], rels: ['gen_a^2*gen_b-gen_a*gen_c^2', 'gen_c^2*gen_d-gen_f', 'gen_c^2*gen_e-gen_g', 'gen_c*gen_g-gen_f*gen_e'], augmentation: 'monoid' }
);
const report = [];
try {
  for (const c of cases) {
    const dir = path.join(out, c.id); fs.mkdirSync(dir);
    fs.mkdirSync(path.join(dir, 'wasm'));
    const form = { task: 'anick', ring: 'noncomm', order: 'degleftlex', field: c.p ? 'p' : '0', modulus: c.p || 0, maxdeg: 8, ...c };
    const job = buildJob(form), rt = await wasmRuntime({onOutput: line => fs.appendFileSync(path.join(dir, 'wasm.log'), line + '\n')}), result = rt.run(job);
    for (const [file, text] of Object.entries(result.files)) fs.writeFileSync(path.join(dir, 'wasm', file), text);
    const stages = job.resolution ? [job, resolutionJob(job, result.files[job.outputs.gb])] : [job];
    for (const part of stages) for (const [file, text] of Object.entries(part.files)) fs.writeFileSync(path.join(dir, file), text);
    const script = stages.map(part => part.script).join('\n') + '\n(QUIT)\n';
    fs.writeFileSync(path.join(dir, 'native-session.lsp'), script);
    const ref = spawnSync(native, [], { cwd: dir, input: script, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 8e6 });
    fs.writeFileSync(path.join(dir, 'native.log'), (ref.stdout || '') + (ref.stderr || ''));
    assert.ifError(ref.error); assert.equal(ref.status, 0, c.id + ': native exit');
    for (const file of Object.keys(result.files).filter(n => /\.(gb|anick|jsonl)$/.test(n)))
      assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), result.files[file], c.id + ': native ' + file);
    const data = result.files['resolution.jsonl'], basis = result.files['resolution.gb'] || result.files['result.gb'];
    const h = result.homology || augmentedHomology(data, c.vars, c.p || 0);
    const identities = certifyResolution(data, basis, c.vars, c.p || 0);
    const a = algebra(c.vars, false, c.p || 0), gb = a.basis(basis);
    const input = readInputFile(stages.at(-1).files[Object.keys(stages.at(-1).files)[0]]);
    const ambiguities = a.certify(input.rels.map(a.parse), gb);
    const short = c.vars.map((_, i) => String.fromCharCode(65 + i));
    const shortResult = (await wasmRuntime()).run(buildJob({ ...form, vars: short, rels: rename(c.rels, c.vars, short) }));
    assert.deepEqual(canonical(data, c.vars), canonical(shortResult.files['resolution.jsonl'], short), c.id + ': renaming all differential terms');
    const shortH = shortResult.homology || augmentedHomology(shortResult.files['resolution.jsonl'], short, c.p || 0);
    assert.deepEqual(h, shortH, c.id + ': renaming homology');
    if (c.expected) assert.deepEqual(h.betti.slice(0, c.expected.length), c.expected, c.id + ': known Betti numbers');
    if (c.collision) {
      const rows = readResolution(data, c.vars).diffs.get(1);
      assert.equal(rows.length, 2); assert.notDeepEqual(rows[0].chain, rows[1].chain);
    }
    if (c.checkLegacy) {
      const original = (await wasmRuntime()).run(buildJob({ ...form, legacy: true }));
      assert.equal(original.files['result.anick'], result.files['result.anick'], c.id + ': original long-name output preserved');
    }
    const row = { id: c.id, generators: c.vars, modulus: c.p || 0, reversed: !!c.reverseVars, weights: c.weights || null,
      nativeEquality: true, renamingEquality: true, legacyEquality: !!c.checkLegacy, homology: h, identities, ambiguities, elapsedMs: result.elapsedMs };
    report.push(row); fs.writeFileSync(path.join(out, 'partial-report.json'), JSON.stringify(report, null, 2));
    console.log(c.id, 'PASS', h.betti, identities, 'full differential identities');
  }
  assert.equal(report.length, 20);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
} catch (e) { fs.writeFileSync(path.join(out, 'partial-report.json'), JSON.stringify(report, null, 2)); console.error(e); process.exitCode = 1; }
