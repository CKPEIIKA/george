// A homogeneous truncated Gröbner basis is complete once every critical pair
// lies within the computed degrees. Two leading words of degrees a and b
// overlap (or share a variable, in the commutative case) in degree at most
// a + b − w, where w is the smallest generator weight; coprime commutative
// pairs need no check. So if every basis element and every input relation has
// degree at most m, and all degrees through d are computed with
// 2m − w ≤ d, no further basis element can appear in any degree.
export function completenessCertificate({degrees, relationDegree = 0, through, minWeight = 1}) {
  if (!Number.isSafeInteger(through) || through < 1 || !Number.isSafeInteger(minWeight) || minWeight < 1) return null;
  const m = Math.max(relationDegree, ...degrees);
  const bound = Math.max(m, 2 * m - minWeight);
  return bound <= through ? {m, bound, through} : null;
}

// The status chip for a finished computation: complete, bounded at a degree,
// or stopped, together with the key and parameters of its explanation.
export function runOutcome({job, facts = {}, res, summary}) {
  if (res.interrupted) return {state: 'stopped', hint: 'basis.stoppedPartial'};
  if (facts.resolutionTask) return {state: 'bounded', degree: job.degreeBound, hint: 'res.bounded', params: {d: job.degreeBound}};
  if (!summary) return null;
  const meta = res.fomkyr;
  // Imported or assumed dimensions make any completeness claim conditional.
  const conditional = !!(meta?.conditionalOnImportedFkDimensions || meta?.conditionalOnExternalDimensions);
  if (meta?.unrestrictedBasisComplete) return conditional ? {state: 'conditional', hint: 'fomkyr.completeConditional'} : {state: 'complete', hint: 'fomkyr.completeBasis'};
  if (!meta && summary.complete && !job.degreeBound) return {state: 'complete', hint: 'basis.complete'};
  if (!meta && summary.complete && facts.itemwise) return {state: 'complete', hint: 'basis.itemwiseComplete', params: {d: job.degreeBound}};
  const through = Number(meta ? summary.completedThroughDegree : job.degreeBound);
  if (!(through > 0)) return {state: 'stopped', hint: 'basis.stoppedPartial'};
  if (!summary.complete && !meta) return {state: 'bounded', degree: through, hint: 'basis.partial'};
  const certificate = facts.certificate && !conditional && summary.complete
    ? completenessCertificate({...facts.certificate, degrees: summary.degrees, through}) : null;
  if (certificate) return {state: 'complete', hint: 'basis.certified', params: {m: certificate.m, bound: certificate.bound, d: through}};
  return {state: 'bounded', degree: through, hint: meta ? 'fomkyr.bounded' : 'basis.bounded', params: {d: through}};
}
