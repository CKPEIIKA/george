// IDs are persisted in forms and share links; keep their meaning stable.
import {NATIVE_CAPABILITIES} from './native-capabilities.js';
export const DEFAULT_BACKEND = 'memory64';
export const DEFAULT_MEMORY64_MIB = 16077; // 15.7 GiB rounded to a whole MiB.
export const BACKENDS = Object.freeze({
  standard: Object.freeze({directory: '../engine/', label: 'backend.standard', defaultHeapMiB: 2048, maximumHeapMiB: 4095}),
  optimized: Object.freeze({directory: '../engine/optimized/', label: 'backend.optimized', defaultHeapMiB: 2048, maximumHeapMiB: 4095}),
  compiled: Object.freeze({directory: '../engine/compiled/', label: 'backend.compiled', defaultHeapMiB: 2048, maximumHeapMiB: 4095}),
  memory64: Object.freeze({directory: '../engine/memory64/', label: 'backend.memory64', defaultHeapMiB: DEFAULT_MEMORY64_MIB, maximumHeapMiB: 16384, memory64: true}),
  native: Object.freeze({directory: '../engine/native/', worker: '../engine/native/worker.js',
    label: 'backend.native', kind: 'native', experimental: true, defaultHeapMiB: 512,
    maximumHeapMiB: 14304, capabilities: NATIVE_CAPABILITIES}),
});

// These clients consume ECL assets and support the full Bergman task matrix.
export const BERGMAN_BACKENDS = Object.freeze(Object.fromEntries(
  Object.entries(BACKENDS).filter(([, backend]) => backend.kind !== 'native')));

export function nativeBackendSupported() {
  return globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined'
    && typeof globalThis.navigator?.storage?.getDirectory === 'function';
}

export function getBackend(id) {
  if (!Object.hasOwn(BACKENDS, id)) throw new Error('Unknown computation engine.');
  return BACKENDS[id];
}

export function defaultMemoryMiB(id = 'standard') {
  return getBackend(id).defaultHeapMiB;
}

export function preferredBackend(supportsMemory64 = memory64Supported()) {
  return supportsMemory64 ? DEFAULT_BACKEND : 'compiled';
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
