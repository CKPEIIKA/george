// Degrees come from engine events, never from the requested bound or a timer.
export function degreeProgress(event, previous = null) {
  let degree, completed = false;
  const through = Number(event.completedThroughDegree);
  if (event.type === 'degree-start') degree = Number(event.degree);
  else if (event.type === 'degree') {degree = through; completed = true;}
  else if (event.type === 'progress') {
    const current = Number(event.currentDegree);
    if (current > through) degree = current;
    else {degree = through; completed = true;}
  } else if (event.type === 'phase' && ['checkpoint','hilbert','export'].includes(event.phase)) {
    degree = through; completed = true;
  } else return null;
  if (!Number.isSafeInteger(degree) || degree < 1) return null;
  const phase = event.phase ?? 'basis';
  const samePhase = previous && previous.phase === phase;
  const completedThroughDegree = Number.isSafeInteger(through) && through >= 0
    ? through : completed ? degree : degree - 1;
  const result = {degree,completed,completedThroughDegree,phase,source:event.source ?? 'engine'};
  for (const key of ['pairs','reductions','basisSize']) {
    const value = event[key] ?? (samePhase ? previous[key] : undefined);
    if (Number.isFinite(value) && value >= 0) result[key] = value;
  }
  return result;
}

export function degreeLabel(progress, bound) {
  const degree = progress?.degree ?? '—';
  const state = progress ? progress.completed ? ' ✓' : ' …' : '';
  return `${degree}${state}${bound ? ` / ${bound}` : ''}`;
}
