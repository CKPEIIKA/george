import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {latinHypercube, backendSamples, largeBackendAnchors, oracleBackendAnchors, BASIS_DIMENSIONS} from './support/backend-lhs.mjs';
import {buildJob, ORDERS, parseRelation, isHomogeneous} from '../web/src/bergman-syntax.js';

test('LHS visits each stratum once in every dimension and reproduces its seed', () => {
  const a = latinHypercube(64, BASIS_DIMENSIONS);
  assert.deepEqual(a, latinHypercube(64, BASIS_DIMENSIONS));
  assert.notDeepEqual(a, latinHypercube(64, BASIS_DIMENSIONS, 1));
  for (const dimension of BASIS_DIMENSIONS) {
    assert.deepEqual(a.map(row => Math.floor(row[dimension] * 64)).sort((a, b) => a - b),
      Array.from({length: 64}, (_, i) => i), dimension);
    assert.ok(a.every(row => row[dimension] >= 0 && row[dimension] < 1));
  }
});

test('oracle regressions are pinned to complete sampled jobs and expected dimensions', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('fixtures/backend-oracles.json', import.meta.url)));
  const {cases} = backendSamples(fixture.basisSamples, fixture.samplingSeed);
  for (const regression of fixture.cases) {
    const sample = cases.find(c => c.id === regression.id);
    assert.ok(sample, regression.id);
    const hash = crypto.createHash('sha256').update(JSON.stringify(buildJob(sample.form))).digest('hex');
    assert.equal(hash, regression.jobSha256, regression.id);
    assert.ok(regression.expectedDimensions.length > 0);
  }
});
test('oracle anchors cover one-generator orders/fields and weighted elimination in both modes', () => {
  const anchors=oracleBackendAnchors(); assert.equal(anchors.length,16);
  for(const c of anchors)assert.ok(buildJob(c.form).script,c.id);
  for(const order of ORDERS.comm)for(const field of ['0','2','p'])
    assert.ok(anchors.some(c=>c.form.order===order.id&&c.form.field===field));
  for(const order of ['elim','invelim'])for(const legacy of [false,true])
    assert.ok(anchors.some(c=>c.form.order===order&&c.form.legacy===legacy));
});
test('LHS samples build valid jobs across supported fields, orders and modes', () => {
  const {cases} = backendSamples();
  assert.equal(cases.length, 96);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const c of cases) assert.ok(buildJob(c.form).script, c.id);
  for (const {form} of cases.filter(c => c.group === 'basis' && c.form.legacy)) {
    const weights = new Map(form.vars.map((v, i) => [v, Number(form.weights.split(' ')[i] || 1)]));
    assert.ok(form.rels.every(r => isHomogeneous(parseRelation(r, form.vars), weights)), 'legacy sampling constraint');
  }
  const basis = cases.filter(c => c.group === 'basis').map(c => c.form);
  assert.deepEqual([...new Set(basis.map(f => f.ring))].sort(), ['comm', 'noncomm']);
  assert.deepEqual([...new Set(basis.map(f => f.modulus))].sort((a, b) => a - b), [0, 2, 5, 7]);
  for (const [ring, orders] of Object.entries(ORDERS)) for (const {id} of orders)
    assert.ok(basis.some(f => f.ring === ring && f.order === id), `${ring}: ${id}`);
  assert.ok(basis.some(f => f.legacy)); assert.ok(basis.some(f => !f.legacy));
  assert.ok(basis.some(f => f.reverseVars)); assert.ok(basis.some(f => !f.reverseVars));
  assert.ok(basis.some(f => f.weights)); assert.ok(basis.some(f => !f.weights));
  assert.ok(cases.some(c => c.form.augmentation === 'monoid'));
  assert.throws(() => backendSamples(17), /multiple of 16/);
});

test('large parity anchors exceed 15 generators and 100 relations', () => {
  const anchors = largeBackendAnchors();
  assert.deepEqual(anchors.map(c => [c.form.vars.length, c.form.rels.length]), [[16, 136], [20, 210]]);
  for (const c of anchors) {
    assert.ok(buildJob(c.form).script);
    assert.equal(c.expectedDimensions.length, Number(c.form.maxdeg) + 1);
  }
});
