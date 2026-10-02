// Full E_n presentations, not graph subalgebras (which can need extra relations).
// Definition and rational Hilbert coefficients: arXiv:1310.4112, section 2.
import {latinHypercube} from './backend-lhs.mjs';

export const FK_SOURCE = 'https://arxiv.org/pdf/1310.4112';
export const FK_SEED = 0x464b3035;
export const FK_DIMENSIONS = ['rank', 'field', 'degree', 'generatorOrder', 'signs', 'reverse', 'legacy', 'pruning'];

export function fominKirillov(n, {seed = 0, signed = false} = {}) {
  if (!Number.isInteger(n) || n < 3 || n > 6) throw new Error('FK test rank must be from 3 to 6.');
  const edges = [], name = (i, j) => `x_${i}_${j}`;
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) edges.push({i, j, name: name(i,j)});
  let state = seed >>> 0;
  const random = () => {state = (Math.imul(state,1664525)+1013904223)>>>0; return state/2**32;};
  const signs = Object.fromEntries(edges.map(e => [e.name, signed && random() < 0.5 ? -1 : 1]));
  const expression = terms => terms.map(([coefficient,a,b], index) => {
    const sign = coefficient * signs[a] * signs[b];
    return `${sign < 0 ? '-' : index ? '+' : ''}${a}*${b}`;
  }).join('');
  const squares = edges.map(e => `${e.name}^2`), commuting = [], triangles = [];
  for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) {
    const x = edges[a], y = edges[b];
    if (new Set([x.i,x.j,y.i,y.j]).size === 4) commuting.push(expression([[1,x.name,y.name],[-1,y.name,x.name]]));
  }
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) for (let k = j + 1; k <= n; k++) {
    const a = name(i,j), b = name(j,k), c = name(i,k);
    triangles.push(expression([[1,a,b],[-1,b,c],[-1,c,a]]), expression([[1,b,a],[-1,c,b],[-1,a,c]]));
  }
  const vars = edges.map(e => e.name);
  if (seed) for (let i = vars.length - 1; i > 0; i--) {const j = Math.floor(random()*(i+1)); [vars[i],vars[j]] = [vars[j],vars[i]];}
  return {vars, rels:[...squares,...commuting,...triangles], signs,
    relationCounts:{squares:squares.length,disjointCommutators:commuting.length,triangleRelations:triangles.length}};
}

export function fominKirillovSamples(count = 16, seed = FK_SEED) {
  if (!Number.isInteger(count) || count < 8 || count % 8) throw new Error('FK LHS count must be a positive multiple of 8, at least 8.');
  const samples = latinHypercube(count, FK_DIMENSIONS, seed);
  const fields = [0,2,3,5,7];
  const cases = samples.map((sample,i) => {
    const rank = 3 + Math.floor(sample.rank*4), modulus = fields[Math.floor(sample.field*fields.length)];
    const requestedDegree = 2 + Math.floor(sample.degree*3);
    const degree = rank === 6 ? Math.min(requestedDegree,3) : requestedDegree;
    const orderSeed = Math.floor(sample.generatorOrder*2**32);
    const presentation = fominKirillov(rank, {seed:orderSeed, signed:sample.signs >= 0.5});
    return {id:`fk-lhs-${String(i+1).padStart(3,'0')}`,group:'fomin-kirillov-lhs',rank,sample,requestedDegree,
      signs:presentation.signs,relationCounts:presentation.relationCounts,
      form:{task:'gb',ring:'noncomm',order:'degleftlex',vars:presentation.vars,rels:presentation.rels,
        field:modulus===0?'0':modulus===2?'2':'p',modulus, maxdeg:String(degree), memoryMiB:2048,
        reverseVars:sample.reverse>=0.5,legacy:sample.legacy>=0.5,monomialPruning:sample.pruning>=0.5,
        nonhomog:'degreewise',strategy:'default',lowterms:'quick',outmode:'ALG'}};
  });
  return {seed,count,dimensions:FK_DIMENSIONS,samples,constraints:[
    'Full E_n, ranks 3–6; square-zero, disjoint commutator and both oriented triangle relations.',
    'Degree 2–4, with rank 6 capped at degree 3 in both Bergman and Singular.',
    'Generator permutations and optional sign changes preserve the presented algebra.',
    'Rational and prime fields 2/3/5/7; both behavior modes and pruning settings.',
  ],cases};
}
