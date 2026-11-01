// Engine totals describe the computation; parsed text may contain only a preview.
export function basisSummary(groups, done, result = {}) {
  const shown = groups.reduce((n, group) => n + group.polys.length, 0);
  const metadata = result.fomkyr;
  const counts = metadata?.basisByDegree ?? groups.map(group => ({degree: group.deg, count: group.polys.length}));
  const displayed = new Map(groups.map(group => [group.deg, group.polys]));
  const degrees = counts.filter(group => group.count > 0).map(group => group.degree);
  return {
    total: metadata?.basisSize ?? shown, shown, degrees,
    complete: !result.interrupted && (metadata ? metadata.complete === true : done),
    completedThroughDegree: metadata?.completedThroughDegree,
    truncated: metadata?.previewTruncated === true,
    groups: counts.map(group => ({deg: group.degree, count: group.count, polys: displayed.get(group.degree) ?? []})),
  };
}
