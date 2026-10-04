// SPDX-License-Identifier: MIT. Terminal reports; persisted records remain JSON.
export function humanReport(report) {
  const lines = [], type = report.type ?? report.event;
  const elapsed = report.elapsedSeconds ?? (report.elapsedMs ?? report.cumulativeElapsedMs) / 1000;
  const time = Number.isFinite(elapsed) ? `Elapsed: ${elapsed.toFixed(3)} s` : null;
  const memory = () => {
    const values = {...report.memoryPlan, ...report};
    for (const [key, label] of [['budgetBytes', 'Memory allowance'], ['ordinaryScratchBytes', 'Reduction workspace'],
      ['rowReserveBytes', 'Shared row reserve'], ['allocatedBytes', 'Allocated capacity'],
      ['linearMemoryBytes', 'Wasm linear memory'], ['peakRSSBytes', 'Peak physical RAM']]) {
      const bytes = Number(values[key]);
      if (Number.isFinite(bytes)) {
        const unit = bytes >= 1073741824 ? 'GiB' : 'MiB';
        lines.push(`${label}: ${(bytes / (unit === 'GiB' ? 1073741824 : 1048576)).toFixed(2)} ${unit}`);
      }
    }
  };
  if (type === 'progress') {
    const counts = report.overlaps ?? {};
    lines.push(`Degree ${report.currentDegree}: ${counts.resolved ?? '?'} / ${counts.total ?? '?'} overlaps; completed through degree ${report.completedThroughDegree}.`);
    if (time) lines.push(time);
  } else if (type === 'degree') {
    lines.push(`Completed degree ${report.completedThroughDegree}: ${report.basisSize} polynomials.`);
    if (time) lines.push(time);
  } else if (type === 'checkpoint') {
    lines.push(`Checkpoint saved: completed through degree ${report.completedThroughDegree}${report.partial ? `, partial degree ${report.currentDegree}` : ''}.`);
  } else if (type === 'cache') {
    lines.push(`Saved completed degree: ${report.resumedFromDegree}${report.resumedPartial ? `; partial degree ${report.resumedPartial.currentDegree}` : ''}.${report.cacheHit ? ' Requested degree already cached.' : ''}`);
  } else if (type === 'memory-adaptation') {
    lines.push(`Workspace pressure: using ${report.workers} workers; retrying pending work${report.replayFromTask == null ? '' : ` from task ${report.replayFromTask}`}.`);
  } else if (type === 'hilbert-degree-closure') {
    lines.push(`Hilbert closure at degree ${report.degree ?? report.details?.degree} (${report.evidence ?? report.mode ?? 'evidence'}).`);
  } else if (type === 'fk-gate-degree-closure') {
    lines.push(`FK6 imported-profile closure at degree ${report.degree}.`);
  } else if (type === 'fk-gate-state') {
    lines.push(`FK6 degree ${report.degree}: ${report.closedSectors ?? 0} closed components; dimension deficit ${report.deficit ?? '?'}.`);
  } else if (type === 'warning' || type === 'stdout') {
    lines.push(String(report.message ?? report.text).trimEnd());
  } else if (Object.hasOwn(report, 'complete')) {
    lines.push(report.complete
      ? `Completed through degree ${report.completedThroughDegree}: ${report.basisSize} polynomials.`
      : `Stopped: ${report.code ?? 'ERROR'}.${report.message ? ` ${report.message}` : ''}`);
    if (report.terms != null) lines.push(`Terms: ${report.terms}; workers: ${report.workers}.`);
    if (time) lines.push(time);
    memory();
  } else if (report.checkpoint === null) {
    lines.push(`No valid checkpoint found.${report.error ? ` ${report.error}` : ''}`);
  } else if (report.completedThroughDegree != null) {
    lines.push(`Checkpoint: completed through degree ${report.completedThroughDegree}; ${report.basisSize} polynomials.`);
    if (report.partial) lines.push(`Saved partial degree: ${report.currentDegree}.`);
    if (time) lines.push(time);
  } else {
    lines.push(`Wasm memory plan${report.workers == null ? '' : `: ${report.workers} workers`}.`);
    memory();
  }
  if (report.conditionalOnExternalDimensions) lines.push('Results are conditional on the supplied external Hilbert dimensions.');
  if (report.conditionalOnImportedFkDimensions) lines.push('Results are conditional on the imported FK6 dimensions; external proof package not replayed here.');
  return lines.join('\n');
}
