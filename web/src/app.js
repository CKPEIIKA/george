import { EXAMPLES } from './examples.js';
import {
  esc, parseVars, splitRelations, parseRelation, isHomogeneous, toBergman, typeset, typesetTerms,
  parseBasis, parseAnick, typesetTensor, typesetWord, readInputFile, buildJob, validateSettings, monomialPruningAvailable, exampleForm, ORDERS, TASKS, TASK_BY_ID, FAMILIES,
} from './bergman-syntax.js';
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
import { applyBackendCapabilities, backendCapabilities } from './backend-capabilities.js';
import { timeoutMilliseconds } from './time-limit.js';
import { formatMemorySize } from './memory-monitor.js';
import { attachFomkyrResultLinks, renderFomkyrSeries } from '../engine/fomkyr/result-links.js';
import {installFomkyrControls, readFomkyrOptions, writeFomkyrOptions} from './fomkyr-options.js';

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
applyTheme(preferences.theme);
let engineInfo = null;
let engineError = null;
let lastRendered = null;
let statusState = { key: 'status.idle', params: {}, busy: false };
let guideGeneration = 0;
let shareGeneration = 0;
let allocatedMemoryBytes;
let runStartedAt = null;
let runTimer;
let runDegree = null;
let runDegreeBound = null;

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
    monomialPruning: els.monomialPruning.checked,
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
  writeFomkyrOptions(s.fomkyrOptions || {}, document, {strict: !restoreDraft});
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
  $('nativeWorkers').value = String(s.nativeWorkers ?? $('nativeWorkers').value ?? 0);
  els.monomialPruning.checked = s.monomialPruning ?? els.monomialPruning.checked;
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

  let html = '';
  let anyNonhomog = false;
  const rels = splitRelations(f.relsText);
  for (const r of rels) {
    try {
      const terms = parseRelation(r, vv.names, f.backend === 'fomkyr' ? 0xfffffffe : 10000);
      const hom = isHomogeneous(terms, weights);
      if (!hom) anyNonhomog = true;
      html += `<li><span class="rel">${typesetTerms(terms)}${hom ? '' : `<span class="nh">${t('nonhomog')}</span>`}</span></li>`;
    } catch (e) {
      html += `<li class="bad"><span class="rel"><code>${esc(r)}</code>: ${esc(translateMessage(e.message))}</span></li>`;
      problems.push('relations');
    }
  }
  if (rels.length === 0) problems.push('relations');
  els.relPreview.innerHTML = html;
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

function refresh() {
  shareGeneration++;
  els.sharePanel.hidden = true;
  els.shareStatus.hidden = true;
  applyBackendCapabilities(els.form, els.backend.value, {tasks: TASKS, translate: t, onRingChange: fillOrders});
  const consoleAvailable = backendCapabilities(els.backend.value).console !== false;
  document.querySelector('[data-view="console"]').setAttribute('aria-disabled', String(!consoleAvailable));
  consoleView.setEnabled(consoleAvailable);
  for (const option of els.memoryMiB.options) {
    option.hidden = option.disabled = !validMemoryMiB(Number(option.value), els.backend.value);
  }
  if (!validMemoryMiB(Number(els.memoryMiB.value), els.backend.value)) els.memoryMiB.value = String(Math.min(Number(els.memoryMiB.value) || BACKENDS[els.backend.value].maximumHeapMiB, BACKENDS[els.backend.value].maximumHeapMiB));
  $('backendHint').textContent = t(els.backend.value === 'fomkyr' ? 'backend.nativeHint' : 'backend.hint');
  $('nativeWorkersField').hidden = els.backend.value !== 'fomkyr';
  $('fomkyrOptions').hidden = els.backend.value !== 'fomkyr';
  for (const input of $('fomkyrOptions').querySelectorAll('input, select')) input.disabled = els.backend.value !== 'fomkyr';
  $('memoryHint').textContent = t(els.backend.value === 'fomkyr' ? 'native.memoryHint' : 'memory.hint');
  const f = readForm();
  const task = TASK_BY_ID.get(f.task);
  els.matrixField.hidden = f.order !== 'matrix';
  els.rabbitField.hidden = f.strategy !== 'rabbit';
  els.maxserdegField.hidden = f.task !== 'hilbert' && f.backend !== 'fomkyr';
  els.moduleFields.hidden = !task.module;
  els.nmodgenField.hidden = task.module === 'two';
  els.twoModFields.hidden = task.module !== 'two';
  els.monomialPruning.disabled ||= !monomialPruningAvailable(readForm());
  if (els.monomialPruning.disabled) els.monomialPruning.checked = false;
  els.go.textContent = t('task.' + readForm().task + '.b');
  const tutorial = TUTORIALS.find(item => els.preset.value === 'tutorial:' + item.id);
  $('presetDescription').textContent = tutorial ? tutorial.description[getLanguage()] : t('start.hint');
  validate();
  save();
}

// ------------------------------------------------------------ running

function setStatus(key, params = {}, busy = false) {
  statusState = { key, params, busy };
  const seconds = key === 'status.done' ? new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 2, useGrouping: false }).format(params.ms / 1000) : undefined;
  els.runStatus.textContent = t(key, { ...params, seconds, msg: translateMessage(params.msg || '') });
  els.runStatus.classList.toggle('busy', busy);
  els.runMetrics.hidden = !busy;
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

function updateMemoryUsage(bytes) {
  allocatedMemoryBytes = bytes;
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
  const seconds = new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 1, useGrouping: false })
    .format(Math.max(0, performance.now() - runStartedAt) / 1000);
  const value = t('monitor.seconds', { seconds });
  els.timeValue.textContent = value;
  els.timeMetric.setAttribute('aria-label', `${t('monitor.time')}: ${value}`);
}

function updateDegreeUsage() {
  const degree = runDegree?.degree ?? '—';
  const limit = runDegreeBound ? t('monitor.degreeLimit', { bound: runDegreeBound }) : '';
  let progress = t(runDegree ? (runDegree.completed ? 'monitor.degreeCompleted' : 'monitor.degreeCurrent')
    : (lastJob?.backend === 'fomkyr' ? 'monitor.degreeWaiting' : 'monitor.degreeUnavailable'), { degree, limit });
  if (runDegree?.phase === 'anick') progress = t('monitor.degreeAnick', { progress });
  els.degreeValue.textContent = `${degree}${runDegreeBound ? ` / ${runDegreeBound}` : ''}${runDegree?.completed ? ' ✓' : ''}`;
  els.degreeUsageHint.textContent = progress;
  els.degreeMetric.setAttribute('aria-label', progress);
}

function updateDegreeProgress(event) {
  let degree, completed = false;
  if (event.type === 'degree-start') degree = Number(event.degree);
  else if (event.type === 'degree') { degree = Number(event.completedThroughDegree); completed = true; }
  else if (event.type === 'progress') {
    const current = Number(event.currentDegree), through = Number(event.completedThroughDegree);
    if (current > through) degree = current;
    else { degree = through; completed = true; }
  } else return;
  if (!Number.isSafeInteger(degree) || degree < 1) return;
  runDegree = { degree, completed, phase: event.phase ?? 'basis' };
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

async function compute(ev) {
  ev.preventDefault();
  if (running) return;
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

  const generation = ++runGeneration;
  const t0 = performance.now();
  running = true;
  allocatedMemoryBytes = undefined;
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
  prepareTabs(task);
  let stdout = '';
  renderLog(job, stdout);
  try {
    const res = await engine.run(job, (e) => {
      if (generation !== runGeneration) return;
      if (e.type === 'stdout') { stdout += e.text; renderLog(job, stdout); }
      else updateDegreeProgress(e);
    });
    if (generation !== runGeneration) return;
    const ms = Math.round(performance.now() - t0);
    renderResults(job, res);
    setStatus('status.done', { ms });
  } catch (e) {
    if (generation !== runGeneration) return;
    if (e.partialResult) renderResults(job, e.partialResult);
    if (e.code === 'memory-limit') setStatus(job.memoryMiB === 0 ? 'status.memoryUncapped' : 'status.memory', {mib: job.memoryMiB});
    else if (e.code === 'timeout') setStatus('status.timeout');
    else setStatus(e.name === 'AbortError' ? 'status.stopped' : 'status.error', { engine: job.backend === 'fomkyr' ? 'fomkyr' : 'bergman', msg: e.message });
  } finally {
    if (generation !== runGeneration) return;
    running = false;
    els.go.disabled = false;
    els.stop.hidden = true;
    renderLog(job, stdout);
    if (els.view.dataset.pane === 'input') els.resultsDot.hidden = false;
  }
}

function prepareTabs(task) {
  const has = (k) => task.out.includes(k);
  const show = { basis: true, series: has('hs') || has('pb') || els.backend.value === 'fomkyr', betti: has('anick'), resolution: has('anick'), files: true, log: true };
  for (const b of els.tabs.querySelectorAll('button')) b.hidden = !show[b.dataset.tab];
  selectTab(has('anick') ? 'betti' : 'basis');
}

// ------------------------------------------------------------ rendering

const badge = (res) => (res.reference ? `<span class="badge">${t('reference')}</span>` : '');

function notComputed(what) {
  return `<div class="empty"><p>${esc(t('notComputed', { what }))}</p>` +
    `<p><button type="button" class="quiet small" data-goto="log">${t('showSession')}</button></p></div>`;
}

function renderResults(job, res) {
  lastRendered = { job, res };
  const files = res.files;
  $('basisEmpty').hidden = true;
  const gbText = files[job.outputs.gb];
  if (gbText === undefined) $('basisOut').innerHTML = notComputed(t('tab.basis'));
  else {
    const { groups, done } = parseBasis(gbText);
    const n = groups.reduce((a, g) => a + g.polys.length, 0);
    const degs = groups.map((g) => g.deg);
    let html = `<p class="summary">${(degs.length === 1 ? tn('basis.summary1', n, { a: degs[0] }) : t(degs.length > 1 ? 'basis.summary' : 'basis.summaryFlat', { n, a: degs[0], b: degs.at(-1) }))}${badge(res)}</p>`;
    if (res.interrupted) html += `<p class="notice">${t('basis.interrupted')}</p>`;
    else if (!done) html += `<p class="notice">${t('basis.partial')}</p>`;
    else if (res.fomkyr?.unrestrictedBasisComplete) html += `<p class="notice">${t('fomkyr.completeBasis')}</p>`;
    else if (job.degreeBound) html += `<p class="notice">${t('basis.bounded', { d: job.degreeBound })}</p>`;
    if (res.fomkyr?.reduced === false) html += `<p class="notice">${t('native.unreduced')}</p>`;
    if (res.fomkyr?.previewTruncated) html += `<p class="notice">${t('native.preview')}</p>`;
    for (const g of groups) {
      html += `<section class="degree"><h3><span class="d">${t('basis.degree', { d: g.deg })}</span>${tn('basis.count', g.polys.length)}</h3><ol class="polys">`;
      for (const p of g.polys) html += `<li>${typeset(p, { lead: true })}</li>`;
      html += '</ol></section>';
    }
    $('basisOut').innerHTML = html;
  }

  if (res.fomkyr?.hilbert) renderFomkyrSeries($('seriesOut'), res.fomkyr.hilbert, t);
  else if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res);
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
      $('resolutionOut').innerHTML = (res.homology?.shifted ? `<p>${t('res.shifted')}</p>` : '') + renderResolution(resolution, res);
    }
  }
  renderFiles(job, files);
  attachFomkyrResultLinks($('filesOut'), res.fomkyr, t);
}

// Bergman prints series literally (+1*t^0+1*t^1); show them the way one writes them.
function tidySeries(expr) {
  return expr
    .replace(/(\d+)\*?[A-Za-z]\^0(?!\d)/g, '$1')
    .replace(/(^|[+\-(*])1\*(?=[A-Za-z])/g, '$1')
    .replace(/([A-Za-z])\^1(?!\d)/g, '$1');
}

function renderSeries(hs, pb, res) {
  if (hs === undefined && pb === undefined) return notComputed(t('tab.series'));
  let html = `<p class="summary">${t('series.summary')}${badge(res)}</p>`;
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

function renderResolution(a, res) {
  if (a.diffs.size === 0) return `<div class="empty"><p>${t('res.none')}</p></div>`;
  let html = `<p class="summary">${t('res.summary')}${badge(res)}</p><div class="chains">`;
  for (const [i, list] of [...a.diffs.entries()].sort((x, y) => x[0] - y[0])) {
    html += `<section><h3><span class="d"><var>D</var>(${i}, ·)</span> ${tn('res.on', list.length)}</h3>`;
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

function renderFiles(job, files) {
  const names = Object.keys(files);
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
  $('logOut').innerHTML = codeBlock('input.bg', job.files['input.bg']) + (job.backend === 'fomkyr' ? '' : codeBlock('session.lsp', job.script)) +
    (stdout ? codeBlock('terminal.txt', stdout, { download: false }) : '');
}

// ------------------------------------------------------------ copy and download

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
});

// ------------------------------------------------------------ console

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
  if (location.hash === '#console' && backendCapabilities(els.backend.value).console === false) {
    location.hash = '#compute';
    return;
  }
  const v = (location.hash || '#compute').slice(1);
  const view = v.startsWith('guide') ? 'guide' : ['compute', 'console', 'about'].includes(v) ? v : 'compute';
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== `view-${view}`;
  for (const a of document.querySelectorAll('.views a')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (view === 'guide' && v !== 'guide') $('guideContent').querySelector(`#${CSS.escape(v)}`)?.scrollIntoView();
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
  applyTranslations();
  syncPreferenceControls();
  fillPresets();
  fillTasks();
  fillOrders();
  els.backend.querySelector('option[value="memory64"]').disabled = !memory64Supported();

  refresh();
  document.documentElement.lang = getLanguage();
  setStatus(statusState.key, statusState.params, statusState.busy);
  updateEngineNote();
  updateGuide();
  consoleView.updateLanguage();
  if (lastRendered) renderResults(lastRendered.job, lastRendered.res);
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
    refresh();
  });
  els.form.addEventListener('change', (e) => {
    if (e.target === els.backend && els.backend.value === 'fomkyr') els.maxserdeg.value = '';
    if (e.target === els.preset || e.target === els.presetN) { applyPreset(); return; }
    if (e.target.name === 'ring') fillOrders();
    refresh();
  });
  els.form.addEventListener('submit', compute);
  els.share.addEventListener('click', sharePresentation);
  els.shareLink.addEventListener('click', () => els.shareLink.select());
  els.stop.addEventListener('click', () => { runGeneration++; engine.cancel(); running = false; els.go.disabled = false; els.stop.hidden = true; setStatus('status.stopped'); });
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
