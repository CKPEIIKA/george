import { EXAMPLES } from './examples.js';
import {
  esc, parseVars, splitRelations, parseRelation, isHomogeneous, toBergman, typeset, typesetTerms,
  parseBasis, parseAnick, typesetTensor, typesetWord, readInputFile, buildJob, validateSettings, monomialPruningAvailable, exampleForm, ORDERS, TASKS, TASK_BY_ID, FAMILIES,
  varHTML, positiveLeading, variableOrder, jobFacts,
} from './bergman-syntax.js';
import {runOutcome} from './completeness.js';
import { EclEngine } from './engine.js';
import { t, tn, setLanguage, getLanguage, applyTranslations, translateMessage } from './i18n.js';
import { readPreferences, savePreferences, applyTheme } from './preferences.js';
import { TUTORIALS, tutorialForm } from './tutorials.js';
import { guideHTML } from './guide.js';
import { renderMath } from './math.js';
import { structuralResolutionDisplay } from './resolution-data.js';
import { initConsole } from './console.js';
import { createShareLink, readShareLink, SHARE_PREFIX } from './share.js';
import { BACKENDS, DEFAULT_BACKEND, validMemoryMiB, memory64Supported, defaultMemoryMiB, preferredBackend } from './backends.js';
import { applyBackendCapabilities, backendCapabilities, backendAllows } from './backend-capabilities.js';
import { timeoutMilliseconds } from './time-limit.js';
import { formatMemorySize } from './memory-monitor.js';
import { attachFomkyrResultLinks, renderFomkyrSeries } from '../engine/fomkyr/result-links.js';
import {installFomkyrControls, readFomkyrOptions, writeFomkyrOptions, updateFomkyrControlAvailability} from './fomkyr-options.js';
import {degreeProgress,degreeLabel} from './degree-progress.js';
import {groupRelations, polynomialTermCount} from './relation-preview.js';
import {copyMathSelection} from './math-copy.js';
import {basisSummary} from './basis-summary.js';
import {elapsedSeconds} from './elapsed-time.js';
import {nextBasisPreview} from './basis-preview.js';
import {downloadZip} from './zip-download.js';
import {scriptSettings} from './normal-basis.js';
import {FomkyrDashboard} from './fomkyr-dashboard.js';
import {verificationAvailable,verificationEntries} from '../engine/fomkyr/verification-bundle.js';
import {parseNativeJob} from '../engine/fomkyr/job-adapter.js';
import {acquireRunLock} from '../engine/fomkyr/storage.js';

const $ = (id) => document.getElementById(id);
installFomkyrControls(document, t);
const engine = new EclEngine({getBackend: () => $('backend').value,
  getTimeoutMs: () => timeoutMilliseconds($('timeoutMinutes').value), onMemory: updateMemoryUsage, onReady: info => {
  engineInfo = info;
  engineError = null;
  updateEngineNote();
  $('engineNote').classList.add('live');
}});
const EX_BY_ID = new Map(EXAMPLES.map((e) => [e.id, e]));
const STORE_KEY = 'george.form.v1';
let storage;
try { storage = window.localStorage; } catch { /* storage unavailable */ }
const preferences = readPreferences(storage, navigator.language);
setLanguage(preferences.language);
document.documentElement.lang = getLanguage();
applyTheme(preferences.theme);
let engineInfo = null;
let engineError = null;
let lastRendered = null;
let lastOutcome = null;
let zipSource = null;
let zipBusy = false;
let statusState = { key: 'status.idle', params: {}, busy: false };
let guideGeneration = 0;
let shareGeneration = 0;
let allocatedMemoryBytes;
let runMemoryPlan;
let runStartedAt = null;
let runTimer;
let runDegree = null;
let runDegreeBound = null;
let fomkyrPruningChoice;

const els = {
  form: $('presentation'), preset: $('preset'), presetN: $('presetN'), presetNField: $('presetNField'),
  vars: $('vars'), varsErr: $('varsErr'), rels: $('rels'), relPreview: $('relPreview'),
  modulus: $('modulus'), pField: $('pField'), pErr: $('pErr'),
  order: $('order'), reverseVars: $('reverseVars'), matrix: $('matrix'), matrixField: $('matrixField'),
  maxdeg: $('maxdeg'), weights: $('weights'), homogWarn: $('homogWarn'),
  memoryMiB: $('memoryMiB'), backend: $('backend'), timeoutMinutes: $('timeoutMinutes'),
  monomialPruning: $('monomialPruning'),
  nonhomog: $('nonhomog'), strategy: $('strategy'), rabbit: $('rabbit'), rabbitField: $('rabbitField'),
  augmentation: $('augmentation'),
  lowterms: $('lowterms'), outmode: $('outmode'), legacy: $('legacy'), maxserdeg: $('maxserdeg'), maxserdegField: $('maxserdegField'),
  moduleFields: $('moduleFields'), nmodgen: $('nmodgen'), nmodgenField: $('nmodgenField'),
  twoModFields: $('twoModFields'), nlmodgen: $('nlmodgen'), nrmodgen: $('nrmodgen'),
  taskList: $('taskList'), go: $('go'), stop: $('stop'), runStatus: $('runStatus'), memoryUsage: $('memoryUsage'),
  runMetrics: $('runMetrics'), memoryMetric: $('memoryMetric'), memoryValue: $('memoryValue'),
  degreeMetric: $('degreeMetric'), degreeValue: $('degreeValue'), degreeUsageHint: $('degreeUsageHint'),
  timeMetric: $('timeMetric'), timeValue: $('timeValue'),
  share: $('share'), sharePanel: $('sharePanel'), shareLink: $('shareLink'), shareStatus: $('shareStatus'),
  tabs: $('tabs'), view: $('view-compute'), resultsDot: $('resultsDot'),
  resultsZip: $('downloadResultsZip'), resultsZipStatus: $('resultsZipStatus'),
};

let loadedExample = null; // { id, snapshot } while the form still equals a bundled example
let running = false;
let runGeneration = 0;

// ------------------------------------------------------------ form state

const radio = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const setRadio = (name, value) => {
  const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (r) r.checked = true;
};

function readForm() {
  return {
    ring: radio('ring'),
    vars: parseVars(els.vars.value).names,
    relsText: els.rels.value,
    rels: splitRelations(els.rels.value),
    field: radio('field'),
    modulus: els.modulus.value,
    order: els.order.value,
    reverseVars: els.reverseVars.checked,
    matrix: els.matrix.value,
    maxdeg: els.maxdeg.value,
    memoryMiB: Number(els.memoryMiB.value),
    backend: els.backend.value,
    timeoutMinutes: Number(els.timeoutMinutes.value),
    nativeWorkers: Number($('nativeWorkers').value),
    fomkyrOptions: readFomkyrOptions(document),
    monomialPruning: els.backend.value === 'fomkyr' ? fomkyrPruningChoice ?? true : els.monomialPruning.checked,
    weights: els.weights.value,
    nonhomog: els.nonhomog.value,
    augmentation: els.augmentation.value,
    strategy: els.strategy.value,
    rabbit: els.rabbit.value,
    lowterms: els.lowterms.value,
    outmode: els.outmode.value,
    legacy: els.legacy.checked,
    maxserdeg: els.maxserdeg.value,
    nmodgen: els.nmodgen.value,
    nlmodgen: els.nlmodgen.value,
    nrmodgen: els.nrmodgen.value,
    task: (document.querySelector('input[name="task"]:checked') || {}).value || 'gb',
  };
}

function writeForm(s, {restoreDraft = false} = {}) {
  if (s.backend === 'native') s = {...s, backend: 'fomkyr'};
  writeFomkyrOptions(s.fomkyrOptions || {}, document, {strict: !restoreDraft && (s.backend ?? els.backend.value) === 'fomkyr'});
  setRadio('ring', s.ring || 'noncomm');
  fillOrders();
  els.vars.value = s.varsText ?? (s.vars || []).join(', ');
  els.rels.value = s.relsText ?? (s.rels || []).join(',\n');
  setRadio('field', s.field || '0');
  els.modulus.value = s.modulus ?? 5;
  if (s.order) els.order.value = s.order;
  if (!els.order.value) els.order.selectedIndex = 0;
  els.reverseVars.checked = !!s.reverseVars;
  if (s.matrix !== undefined) els.matrix.value = s.matrix;
  els.maxdeg.value = s.maxdeg || '';
  els.timeoutMinutes.value = String(s.timeoutMinutes ?? els.timeoutMinutes.value ?? 0);
  const nativeWorkers = Number(s.nativeWorkers ?? $('nativeWorkers').value ?? 0);
  $('nativeWorkers').value = nativeWorkers ? String(nativeWorkers) : '';
  const formBackend = s.backend ?? els.backend.value;
  if (s.monomialPruning !== undefined) {
    els.monomialPruning.checked = s.monomialPruning;
    if (formBackend === 'fomkyr') fomkyrPruningChoice = s.monomialPruning;
  } else if (formBackend === 'fomkyr') els.monomialPruning.checked = fomkyrPruningChoice ?? true;
  if (s.backend !== undefined) els.backend.value = Object.hasOwn(BACKENDS, s.backend) ? s.backend : DEFAULT_BACKEND;
  const memoryMiB = Number(s.memoryMiB ?? (els.memoryMiB.value || defaultMemoryMiB(els.backend.value)));
  if (validMemoryMiB(memoryMiB, els.backend.value) && ![...els.memoryMiB.options].some(o => Number(o.value) === memoryMiB)) {
    els.memoryMiB.add(new Option(`${memoryMiB} MiB`, String(memoryMiB)));
  }
  els.memoryMiB.value = String(memoryMiB);
  els.weights.value = s.weights || '';
  els.nonhomog.value = s.nonhomog || 'auto';
  els.augmentation.value = s.augmentation || 'graded';
  els.strategy.value = s.strategy || 'default';
  if (s.rabbit !== undefined) els.rabbit.value = s.rabbit;
  els.lowterms.value = s.lowterms || 'quick';
  els.outmode.value = s.outmode || 'ALG';
  els.legacy.checked = !!s.legacy;
  if (s.maxserdeg !== undefined) els.maxserdeg.value = s.maxserdeg;
  els.nmodgen.value = s.nmodgen ?? 1;
  els.nlmodgen.value = s.nlmodgen ?? 1;
  els.nrmodgen.value = s.nrmodgen ?? 1;
  const t = document.querySelector(`input[name="task"][value="${s.task || 'gb'}"]`);
  if (t) t.checked = true;
}

const snapshot = () => JSON.stringify({ ...readForm(), rels: undefined });

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ form: readForm(), preset: els.preset.value, n: els.presetN.value })); } catch { /* storage unavailable */ }
}

// ------------------------------------------------------------ setup of controls

function fillPresets() {
  const selected = els.preset.value;
  let html = `<option value="">${t('start.blank')}</option><optgroup label="${t('start.tutorials')}">`;
  for (const item of TUTORIALS) html += `<option value="tutorial:${item.id}">${esc(item.title[getLanguage()])}</option>`;
  html += `</optgroup><optgroup label="${t('start.families')}">`;
  for (const id of Object.keys(FAMILIES)) html += `<option value="family:${id}">${esc(t('fam.' + id))}</option>`;
  html += `</optgroup><optgroup label="${t('start.examples')}">`;
  for (const e of EXAMPLES) html += `<option value="example:${e.id}">${esc(t('ex.' + e.id))}</option>`;
  html += '</optgroup>';
  els.preset.innerHTML = html;
  els.preset.value = selected;
}

function fillOrders() {
  const ring = radio('ring');
  const cur = els.order.value;
  els.order.innerHTML = ORDERS[ring].map((o) => `<option value="${o.id}">${esc(t('order.' + o.id))}</option>`).join('');
  if (ORDERS[ring].some((o) => o.id === cur)) els.order.value = cur;
}

function fillTasks() {
  const selected = document.querySelector('input[name="task"]:checked')?.value || 'gb';
  const groups = new Map();
  for (const t of TASKS) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push(t);
  }
  let html = '';
  for (const [g, ts] of groups) {
    const group = t(g === 'Resolutions' ? 'group.res' : 'group.bases');
    html += `<div class="task-group" role="radiogroup" aria-label="${esc(group)}"><h3>${esc(group)}</h3>`;
    for (const t of ts) {
      html += `<label class="task" data-task="${t.id}"><input type="radio" name="task" value="${t.id}"${t.id === selected ? ' checked' : ''}>` +
        `<span class="t-label" data-i18n="task.${t.id}"></span><span class="t-desc" data-i18n="task.${t.id}.d"></span><span class="t-note" hidden></span></label>`;
    }
    html += '</div>';
  }
  els.taskList.innerHTML = html;
  applyTranslations(els.taskList);
  $('taskSelect').innerHTML = [...groups].map(([g, ts]) => `<optgroup label="${esc(t(g === 'Resolutions' ? 'group.res' : 'group.bases'))}">` +
    ts.map(task => `<option value="${task.id}">${esc(t('task.' + task.id))}</option>`).join('') + '</optgroup>').join('');
}

// The compact select mirrors the radio group, including unavailable choices.
function syncTaskSelect() {
  const select = $('taskSelect');
  for (const option of select.options) {
    const label = els.taskList.querySelector(`[data-task="${option.value}"]`);
    const disabled = label.querySelector('input').disabled, ringOnly = TASK_BY_ID.get(option.value).ring;
    option.hidden = label.classList.contains('backend-hidden');
    option.disabled = disabled;
    option.textContent = t('task.' + option.value) + (disabled && !option.hidden && ringOnly ? ` (${t(ringOnly === 'comm' ? 'task.commOnlyShort' : 'task.noncommOnlyShort')})` : '');
  }
  for (const group of select.querySelectorAll('optgroup')) group.hidden = [...group.children].every(option => option.hidden);
  const checked = document.querySelector('input[name="task"]:checked')?.value || 'gb';
  select.value = checked;
  $('taskDescription').textContent = t('task.' + checked + '.d');
}

// ------------------------------------------------------------ presets

function applyPreset() {
  const v = els.preset.value;
  els.presetNField.hidden = !v.startsWith('family:');
  if (!v) { loadedExample = null; refresh(); return; }
  if (v.startsWith('tutorial:')) {
    writeForm(tutorialForm(v.slice(9)));
    loadedExample = null;
  } else if (v.startsWith('family:')) {
    const fam = FAMILIES[v.slice(7)];
    const n = Math.max(2, Math.min(7, Number(els.presetN.value) || 3));
    const { vars, rels } = fam.build(n);
    writeForm({ ...readForm(), ring: 'noncomm', vars, relsText: rels.join(',\n'), order: 'degleftlex', augmentation:fam.nonhomog?'monoid':'graded',
      nonhomog: fam.nonhomog ? 'itemwise' : 'auto', maxdeg: readForm().maxdeg || '6', task: readForm().task });
    loadedExample = null;
  } else {
    const ex = EX_BY_ID.get(v.slice(8));
    writeForm(exampleForm(ex));
    loadedExample = { id: ex.id, snapshot: null };
  }
  refresh();
  if (loadedExample) loadedExample.snapshot = snapshot();
}

// ------------------------------------------------------------ validation and preview

function isPrime(n) {
  if (!Number.isSafeInteger(n) || n < 2 || n > 2147483647) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function validate() {
  const f = readForm();
  const problems = [];
  const settingsErrors = validateSettings(f);
  if (f.backend === 'memory64' && !memory64Supported()) settingsErrors.push('This browser does not support the memory64 engine. Select a 32-bit engine.');
  problems.push(...settingsErrors);
  const vv = parseVars(els.vars.value);
  els.varsErr.hidden = vv.errors.length === 0 && vv.names.length > 0;
  els.varsErr.textContent = vv.names.length === 0 ? t('err.noVars') : vv.errors.map(translateMessage).join(' ');
  els.vars.setAttribute('aria-invalid', String(!els.varsErr.hidden));
  if (!els.varsErr.hidden) problems.push('generators');

  const weights = new Map();
  const wl = f.weights.trim() ? f.weights.trim().split(/[\s,]+/) : [];
  if (wl.length && wl.length !== vv.names.length) problems.push('weights');
  wl.forEach((w, i) => weights.set(vv.names[i], Number(w)));

  const previewRows = [];
  let anyNonhomog = false;
  const rels = splitRelations(f.relsText);
  for (const [index,r] of rels.entries()) {
    try {
      const terms = parseRelation(r, vv.names, f.backend === 'fomkyr' ? 0xfffffffe : 10000);
      const hom = isHomogeneous(terms, weights);
      if (!hom) anyNonhomog = true;
      previewRows.push({index,termCount:terms.length,html:`<li value="${index+1}"><span class="rel"><span class="math-expression" data-math-source="${esc(toBergman(terms))}">${typesetTerms(terms)}</span>${hom ? '' : `<span class="nh">${t('nonhomog')}</span>`}</span></li>`});
    } catch (e) {
      previewRows.push({index,html:`<li class="bad" value="${index+1}"><span class="rel"><code>${esc(r)}</code>: ${esc(translateMessage(e.message))}</span></li>`});
      problems.push('relations');
    }
  }
  if (rels.length === 0) problems.push('relations');
  els.relPreview.innerHTML = groupRelations(previewRows).map(group=>`<ol class="relation-group" data-term-count="${group.termCount}">${group.relations.map(row=>row.html).join('')}</ol>`).join('');
  $('relPreviewPanel').hidden = rels.length === 0;
  $('relPreviewCount').textContent = String(rels.length);
  els.rels.setAttribute('aria-invalid', String(problems.includes('relations') && rels.length > 0));

  els.pField.hidden = f.field !== 'p';
  const p = Number(f.modulus);
  els.pErr.hidden = f.field !== 'p' || isPrime(p);
  els.pErr.textContent = t('err.prime', { p: f.modulus });
  if (!els.pErr.hidden) problems.push('p');

  let warn = '';
  if (settingsErrors.length) warn = settingsErrors.map(translateMessage).join(' ');
  else if (wl.length && wl.length !== vv.names.length) warn = t('warn.weights', { v: vv.names.length, w: wl.length });
  else if (anyNonhomog && f.nonhomog === 'degreewise') warn = t('warn.degreewise');
  else if (anyNonhomog) warn = t('warn.nonhomog');
  els.homogWarn.hidden = !warn;
  els.homogWarn.textContent = warn;
  return { ok: problems.length === 0, anyNonhomog, form: f };
}

// Computations and settings an engine cannot use are hidden, not listed
// one by one as unavailable.
const BERGMAN_SETTINGS = ['strategy', 'lowterms', 'outmode', 'nonhomog', 'augmentation', 'legacy'];
function updateEngineControls() {
  const backend = els.backend.value;
  const {choices = {}, fixedSettings = {}} = backendCapabilities(backend);
  let blocked = 0;
  for (const label of els.taskList.querySelectorAll('[data-task]')) {
    const hide = !backendAllows(backend, 'task', label.dataset.task);
    label.classList.toggle('backend-hidden', hide);
    if (hide) blocked++;
  }
  for (const group of els.taskList.querySelectorAll('.task-group')) group.classList.toggle('backend-hidden', !group.querySelector('[data-task]:not(.backend-hidden)'));
  $('tasksUnavailable').hidden = blocked === 0;
  $('tasksUnavailableText').textContent = t('tasks.unavailable', {n: blocked});
  for (const id of BERGMAN_SETTINGS) {
    const unused = Object.hasOwn(fixedSettings, id) || (choices[id]?.length ?? 2) < 2 || (backend === 'fomkyr' && ['nonhomog', 'lowterms'].includes(id));
    ($(id).closest('.check-row') ?? $(id).closest('label')).classList.toggle('backend-hidden', unused);
  }
}

function refresh() {
  shareGeneration++;
  els.sharePanel.hidden = true;
  els.shareStatus.hidden = true;
  applyBackendCapabilities(els.form, els.backend.value, {tasks: TASKS, translate: t, onRingChange: fillOrders});
  // Engines without a Lisp console show the fomkyr dashboard in its place.
  const consoleAvailable = backendCapabilities(els.backend.value).console !== false;
  consoleView.setEnabled(consoleAvailable);
  $('lispConsole').hidden = !consoleAvailable;
  $('fomkyrDashboard').hidden = consoleAvailable;
  const addressing32 = els.backend.value === 'fomkyr' && $('fomkyr-bits').value === '32';
  const heapMaximum = addressing32 ? 4095 : BACKENDS[els.backend.value].maximumHeapMiB;
  for (const option of els.memoryMiB.options) {
    option.hidden = option.disabled = !validMemoryMiB(Number(option.value), els.backend.value)
      || addressing32 && Number(option.value) > heapMaximum;
  }
  if (!validMemoryMiB(Number(els.memoryMiB.value), els.backend.value) || addressing32 && Number(els.memoryMiB.value) > heapMaximum) els.memoryMiB.value = String(Math.min(Number(els.memoryMiB.value) || heapMaximum, heapMaximum));
  $('backendHint').textContent = t(els.backend.value === 'fomkyr' ? 'backend.nativeHint' : 'backend.hint');
  $('nativeWorkersField').hidden = els.backend.value !== 'fomkyr';
  $('fomkyrOptions').hidden = els.backend.value !== 'fomkyr';
  $('fomkyrMathOptions').hidden = els.backend.value !== 'fomkyr';
  $('memoryHint').textContent = t(els.backend.value === 'fomkyr' ? 'native.memoryHint' : 'memory.hint');
  const f = readForm();
  const task = TASK_BY_ID.get(f.task);
  els.matrixField.hidden = f.order !== 'matrix';
  els.rabbitField.hidden = f.strategy !== 'rabbit';
  const seriesEnabled = f.backend === 'fomkyr' ? f.fomkyrOptions.hilbert : f.task === 'hilbert';
  els.maxserdegField.hidden = !seriesEnabled;
  els.maxserdeg.disabled ||= !seriesEnabled;
  // These Bergman modes do not alter Fomkyr's homogeneous reduction algorithm.
  // Retain their values so older links and a later engine switch preserve them.
  if (f.backend === 'fomkyr') for (const key of ['nonhomog', 'lowterms']) {
    $(key).disabled = true;
    $(key).closest('label')?.classList.add('backend-disabled');
  }
  updateEngineControls();
  syncTaskSelect();
  const chain = variableOrder(f);
  $('varOrder').innerHTML = chain && chain.length > 1
    ? `${esc(t(f.order === 'matrix' ? 'order.chainMatrix' : 'order.chain'))}<span class="chain-vars">${chain.map(varHTML).join('<span class="gt">&nbsp;&gt; </span>')}</span>` : '';
  els.moduleFields.hidden = !task.module;
  els.nmodgenField.hidden = task.module === 'two';
  els.twoModFields.hidden = task.module !== 'two';
  els.monomialPruning.disabled ||= !monomialPruningAvailable(readForm());
  if (els.monomialPruning.disabled) els.monomialPruning.checked = false;
  else if (els.backend.value === 'fomkyr') els.monomialPruning.checked = fomkyrPruningChoice ?? true;
  updateFomkyrControlAvailability(readForm(), document, t);
  els.go.textContent = t('task.' + readForm().task + '.b');
  const tutorial = TUTORIALS.find(item => els.preset.value === 'tutorial:' + item.id);
  $('presetDescription').textContent = tutorial ? tutorial.description[getLanguage()] : t('start.hint');
  validate();
  save();
}

// ------------------------------------------------------------ running

function setStatus(key, params = {}, busy = false) {
  statusState = { key, params, busy };
  const seconds = key === 'status.done' ? elapsedSeconds(params.ms, getLanguage(), 2) : undefined;
  els.runStatus.textContent = t(key, { ...params, seconds, msg: translateMessage(params.msg || '') });
  els.runStatus.classList.toggle('busy', busy);
  els.runMetrics.hidden = !busy;
  $('results').classList.toggle('running', busy);
  const computing = document.documentElement.classList.contains('computing');
  document.documentElement.classList.toggle('computing', busy);
  if (busy && !computing) $('logo').setCurrentTime?.(0);
  renderChip();
  if (!busy) {
    clearInterval(runTimer);
    runTimer = undefined;
    for (const help of els.runMetrics.querySelectorAll('.help')) {
      help.classList.remove('open');
      help.querySelector('.help-btn').setAttribute('aria-expanded', 'false');
    }
  }
  updateMemoryUsage(allocatedMemoryBytes);
  updateDegreeUsage();
  updateElapsedTime();
}

const STOPPED = {state: 'stopped', hint: 'basis.stoppedPartial'};
function renderChip() {
  const outcome = statusState.busy ? null : statusState.key === 'status.stopped' ? {state: 'stopped', hint: 'chip.stoppedHint'} : lastOutcome;
  $('runChipWrap').hidden = !outcome;
  if (!outcome) return;
  $('runChip').dataset.state = outcome.state;
  $('runChip').textContent = t({complete: 'chip.complete', conditional: 'chip.conditional', bounded: 'chip.through', stopped: 'chip.stopped'}[outcome.state], {d: outcome.degree});
  $('runChipHint').textContent = t(outcome.hint, outcome.params);
}

function updateMemoryUsage(bytes) {
  allocatedMemoryBytes = bytes;
  const memoryLabel = value => {
    const size = formatMemorySize(value, getLanguage());
    return size ? `${size.amount} ${t(size.unit === 'GiB' ? 'memory.gib' : 'memory.mib')}` : '—';
  };
  $('memoryUsageHint').textContent = t('memory.usageHint') + (runMemoryPlan ? ' ' + t('memory.planHint', {
    budget: memoryLabel(runMemoryPlan.budgetBytes),
    scratch: memoryLabel(runMemoryPlan.ordinaryScratchBytes),
    reserve: memoryLabel(runMemoryPlan.rowReserveBytes),
  }) : '');
  const size = formatMemorySize(bytes, getLanguage());
  els.memoryUsage.hidden = !statusState.busy || !size;
  if (size) {
    const unit = t(size.unit === 'GiB' ? 'memory.gib' : 'memory.mib');
    els.memoryValue.textContent = `${size.amount} ${unit}`;
    els.memoryMetric.setAttribute('aria-label', t('memory.usage', { ...size, unit }));
  }
}

function updateElapsedTime() {
  if (!statusState.busy || runStartedAt === null) return;
  const seconds = elapsedSeconds(performance.now() - runStartedAt, getLanguage());
  const value = t('monitor.seconds', { seconds });
  els.timeValue.textContent = value;
  els.timeMetric.setAttribute('aria-label', `${t('monitor.time')}: ${value}`);
}

function updateDegreeUsage() {
  const degree = runDegree?.degree ?? '—';
  const limit = runDegreeBound ? t('monitor.degreeLimit', { bound: runDegreeBound }) : '';
  const phaseKey = {input:'monitor.phaseInput',indexing:'monitor.phaseIndexing',committing:'monitor.phaseCommitting',checkpoint:'monitor.phaseCheckpoint',hilbert:'monitor.phaseHilbert',export:'monitor.phaseExport',done:'monitor.phaseDone'}[runDegree?.phase];
  let progress = t(phaseKey ?? (runDegree ? (runDegree.completed ? 'monitor.degreeCompleted' : 'monitor.degreeCurrent')
    : (lastJob?.backend === 'fomkyr' ? 'monitor.degreeWaiting' : 'monitor.degreeUnavailable')), { degree, limit, through:runDegree?.completedThroughDegree ?? 0 });
  if (runDegree?.phase === 'anick') progress = t('monitor.degreeAnick', { progress });
  if (runDegree?.pairs !== undefined) {
    const format = value => new Intl.NumberFormat(getLanguage()).format(value);
    progress += ' ' + t('monitor.degreeCounters', {pairs:format(runDegree.pairs),reductions:format(runDegree.reductions ?? 0),rules:format(runDegree.basisSize ?? 0)});
  }
  const exact = value => new Intl.NumberFormat(getLanguage()).format(BigInt(value));
  if (runDegree?.overlaps) {
    const {resolved,total} = runDegree.overlaps;
    progress += ' ' + t(total === null ? 'monitor.overlapsUnknown' : 'monitor.overlaps', {resolved:exact(resolved),total:total === null ? '' : exact(total)});
  }
  if (runDegree?.activity) {
    const {activeLanes,sampledReductions,maxActiveRowTerms} = runDegree.activity;
    progress += ' ' + t('monitor.activity',{workers:activeLanes,reductions:exact(sampledReductions),terms:exact(maxActiveRowTerms)});
  }
  els.degreeValue.textContent = degreeLabel(runDegree,runDegreeBound);
  els.degreeUsageHint.textContent = progress;
  els.degreeMetric.setAttribute('aria-label', progress);
}

function updateDegreeProgress(event) {
  const next = degreeProgress(event,runDegree);
  if (!next) return;
  runDegree = next;
  updateDegreeUsage();
}

function showPane(which) {
  els.view.dataset.pane = which;
  $('switchInput').setAttribute('aria-selected', String(which === 'input'));
  $('switchOutput').setAttribute('aria-selected', String(which === 'output'));
  if (which === 'output') els.resultsDot.hidden = true;
}

function selectTab(name) {
  for (const b of els.tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('.tabpanel')) p.hidden = p.dataset.panel !== name;
}

let lastJob = null;
// How bergman bases are shown: normalized (monic) or as the engine printed them.
let basisView = 'normalized';
try { if (localStorage.getItem('george.basisView') === 'engine') basisView = 'engine'; } catch { /* storage unavailable */ }

async function compute(ev) {
  ev.preventDefault();
  if (running || zipBusy) return;
  const { ok, anyNonhomog, form } = validate();
  if (!ok) {
    setStatus('status.fix');
    els.form.querySelector('[aria-invalid="true"], .error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const f = { ...form, nonhomog: form.nonhomog === 'auto' ? (anyNonhomog ? 'itemwise' : 'degreewise') : form.nonhomog };
  let job;
  try { job = buildJob(f); } catch (error) { setStatus('status.raw', { msg: error.message }); return; }
  if (loadedExample && loadedExample.snapshot === snapshot()) job.exampleId = loadedExample.id;
  lastJob = job;
  if (job.backend === 'fomkyr') dashboard.start(job);
  let facts;
  try { facts = jobFacts(f, job); } catch { facts = {}; }
  lastOutcome = null;

  const generation = ++runGeneration;
  const t0 = performance.now();
  running = true;
  updateZipButton();
  allocatedMemoryBytes = undefined;
  runMemoryPlan = null;
  runStartedAt = t0;
  runDegree = null;
  runDegreeBound = Number(job.degreeBound) > 0 ? Number(job.degreeBound) : null;
  clearInterval(runTimer);
  runTimer = setInterval(updateElapsedTime, 250);
  els.go.disabled = true;
  els.stop.hidden = false;
  setStatus('status.busy', {}, true);
  if (matchMedia('(max-width: 960px)').matches) showPane('output');
  const task = TASK_BY_ID.get(job.task);
  prepareTabs(task, job);
  let stdout = '';
  renderLog(job, stdout);
  try {
    const res = await engine.run(job, (e) => {
      if (generation !== runGeneration) return;
      if (job.backend === 'fomkyr') dashboard.event(e);
      if (e.type === 'stdout') { stdout += e.text; renderLog(job, stdout); }
      else {
        if (e.type === 'memory-plan') runMemoryPlan = {...e};
        if (runMemoryPlan && Number.isFinite(e.rowReserveBytes)) runMemoryPlan.rowReserveBytes = e.rowReserveBytes;
        updateMemoryUsage(allocatedMemoryBytes);
        updateDegreeProgress(e);
      }
    });
    if (generation !== runGeneration) return;
    const ms = Math.round(performance.now() - t0);
    renderResults(job, res, facts);
    setStatus('status.done', { ms });
    if (job.backend === 'fomkyr') dashboard.finish('finished', els.runStatus.textContent,
      lastOutcome && {state: lastOutcome.state, text: $('runChip').textContent, hint: $('runChipHint').textContent});
  } catch (e) {
    if (generation !== runGeneration) return;
    if (e.partialResult) renderResults(job, Object.assign(e.partialResult, {stopped: true}), facts);
    lastOutcome = ['memory-limit', 'timeout'].includes(e.code) || e.partialResult ? STOPPED : null;
    if (e.code === 'memory-limit') setStatus(job.memoryMiB === 0 ? 'status.memoryUncapped' : 'status.memory', {mib: job.memoryMiB});
    else if (e.code === 'timeout') setStatus('status.timeout');
    else setStatus(e.name === 'AbortError' ? 'status.stopped' : 'status.error', { engine: job.backend === 'fomkyr' ? 'fomkyr' : 'bergman', msg: e.message });
    if (job.backend === 'fomkyr') dashboard.finish(e.code === 'memory-limit' || e.code === 'timeout' || e.name === 'AbortError' ? 'stopped' : 'error', els.runStatus.textContent);
  } finally {
    if (generation !== runGeneration) return;
    running = false;
    updateZipButton();
    els.go.disabled = false;
    els.stop.hidden = true;
    renderLog(job, stdout);
    if (els.view.dataset.pane === 'input') els.resultsDot.hidden = false;
  }
}

function prepareTabs(task, job) {
  const has = (k) => task.out.includes(k);
  const show = { basis: true, series: has('hs') || has('pb') || !!job.outputs?.hs, betti: has('anick'), resolution: has('anick'), files: true, log: true };
  for (const b of els.tabs.querySelectorAll('button')) b.hidden = !show[b.dataset.tab];
  selectTab(has('anick') ? 'betti' : 'basis');
}

// ------------------------------------------------------------ rendering

const badge = (res) => (res.reference ? `<span class="badge">${t('reference')}</span>` : '');

function notComputed(what) {
  return `<div class="empty"><p>${esc(t('notComputed', { what }))}</p>` +
    `<p><button type="button" class="quiet small" data-goto="log">${t('showSession')}</button></p></div>`;
}

function renderResults(job, res, facts = lastRendered?.job === job ? lastRendered.facts : {}) {
  lastRendered = { job, res, facts };
  lastOutcome = res.stopped ? STOPPED : runOutcome({job, facts, res, summary: null});
  const files = res.files;
  $('basisEmpty').hidden = true;
  const gbText = files[job.outputs.gb];
  if (gbText === undefined) $('basisOut').innerHTML = notComputed(t('tab.basis'));
  else {
    const parsed = parseBasis(gbText);
    const summary = basisSummary(parsed.groups, parsed.done, res);
    if (!res.stopped) lastOutcome = runOutcome({job, facts, res, summary});
    const n = summary.total;
    const degs = summary.degrees;
    let html = `<div class="basis-head"><p class="summary">${(degs.length === 1 ? tn('basis.summary1', n, { a: degs[0] }) : t(degs.length > 1 ? 'basis.summary' : 'basis.summaryFlat', { n, a: degs[0], b: degs.at(-1) }))}${badge(res)}</p>`;
    // A compact index of the degrees; each entry jumps to its section.
    if (summary.groups.length > 1) html += `<nav class="degree-index" aria-label="${esc(t('basis.index'))}">` + summary.groups.map(g =>
      `<button type="button" data-degree="${g.deg}" title="${esc(t('basis.jump', { d: g.deg, n: g.count }))}"><span class="k">${g.deg}</span><span class="v">${g.count}</span></button>`).join('') + '</nav>';
    // Warnings are callouts; other facts are one quiet line; buttons share one row.
    const warnings = [], info = [], actions = [];
    if (res.fomkyr?.conditionalOnImportedFkDimensions) warnings.push(t('fomkyr.importedDimensionsNotice'));
    if (res.fomkyr?.conditionalOnExternalDimensions) warnings.push(t('fomkyr.externalDimensionsNotice'));
    else if (res.fomkyr?.hilbertEvidenceMode === 'replayed-integer-duals') info.push(t('fomkyr.certificateNotice'));
    if (res.fomkyr?.reduced === false) info.push(t('native.unreduced'));
    if (summary.truncated) {
      info.push(t('basis.previewCount', { shown: summary.shown, total: n }));
      if (res.fomkyr?.fullBasisPath) actions.push(`<button type="button" class="quiet small" id="basisMore">${t('basis.showMore')}</button><span id="basisMoreStatus" role="status"></span>`);
      actions.push(`<button type="button" class="quiet small" data-goto="files">${t('basis.toFiles')}</button>`);
    }
    if (warnings.length) html += '<ul class="notes">' + warnings.map(note => `<li class="warn">${note}</li>`).join('') + '</ul>';
    if (info.length) html += `<p class="basis-info">${info.join(' ')}</p>`;
    if (actions.length) html += `<div class="basis-actions">${actions.join('')}</div>`;
    // Bergman prints primitive integer elements; fomkyr already exports the
    // reduced monic basis. Show the normalized basis for both by default.
    let groups = summary.groups;
    const normalizable = !res.fomkyr?.reduced && !summary.truncated && gbText.length <= DISPLAY_NORMALIZE_CHARS;
    if (normalizable) {
      const view = basisView === 'normalized' && !res.normalizeError ? 'normalized' : 'engine';
      html += `<div class="basis-view"><div class="seg small" role="group" aria-label="${esc(t('basis.view'))}">` +
        ['normalized', 'engine'].map((v) => `<button type="button" data-basis-view="${v}" aria-pressed="${v === view}">${esc(t('basis.view.' + v))}</button>`).join('') + '</div>' +
        `<span class="hint">${esc(res.normalizeError ? t('basis.normalizeFailed', {msg: res.normalizeError}) : view === 'normalized' && !res.normalized ? t('basis.normalizing') : t('basis.view.' + view + 'Hint'))}</span></div>`;
      if (view === 'normalized' && res.normalized) groups = parseBasis(res.normalized.text).groups.map((g) => ({deg: g.deg, count: g.polys.length, polys: g.polys}));
      else if (view === 'normalized' && !res.normalizing) {
        res.normalizing = true;
        normalizeInWorker(job, gbText).then((result) => { res.normalized = result; }, (error) => { res.normalizeError = error.message; })
          .finally(() => { if (lastRendered?.res === res) renderResults(job, res); });
      }
    }
    html += '</div>';
    for (const g of groups) {
      html += `<section class="degree" id="basis-degree-${g.deg}"><h3><span class="d">${t(facts.weighted ? 'basis.weightedDegree' : 'basis.degree', { d: g.deg })}</span>${tn('basis.count', g.count)}</h3>`;
      if (g.polys.length < g.count) html += `<p class="caption">${t('basis.degreePreview', { shown: g.polys.length, total: g.count })}</p>`;
      html += '<div class="polynomial-groups">';
      const rows = g.polys.map((source, index) => ({source: positiveLeading(source), index, termCount: polynomialTermCount(source)}));
      for (const group of groupRelations(rows)) {
        html += `<ol class="polys" data-term-count="${group.termCount}">`;
        for (const {source, index} of group.relations) html += `<li value="${index+1}"><span class="math-expression" data-math-source="${esc(source)}">${typeset(source, { lead: true })}</span></li>`;
        html += '</ol>';
      }
      html += '</div></section>';
    }
    $('basisOut').innerHTML = html;
    // The verification bundle lives in the Files tab, beside the other downloads.
    $('verificationOut').innerHTML = verificationAvailable(res.fomkyr) ? `<p class="hint">${t('verification.hint')}</p>` +
      `<button type="button" class="quiet small" id="downloadVerificationBundle">${t('verification.download')}</button> <span id="verificationBundleStatus" role="status"></span>` : '';
    const verification=$('downloadVerificationBundle');
    if(verification)verification.onclick=()=>downloadVerificationBundle(job,res.fomkyr);
    const more = $('basisMore');
    if (more) more.onclick = async () => {
      more.disabled = true;
      try {
        const root = await navigator.storage.getDirectory();
        const directory = await (await root.getDirectoryHandle('fomkyr')).getDirectoryHandle(res.fomkyr.runKey);
        const file = await (await directory.getFileHandle('result.gb')).getFile();
        const next = await nextBasisPreview(file, res.fomkyr.previewByteLength);
        if (lastRendered?.res !== res || running) return;
        const previous = files[job.outputs.gb].replace(/\n% PREVIEW TRUNCATED[^\n]*\n?$/, '');
        files[job.outputs.gb] = previous + next.text;
        res.fomkyr = {...res.fomkyr, previewByteLength:next.offset, previewTruncated:next.truncated};
        renderResults(job, res);
        renderChip();
      } catch (error) {
        more.disabled = false;
        $('basisMoreStatus').textContent = t('native.unavailable', {msg:error.message});
      }
    };
  }

  if (res.fomkyr?.hilbert) renderFomkyrSeries($('seriesOut'), res.fomkyr.hilbert, t);
  else if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res, job, facts);
  else $('seriesOut').innerHTML = notComputed(t('tab.series'));
  if (job.outputs.anick) {
    const txt = files[job.outputs.anick];
    if (txt === undefined) {
      $('bettiOut').innerHTML = notComputed(t('tab.betti'));
      $('resolutionOut').innerHTML = notComputed(t('tab.resolution'));
    } else {
      const a = parseAnick(txt);
      $('bettiOut').innerHTML = res.homology
        ? `<p>${t('betti.ungraded')}</p><div class="table-wrap"><table class="betti"><thead><tr><th scope="col">${t('degree')}</th>${res.homology.betti.map((_,i)=>`<th scope="col">${i}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">${t('dimension')}</th>${res.homology.betti.map(n=>`<td>${n}</td>`).join('')}</tr></tbody></table></div>${res.homology.finiteTailZero?`<p>${t('betti.tail')}</p>`:''}${res.homology.truncatedBetti?`<p>${t('betti.truncated',{degree:res.homology.highestCertifiedDegree})}</p>`:''}<p>${t('betti.raw')}</p>`
        : renderBetti(a, res);
      const resolution = files['resolution.jsonl'] ? structuralResolutionDisplay(files['resolution.jsonl'], readInputFile(job.files['input.bg']).vars) : a;
      $('resolutionOut').innerHTML = (res.homology?.shifted ? `<p>${t('res.shifted')}</p>` : '') + renderResolution(resolution, res, job.task === 'anick');
    }
  }
  renderFiles(job, files, res);
  attachFomkyrResultLinks($('filesOut'), res.fomkyr, t);
}

// Bergman prints series literally (+1*t^0+1*t^1); show them the way one writes them.
function tidySeries(expr) {
  return expr
    .replace(/(\d+)\*?[A-Za-z]\^0(?!\d)/g, '$1')
    .replace(/(^|[+\-(*])1\*(?=[A-Za-z])/g, '$1')
    .replace(/([A-Za-z])\^1(?!\d)/g, '$1');
}

function renderSeries(hs, pb, res, job, facts) {
  if (hs === undefined && pb === undefined) return notComputed(t('tab.series'));
  const d = facts.seriesBound;
  let html = `<p class="summary">${t(!d ? 'series.summaryAll' : job.task === 'hilbert' ? 'series.summaryHilbert' : 'series.summary', { d })}${badge(res)}</p>`;
  if (hs !== undefined) {
    const lines = hs.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => l.includes(':'))) {
      for (const l of lines) {
        const i = l.indexOf(':');
        const what = l.slice(0, i).trim();
        const expr = l.slice(i + 1).trim();
        const trailing = expr.endsWith('...');
        const label = /numerator/i.test(what) ? t('series.hsNumerator') : /denominator/i.test(what) ? t('series.hsDenominator') : /power series/i.test(what) ? t('series.hsPower') : what;
        html += `<p class="series-line"><span class="what">${esc(label)}</span><span class="expr">${typeset(tidySeries(expr.replace(/\.\.\.$/, '')))}${trailing ? ' <span class="op">+</span> …' : ''}</span></p>`;
        if (/power series/i.test(what)) html += dimsTable(expr);
      }
    } else {
      const expr = lines.join('');
      html += `<p class="series-line"><span class="what">${t('series.hilbert')}</span><span class="expr">${typeset(tidySeries(expr))}</span></p>`;
      html += dimsTable(expr, 'z');
    }
  }
  if (pb !== undefined) {
    const expr = pb.split('\n').map((l) => l.trim()).filter(Boolean).join('');
    html += `<p class="series-line"><span class="what">${t('series.pb')}</span><span class="expr">${expr ? typeset(tidySeries(expr)) : `<span class="raw">${t('series.empty')}</span>`}</span></p>`;
    if (!expr) html += `<p class="caption">${t('series.pbEmpty')}</p>`;
  }
  return html;
}

// Coefficients of a power series "1+2t^1+3t^2" by degree.
function dimsTable(expr, v = 't') {
  const coef = new Map();
  const re = new RegExp(`([+-]?)(\\d*)\\*?(?:${v}(?:\\^(\\d+))?)?(?=[+-]|$|\\.)`, 'g');
  let m;
  const src = expr.replace(/\s+/g, '').replace(/\.\.\.$/, '');
  while ((m = re.exec(src)) && m[0] !== '') {
    const hasVar = m[0].includes(v);
    const deg = hasVar ? Number(m[3] ?? 1) : 0;
    const c = Number((m[1] === '-' ? '-' : '') + (m[2] || '1'));
    coef.set(deg, (coef.get(deg) || 0) + c);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (coef.size < 2) return '';
  const max = Math.max(...coef.keys());
  let html = `<div class="dims" aria-label="${t('series.dims')}">`;
  for (let d = 0; d <= max; d++) html += `<div><span class="k">${d}</span><span class="v">${coef.get(d) ?? 0}</span></div>`;
  return html + '</div>';
}

function renderBetti(a, res) {
  if (!a.table) return `<div class="empty"><p>${t('betti.none')}</p></div>`;
  const { cols, rows } = a.table;
  let html = `<p class="summary">${t('betti.summary')}${badge(res)}</p><div class="table-wrap"><table class="betti"><thead><tr><th scope="col"></th>`;
  for (const c of cols) html += `<th scope="col">${esc(c)}</th>`;
  html += '</tr></thead><tbody>';
  for (const r of rows) {
    html += `<tr><th scope="row">${esc(r.label)}</th>`;
    for (let i = 0; i < cols.length; i++) {
      const v = r.cells[i];
      if (v === undefined) html += '<td></td>';
      else if (v === '-') html += '<td class="z">–</td>';
      else html += `<td class="nz">${esc(v)}</td>`;
    }
    html += '</tr>';
  }
  html += `</tbody></table></div><p class="caption">${t('betti.caption')}</p>`;
  return html;
}

// For the trivial module, bergman's D(i, ·) is the differential ∂ᵢ₊₁ on
// chains in homological degree i + 1, the Betti table column.
function renderResolution(a, res, homological) {
  if (a.diffs.size === 0) return `<div class="empty"><p>${t('res.none')}</p></div>`;
  let html = `<p class="summary">${t(homological ? 'res.summary' : 'res.summaryRaw')}${badge(res)}</p><div class="chains">`;
  for (const [i, list] of [...a.diffs.entries()].sort((x, y) => x[0] - y[0])) {
    const name = homological ? `∂<sub>${i + 1}</sub>` : `<var>D</var>(${i}, ·)`;
    html += `<section><h3><span class="d" title="D(${i}, ·)">${name}</span> ${tn('res.on', list.length)}</h3>`;
    for (const d of list) html += `<p class="tensor-line"><span class="chain">${d.chainHTML ?? typesetWord(d.chain)}</span><span class="arrow">↦</span>${d.imageHTML ?? typesetTensor(d.image)}</p>`;
    html += '</section>';
  }
  return html + '</div>';
}

function codeBlock(name, text, { download = true } = {}) {
  return `<div class="file"><div class="file-head"><span class="name">${esc(name)}</span>` +
    `<button type="button" class="quiet small" data-copy="${esc(name)}">${t('copy')}</button>` +
    (download ? `<button type="button" class="quiet small" data-download="${esc(name)}">${t('download')}</button>` : '') +
    `</div><pre class="code-block">${esc(text)}</pre></div>`;
}

let fileContents = new Map();

function renderFiles(job, files, res) {
  const names = Object.keys(files);
  zipSource = {job, files, meta:res?.fomkyr};
  if(!zipBusy)els.resultsZipStatus.hidden=true;
  updateZipButton();
  for (const n of names) fileContents.set(n, files[n]);
  $('filesOut').innerHTML = names.length
    ? names.map((n) => codeBlock(n, files[n])).join('')
    : `<div class="empty"><p>${t('files.none')}</p></div>`;
}

function renderLog(job, stdout) {
  fileContents.set('input.bg', job.files['input.bg']);
  if (job.backend === 'fomkyr') fileContents.delete('session.lsp');
  else fileContents.set('session.lsp', job.script);
  fileContents.set('terminal.txt', stdout);
  $('logHint').textContent = t(job.backend === 'fomkyr' ? 'native.logHint' : 'log.hint');
  $('logOut').innerHTML = codeBlock('input.bg', job.files['input.bg']) + (job.backend === 'fomkyr' || !job.script ? '' : codeBlock('session.lsp', job.script)) +
    (stdout ? codeBlock('terminal.txt', stdout, { download: false }) : '');
}

// ------------------------------------------------------------ copy and download

function updateZipButton() {
  els.resultsZip.hidden = !zipSource || !Object.keys(zipSource.files).length;
  els.resultsZip.disabled = running || zipBusy || els.resultsZip.hidden;
}
async function downloadResultsZip() {
  if(running || zipBusy || !zipSource)return;
  const source=zipSource,wasDisabled=els.go.disabled;
  let normalizationError=null;
  zipBusy=true;els.go.disabled=true;updateZipButton();
  els.resultsZipStatus.hidden=false;els.resultsZipStatus.textContent=t('results.zipBusy');
  try{
    const degree=source.meta?.completedThroughDegree??source.job.degreeBound;
    const filename='george-'+source.job.task+(degree?'-degree-'+degree:'')+'.zip';
    await downloadZip(filename,async()=>{
      const entries=[];
      if(source.job.files['input.bg']!==undefined)entries.push({name:'input.txt',blob:new Blob([source.job.files['input.bg']],{type:'text/plain;charset=utf-8'})});
      for(const [name,text] of Object.entries(source.files)){
        let blob=new Blob([text],{type:'text/plain;charset=utf-8'});
        if(name===source.job.outputs.gb && source.meta?.fullBasisPath){
          const root=await navigator.storage.getDirectory();
          const directory=await (await root.getDirectoryHandle('fomkyr')).getDirectoryHandle(source.meta.runKey);
          blob=await (await directory.getFileHandle('result.gb')).getFile();
        }else if(name===source.job.outputs.gb && source.meta?.previewTruncated)throw new Error(t('results.zipIncomplete'));
        const archiveName=name===source.job.outputs.gb?'result.txt':name.replace(/\.(hs|pb|anick)$/i,'.$1.txt');
        entries.push({name:archiveName,blob});
        if(name===source.job.outputs.gb){
          try{entries.push({name:'result-normalized.txt',blob:source.meta?.reduced?await engineNormalizedBasis(source.job,blob):new Blob([await normalizedBasis(source.job,blob)],{type:'text/plain;charset=utf-8'})});}
          catch(error){normalizationError=error.message;}
        }
      }
      return entries;
    });
    els.resultsZipStatus.textContent=normalizationError?t('results.zipNoNormalized',{msg:normalizationError}):t('results.zipReady');
  }catch(error){
    if(error.name==='AbortError')els.resultsZipStatus.hidden=true;
    else els.resultsZipStatus.textContent=t('results.zipError',{msg:error.message});
  }finally{zipBusy=false;els.go.disabled=wasDisabled||running;updateZipButton();}
}

// The same header for every engine, so normalized files compare directly.
function normalizedComplete(job) {
  return lastRendered?.job === job && lastOutcome?.state === 'complete';
}
function normalizedHeader(job, vars, {orderedTails = true, dropped = 0, notes = []} = {}) {
  const outcome = lastRendered?.job === job ? lastOutcome : null;
  const status = !outcome ? 'unknown' : outcome.state === 'complete' ? 'complete reduced Gröbner basis'
    : outcome.state === 'conditional' ? 'complete if the imported or supplied dimensions are correct'
    : outcome.degree ? `through degree ${outcome.degree}; higher degrees may add elements` : 'partial; the computation stopped';
  const settingLines = job.script.split('\n').filter((line) => /^\((\w*IFY|\w*ORDER|SETORDERMATRIX|SETMODULUS|SETWEIGHTS|SETMAXDEG)\b/.test(line));
  return [
    `% Reduced Gröbner basis, normalized by George ${document.querySelector('.brand-version')?.textContent ?? ''}.`,
    '% Every element is monic, and no term of an element is divisible by the leading monomial of another.',
    `% Settings: ${settingLines.join(' ')}`,
    `% Generators: ${vars.join(', ')}`,
    `% Status: ${status}.`,
    orderedTails ? '% Each element lists its leading monomial first, then its terms in decreasing monomial order.'
      : '% Each element lists its leading monomial first, then its terms in a fixed canonical sequence.',
    ...(dropped ? [`% ${dropped} element(s) with a redundant leading monomial were removed.`] : []),
    ...notes.map((note) => `% Engine: ${note}`),
  ].join('\n') + '\n';
}

// fomkyr already exports the reduced monic basis. Keep its notes, replace its
// header and its export marker, and pass the body through without reading it.
async function engineNormalizedBasis(job, blob) {
  const vars = readInputFile(job.files['input.bg']).vars;
  const notes = [];
  let offset = 0;
  for (const line of (await blob.slice(0, 65536).text()).split('\n')) {
    if (!line.startsWith('%') || /^%\s*\d+\s*$/.test(line)) break;
    notes.push(line.replace(/^%\s*/, ''));
    offset += new TextEncoder().encode(line + '\n').length;
  }
  const end = blob.size - ((await blob.slice(Math.max(0, blob.size - 5)).text()) === 'Done\n' ? 5 : 0);
  return new Blob([normalizedHeader(job, vars, {notes}), blob.slice(offset, end), normalizedComplete(job) ? 'Done\n' : ''], {type: 'text/plain;charset=utf-8'});
}

// The reduced monic basis, computed in a worker. Terms of any element that
// another leading monomial divides are rewritten; see normal-basis.js.
const NORMALIZE_LIMIT_BYTES = 256 * 1048576;
// Larger bases stay as the engine printed them on screen; the ZIP still normalizes them.
const DISPLAY_NORMALIZE_CHARS = 32 * 1048576;
// Runs the normalizer worker on a basis text; see normal-basis.js.
async function normalizeInWorker(job, text, onProgress = () => {}) {
  const vars = readInputFile(job.files['input.bg']).vars;
  const worker = new Worker(new URL('./normal-basis-worker.js', import.meta.url), {type: 'module'});
  try {
    return await new Promise((resolve, reject) => {
      worker.onerror = (event) => reject(new Error(event.message || 'worker failed'));
      worker.onmessage = ({data}) => {
        if (data.progress) onProgress(data.progress);
        else if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.postMessage({text, vars, ...scriptSettings(job.script, vars)});
    });
  } finally { worker.terminate(); }
}
async function normalizedBasis(job, blob) {
  if (blob.size > NORMALIZE_LIMIT_BYTES) throw new Error(t('results.normalizeLarge'));
  const vars = readInputFile(job.files['input.bg']).vars;
  const cached = lastRendered?.job === job ? lastRendered.res.normalized : null;
  const result = cached ?? await normalizeInWorker(job, await blob.text(), (progress) => { els.resultsZipStatus.textContent = t('results.normalizing', {d: progress.degree}); });
  return normalizedHeader(job, vars, result) + result.text + (normalizedComplete(job) ? 'Done\n' : '');
}

async function downloadVerificationBundle(job,result) {
  if(running||zipBusy)return;
  const button=$('downloadVerificationBundle'),status=$('verificationBundleStatus'),wasDisabled=els.go.disabled;
  let release;
  zipBusy=true;button.disabled=true;els.go.disabled=true;updateZipButton();status.textContent=t('verification.preparing');
  try {
    await downloadZip(`fomkyr-degree-${result.completedThroughDegree}-verification.zip`,async()=>{
      release=await acquireRunLock(result.runKey);
      const root=await navigator.storage.getDirectory(),directory=await(await root.getDirectoryHandle('fomkyr')).getDirectoryHandle(result.runKey);
      const {fixture}=parseNativeJob(job);
      return verificationEntries({fixture,result,openFile:async name=>(await directory.getFileHandle(name)).getFile(),onProgress:name=>{status.textContent=t('verification.hashing',{name});}});
    });
    status.textContent=t('verification.ready');
  }catch(error){status.textContent=error.name==='AbortError'?'':t('verification.error',{msg:error.message});}
  finally{await release?.();zipBusy=false;button.disabled=false;els.go.disabled=wasDisabled||running;updateZipButton();}
}

document.addEventListener('copy', copyMathSelection);

function shareMessage(key) {
  els.shareStatus.textContent = t(key);
  els.shareStatus.hidden = false;
}

async function sharePresentation() {
  const generation = ++shareGeneration;
  const state = { ...readForm(), varsText: els.vars.value, preset: els.preset.value, presetN: els.presetN.value, ...preferences };
  els.share.disabled = true;
  try {
    const link = await createShareLink(state, location.href);
    if (generation !== shareGeneration) return;
    els.shareLink.value = link;
    els.sharePanel.hidden = false;
    let copied = false;
    try { await navigator.clipboard.writeText(link); copied = true; } catch { /* manual copy below */ }
    if (generation !== shareGeneration) return;
    if (!copied) { els.shareLink.focus(); els.shareLink.select(); }
    shareMessage(copied ? 'share.copied' : 'share.ready');
  } catch (error) {
    if (generation === shareGeneration) shareMessage(error.message === 'share.tooLarge' ? 'share.tooLarge' : 'share.failed');
  } finally { els.share.disabled = false; }
}

async function restoreSharedPresentation(hash) {
  const state = await readShareLink(hash);
  if (!state || location.hash !== hash) return false;
  writeForm(state);
  els.preset.value = state.preset;
  els.presetN.value = state.presetN;
  els.presetNField.hidden = !state.preset.startsWith('family:');
  loadedExample = null;
  preferences.language = state.language;
  preferences.theme = state.theme;
  setLanguage(preferences.language);
  applyTheme(preferences.theme);
  savePreferences(storage, preferences);
  updateLanguage();
  showPane('input');
  shareMessage('share.loaded');
  return true;
}

function shareLoadError(error) {
  shareMessage(error.message === 'share.unsupported' ? 'share.unsupported' : error.message === 'share.tooLarge' ? 'share.tooLarge' : 'share.invalid');
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = t('copied');
  setTimeout(() => { btn.textContent = old; }, 1400);
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.copy) copyText(fileContents.get(b.dataset.copy) ?? '', b);
  else if (b.dataset.download) download(b.dataset.download, fileContents.get(b.dataset.download) ?? '');
  else if (b.dataset.goto) selectTab(b.dataset.goto);
  else if (b.dataset.basisView && lastRendered) {
    basisView = b.dataset.basisView;
    try { localStorage.setItem('george.basisView', basisView); } catch { /* storage unavailable */ }
    renderResults(lastRendered.job, lastRendered.res);
  }
  else if (b.dataset.degree && b.closest('.degree-index')) $('basis-degree-' + b.dataset.degree)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// ------------------------------------------------------------ console

const dashboard = new FomkyrDashboard($('fomkyrDashboardBody'), t, (n) => new Intl.NumberFormat(getLanguage()).format(n));
const consoleView = initConsole({
  $, engine, storage,
  runCurrent: {
    build() {
      const { ok, form: f, anyNonhomog } = validate();
      if (!ok) throw new Error(t('console.fix'));
      return buildJob({ ...f, nonhomog: f.nonhomog === 'auto' ? (anyNonhomog ? 'itemwise' : 'degreewise') : f.nonhomog });
    },
    done: (job, files) => renderFiles(job, files),
  },
});

// ------------------------------------------------------------ views

function route() {
  const v = (location.hash || '#compute').slice(1);
  const view = v.startsWith('guide') ? 'guide' : ['compute', 'console', 'about'].includes(v) ? v : 'compute';
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== `view-${view}`;
  for (const a of document.querySelectorAll('.views a')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (view === 'guide' && v !== 'guide') $('guideContent').querySelector(`#${CSS.escape(v)}`)?.scrollIntoView();
  if (view === 'console') { consoleView.shown(); dashboard.render(true); }
}

function updateGuide() {
  const generation = ++guideGeneration;
  $('mathNotice').hidden = true;
  $('guideContent').setAttribute('aria-busy', 'true');
  renderMath($('guideContent'), guideHTML(getLanguage())).then(() => {
    if (generation !== guideGeneration) return;
    $('guideContent').setAttribute('aria-busy', 'false');
    if (location.hash.startsWith('#guide-')) route();
  }).catch(() => {
    if (generation !== guideGeneration) return;
    $('guideContent').setAttribute('aria-busy', 'false');
    $('mathNotice').textContent = t('math.error');
    $('mathNotice').hidden = false;
  });
}

function updateEngineNote() {
  const name=engineInfo?.backend==='fomkyr' ? 'fomkyr' : 'bergman';
  $('engineNote').textContent = engineInfo ? t('engine.ready', { engine: name, version: engineInfo.version })
    : engineError ? t('engine.error', { msg: engineError }) : t('engine.loading', {engine: $('backend').value==='fomkyr' ? 'fomkyr' : 'bergman'});
}

// "?" helpers show on hover or focus (CSS); a tap toggles them, Escape or a tap elsewhere closes them.
function closeHelps(except) {
  for (const help of document.querySelectorAll('.help.open')) {
    if (help === except) continue;
    help.classList.remove('open');
    help.querySelector('.help-btn').setAttribute('aria-expanded', 'false');
  }
}
document.addEventListener('click', e => {
  const button = e.target.closest('.help-btn');
  if (e.target.closest('.help-pop')) return;
  closeHelps(button?.parentElement);
  if (!button) return;
  const open = button.parentElement.classList.toggle('open');
  button.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHelps(); });

// The theme button cycles automatic, light, dark; its label names the current theme.
const THEMES = ['auto', 'light', 'dark'];
function syncPreferenceControls() {
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === preferences.language));
  }
  const label = `${t('theme.label')}: ${t('theme.' + preferences.theme)}`;
  $('theme').dataset.pref = preferences.theme;
  $('theme').setAttribute('aria-label', label);
  $('theme').title = label;
}

function updateLanguage() {
  document.documentElement.lang = getLanguage();
  applyTranslations();
  syncPreferenceControls();
  fillPresets();
  fillTasks();
  fillOrders();
  els.backend.querySelector('option[value="memory64"]').disabled = !memory64Supported();

  refresh();
  setStatus(statusState.key, statusState.params, statusState.busy);
  updateEngineNote();
  updateGuide();
  consoleView.updateLanguage();
  dashboard.render(true);
  // Re-rendering in the new language must not replace a failed run's status.
  const outcome = lastOutcome;
  if (lastRendered) renderResults(lastRendered.job, lastRendered.res);
  lastOutcome = outcome;
  renderChip();
  if (lastJob) renderLog(lastJob, fileContents.get('terminal.txt') || '');
}

document.addEventListener('click', e => {
  const button = e.target.closest('[data-tutorial]');
  if (!button) return;
  els.preset.value = 'tutorial:' + button.dataset.tutorial;
  applyPreset();
  showPane('input');
  location.hash = 'compute';
});

// ------------------------------------------------------------ init

async function init() {
  applyTranslations();
  els.backend.value = preferredBackend();
  els.memoryMiB.value = String(defaultMemoryMiB(els.backend.value));
  els.backend.querySelector('option[value="memory64"]').disabled = !memory64Supported();

  document.documentElement.lang = getLanguage();
  syncPreferenceControls();
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => {
      if (preferences.language === button.dataset.lang) return;
      preferences.language = button.dataset.lang;
      setLanguage(preferences.language);
      savePreferences(storage, preferences);
      updateLanguage();
    });
  }
  $('theme').addEventListener('click', () => {
    preferences.theme = THEMES[(THEMES.indexOf(preferences.theme) + 1) % THEMES.length];
    applyTheme(preferences.theme);
    savePreferences(storage, preferences);
    syncPreferenceControls();
    shareGeneration++;
    els.sharePanel.hidden = true;
    els.shareStatus.hidden = true;
  });
  updateGuide();
  fillPresets();
  fillTasks();
  fillOrders();
  let restored = false;
  let shareError;
  try { restored = await restoreSharedPresentation(location.hash); }
  catch (error) { shareError = error; }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!restored && saved && saved.form) {
      writeForm(saved.form, {restoreDraft: true});
      els.preset.value = saved.preset || '';
      els.presetN.value = saved.n || 3;
      els.presetNField.hidden = !els.preset.value.startsWith('family:');
      if (els.preset.value.startsWith('example:')) loadedExample = { id: els.preset.value.slice(8), snapshot: null };
      restored = true;
    }
  } catch { /* ignore */ }
  if (!restored) {
    // Bergman 2's default presentation
    writeForm({ ring: 'noncomm', vars: ['x', 'y', 'z'], relsText: 'x^3+y^3+z^3-xyz', order: 'degleftlex', maxdeg: '5', task: 'gb' });
  }
  refresh();
  if (loadedExample) {
    // keep the reference link only if the stored form equals the example
    const cur = snapshot();
    const restoredForm = readForm();
    const prev = els.preset.value;
    applyPreset();
    if (snapshot() !== cur) { loadedExample = null; writeForm(restoredForm); els.preset.value = prev; refresh(); }
  }
  if (location.hash.startsWith(SHARE_PREFIX) && restored && !shareError) shareMessage('share.loaded');
  if (shareError) shareLoadError(shareError);

  els.form.addEventListener('input', (e) => {
    if (e.target === els.preset || e.target === els.presetN) return;
    if (e.target === els.monomialPruning && els.backend.value === 'fomkyr') fomkyrPruningChoice = els.monomialPruning.checked;
    if (e.target === els.backend && els.backend.value === 'fomkyr') els.monomialPruning.checked = fomkyrPruningChoice ?? true;
    refresh();
  });
  els.form.addEventListener('change', (e) => {
    if (e.target === els.backend && els.backend.value === 'fomkyr') {
      els.maxserdeg.value = '';
      els.monomialPruning.checked = fomkyrPruningChoice ?? true;
    }
    if (e.target === els.preset || e.target === els.presetN) { applyPreset(); return; }
    if (e.target.name === 'ring') fillOrders();
    refresh();
  });
  els.form.addEventListener('submit', compute);
  // Runs before the form's own input/change handlers, which read the radios.
  for (const type of ['input', 'change']) $('taskSelect').addEventListener(type, () => {
    const radio = document.querySelector(`input[name="task"][value="${$('taskSelect').value}"]`);
    if (radio && !radio.disabled) radio.checked = true;
  });
  $('useBergman').addEventListener('click', () => {
    els.backend.value = preferredBackend();
    els.backend.dispatchEvent(new Event('change', { bubbles: true }));
  });
  els.share.addEventListener('click', sharePresentation);
  els.shareLink.addEventListener('click', () => els.shareLink.select());
  els.stop.addEventListener('click', () => { runGeneration++; lastOutcome = null; dashboard.finish('stopped'); engine.cancel(); running = false; updateZipButton(); els.go.disabled = false; els.stop.hidden = true; setStatus('status.stopped'); });
  els.resultsZip.addEventListener('click',downloadResultsZip);
  els.tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) selectTab(b.dataset.tab); });
  els.tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const vis = [...els.tabs.querySelectorAll('button:not([hidden])')];
    const i = vis.indexOf(document.activeElement);
    const nx = vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length];
    nx.focus(); selectTab(nx.dataset.tab);
  });
  $('switchInput').addEventListener('click', () => showPane('input'));
  $('switchOutput').addEventListener('click', () => showPane('output'));
  showPane('input');
  window.addEventListener('hashchange', async () => {
    route();
    try { await restoreSharedPresentation(location.hash); }
    catch (error) { shareLoadError(error); }
  });
  route();
  try {
    engineInfo = await engine.init();
    updateEngineNote();
    $('engineNote').classList.add('live');
  } catch (error) {
    if (error.name === 'AbortError') return;
    engineError = error.message;
    updateEngineNote();
  }
}

init();
