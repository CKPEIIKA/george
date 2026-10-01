// Seeded Latin hypercube designs, quantized into valid Bergman settings.
// Every numeric dimension visits each stratum once, before discretization.
import {ORDERS, parseRelation, isHomogeneous} from '../../web/src/bergman-syntax.js';

export const LHS_SEED = 0x47454f34;
export function latinHypercube(count, dimensions, seed = LHS_SEED) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid sample count.');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  const rows = Array.from({length: count}, () => ({}));
  for (const dimension of dimensions) {
    const strata = Array.from({length: count}, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [strata[i], strata[j]] = [strata[j], strata[i]];
    }
    rows.forEach((row, i) => { row[dimension] = (strata[i] + random()) / count; });
  }
  return rows;
}

export const BASIS_DIMENSIONS = ['ring', 'field', 'generators', 'relations', 'degree', 'weights',
  'shape', 'coefficient', 'order', 'reverse', 'lowterms', 'legacy', 'output', 'memory'];
export const SAMPLE_CONSTRAINTS = [
  'Legacy successful-result samples use weighted homogeneous relations; original nonhomogeneous defects are intentionally retained by legacy mode.',
  'Nonhomogeneous samples use degree-compatible orders and idempotent or mixed quadratic inputs; homogeneous elimination orders are sampled on homogeneous inputs.',
  'Resolution samples use the degree-left-lex order, matching the structured resolution checker.',
  'Monoid augmentation samples use fixed mode, as original Bergman has no monoid augmentation setting.',
];
const select = (unit, values) => values[Math.floor(unit * values.length)];
const integer = (unit, min, max) => min + Math.floor(unit * (max - min + 1));
const field = unit => {
  const modulus = select(unit, [0, 2, 5, 7]);
  return {field: modulus === 0 ? '0' : modulus === 2 ? '2' : 'p', modulus};
};
function matrix(n) {
  return Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => i === 0 || i === j ? 1 : 0).join(' ')).join('\n');
}
function base(row, n, ring) {
  return {vars: ['a', 'b', 'c', 'd'].slice(0, n), ring, ...field(row.field),
    order: select(row.order, ORDERS[ring].map(o => o.id)), matrix: matrix(n),
    reverseVars: row.reverse >= 0.5, maxdeg: String(integer(row.degree, 4, 6)),
    lowterms: row.lowterms >= 0.5 ? 'safe' : 'quick', legacy: row.legacy >= 0.5,
    outmode: row.output >= 0.5 ? 'MACAULAY' : 'ALG', nonhomog: 'auto', augmentation: 'graded',
    memoryMiB: select(row.memory, [512, 1024, 2048, 3072, 3584])};
}

export function backendSamples(count = 64, seed = LHS_SEED) {
  if (!Number.isInteger(count) || count < 16 || count % 16 || count > 256) throw new Error('Sample count must be a multiple of 16 from 16 to 256.');
  const cases = [];
  const basisDesign = latinHypercube(count, BASIS_DIMENSIONS, seed);
  basisDesign.forEach((row, index) => {
    const n = integer(row.generators, 1, 4), ring = select(row.ring, ['comm', 'noncomm']);
    const form = {...base(row, n, ring), task: 'gb'};
    const shape = select(row.shape, ['monomial', 'binomial', 'quadratic', 'nonhomogeneous']);
    const coefficient = select(row.coefficient, ['1', '2', '7', '12157665459056928801']);
    const weightStyle = select(row.weights, ['unit', 'uniform', 'mixed']);
    form.weights = weightStyle === 'unit' ? '' : form.vars.map((_, i) => weightStyle === 'uniform' ? 2 : 1 + i % 2).join(' ');
    // Squares keep these sampled problems bounded and inexpensive. The
    // extra relations exercise cancellations, exact coefficients and tails.
    form.rels = form.vars.map(v => shape === 'nonhomogeneous' ? `${v}^2-${v}` : `${v}^2`);
    for (let j = 0; j < integer(row.relations, 0, 6); j++) {
      const a = form.vars[(index + j) % n], b = form.vars[(index + j + 1) % n];
      const c = form.vars[(index + j + 2) % n];
      if (shape === 'monomial') form.rels.push(`${a}*${b}*${a}`);
      else if (shape === 'binomial') form.rels.push(`${a}*${b}-${coefficient}*${b}*${a}`);
      else if (shape === 'quadratic') form.rels.push(`${a}*${b}+${coefficient}*${b}*${c}-${c}*${a}`);
      else form.rels.push(`${a}*${b}-${coefficient}*${b}*${a}`);
    }
    const weightMap = new Map(form.vars.map((v, i) => [v, Number(form.weights.split(' ')[i] || 1)]));
    if (form.rels.some(r => !isHomogeneous(parseRelation(r, form.vars), weightMap))) {
      form.legacy = false;
      form.order = ring === 'comm' ? 'deglex' : 'degleftlex';
    }
    cases.push({id: `lhs-gb-${String(index + 1).padStart(3, '0')}`, group: 'basis', form,
      sample: row, shape, weightStyle});
  });
  const taskDimensions = [...BASIS_DIMENSIONS, 'augmentation', 'task'];
  const seriesDesign = latinHypercube(count / 4, taskDimensions, seed ^ 0x48534552);
  seriesDesign.forEach((row, index) => {
    const n = integer(row.generators, 1, 3), ring = select(row.ring, ['comm', 'noncomm']);
    const form = {...base(row, n, ring), task: ring === 'comm' ? 'hilbert' : 'ncpbh',
      maxserdeg: '6', outmode: 'ALG', weights: ''};
    form.rels = form.vars.map(v => `${v}^${select(row.shape, [2, 3])}`);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) form.rels.push(`${form.vars[i]}*${form.vars[j]}-${form.vars[j]}*${form.vars[i]}`);
    cases.push({id: `lhs-series-${String(index + 1).padStart(3, '0')}`, group: 'series', form, sample: row});
  });
  const resolutionDesign = latinHypercube(count / 4, taskDimensions, seed ^ 0x414e4943);
  resolutionDesign.forEach((row, index) => {
    const n = integer(row.generators, 1, 3);
    const monoid = row.augmentation >= 0.5;
    const form = {...base(row, n, 'noncomm'), task: 'anick', maxdeg: String(integer(row.degree, 4, 6)),
      order: 'degleftlex', weights: '', outmode: 'ALG', augmentation: monoid ? 'monoid' : 'graded'};
    // Original Bergman has no monoid augmentation setting.
    if (monoid) form.legacy = false;
    form.rels = form.vars.map(v => monoid ? `${v}^2-1` : `${v}^${select(row.shape, [2, 3])}`);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) form.rels.push(`${form.vars[i]}*${form.vars[j]}-${form.vars[j]}*${form.vars[i]}`);
    cases.push({id: `lhs-resolution-${String(index + 1).padStart(3, '0')}`, group: 'resolution', form, sample: row});
  });
  return {seed, count, constraints: SAMPLE_CONSTRAINTS, dimensions: BASIS_DIMENSIONS,
    designs: {basis: basisDesign, series: seriesDesign, resolution: resolutionDesign}, cases};
}

// Larger finite presentations supplement the small sampled design. Their
// commuting square-zero quotients have independently known dimensions C(n,d).
export function largeBackendAnchors() {
  return [16, 20].map(n => {
    const vars = Array.from({length: n}, (_, i) => `x_${i + 1}`);
    const rels = vars.map(v => `${v}^2`);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
      rels.push(`${vars[i]}*${vars[j]}-${vars[j]}*${vars[i]}`);
    const degree = n === 16 ? 3 : 2;
    return {id: `large-${n}-generators-${rels.length}-relations`, group: 'large', form: {
      task: 'gb', vars, rels, ring: 'noncomm', order: 'degleftlex', maxdeg: String(degree),
      field: n === 16 ? '0' : 'p', modulus: 5, memoryMiB: 3584,
    }, expectedDimensions: [1, n, n * (n - 1) / 2, ...(degree === 3 ? [n * (n - 1) * (n - 2) / 6] : [])]};
  });
}
