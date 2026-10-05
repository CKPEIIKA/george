import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBasis, scriptSettings } from '../web/src/normal-basis.js';
import { buildJob } from '../web/src/bergman-syntax.js';
import { tutorialForm } from '../web/src/tutorials.js';

const norm = (text, vars, options = {}) => normalizeBasis({ text, vars, ...options }).text;

test('tails are interreduced and every element is made monic', () => {
  // Leading monomials first, as engines print them; deg-left-lex with y > x.
  assert.equal(norm('% 2\nx*y,\n-2*y^2-2*y*x-2*x^2,\n% 3\nx^3+x*y*x,\n', ['x', 'y']), '% 2\ny^2+y*x+x^2,\nx*y,\n% 3\nx^3,\n');
  // c*b's tail term c*a is another leading monomial: c*b + c*a -> c*b + b*a.
  assert.equal(norm('% 2\nc*a-b*a,\nc*b+c*a,\n', ['a', 'b', 'c']), '% 2\nc*b+b*a,\nc*a-b*a,\n');
});

test('coefficients stay exact over Q and in prime fields', () => {
  assert.equal(norm('% 2\n3*y*x+2*x*y,\n', ['x', 'y']), '% 2\ny*x+2/3*x*y,\n');
  assert.equal(norm('% 2\n-3*y*x+2*x*y-4,\n', ['x', 'y']), '% 2\ny*x-2/3*x*y+4/3,\n');
  assert.equal(norm('% 2\n2*y*x+x*y,\n', ['x', 'y'], { modulus: 5 }), '% 2\ny*x+3*x*y,\n');
});

test('commutative orders print tails in decreasing monomial order', () => {
  const vars = ['x', 'y'];
  assert.equal(norm('% 3\nx^3,\n-x^2*y+x*y^2,\n% 4\nx*y^3,\n', vars, { ring: 'comm', order: 'degrevlex' }), '% 3\nx^3,\nx^2*y-x*y^2,\n% 4\nx*y^3,\n');
  // x*y^2's tail y^3 is not divisible by x^2*y; an order mismatch falls back to a fixed sequence.
  const result = normalizeBasis({ text: '% 3\ny^3+x^3,\n', vars, ring: 'comm', order: 'deglex' });
  assert.equal(result.orderedTails, false);
});

test('redundant elements are removed', () => {
  const result = normalizeBasis({ text: '% 2\nx*y,\n% 3\nx*y*x+y^3,\ny^3,\n', vars: ['x', 'y'] });
  assert.equal(result.dropped, 1);
  assert.equal(result.text, '% 2\nx*y,\n% 3\ny^3,\n');
});

test('a scrambled basis normalizes to the same canonical text', () => {
  const form = tutorialForm('oscillator');
  const { vars } = form;
  const basis = form.rels.map((r) => r.replace(/\s/g, ''));
  const original = norm('% 2\n' + basis.map((p) => p + ',').join('\n') + '\n', vars);
  // Scale each element and add a later element (with a smaller leading
  // monomial) into its tail; the ideal and leading monomials are unchanged.
  const leadSort = normalizeBasis({ text: original, vars }).text.split('\n').filter((l) => l.endsWith(','));
  const scrambled = leadSort.map((p, i) => {
    const next = leadSort[i + 1];
    return `${3 + i}*(${p.slice(0, -1)})` + (next ? `+5*(${next.slice(0, -1)})` : '');
  }).map((s) => s.replace(/(\d+)\*\(([^)]*)\)/g, (_, k, p) => p.replace(/(^|[+-])(\d+\*)?/g, (m, sign, c) => `${sign === '-' ? '-' : '+'}${k * (c ? parseInt(c) : 1)}*`).replace(/^\+/, '')));
  assert.notEqual(scrambled.join(''), leadSort.join(''));
  assert.equal(norm('% 2\n' + scrambled.map((p) => p + ',').join('\n') + '\n', vars), original);
});

test('ring, order, field and weights are read from the session script', () => {
  const job = buildJob({ ...tutorialForm('weights') });
  assert.deepEqual(scriptSettings(job.script, ['x', 'y', 'z']), { ring: 'noncomm', order: 'degleftlex', modulus: 0, weights: [1, 1, 2], matrix: null });
  const matrix = buildJob(tutorialForm('matrix'));
  const settings = scriptSettings(matrix.script, ['x', 'y', 'z']);
  assert.equal(settings.ring, 'comm'); assert.equal(settings.order, 'matrix'); assert.equal(settings.matrix.length, 3);
});
