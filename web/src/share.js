import { ORDERS, TASKS } from './bergman-syntax.js';
import { BACKENDS, validMemoryMiB } from './backends.js';
import { timeoutMilliseconds } from './time-limit.js';
import { validateFomkyrOptions } from './fomkyr-options.js';

export const SHARE_PREFIX = '#s=';
const MAX_BYTES = 1048576;

// Version 1: keep this field order and these defaults stable for existing links.
const FIELDS = [
  ['ring', 'noncomm'], ['varsText', ''], ['relsText', ''], ['field', '0'],
  ['modulus', '5'], ['order', 'degleftlex'], ['reverseVars', false],
  ['matrix', '1 2 1\n0 -1 1\n3 -2 2'], ['maxdeg', ''], ['memoryMiB', 2048],
  ['weights', ''], ['nonhomog', 'auto'], ['augmentation', 'graded'],
  ['strategy', 'default'], ['rabbit', '2 2 8'], ['lowterms', 'quick'],
  ['outmode', 'ALG'], ['legacy', false], ['maxserdeg', '7'],
  ['nmodgen', '1'], ['nlmodgen', '1'], ['nrmodgen', '1'], ['task', 'gb'],
  ['preset', ''], ['presetN', '3'], ['language', 'en'], ['theme', 'auto'],
  // Old links reproduce the engine that was available when they were made.
  ['backend', 'standard'],
  ['timeoutMinutes', 0],
  ['monomialPruning', false],
  ['nativeWorkers', 0],
  ['fomkyrOptions', ''],
];
const CHOICES = {
  ring: ['noncomm', 'comm'], field: ['0', '2', 'p'],
  order: Object.values(ORDERS).flat().map(order => order.id),
  nonhomog: ['auto', 'itemwise', 'degreewise'], augmentation: ['graded', 'monoid'],
  strategy: ['default', 'rabbit'], lowterms: ['quick', 'safe'], outmode: ['ALG', 'MACAULAY'],
  task: TASKS.map(task => task.id), language: ['en', 'ru'], theme: ['auto', 'light', 'dark'],
  backend: Object.keys(BACKENDS),
};

function validateState(state) {
  for (const [key, fallback] of FIELDS) {
    if (typeof state[key] !== typeof fallback || (CHOICES[key] && !CHOICES[key].includes(state[key]))) throw new Error('share.invalid');
  }
  if (!ORDERS[state.ring].some(order => order.id === state.order)) throw new Error('share.invalid');
  if (!validMemoryMiB(state.memoryMiB, state.backend)) throw new Error('share.invalid');
  if (!Number.isInteger(state.nativeWorkers) || state.nativeWorkers < 0 || state.nativeWorkers > 32) throw new Error('share.invalid');
  try { timeoutMilliseconds(state.timeoutMinutes); } catch { throw new Error('share.invalid'); }
  try { if (state.fomkyrOptions) validateFomkyrOptions(JSON.parse(state.fomkyrOptions)); } catch { throw new Error('share.invalid'); }
  return state;
}

function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function readBytes(stream) {
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('share.tooLarge'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function createShareLink(values, href) {
  if (values.fomkyrOptions && typeof values.fomkyrOptions === 'object') values = {...values, fomkyrOptions: JSON.stringify(values.fomkyrOptions)};
  const state = validateState(Object.fromEntries(FIELDS.map(([key, fallback]) => [key, values[key] ?? fallback])));
  let mask = 0n;
  const changed = [];
  FIELDS.forEach(([key, fallback], i) => {
    if (state[key] !== fallback) { mask |= 1n << BigInt(i); changed.push(state[key]); }
  });
  let bytes = new TextEncoder().encode(JSON.stringify([mask.toString(36), ...changed]));
  if (bytes.length > MAX_BYTES) throw new Error('share.tooLarge');
  let format = 'u';
  if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
    const compressed = await readBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate')));
    if (compressed.length < bytes.length) { bytes = compressed; format = 'z'; }
  }
  const url = new URL(href);
  url.hash = `${SHARE_PREFIX}1${format}${toBase64(bytes)}`;
  return url.href;
}

export async function readShareLink(hash) {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  const token = hash.slice(SHARE_PREFIX.length);
  if (!/^1[uz][A-Za-z0-9_-]+$/.test(token) || token.length > Math.ceil(MAX_BYTES * 4 / 3) + 2) throw new Error('share.invalid');
  let bytes = Uint8Array.from(atob(token.slice(2).replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
  if (token[1] === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('share.unsupported');
    bytes = await readBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')));
  }
  const packed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!Array.isArray(packed) || typeof packed[0] !== 'string' || !/^[0-9a-z]+$/.test(packed[0])) throw new Error('share.invalid');
  const mask = parseInt(packed[0], 36);
  if (!Number.isSafeInteger(mask) || mask < 0 || mask >= 2 ** FIELDS.length) throw new Error('share.invalid');
  let offset = 1;
  const state = Object.fromEntries(FIELDS.map(([key, fallback], i) => [key, BigInt(mask) & (1n << BigInt(i)) ? packed[offset++] : fallback]));
  if (offset !== packed.length) throw new Error('share.invalid');
  validateState(state);
  state.fomkyrOptions = state.fomkyrOptions ? JSON.parse(state.fomkyrOptions) : {};
  return state;
}
