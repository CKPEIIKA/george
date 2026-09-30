import { EXAMPLES } from './examples.js';
import {
  esc, parseVars, splitRelations, parseRelation, isHomogeneous, toBergman, typeset, typesetTerms,
  parseBasis, parseAnick, typesetTensor, typesetWord, readInputFile, buildJob, validateSettings, exampleForm, ORDERS, TASKS, TASK_BY_ID, FAMILIES,
} from './bergman-syntax.js';
import { EclEngine } from './engine.js';

const $ = (id) => document.getElementById(id);
const engine = new EclEngine();
const EX_BY_ID = new Map(EXAMPLES.map((e) => [e.id, e]));
const STORE_KEY = 'george.form.v1';

const els = {
  form: $('presentation'), preset: $('preset'), presetN: $('presetN'), presetNField: $('presetNField'),
  vars: $('vars'), varsErr: $('varsErr'), rels: $('rels'), relPreview: $('relPreview'),
  modulus: $('modulus'), pField: $('pField'), pErr: $('pErr'),
  order: $('order'), reverseVars: $('reverseVars'), matrix: $('matrix'), matrixField: $('matrixField'),
  maxdeg: $('maxdeg'), weights: $('weights'), homogWarn: $('homogWarn'),
  nonhomog: $('nonhomog'), strategy: $('strategy'), rabbit: $('rabbit'), rabbitField: $('rabbitField'),
  augmentation: $('augmentation'),
  lowterms: $('lowterms'), outmode: $('outmode'), legacy: $('legacy'), maxserdeg: $('maxserdeg'), maxserdegField: $('maxserdegField'),
  moduleFields: $('moduleFields'), nmodgen: $('nmodgen'), nmodgenField: $('nmodgenField'),
  twoModFields: $('twoModFields'), nlmodgen: $('nlmodgen'), nrmodgen: $('nrmodgen'),
  taskList: $('taskList'), go: $('go'), stop: $('stop'), runStatus: $('runStatus'),
  tabs: $('tabs'), view: $('view-compute'), resultsDot: $('resultsDot'),
};

let loadedExample = null; // { id, snapshot } while the form still equals a bundled example
let running = false;

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

function writeForm(s) {
  setRadio('ring', s.ring || 'noncomm');
  fillOrders();
  els.vars.value = (s.vars || []).join(', ');
  els.rels.value = s.relsText ?? (s.rels || []).join(',\n');
  setRadio('field', s.field || '0');
  els.modulus.value = s.modulus || 5;
  if (s.order) els.order.value = s.order;
  if (!els.order.value) els.order.selectedIndex = 0;
  els.reverseVars.checked = !!s.reverseVars;
  if (s.matrix !== undefined) els.matrix.value = s.matrix;
  els.maxdeg.value = s.maxdeg || '';
  els.weights.value = s.weights || '';
  els.nonhomog.value = s.nonhomog || 'auto';
  els.augmentation.value = s.augmentation || 'graded';
  els.strategy.value = s.strategy || 'default';
  if (s.rabbit) els.rabbit.value = s.rabbit;
  els.lowterms.value = s.lowterms || 'quick';
  els.outmode.value = s.outmode || 'ALG';
  els.legacy.checked = !!s.legacy;
  if (s.maxserdeg) els.maxserdeg.value = s.maxserdeg;
  els.nmodgen.value = s.nmodgen || 1;
  els.nlmodgen.value = s.nlmodgen || 1;
  els.nrmodgen.value = s.nrmodgen || 1;
  const t = document.querySelector(`input[name="task"][value="${s.task || 'gb'}"]`);
  if (t) t.checked = true;
}

const snapshot = () => JSON.stringify({ ...readForm(), rels: undefined });

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ form: readForm(), preset: els.preset.value, n: els.presetN.value })); } catch { /* storage unavailable */ }
}

// ------------------------------------------------------------ setup of controls

function fillPresets() {
  let html = '<option value="">Blank presentation</option><optgroup label="Families, as in Bergman 2">';
  for (const [id, f] of Object.entries(FAMILIES)) html += `<option value="family:${id}">${esc(f.label)}</option>`;
  html += '</optgroup><optgroup label="Examples from bergman’s test suite">';
  for (const e of EXAMPLES) html += `<option value="example:${e.id}">${esc(e.title)}</option>`;
  html += '</optgroup>';
  els.preset.innerHTML = html;
}

function fillOrders() {
  const ring = radio('ring');
  const cur = els.order.value;
  els.order.innerHTML = ORDERS[ring].map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
  if (ORDERS[ring].some((o) => o.id === cur)) els.order.value = cur;
}

function fillTasks() {
  const groups = new Map();
  for (const t of TASKS) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push(t);
  }
  let html = '';
  for (const [g, ts] of groups) {
    html += `<div class="task-group" role="radiogroup" aria-label="${esc(g)}"><h3>${esc(g)}</h3>`;
    for (const t of ts) {
      html += `<label class="task" data-task="${t.id}"><input type="radio" name="task" value="${t.id}"${t.id === 'gb' ? ' checked' : ''}>` +
        `<span class="t-label">${esc(t.label)}</span><span class="t-desc">${esc(t.desc)}</span><span class="t-note" hidden></span></label>`;
    }
    html += '</div>';
  }
  els.taskList.innerHTML = html;
}

// ------------------------------------------------------------ presets

function applyPreset() {
  const v = els.preset.value;
  els.presetNField.hidden = !v.startsWith('family:');
  if (!v) { loadedExample = null; refresh(); return; }
  if (v.startsWith('family:')) {
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
  problems.push(...settingsErrors);
  const vv = parseVars(els.vars.value);
  els.varsErr.hidden = vv.errors.length === 0 && vv.names.length > 0;
  els.varsErr.textContent = vv.names.length === 0 ? 'Enter at least one generator.' : vv.errors.join(' ');
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
      const terms = parseRelation(r, vv.names);
      const hom = isHomogeneous(terms, weights);
      if (!hom) anyNonhomog = true;
      html += `<li><span class="rel">${typesetTerms(terms)}${hom ? '' : '<span class="nh">not homogeneous</span>'}</span></li>`;
    } catch (e) {
      html += `<li class="bad"><span class="rel"><code>${esc(r)}</code>: ${esc(e.message)}</span></li>`;
      problems.push('relations');
    }
  }
  if (rels.length === 0) problems.push('relations');
  els.relPreview.innerHTML = html;
  els.rels.setAttribute('aria-invalid', String(problems.includes('relations') && rels.length > 0));

  els.pField.hidden = f.field !== 'p';
  const p = Number(f.modulus);
  els.pErr.hidden = f.field !== 'p' || isPrime(p);
  els.pErr.textContent = `${f.modulus} is not a prime; bergman works over prime fields.`;
  if (!els.pErr.hidden) problems.push('p');

  let warn = '';
  if (settingsErrors.length) warn = settingsErrors.join(' ');
  else if (wl.length && wl.length !== vv.names.length) warn = `Give one weight per generator: there are ${vv.names.length} generators and ${wl.length} weights.`;
  else if (anyNonhomog && f.nonhomog === 'degreewise') warn = 'Some relations are not homogeneous. Degree-by-degree processing needs homogeneous relations; choose item-by-item processing under More settings.';
  else if (anyNonhomog) warn = 'Some relations are not homogeneous, so bergman will process them item by item. A maximal degree keeps the computation finite.';
  els.homogWarn.hidden = !warn;
  els.homogWarn.textContent = warn;
  return { ok: problems.length === 0, anyNonhomog, form: f };
}

function refresh() {
  const f = readForm();
  const task = TASK_BY_ID.get(f.task);
  els.matrixField.hidden = f.order !== 'matrix';
  els.rabbitField.hidden = f.strategy !== 'rabbit';
  els.maxserdegField.hidden = f.task !== 'hilbert';
  els.moduleFields.hidden = !task.module;
  els.nmodgenField.hidden = task.module === 'two';
  els.twoModFields.hidden = task.module !== 'two';
  for (const lbl of els.taskList.querySelectorAll('.task')) {
    const t = TASK_BY_ID.get(lbl.dataset.task);
    const input = lbl.querySelector('input');
    const note = lbl.querySelector('.t-note');
    const unavailable = t.ring && t.ring !== f.ring;
    lbl.classList.toggle('unavailable', !!unavailable);
    input.disabled = !!unavailable;
    note.hidden = !unavailable;
    note.textContent = unavailable ? (t.ring === 'comm' ? 'For commutative algebras.' : 'For noncommutative algebras.') : '';
  }
  if (task.ring && task.ring !== f.ring) {
    document.querySelector('input[name="task"][value="gb"]').checked = true;
  }
  els.go.textContent = TASK_BY_ID.get(readForm().task).button;
  validate();
  save();
}

// ------------------------------------------------------------ running

function setStatus(text, busy = false) {
  els.runStatus.textContent = text;
  els.runStatus.classList.toggle('busy', busy);
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
    setStatus('Fix the highlighted fields first.');
    els.form.querySelector('[aria-invalid="true"], .error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const f = { ...form, nonhomog: form.nonhomog === 'auto' ? (anyNonhomog ? 'itemwise' : 'degreewise') : form.nonhomog };
  let job;
  try { job = buildJob(f); } catch (error) { setStatus(error.message); return; }
  if (loadedExample && loadedExample.snapshot === snapshot()) job.exampleId = loadedExample.id;
  lastJob = job;

  running = true;
  els.go.disabled = true;
  els.stop.hidden = false;
  setStatus('Computing…', true);
  if (matchMedia('(max-width: 960px)').matches) showPane('output');
  const task = TASK_BY_ID.get(job.task);
  prepareTabs(task);
  let stdout = '';
  const t0 = performance.now();
  renderLog(job, stdout);
  try {
    const res = await engine.run(job, (e) => { if (e.type === 'stdout') { stdout += e.text; renderLog(job, stdout); } });
    const ms = Math.round(performance.now() - t0);
    renderResults(job, res);
    setStatus(`Computed in ${ms} ms. Check the basis tab for any degree limit.`);
  } catch (e) {
    setStatus(e.name === 'AbortError' ? 'Stopped.' : `bergman stopped with an error: ${e.message}`);
  } finally {
    running = false;
    els.go.disabled = false;
    els.stop.hidden = true;
    renderLog(job, stdout);
    if (els.view.dataset.pane === 'input') els.resultsDot.hidden = false;
  }
}

function prepareTabs(task) {
  const has = (k) => task.out.includes(k);
  const show = { basis: true, series: has('hs') || has('pb'), betti: has('anick'), resolution: has('anick'), files: true, log: true };
  for (const b of els.tabs.querySelectorAll('button')) b.hidden = !show[b.dataset.tab];
  selectTab(has('anick') ? 'betti' : 'basis');
}

// ------------------------------------------------------------ rendering

const badge = (res) => (res.reference ? '<span class="badge">reference output</span>' : '');

function notComputed(what) {
  return `<div class="empty"><p>${esc(what)} did not produce an output file.</p>` +
    '<p><button type="button" class="quiet small" data-goto="log">Show the bergman session</button></p></div>';
}

function renderResults(job, res) {
  const files = res.files;
  $('basisEmpty').hidden = true;
  const gbText = files[job.outputs.gb];
  if (gbText === undefined) $('basisOut').innerHTML = notComputed('Gröbner basis');
  else {
    const { groups, done } = parseBasis(gbText);
    const n = groups.reduce((a, g) => a + g.polys.length, 0);
    const degs = groups.map((g) => g.deg);
    let html = `<p class="summary">${n} element${n === 1 ? '' : 's'}` +
      (degs.length ? `, in degree${degs.length > 1 ? `s ${degs[0]} to ${degs[degs.length - 1]}` : ` ${degs[0]}`}` : '') +
      `. Leading monomials are highlighted.${badge(res)}</p>`;
    if (!done) html += '<p class="notice">The computation reached its degree limit. This is a partial basis; completion beyond that degree is not certified.</p>';
    else if (job.degreeBound) html += `<p class="notice">Computed through degree ${esc(String(job.degreeBound))}. Bergman’s completion marker can describe a bounded calculation; completeness in higher degrees requires a separate check.</p>`;
    for (const g of groups) {
      html += `<section class="degree"><h3><span class="d">Degree ${g.deg}</span>${g.polys.length} element${g.polys.length === 1 ? '' : 's'}</h3><ol class="polys">`;
      for (const p of g.polys) html += `<li>${typeset(p, { lead: true })}</li>`;
      html += '</ol></section>';
    }
    $('basisOut').innerHTML = html;
  }

  if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res);
  if (job.outputs.anick) {
    const txt = files[job.outputs.anick];
    if (txt === undefined) {
      $('bettiOut').innerHTML = notComputed('Betti numbers');
      $('resolutionOut').innerHTML = notComputed('Resolution');
    } else {
      const a = parseAnick(txt);
      $('bettiOut').innerHTML = res.homology
        ? `<p>Ungraded Betti numbers. Consecutive augmented differentials were checked to compose to zero.</p><div class="table-wrap"><table class="betti"><thead><tr><th scope="col">Degree</th>${res.homology.betti.map((_,i)=>`<th scope="col">${i}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">Dimension</th>${res.homology.betti.map(n=>`<td>${n}</td>`).join('')}</tr></tbody></table></div>${res.homology.finiteTailZero?'<p>The chain complex ends here; higher Betti numbers are zero.</p>':''}<p>The internal-degree Betti table in the original raw output is not valid for nonhomogeneous relations; use homology.json.</p>`
        : renderBetti(a, res);
      $('resolutionOut').innerHTML = (res.homology?.shifted ? '<p>The resolution uses shifted generators: each displayed generator represents the original generator minus 1.</p>' : '') + renderResolution(a, res);
    }
  }
  renderFiles(job, files);
}

// Bergman prints series literally (+1*t^0+1*t^1); show them the way one writes them.
function tidySeries(expr) {
  return expr
    .replace(/(\d+)\*?[A-Za-z]\^0(?!\d)/g, '$1')
    .replace(/(^|[+\-(*])1\*(?=[A-Za-z])/g, '$1')
    .replace(/([A-Za-z])\^1(?!\d)/g, '$1');
}

function renderSeries(hs, pb, res) {
  if (hs === undefined && pb === undefined) return notComputed('Series');
  let html = `<p class="summary">Series computed up to the maximal degree.${badge(res)}</p>`;
  if (hs !== undefined) {
    const lines = hs.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.some((l) => l.includes(':'))) {
      for (const l of lines) {
        const i = l.indexOf(':');
        const what = l.slice(0, i).trim();
        const expr = l.slice(i + 1).trim();
        const trailing = expr.endsWith('...');
        html += `<p class="series-line"><span class="what">${esc(what)}</span><span class="expr">${typeset(tidySeries(expr.replace(/\.\.\.$/, '')))}${trailing ? ' <span class="op">+</span> …' : ''}</span></p>`;
        if (/power series/i.test(what)) html += dimsTable(expr);
      }
    } else {
      const expr = lines.join('');
      html += `<p class="series-line"><span class="what">Hilbert series</span><span class="expr">${typeset(tidySeries(expr))}</span></p>`;
      html += dimsTable(expr, 'z');
    }
  }
  if (pb !== undefined) {
    const expr = pb.split('\n').map((l) => l.trim()).filter(Boolean).join('');
    html += `<p class="series-line"><span class="what">Poincaré–Betti series</span><span class="expr">${expr ? typeset(tidySeries(expr)) : '<span class="raw">empty</span>'}</span></p>`;
    if (!expr) html += '<p class="caption">bergman 1.001 leaves this file empty. Switch off legacy mode under More settings to get the series.</p>';
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
  let html = '<div class="dims" aria-label="Dimension in each degree">';
  for (let d = 0; d <= max; d++) html += `<div><span class="k">${d}</span><span class="v">${coef.get(d) ?? 0}</span></div>`;
  return html + '</div>';
}

function renderBetti(a, res) {
  if (!a.table) return '<div class="empty"><p>bergman printed no Betti table.</p></div>';
  const { cols, rows } = a.table;
  let html = `<p class="summary">Betti numbers up to the maximal degree.${badge(res)}</p><div class="table-wrap"><table class="betti"><thead><tr><th scope="col"></th>`;
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
  html += '</tbody></table></div><p class="caption">Column <var>i</var> is the homological degree. The entry in row <var>r</var> is the Betti number <var>B</var>(<var>i</var>, <var>i</var> + <var>r</var>); a dash means zero.</p>';
  return html;
}

function renderResolution(a, res) {
  if (a.diffs.size === 0) return '<div class="empty"><p>bergman printed no differentials for this computation.</p></div>';
  let html = `<p class="summary">Anick chains and their differentials, as printed by bergman: each chain maps to a sum of chain ⊗ algebra element.${badge(res)}</p><div class="chains">`;
  for (const [i, list] of [...a.diffs.entries()].sort((x, y) => x[0] - y[0])) {
    html += `<section><h3><span class="d"><var>D</var>(${i}, ·)</span> on ${list.length} chain${list.length === 1 ? '' : 's'}</h3>`;
    for (const d of list) html += `<p class="tensor-line"><span class="chain">${typesetWord(d.chain)}</span><span class="arrow">↦</span>${typesetTensor(d.image)}</p>`;
    html += '</section>';
  }
  return html + '</div>';
}

function codeBlock(name, text, { download = true } = {}) {
  return `<div class="file"><div class="file-head"><span class="name">${esc(name)}</span>` +
    `<button type="button" class="quiet small" data-copy="${esc(name)}">Copy</button>` +
    (download ? `<button type="button" class="quiet small" data-download="${esc(name)}">Download</button>` : '') +
    `</div><pre class="code-block">${esc(text)}</pre></div>`;
}

let fileContents = new Map();

function renderFiles(job, files) {
  const names = Object.keys(files);
  for (const n of names) fileContents.set(n, files[n]);
  $('filesOut').innerHTML = names.length
    ? names.map((n) => codeBlock(n, files[n])).join('')
    : '<div class="empty"><p>No output files yet.</p></div>';
}

function renderLog(job, stdout) {
  fileContents.set('input.bg', job.files['input.bg']);
  fileContents.set('session.lsp', job.script);
  fileContents.set('terminal.txt', stdout);
  $('logOut').innerHTML = codeBlock('input.bg', job.files['input.bg']) + codeBlock('session.lsp', job.script) +
    (stdout ? codeBlock('terminal.txt', stdout, { download: false }) : '');
}

// ------------------------------------------------------------ copy and download

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Copied';
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

const term = $('terminal');
const history = [];
let histPos = 0;

function termWrite(text, cls) {
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  term.append(span);
  term.scrollTop = term.scrollHeight;
}

async function runLine(line) {
  termWrite(`1 lisp> ${line}\n`, 'in');
  consoleBusy(true);
  try { await engine.eval(line, (e) => termWrite(e.text, 'note')); }
  catch (error) { termWrite(`${error.message}\n`, 'note'); }
  finally { consoleBusy(false); }
}

function consoleBusy(busy) {
  $('promptForm').querySelector('button').disabled = busy;
  $('promptInput').disabled = busy;
  $('pasteJob').disabled = busy;
  $('stopConsole').hidden = !busy;
}
$('stopConsole').addEventListener('click', () => engine.cancel());

$('promptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const inp = $('promptInput');
  const line = inp.value.trim();
  if (!line) return;
  history.push(line); histPos = history.length;
  inp.value = '';
  await runLine(line);
});
$('promptInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && histPos > 0) { histPos--; e.target.value = history[histPos]; e.preventDefault(); }
  if (e.key === 'ArrowDown') { histPos = Math.min(history.length, histPos + 1); e.target.value = history[histPos] ?? ''; e.preventDefault(); }
});
$('clearTerm').addEventListener('click', () => { term.textContent = ''; });
$('pasteJob').addEventListener('click', async () => {
  try {
    const { ok, form: f, anyNonhomog } = validate();
    if (!ok) throw new Error('Fix the presentation fields first.');
    const job = buildJob({ ...f, nonhomog: f.nonhomog === 'auto' ? (anyNonhomog ? 'itemwise' : 'degreewise') : f.nonhomog });
    termWrite(`% input.bg\n${job.files['input.bg']}\n${job.script}`, 'in');
    consoleBusy(true);
    const result = await engine.run(job, (e) => termWrite(e.text, 'note'));
    renderFiles(job, result.files);
  } catch (error) { termWrite(`${error.message}\n`, 'note'); }
  finally { consoleBusy(false); }
});

// ------------------------------------------------------------ views

function route() {
  const v = (location.hash || '#compute').slice(1);
  const view = ['compute', 'console', 'about'].includes(v) ? v : 'compute';
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== `view-${view}`;
  for (const a of document.querySelectorAll('.views a')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

// ------------------------------------------------------------ init

async function init() {
  fillPresets();
  fillTasks();
  fillOrders();
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.form) {
      writeForm(saved.form);
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
    const prev = els.preset.value;
    applyPreset();
    if (snapshot() !== cur) { loadedExample = null; els.preset.value = prev; }
  }

  els.form.addEventListener('input', (e) => {
    if (e.target === els.preset || e.target === els.presetN) return;
    refresh();
  });
  els.form.addEventListener('change', (e) => {
    if (e.target === els.preset || e.target === els.presetN) { applyPreset(); return; }
    if (e.target.name === 'ring') fillOrders();
    refresh();
  });
  els.form.addEventListener('submit', compute);
  els.stop.addEventListener('click', () => { engine.cancel(); running = false; els.go.disabled = false; els.stop.hidden = true; setStatus('Stopped.'); });
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
  window.addEventListener('hashchange', route);
  route();
  try {
    const info = await engine.init();
    $('engineNote').textContent = `bergman is ready (${info.version}).`;
    $('engineNote').classList.add('live');
  } catch (error) {
    $('engineNote').textContent = `Engine unavailable: ${error.message}`;
  }
}

init();
