// IDs are persisted in forms and share links; keep their meaning stable.
export const DEFAULT_BACKEND = 'compiled';
export const BACKENDS = Object.freeze({
  standard: Object.freeze({directory: '../engine/', label: 'backend.standard', maximumHeapMiB: 4095}),
  optimized: Object.freeze({directory: '../engine/optimized/', label: 'backend.optimized', maximumHeapMiB: 4095}),
  compiled: Object.freeze({directory: '../engine/compiled/', label: 'backend.compiled', maximumHeapMiB: 4095}),
  memory64: Object.freeze({directory: '../engine/memory64/', label: 'backend.memory64', maximumHeapMiB: 16384, memory64: true}),
});

export function getBackend(id) {
  if (!Object.hasOwn(BACKENDS, id)) throw new Error('Unknown computation engine.');
  return BACKENDS[id];
}

export function validMemoryMiB(value, id = 'standard') {
  const backend = getBackend(id);
  return Number.isSafeInteger(value) && ((value >= 128 && value <= backend.maximumHeapMiB) ||
    (value === 0 && backend.memory64 === true));
}

export function memoryLimitMessage(id = 'standard') {
  const backend = getBackend(id);
  return `Memory limit must be an integer from 128 to ${backend.maximumHeapMiB} MiB${backend.memory64 ? ', or 0 for no heap cap' : ''}.`;
}

// Probe the same 16 GiB memory declaration used by the shipped engine.
export function memory64Supported() {
  return typeof WebAssembly !== 'undefined' && WebAssembly.validate(
    new Uint8Array([0,97,115,109,1,0,0,0,5,6,1,5,1,128,128,16]));
}
