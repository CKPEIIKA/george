// Lightweight output consistency check, run outside resource measurements.
// This does not certify critical pairs or equality of the generated ideals.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {algebra} from '../test/support/algebra.mjs';
import {readInputFile} from '../web/src/bergman-syntax.js';

const reportFile = path.resolve(process.argv[2] || 'build/validation/backend-resources-degree8/report.json');
const directory = path.dirname(reportFile);
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
assert.equal(report.state, 'complete', 'Finish the serial benchmark first');
const {vars} = readInputFile('(ALGFORMINPUT)\n' + JSON.parse(fs.readFileSync(report.inputFile, 'utf8')).inputText);
const bergman = algebra(vars, false, 0);
const singular = algebra(vars.map((_, i) => 'fk_var_' + i), false, 0);
function leadingWords(row) {
  if (row.id === 'singular') {
    const text = fs.readFileSync(path.join(directory, row.stdoutFile), 'utf8');
    return [...text.matchAll(/^LEAD:(.+)$/gm)].map(match => singular.lead(singular.parse(match[1]))).sort();
  }
  const basis = bergman.basis(fs.readFileSync(path.join(directory, row.basisFile), 'utf8'));
  return basis.map(bergman.lead).sort();
}
const results = [];
for (const degree of report.degrees) {
  const reference = report.rows.find(row => row.id === 'compiled' && row.degree === degree && row.status === 'complete');
  assert.ok(reference, 'Missing C/ECL reference for degree ' + degree);
  const expected = leadingWords(reference);
  for (const row of report.rows.filter(row => row.degree === degree && row.status === 'complete')) {
    const actual = leadingWords(row);
    assert.equal(actual.length, row.basisSize, row.id + ' basis count');
    assert.deepEqual(actual, expected, row.id + ' degree ' + degree + ' leading words');
    results.push({id: row.id, degree, basisSize: actual.length, leadingWordsMatch: true,
      leadingWordsSha256: crypto.createHash('sha256').update(actual.join('\n')).digest('hex')});
  }
}
fs.writeFileSync(path.join(directory, 'leading-word-audit.json'), JSON.stringify({
  state: 'complete',
  method: 'Exact degree-left-lex leading-word sets checked for every completed resource run against C/ECL. This is a bounded consistency check, not a new critical-pair or ideal-membership certificate.',
  runs: results.length, results,
}, null, 2) + '\n');
console.log(results.length + ' completed runs have matching leading-word sets.');
