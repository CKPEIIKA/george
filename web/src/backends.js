// IDs are persisted in forms and share links; keep their meaning stable.
export const DEFAULT_BACKEND = 'compiled';
export const BACKENDS = Object.freeze({
  standard: Object.freeze({directory: '../engine/', label: 'backend.standard'}),
  optimized: Object.freeze({directory: '../engine/optimized/', label: 'backend.optimized'}),
  compiled: Object.freeze({directory: '../engine/compiled/', label: 'backend.compiled'}),
});

export function getBackend(id) {
  if (!Object.hasOwn(BACKENDS, id)) throw new Error('Unknown computation engine.');
  return BACKENDS[id];
}
