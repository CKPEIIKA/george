import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../web/src/bergman-syntax.js';
import { completenessCertificate, runOutcome } from '../web/src/completeness.js';

const expand = (src, vars) => B.toBergman(B.parseRelation(src, vars));

test('commutators, anticommutators and equations expand to plain relations', () => {
  assert.equal(expand('[a0,b0] = t^2', ['t', 'b0', 'a0']), 'a0*b0-b0*a0-t^2');
  assert.equal(expand('{g1,g2} = 0', ['g1', 'g2']), 'g1*g2+g2*g1');
  assert.equal(expand('{g1,g1} = 2t^2', ['t', 'g1']), '2*g1^2-2*t^2');
  assert.equal(expand('[h, e] = 2t e', ['t', 'h', 'e']), 'h*e-e*h-2*t*e');
  assert.equal(expand('[x, yz]', ['x', 'y', 'z']), 'x*y*z-y*z*x');
  assert.equal(expand('[[x,y],x]', ['x', 'y']), '2*x*y*x-y*x^2-x^2*y');
  assert.equal(expand('x^2 = x', ['x']), 'x^2-x');
  assert.equal(expand('[x,y]^2', ['x', 'y']), 'x*y*x*y-x*y^2*x-y*x^2*y+y*x*y*x');
});

test('bracket syntax keeps its commas inside one relation', () => {
  assert.deepEqual(B.splitRelations('[a,b] = t^2, {g1,g2} = 0\n[x,[y,z]]'), ['[a,b] = t^2', '{g1,g2} = 0', '[x,[y,z]]']);
  assert.deepEqual(B.splitRelations('x*y, y^2;\nz'), ['x*y', 'y^2', 'z']);
});

test('malformed bracket input is rejected with translatable messages', () => {
  for (const bad of ['[x,x]', '[x]', '[x,y', 'x = y = x', '{x,y}^65', '[x,(y)]', 'x =', '= x', '[x,q]'])
    assert.throws(() => B.parseRelation(bad, ['x', 'y']), SyntaxError, bad);
  assert.throws(() => B.parseRelation('[x,x]', ['x']), /expands to zero/);
});

test('names with trailing digits are typeset with subscripts', () => {
  assert.equal(B.varHTML('b0'), '<var>b</var><sub>0</sub>');
  assert.equal(B.varHTML('a_12'), '<var>a</var><sub>12</sub>');
  assert.equal(B.varHTML('x'), '<var>x</var>');
  assert.match(B.varHTML('Jz'), /var-long/);
  assert.match(B.typeset('a1*b1-b1*a1'), /<var>a<\/var><sub>1<\/sub><var>b<\/var><sub>1<\/sub>/);
});

test('a negative leading coefficient is shown positive', () => {
  assert.equal(B.positiveLeading('-y*z+x*z'), 'y*z-x*z');
  assert.equal(B.positiveLeading('-2*x^2*y+3*(x-y)'), '2*x^2*y-3*(x-y)');
  assert.equal(B.positiveLeading('x^2-1'), 'x^2-1');
});

test('the effective variable order follows bergman per algebra and order', () => {
  const vars = ['x', 'y', 'z'];
  // Probed against the engine: noncommutative degree orders rank the last name highest.
  assert.deepEqual(B.variableOrder({ vars, ring: 'noncomm', order: 'degleftlex' }), ['z', 'y', 'x']);
  assert.deepEqual(B.variableOrder({ vars, ring: 'noncomm', order: 'homogelim' }), ['z', 'y', 'x']);
  for (const order of ['elim', 'invelim', 'invwelim']) assert.deepEqual(B.variableOrder({ vars, ring: 'noncomm', order }), ['x', 'y', 'z']);
  for (const order of ['deglex', 'degrevlex', 'purelex']) assert.deepEqual(B.variableOrder({ vars, ring: 'comm', order }), ['x', 'y', 'z']);
  assert.deepEqual(B.variableOrder({ vars, ring: 'noncomm', order: 'degleftlex', reverseVars: true }), ['x', 'y', 'z']);
  const matrix = '1 2 1\n0 -1 1\n3 -2 2';
  assert.deepEqual(B.variableOrder({ vars, ring: 'comm', order: 'matrix', matrix }), ['y', 'z', 'x']);
  assert.deepEqual(B.variableOrder({ vars, ring: 'comm', order: 'matrix', matrix, reverseVars: true }), ['y', 'x', 'z']);
  assert.equal(B.variableOrder({ vars, ring: 'comm', order: 'matrix', matrix: '1 1' }), null);
});

test('homogeneous bases are certified complete once every critical pair is computed', () => {
  assert.deepEqual(completenessCertificate({ degrees: [2], relationDegree: 2, through: 6 }), { m: 2, bound: 3, through: 6 });
  assert.equal(completenessCertificate({ degrees: [2, 3], relationDegree: 2, through: 4 }), null);
  assert.ok(completenessCertificate({ degrees: [2, 3], relationDegree: 2, through: 5 }));
  // A relation above the bound is not in the truncated output, so it blocks the certificate.
  assert.equal(completenessCertificate({ degrees: [2], relationDegree: 7, through: 6 }), null);
  assert.equal(completenessCertificate({ degrees: [3, 5], relationDegree: 3, through: 8, minWeight: 1 }), null);
  assert.ok(completenessCertificate({ degrees: [3, 5], relationDegree: 3, through: 8, minWeight: 2 }));
});

test('the run outcome distinguishes complete, bounded and stopped runs', () => {
  const summary = (complete, degrees) => ({ complete, degrees });
  const job = { degreeBound: '6' };
  const form = { task: 'gb', ring: 'noncomm', vars: ['t', 'b', 'a'], rels: ['[a,b] = t^2', '[a,t]', '[b,t]'], nonhomog: 'degreewise', strategy: 'default', weights: '' };
  const facts = B.jobFacts(form, job);
  assert.deepEqual(facts.certificate, { relationDegree: 2, minWeight: 1 });
  assert.equal(runOutcome({ job, facts, res: {}, summary: summary(true, [2]) }).state, 'complete');
  assert.equal(runOutcome({ job: { degreeBound: '3' }, facts, res: {}, summary: summary(true, [2, 3]) }).state, 'bounded');
  assert.equal(runOutcome({ job: { degreeBound: null }, facts, res: {}, summary: summary(true, [2, 3]) }).state, 'complete');
  assert.equal(runOutcome({ job, facts, res: { interrupted: true }, summary: summary(false, [2]) }).state, 'stopped');
  assert.equal(runOutcome({ job, facts: {}, res: {}, summary: summary(true, [2]) }).state, 'bounded');
  assert.equal(B.jobFacts({ ...form, rels: ['x^2-x'], vars: ['x'] }, job).certificate, undefined);
  const fomkyr = { fomkyr: { complete: true, completedThroughDegree: 4 } };
  assert.deepEqual(runOutcome({ job, facts, res: fomkyr, summary: { complete: true, degrees: [2, 3, 4], completedThroughDegree: 4 } }),
    { state: 'bounded', degree: 4, hint: 'fomkyr.bounded', params: { d: 4 } });
});

test('itemwise output keeps every element of a repeated degree', () => {
  const {groups, done} = B.parseBasis('% 2\nx*y,\n   \n% 3\nx^3,\n   \n% 2\ny^2+y*x+x^2,\n   \n');
  assert.deepEqual(groups, [{deg: 2, polys: ['x*y', 'y^2+y*x+x^2']}, {deg: 3, polys: ['x^3']}]);
  assert.equal(done, false);
});

test('an itemwise Done marker is already a completeness certificate', () => {
  const form = { task: 'gb', ring: 'noncomm', vars: ['x'], rels: ['x^2-x'], nonhomog: 'itemwise', strategy: 'default', weights: '' };
  const facts = B.jobFacts(form, { degreeBound: '6' });
  assert.equal(facts.itemwise, true);
  assert.equal(runOutcome({ job: { degreeBound: '6' }, facts, res: {}, summary: { complete: true, degrees: [2] } }).hint, 'basis.itemwiseComplete');
  assert.equal(runOutcome({ job: { degreeBound: '3' }, facts, res: {}, summary: { complete: false, degrees: [2] } }).state, 'bounded');
});

test('dimension evidence accepts series, pairs, CSV and fomkyr documents', async () => {
  const { parseDimensionEvidence, hilbertClosureOption } = await import('../web/src/dimension-evidence.js');
  const entries = (text) => parseDimensionEvidence(text, 'assume').entries;
  const expected = [{ degree: 1, dimension: '15' }, { degree: 2, dimension: '125' }];
  assert.deepEqual(entries('1, 15, 125'), expected);
  assert.deepEqual(entries('1: 15\n2: 125'), expected);
  assert.deepEqual(entries('degree,dimension,certified\n0,1,true\n1,15,true\n2,125,true\n'), expected);
  assert.deepEqual(entries('{"coefficients":["1","15","125"]}'), expected);
  assert.deepEqual(entries('{"2":125,"1":15}'), expected);
  assert.deepEqual(entries('[{"degree":1,"dimension":"15"},{"degree":2,"dimension":125}]'), expected);
  for (const bad of ['', '2, 15, 125', '2 125\n1 15', '1 x', '{', '{"schema":1,"kind":"integer-duals"}'])
    assert.throws(() => parseDimensionEvidence(bad, 'assume'), Error, bad);
  assert.throws(() => parseDimensionEvidence('1, 15', 'certificate'), /certificate/);
  const document = { schema: 1, kind: 'integer-duals', identity: 'abc', modulus: 0, entries: [] };
  const certificate = parseDimensionEvidence(JSON.stringify(document), 'certificate');
  assert.deepEqual(hilbertClosureOption(certificate, 'ignored', 0), { certificate: document });
  // Plain dimensions are bound to the presentation the worker computes.
  const bound = hilbertClosureOption(parseDimensionEvidence('1, 15, 125', 'assume'), 'id', 0).assume;
  assert.equal(bound.identity, 'id'); assert.equal(bound.kind, 'external-dimensions'); assert.deepEqual(bound.entries, expected);
});

test('assumed dimensions never yield an unconditional completeness claim', () => {
  const summary = { complete: true, degrees: [2], completedThroughDegree: 6 };
  const facts = { certificate: { relationDegree: 2, minWeight: 1 } };
  const run = (meta) => runOutcome({ job: { degreeBound: '6' }, facts, res: { fomkyr: { complete: true, ...meta } }, summary });
  assert.equal(run({}).state, 'complete');
  assert.equal(run({ conditionalOnExternalDimensions: true }).state, 'bounded');
  assert.equal(run({ unrestrictedBasisComplete: true }).state, 'complete');
  assert.equal(run({ unrestrictedBasisComplete: true, conditionalOnExternalDimensions: true }).state, 'conditional');
  assert.equal(run({ unrestrictedBasisComplete: true, conditionalOnImportedFkDimensions: true }).state, 'conditional');
});

test('fomkyr turns dimension evidence settings into an engine option', async () => {
  const { buildJob } = B;
  const form = { task: 'gb', ring: 'noncomm', order: 'degleftlex', field: '0', vars: ['x', 'y'], rels: ['x*y-y*x'], maxdeg: '4',
    backend: 'fomkyr', memoryMiB: 512, timeoutMinutes: 0, nativeWorkers: 0, weights: '', nonhomog: 'degreewise', strategy: 'default', lowterms: 'quick', outmode: 'ALG' };
  assert.equal(buildJob(form).fomkyrOptions.hilbertDimensions, undefined);
  const job = buildJob({ ...form, fomkyrOptions: { dimensionEvidence: 'assume', dimensionText: '1, 2, 3, 4' } });
  assert.deepEqual(job.fomkyrOptions.hilbertDimensions.entries.map((e) => e.degree), [1, 2, 3]);
  assert.equal(job.fomkyrOptions.dimensionText, undefined);
  assert.ok(B.validateSettings({ ...form, fomkyrOptions: { dimensionEvidence: 'assume', dimensionText: '' } }).length);
});

test('the FK6 example selects its degree-20 continuation, which excludes unrelated evidence', async () => {
  const { tutorialForm } = await import('../web/src/tutorials.js');
  const fk6 = tutorialForm('fk6');
  assert.equal(fk6.fomkyrOptions.hilbertGate, true);
  assert.equal(fk6.fomkyrOptions.dimensionEvidence, 'fk6-20');
  assert.deepEqual(B.buildJob(fk6).fomkyrOptions.hilbertDimensions.document.entries.map(entry => entry.degree), [18, 19, 20]);
  assert.throws(() => B.buildJob({ ...fk6, fomkyrOptions: { ...fk6.fomkyrOptions, dimensionEvidence: 'assume', dimensionText: '1, 15, 125' } }), /not both/);
});
