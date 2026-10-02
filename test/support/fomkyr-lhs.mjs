import {latinHypercube} from './backend-lhs.mjs';
import {fominKirillov} from './fomin-kirillov.mjs';
export const FOMKYR_LHS_DIMENSIONS = ['rank', 'field', 'degree', 'generatorOrder', 'signs', 'reverse', 'pruning', 'heap', 'cache', 'batch',
  'matcher','chains','eager','quadratic','scheduling','wordCache','matcherBudget',
  'rationalHeap','compiledRewrites','rewriteLength','rewriteSupport','rewriteBudget','sharedCache','rationalRewrites'];
export function fomkyrSamples(count = 64, seed = 0x464b3036) {
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
            wordMatcher:sample.matcher>=0.5,chainCriterion:sample.chains>=0.5,eagerPruning:sample.eager>=0.5,
            quadraticRewrite:sample.quadratic>=0.5,costScheduling:sample.scheduling>=0.5,
            wordCacheEntries:[256,1024,4096,16384][Math.floor(sample.wordCache*4)],matcherMiB:sample.matcherBudget<0.25?0:null,
            rationalHeap:sample.rationalHeap>=0.5,compiledRewrites:sample.compiledRewrites>=0.5,
            rationalRewrites:sample.rationalRewrites>=0.5,
            rewriteDegree:[2,3,4][Math.floor(sample.rewriteLength*3)],
            rewriteSupport:[1,8,64][Math.floor(sample.rewriteSupport*3)],
            rewriteMiB:[0,1,null][Math.floor(sample.rewriteBudget*3)],
            sharedCacheMiB:[0,1,null][Math.floor(sample.sharedCache*3)],
            batchPairs: sample.batch < 0.25 ? 0 : [1, 8, 64][Math.min(2, Math.floor((sample.batch - 0.25) * 4))]}}};
    })};
}
