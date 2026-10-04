// Public, persisted options for Fomkyr.
import {automaticWorkers} from '../engine/fomkyr/worker-count.js';
import {defaultMemoryMiB} from './backends.js';
import {planMemory} from '../engine/fomkyr/memory-policy.js';
import {formatMemorySize} from './memory-monitor.js';
export const FOMKYR_DEFAULTS = Object.freeze({
  hilbertGate: false, hilbertSectors: true, gateMiB: 128,
  scheduler: 'cooperative', quantumMs: 250, lookahead: 128, maxLookahead: 512, elasticWindow: true, sectorPriority: true, radixMaxCache: true, helperRows: true, largeRowWorkspaces: 0,
  execution: 'auto', bits: 'auto', memoryPolicy: 'auto', autoWorkerMiB: 0, spill: true, resume: 'auto', hilbert: false,
  heapReduction: true, cachePercent: 12, heapThreshold: 16, batchPairs: 128,
  hashBits: 18, scratchMiB: null, hilbertMiB: 256, ioMode: 'auto',
  wordMatcher: true, chainCriterion: true, eagerPruning: true,
  quadraticRewrite: true, costScheduling: true, wordCacheEntries: 256,
  matcherMiB: null, progress: true, progressIntervalSeconds: 1,
  rationalHeap: true, rationalRewrites: true, compiledRewrites: true, rewriteDegree: 4, rewriteSupport: 8,
  bigRationalHeap: true, bigRowMaxTerms: 0, fastBigDivision: true, growingRationalHeap: true,
  radixHeap: true, reserveInPlace: true, rowReserveMiB: null,
  rewriteMiB: null, sharedCacheMiB: null,
});
export const FOMKYR_FIELDS = Object.freeze([
  ['hilbertGate', 'checkbox'], ['hilbertSectors', 'checkbox'], ['gateMiB', 'number', 0, 14304],
  ['scheduler', 'select', ['cooperative', 'barrier']],
  ['quantumMs', 'number', 1, 10000], ['lookahead', 'number', 1, 512], ['radixMaxCache', 'checkbox'],
  ['helperRows', 'checkbox'], ['largeRowWorkspaces', 'number', 0, 33],
  ['maxLookahead', 'number', 1, 512], ['elasticWindow', 'checkbox'], ['sectorPriority', 'checkbox'],
  ['execution', 'select', ['auto', 'single', 'multicore']],
  ['bits', 'select', ['auto', '32', '64']],
  ['memoryPolicy', 'select', ['auto', 'manual']],
  ['autoWorkerMiB', 'number', 0, 14304],
  ['spill', 'checkbox'], ['resume', 'checkbox'], ['hilbert', 'checkbox'],
  ['heapReduction', 'checkbox'], ['cachePercent', 'number', 0, 40],
  ['rationalHeap', 'checkbox'], ['rationalRewrites', 'checkbox'], ['compiledRewrites', 'checkbox'],
  ['bigRationalHeap', 'checkbox'], ['bigRowMaxTerms', 'number', 0, 1073741824], ['fastBigDivision', 'checkbox'], ['growingRationalHeap', 'checkbox'],
  ['radixHeap', 'checkbox'], ['reserveInPlace', 'checkbox'], ['rowReserveMiB', 'number', 0, 14304],
  ['rewriteDegree', 'number', 2, 4], ['rewriteSupport', 'number', 1, 64],
  ['rewriteMiB', 'number', 0, 256], ['sharedCacheMiB', 'number', 0, 14304],
  ['wordMatcher', 'checkbox'], ['chainCriterion', 'checkbox'], ['eagerPruning', 'checkbox'],
  ['quadraticRewrite', 'checkbox'], ['costScheduling', 'checkbox'],
  ['wordCacheEntries', 'number', 256, 1048576], ['matcherMiB', 'number', 0, 14304],
  ['progress', 'checkbox'], ['progressIntervalSeconds', 'number', 0.25, 60],
  ['heapThreshold', 'number', 1, 1048576], ['batchPairs', 'number', 0, 512],
  ['hashBits', 'number', 8, 26], ['scratchMiB', 'number', 1, 14303],
  ['hilbertMiB', 'number', 0, 14304], ['ioMode', 'select', ['auto', 'broker', 'direct']],
]);
export const FOMKYR_GROUPS=Object.freeze({
  execution:['execution','bits','memoryPolicy'],
  scheduling:['scheduler','quantumMs','lookahead','maxLookahead','elasticWindow','sectorPriority','helperRows','batchPairs','costScheduling','autoWorkerMiB'],
  memory:['largeRowWorkspaces','scratchMiB','rowReserveMiB','reserveInPlace','bigRowMaxTerms','cachePercent','sharedCacheMiB','hashBits'],
  reduction:['heapReduction','heapThreshold','rationalHeap','bigRationalHeap','growingRationalHeap','fastBigDivision','radixHeap','radixMaxCache','eagerPruning','quadraticRewrite'],
  caches:['wordMatcher','chainCriterion','wordCacheEntries','matcherMiB','compiledRewrites','rationalRewrites','rewriteDegree','rewriteSupport','rewriteMiB'],
  storage:['spill','resume','ioMode','progress','progressIntervalSeconds'],
  mathematics:['hilbert','hilbertGate','hilbertSectors','gateMiB','hilbertMiB'],
});
export function validateFomkyrOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid Fomkyr options.');
  for (const key of Object.keys(options)) if (!Object.hasOwn(FOMKYR_DEFAULTS, key)) throw new Error('Unknown Fomkyr option: ' + key);
  const values = {...FOMKYR_DEFAULTS, ...options};
  for (const [key, type, min, max] of FOMKYR_FIELDS) {
    const value = values[key];
    const valid = type === 'select' ? min.includes(value)
      : type === 'checkbox' ? (key === 'resume' ? value === 'auto' || value === false : typeof value === 'boolean')
      : value === null && (FOMKYR_DEFAULTS[key] === null || key === 'batchPairs') || (key === 'progressIntervalSeconds' ? Number.isFinite(value) : Number.isInteger(value)) && value >= min && value <= max;
    if (!valid) throw new Error('Invalid Fomkyr option: ' + key);
    if (key === 'bigRowMaxTerms' && value && (value < 128 || (value & (value - 1)) !== 0)) throw new Error('Fomkyr big-row ceiling must be 0 or a power of two from 128 to 1073741824.');
    if (key === 'wordCacheEntries' && (value & (value - 1)) !== 0) throw new Error('Fomkyr word cache entries must be a power of two.');
  }
  if(values.elasticWindow&&values.maxLookahead<values.lookahead)throw new Error('Fomkyr expanded window ceiling must be at least the initial window.');
  return values;
}
// Keep saved choices intact while showing which settings the kernel uses.
// The matcher is shared by divisor lookup and the chain criterion. The exact
// integer divider is also used by the general reducer, outside heap reduction.
export function fomkyrControlAvailability(form) {
  const o = {...FOMKYR_DEFAULTS, ...form.fomkyrOptions};
  const enabled = form.backend === 'fomkyr';
  const rational = (form.field ?? '0') === '0';
  const heap = o.heapReduction;
  const rewrites = heap && o.compiledRewrites && o.rewriteMiB !== 0;
  const reserve = rational && heap && (o.rationalHeap || o.bigRationalHeap);
  return Object.fromEntries(FOMKYR_FIELDS.map(([key]) => [key, enabled && ({
    hilbertGate: rational, hilbertSectors: rational && o.hilbertGate, gateMiB: rational && o.hilbertGate,
    quantumMs: o.scheduler === 'cooperative' && o.batchPairs !== 0,
    lookahead: o.scheduler === 'cooperative' && o.batchPairs !== 0,
    elasticWindow: o.scheduler === 'cooperative' && o.batchPairs !== 0,
    maxLookahead: o.scheduler === 'cooperative' && o.batchPairs !== 0 && o.elasticWindow,
    sectorPriority: o.scheduler === 'cooperative' && o.batchPairs !== 0 && o.costScheduling && o.execution !== 'single' && Number(form.nativeWorkers) !== 1 && rational && o.hilbertGate && o.hilbertSectors,
    helperRows: o.scheduler === 'cooperative' && o.batchPairs !== 0 && o.execution !== 'single' && Number(form.nativeWorkers) !== 1,
    largeRowWorkspaces: reserve && (o.memoryPolicy === 'auto' || o.rowReserveMiB !== 0),
    radixMaxCache: heap && o.radixHeap,
    resume: o.spill, ioMode: o.spill && o.execution !== 'single' && Number(form.nativeWorkers) !== 1,
    sharedCacheMiB: o.spill, progressIntervalSeconds: o.progress,
    autoWorkerMiB: o.execution !== 'single' && !Number(form.nativeWorkers) && o.memoryPolicy === 'auto',
    hilbertMiB: o.hilbert, heapThreshold: heap, radixHeap: heap,
    rationalHeap: rational && heap, bigRationalHeap: rational && heap,
    bigRowMaxTerms: rational && heap && o.bigRationalHeap,
    fastBigDivision: rational, growingRationalHeap: rational && heap && o.rationalHeap,
    rationalRewrites: rational && rewrites && (o.rationalHeap || o.bigRationalHeap),
    compiledRewrites: heap,
    rewriteDegree: rewrites, rewriteSupport: rewrites,
    rewriteMiB: heap && o.compiledRewrites,
    scratchMiB: o.memoryPolicy === 'manual',
    rowReserveMiB: reserve && o.memoryPolicy === 'manual',
    reserveInPlace: reserve && (o.memoryPolicy === 'auto' || o.rowReserveMiB !== 0),
    matcherMiB: o.wordMatcher || o.chainCriterion,
    eagerPruning: heap && form.monomialPruning !== false,
    quadraticRewrite: heap,
    costScheduling: o.batchPairs !== 0 && o.execution !== 'single' && Number(form.nativeWorkers) !== 1,
  }[key] ?? true)]));
}
export function updateFomkyrControlAvailability(form, root = document, translate) {
  const availability = fomkyrControlAvailability(form);
  availability.nativeWorkers = form.backend === 'fomkyr' && (form.fomkyrOptions?.execution ?? FOMKYR_DEFAULTS.execution) !== 'single';
  for (const [key, enabled] of Object.entries(availability)) {
    const input = root.getElementById(key === 'nativeWorkers' ? key : 'fomkyr-' + key);
    input.disabled = !enabled;
    input.closest('label')?.classList.toggle('backend-disabled', !enabled);
  }
  const summary = root.getElementById('fomkyr-autoMemorySummary');
  if (summary && translate) {
    summary.hidden = form.backend !== 'fomkyr' || (form.fomkyrOptions?.memoryPolicy ?? 'auto') !== 'auto';
    if (!summary.hidden) {
      const options = {...FOMKYR_DEFAULTS, ...form.fomkyrOptions};
      const budget = Math.min(Number(form.memoryMiB ?? defaultMemoryMiB('fomkyr')), options.bits === '32' ? 4095 : 14304) * 1048576;
      try {
        const plan = planMemory(budget, 1, {memoryPolicy:'auto'});
        const label = value => {
          const size = formatMemorySize(value, root.documentElement?.lang ?? 'en');
          return `${size.amount} ${translate(size.unit === 'GiB' ? 'memory.gib' : 'memory.mib')}`;
        };
        summary.textContent = translate('fomkyr.autoMemorySummary', {
          scratch:label(plan.ordinaryScratchBytes),reserve:label((form.field ?? '0') === '0' ? plan.rowReserveBytes : 0),
        });
      } catch {summary.textContent = '';}
    }
  }
}
export function fomkyrEngineOptions(form) {
  const options = validateFomkyrOptions(form.fomkyrOptions);
  const {gateMiB, scratchMiB, hilbertMiB, matcherMiB, rewriteMiB, sharedCacheMiB, rowReserveMiB, progressIntervalSeconds, ...engine} = options;
  const memoryMiB=Number(form.memoryMiB??defaultMemoryMiB('fomkyr'));
  const availability = fomkyrControlAvailability({...form, backend: 'fomkyr', fomkyrOptions: options});
  engine.arithmeticMode='exact';
  if (engine.batchPairs === null) engine.batchPairs=FOMKYR_DEFAULTS.batchPairs;
  if (options.memoryPolicy === 'manual' && scratchMiB !== null) {
    const lanes = engine.execution === 'single' ? 1 : Number(form.nativeWorkers) || automaticWorkers();
    if (scratchMiB >= memoryMiB || scratchMiB < lanes) throw new Error('Fomkyr scratch space must fit the memory budget and provide at least 1 MiB per worker.');
    engine.scratchBytes = scratchMiB * 1048576;
  } else if (options.memoryPolicy === 'manual') {
    // At 3.5 GiB and above, use 2 GiB. Smaller allowances retain bounded
    // workspace and room for hash tables, reducer caches and the reserve.
    engine.scratchBytes=Math.floor(Math.min(2048,Math.max(memoryMiB/3,memoryMiB-1536)))*1048576;
  }
  engine.gateBudgetBytes = gateMiB * 1048576;
  engine.hilbertBudgetBytes = hilbertMiB * 1048576;
  if (matcherMiB !== null) {
    if (availability.matcherMiB && matcherMiB >= memoryMiB) throw new Error('Fomkyr matcher space must fit the memory budget.');
    engine.matcherBudgetBytes = matcherMiB * 1048576;
  }
  for (const [key, value, control] of [['rewriteBudgetBytes', rewriteMiB, 'rewriteMiB'], ['sharedReducerCacheBytes', sharedCacheMiB, 'sharedCacheMiB'], ['rowReserveBytes', rowReserveMiB, 'rowReserveMiB']]) {
    if (control === 'rowReserveMiB' && options.memoryPolicy === 'auto') continue;
    if (value !== null) {
      if (availability[control] && value >= memoryMiB) throw new Error('Fomkyr cache space must fit the memory budget.');
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
  const groups={};
  for(const [group] of Object.entries(FOMKYR_GROUPS)){
    const parent=root.getElementById(group==='mathematics'?'fomkyrMathOptions':'fomkyrOptions');
    const body=root.createElement('div');body.className='fomkyr-control-grid';
    if(group==='execution'||group==='mathematics')parent.append(body);
    else {
      const details=root.createElement('details');details.className='fomkyr-submenu';details.id='fomkyr-group-'+group;
      const summary=root.createElement('summary');summary.dataset.i18n='fomkyr.group.'+group;summary.textContent=t(summary.dataset.i18n);
      details.append(summary,body);parent.append(details);
    }
    groups[group]=body;
  }
  for (const [key, type, min, max] of FOMKYR_FIELDS) {
    const group=Object.keys(FOMKYR_GROUPS).find(name=>FOMKYR_GROUPS[name].includes(key));
    const container=groups[group];
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
    if (key === 'memoryPolicy') {
      const summary = root.createElement('p'); summary.className = 'hint';
      summary.id = 'fomkyr-autoMemorySummary'; summary.hidden = true;
      container.append(summary);
    }
  }
  writeFomkyrOptions({}, root);
}
