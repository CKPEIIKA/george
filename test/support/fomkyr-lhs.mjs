import {latinHypercube} from './backend-lhs.mjs';
import {fominKirillov} from './fomin-kirillov.mjs';
export const FOMKYR_LHS_DIMENSIONS = ['rank', 'field', 'degree', 'generatorOrder', 'signs', 'reverse', 'pruning', 'heap', 'cache', 'batch'];
export function fomkyrSamples(count = 48, seed = 0x464b3033) {
  const samples = latinHypercube(count, FOMKYR_LHS_DIMENSIONS, seed);
  const fields = [0, 2, 3, 5, 7, 101];
  return {seed, count, dimensions: FOMKYR_LHS_DIMENSIONS, samples,
    cases: samples.map((sample, i) => {
      const rank = 3 + Math.floor(sample.rank * 4);
      const field = fields[Math.floor(sample.field * fields.length)];
      const requestedDegree = 2 + Math.floor(sample.degree * 4);
      const degree = rank === 6 ? Math.min(requestedDegree, 4) : requestedDegree;
      const presentation = fominKirillov(rank, {seed: Math.floor(sample.generatorOrder * 2 ** 32), signed: sample.signs >= 0.5});
      return {id: 'fomkyr-lhs-' + String(i + 1).padStart(3, '0'), rank, requestedDegree, sample,
        form: {vars: presentation.vars, rels: presentation.rels, field: field === 0 ? '0' : field === 2 ? '2' : 'p',
          modulus: String(field), maxdeg: String(degree), maxserdeg: String(degree), reverseVars: sample.reverse >= 0.5,
          monomialPruning: sample.pruning >= 0.5,
          fomkyrOptions: {heapReduction: sample.heap >= 0.5, cachePercent: Math.floor(sample.cache * 41),
            batchPairs: sample.batch < 0.25 ? 0 : [1, 8, 64][Math.min(2, Math.floor((sample.batch - 0.25) * 4))]}}};
    })};
}
