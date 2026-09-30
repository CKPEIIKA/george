import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readResolution, chainKey, structuralResolutionDisplay } from '../web/src/resolution-data.js';
import { augmentedHomology } from '../web/src/homology.js';
import { buildJob, resolutionJob, shiftRelations } from '../web/src/bergman-syntax.js';
import { certifyResolution } from './support/resolution.mjs';

const vars = ['a', 'aa'];
const exportText = (records, generators = vars, modulus = 0) => [
  { format: 'george-resolution', version: 1, generators, modulus }, ...records
].map(row => JSON.stringify(row)).join('\n');
const term = (target, word, numerator = '1', denominator = '1') => ({ target, word, coefficient: [numerator, denominator] });
const records = [
  { degree: 0, chain: [1], terms: [term([], [1])] },
  { degree: 0, chain: [2], terms: [term([], [2])] },
  { degree: 1, chain: [1, 1], terms: [term([1], [1]), term([1], [], '-1')] }
];
test('a*a and aa are distinct chains and preserve exact ungraded homology', () => {
  const data = exportText(records), parsed = readResolution(data, vars);
  assert.notEqual(chainKey(parsed.diffs.get(0)[1].chain), chainKey(parsed.diffs.get(1)[0].chain));
  const complete = { completeBasis: true, basis: '% 2\na*a-a,\nDone\n', degreeBound: 4 };
  assert.deepEqual(augmentedHomology(data, vars, 0, complete).betti, [1, 1, 0]);
  assert.equal(certifyResolution(data, complete.basis, vars), 1);
  const display = structuralResolutionDisplay(data, vars);
  assert.match(display.diffs.get(0)[1].chainHTML, /<var>aa<\/var>/);
  assert.equal((display.diffs.get(1)[0].chainHTML.match(/<var>a<\/var>/g)||[]).length, 2);
  assert.match(display.diffs.get(1)[0].chainHTML, /<var>a<\/var><span class="op times">·<\/span><var>a<\/var>/);
});
test('structural generator order is independent of form order and follows weights', () => {
  const text = exportText(records, ['aa', 'a']);
  assert.deepEqual(readResolution(text, vars).diffs.get(0)[0].chain, ['aa']);
  const complete = { completeBasis: true, basis: '% 4\naa^2-aa,\nDone\n', degreeBound: 6, weights: '1 2' };
  assert.equal(augmentedHomology(text, vars, 0, complete).finiteTailZero, false);
  assert.equal(augmentedHomology(text, vars, 0, {...complete, degreeBound: 7}).finiteTailZero, true);
});
test('rational coefficients above 2^53 and prime coefficients stay exact', () => {
  const big = '12157665459056928801';
  const data = exportText(records.map(row => row.degree ? {...row, terms: [term([1], [1]), term([1], [], big, '7')]} : row));
  assert.deepEqual(augmentedHomology(data, vars).betti, [1, 1]);
  assert.equal(certifyResolution(data, `% 2\n7*a^2+${big}*a,\nDone\n`, vars), 1);
  assert.deepEqual(augmentedHomology(exportText(records, vars, 5), vars, 5).betti, [1, 1]);
});
test('malformed structure, duplicate chains, missing targets and field mismatch are rejected', () => {
  for (const data of [exportText([...records, records[0]]), exportText([{...records[0], chain: [3]}]),
    exportText([{...records[0], terms: [term([1], [])]}]), exportText([{...records[0], terms: [term([], [], '1', '0')]}]),
    exportText(records, ['a', 'a']), exportText(records).replace('"version":1', '"version":2')]) assert.throws(() => readResolution(data, vars));
  assert.throws(() => augmentedHomology(exportText(records, vars, 5), vars, 2), /field/);
  assert.throws(() => readResolution('D(0, aa)=1.aa\n', vars), /structural/);
  assert.throws(() => readResolution('D(0, a)=Nil\n', ['a']), /uncalculated/);
});
test('full algebra check catches corruption invisible to augmentation', () => {
  const data = exportText(records.map(row => row.degree ? {...row, terms: [term([1], [1]), term([1], [], '-2')]} : row));
  assert.deepEqual(augmentedHomology(data, vars).betti, [1, 1]);
  assert.throws(() => certifyResolution(data, '% 2\na^2-a,\nDone\n', vars), /d²/);
});
test('long names work in both stages and legacy output requests remain unchanged', () => {
  const form = { task: 'anick', ring: 'noncomm', order: 'degleftlex', field: '0', vars: ['x_1', 'x_11'], rels: ['x_1^2-1'], augmentation: 'monoid', maxdeg: 6 };
  const job = buildJob(form), next = resolutionJob(job, '% 2\nx_1^2-1,\nDone\n');
  assert.match(next.script, /GEORGEWRITERESOLUTION/);
  assert.equal(next.outputs.resolution, 'resolution.jsonl');
  assert.match(next.files['resolution-input.bg'], /x_1\*x_1/);
  assert.deepEqual(shiftRelations(['x_1*x_11-x_11*x_1'], form.vars), ['+1*x_1*x_11-1*x_11*x_1']);
  const legacy = buildJob({...form, rels: ['x_1^2'], augmentation: 'graded', legacy: true});
  assert.doesNotMatch(legacy.script, /GEORGEWRITERESOLUTION/);
  assert.equal(legacy.outputs.resolution, undefined);
});
