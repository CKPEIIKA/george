// Public, persisted options for Fomkyr (upstream fomkyr 0.6).
import {automaticWorkers} from '../engine/fomkyr/worker-count.js';
export const FOMKYR_DEFAULTS = Object.freeze({
  execution: 'auto', bits: 'auto', spill: true, resume: 'auto', hilbert: false,
  heapReduction: true, cachePercent: 12, heapThreshold: 16, batchPairs: null,
  hashBits: 18, scratchMiB: null, hilbertMiB: 256, ioMode: 'auto',
  wordMatcher: true, chainCriterion: true, eagerPruning: true,
  quadraticRewrite: true, costScheduling: true, wordCacheEntries: 256,
  matcherMiB: null, progress: true, progressIntervalSeconds: 1,
  rationalHeap: true, rationalRewrites: true, compiledRewrites: true, rewriteDegree: 4, rewriteSupport: 8,
  rewriteMiB: null, sharedCacheMiB: null,
});
export const FOMKYR_FIELDS = Object.freeze([
  ['execution', 'select', ['auto', 'single', 'multicore']],
  ['bits', 'select', ['auto', '32', '64']],
  ['spill', 'checkbox'], ['resume', 'checkbox'], ['hilbert', 'checkbox'],
  ['heapReduction', 'checkbox'], ['cachePercent', 'number', 0, 40],
  ['rationalHeap', 'checkbox'], ['rationalRewrites', 'checkbox'], ['compiledRewrites', 'checkbox'],
  ['rewriteDegree', 'number', 2, 4], ['rewriteSupport', 'number', 1, 64],
  ['rewriteMiB', 'number', 0, 256], ['sharedCacheMiB', 'number', 0, 256],
  ['wordMatcher', 'checkbox'], ['chainCriterion', 'checkbox'], ['eagerPruning', 'checkbox'],
  ['quadraticRewrite', 'checkbox'], ['costScheduling', 'checkbox'],
  ['wordCacheEntries', 'number', 256, 1048576], ['matcherMiB', 'number', 0, 14304],
  ['progress', 'checkbox'], ['progressIntervalSeconds', 'number', 0.25, 60],
  ['heapThreshold', 'number', 1, 1048576], ['batchPairs', 'number', 0, 512],
  ['hashBits', 'number', 8, 26], ['scratchMiB', 'number', 1, 14303],
  ['hilbertMiB', 'number', 0, 14304], ['ioMode', 'select', ['auto', 'broker', 'direct']],
]);
export function validateFomkyrOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid Fomkyr options.');
  for (const key of Object.keys(options)) if (!Object.hasOwn(FOMKYR_DEFAULTS, key)) throw new Error('Unknown Fomkyr option: ' + key);
  const values = {...FOMKYR_DEFAULTS, ...options};
  for (const [key, type, min, max] of FOMKYR_FIELDS) {
    const value = values[key];
    const valid = type === 'select' ? min.includes(value)
      : type === 'checkbox' ? (key === 'resume' ? value === 'auto' || value === false : typeof value === 'boolean')
      : value === null && FOMKYR_DEFAULTS[key] === null || (key === 'progressIntervalSeconds' ? Number.isFinite(value) : Number.isInteger(value)) && value >= min && value <= max;
    if (!valid) throw new Error('Invalid Fomkyr option: ' + key);
    if (key === 'wordCacheEntries' && (value & (value - 1)) !== 0) throw new Error('Fomkyr word cache entries must be a power of two.');
  }
  return values;
}
export function fomkyrEngineOptions(form) {
  const options = validateFomkyrOptions(form.fomkyrOptions);
  const {scratchMiB, hilbertMiB, matcherMiB, rewriteMiB, sharedCacheMiB, progressIntervalSeconds, ...engine} = options;
  if (engine.batchPairs === null) delete engine.batchPairs;
  if (scratchMiB !== null) {
    const lanes = engine.execution === 'single' ? 1 : Number(form.nativeWorkers) || automaticWorkers();
    if (scratchMiB >= Number(form.memoryMiB ?? 512) || scratchMiB < lanes) throw new Error('Fomkyr scratch space must fit the memory budget and provide at least 1 MiB per worker.');
    engine.scratchBytes = scratchMiB * 1048576;
  }
  engine.hilbertBudgetBytes = hilbertMiB * 1048576;
  if (matcherMiB !== null) {
    if (matcherMiB >= Number(form.memoryMiB ?? 512)) throw new Error('Fomkyr matcher space must fit the memory budget.');
    engine.matcherBudgetBytes = matcherMiB * 1048576;
  }
  for (const [key, value] of [['rewriteBudgetBytes', rewriteMiB], ['sharedReducerCacheBytes', sharedCacheMiB]]) {
    if (value !== null) {
      if (value >= Number(form.memoryMiB ?? 512)) throw new Error('Fomkyr cache space must fit the memory budget.');
      engine[key] = value * 1048576;
    }
  }
  engine.progressIntervalMs = progressIntervalSeconds * 1000;
  engine.workers = Number(form.nativeWorkers) || undefined;
  engine.monomialPruning = form.monomialPruning ?? true;
  if (String(form.maxserdeg ?? '').trim() !== '') engine.hilbertDegree = Number(form.maxserdeg);
  return engine;
}
export function readFomkyrOptions(root = document) {
  return Object.fromEntries(FOMKYR_FIELDS.map(([key, type]) => {
    const input = root.getElementById('fomkyr-' + key);
    const value = type === 'checkbox' ? (key === 'resume' ? input.checked ? 'auto' : false : input.checked)
      : type === 'number' ? input.value === '' ? null : Number(input.value) : input.value;
    return [key, value];
  }));
}
export function writeFomkyrOptions(options = {}, root = document, {strict = true} = {}) {
  // Local drafts can contain unfinished numeric edits; keep them editable.
  // Shared/imported settings are validated before being written to the form.
  const values = strict ? validateFomkyrOptions(options) : {...FOMKYR_DEFAULTS, ...options};
  for (const [key, type] of FOMKYR_FIELDS) {
    const input = root.getElementById('fomkyr-' + key);
    if (type === 'checkbox') input.checked = !!values[key];
    else input.value = values[key] ?? '';
  }
}
export function installFomkyrControls(root, t) {
  for (const [key, type, min, max] of FOMKYR_FIELDS) {
    const container = root.getElementById(key === 'hilbert' ? 'fomkyrMathOptions' : 'fomkyrOptions');
    const label = root.createElement('label');
    const title = root.createElement('span'); title.className = 'label-row';
    const text = root.createElement('span'); text.dataset.i18n = 'fomkyr.' + key; text.textContent = t(text.dataset.i18n);
    const help = root.createElement('span'); help.className = 'help';
    const button = root.createElement('button'); button.type = 'button'; button.className = 'help-btn';
    button.textContent = '?'; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'fomkyr-' + key + '-hint');
    button.dataset.i18nAttr = 'aria-label:help'; button.setAttribute('aria-label', t('help'));
    const hint = root.createElement('span'); hint.className = 'help-pop'; hint.id = 'fomkyr-' + key + '-hint';
    hint.dataset.i18n = 'fomkyr.' + key + 'Hint'; hint.textContent = t(hint.dataset.i18n);
    help.append(button, hint); title.append(text, help);
    const input = root.createElement(type === 'select' ? 'select' : 'input'); input.id = 'fomkyr-' + key;
    input.setAttribute('aria-describedby', hint.id);
    if (type === 'select') for (const value of min) {
      const option = root.createElement('option'); option.value = value;
      option.dataset.i18n = 'fomkyr.choice.' + value; option.textContent = t(option.dataset.i18n); input.append(option);
    }
    else {input.type = type; if (type === 'number') {input.min = min; input.max = max; input.step = key === 'progressIntervalSeconds' ? 0.25 : 1;}}
    if (type === 'checkbox') {label.className = 'check'; label.append(input, title);}
    else label.append(title, input);
    container.append(label);
  }
  writeFomkyrOptions({}, root);
}
