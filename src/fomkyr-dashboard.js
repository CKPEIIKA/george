// A live fomkyr dashboard for the Console view, modelled on the native
// terminal dashboard (fomkyr/tools/dashboard.py). It only reads the progress
// events the engine already sends; nothing here affects the computation.
import { esc } from './bergman-syntax.js';

const HISTORY = 900; // throughput points kept (~15 min at the engine's 1 s cadence)
const RENDER_MS = 500;

const clock = (s) => {
  s = Math.max(0, Math.floor(s ?? 0));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
};
export function shortDuration(s) {
  if (s === null || s === undefined || !Number.isFinite(s)) return '?';
  if (s > 0 && s < 10) return `${s.toFixed(1)}s`;
  s = Math.max(0, Math.round(s));
  if (s >= 100 * 3600) return '>99h';
  const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60;
  if (d) return `${d}d${String(h).padStart(2, '0')}h`;
  if (h) return `${h}h${String(m).padStart(2, '0')}m`;
  return m ? `${m}m${String(sec).padStart(2, '0')}s` : `${sec}s`;
}
const bytes = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—'
  : Number(n) >= 1 << 30 ? `${(Number(n) / 2 ** 30).toFixed(1)} GiB` : `${Math.round(Number(n) / 2 ** 20)} MiB`);
const percent = (f) => `${(100 * f).toFixed(f > 0 && f < 0.1 ? 1 : 0)}%`;
const clamp = (f) => Math.min(1, Math.max(0, f ?? 0));

function meter(fraction, kind = '', label = '') {
  const f = clamp(fraction);
  return `<span class="fk-meter ${kind}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100 * f)}"${label ? ` aria-label="${esc(label)}"` : ''}><span style="width:${(100 * f).toFixed(2)}%"></span></span>`;
}

// Throughput over time: a 2px line, a light wash and an end dot. Each point
// has a hover title; the axis shows only zero and the peak.
function lineChart(values, { label, unit, format }) {
  // A 5-sample moving average: overlaps finish in bursts between samples.
  const raw = values.map((x) => (Number.isFinite(x) ? x : 0));
  const v = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 2), i + 3); return w.reduce((a, b) => a + b, 0) / w.length; });
  const w = 600, h = 120, pad = 6, top = Math.max(...v) || 1;
  const x = (i) => pad + (i / (v.length - 1)) * (w - 2 * pad), y = (val) => h - pad - (val / top) * (h - 2 * pad);
  const line = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  const step = (w - 2 * pad) / Math.max(1, v.length - 1);
  const hits = v.map((val, i) => `<rect x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${h}"><title>${esc(format(Math.round(val)))} ${esc(unit)}</title></rect>`).join('');
  return `<div class="fk-chart"><span class="fk-axis top">${esc(format(Math.round(top)))}</span><span class="fk-axis bottom">0</span>` +
    `<div class="fk-plotarea"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">` +
    `<line class="grid" x1="0" x2="${w}" y1="${h - pad}" y2="${h - pad}"/>` +
    `<polygon class="wash" points="${x(0)},${h - pad} ${line} ${x(v.length - 1)},${h - pad}"/>` +
    `<polyline class="line" points="${line}"/><g class="hits">${hits}</g></svg>` +
    `<span class="fk-dot" style="left:${(x(v.length - 1) / w * 100).toFixed(2)}%;top:${(y(v.at(-1)) / h * 100).toFixed(2)}%"></span></div></div>`;
}

// Time per degree: capped columns from one baseline; the running degree is a
// wash up to its projection. Values on the last column and the tallest one.
function columnChart(rows, { format }) {
  const height = (r) => r.projected ?? r.seconds;
  const top = Math.max(...rows.map(height), 1e-9);
  const tallest = rows.reduce((a, r) => (height(r) > height(a) ? r : a), rows[0]);
  return '<div class="fk-columns-chart">' + rows.map((r, i) => {
    const solid = clamp(r.seconds / top), wash = r.projected ? clamp(r.projected / top) : 0;
    const labelled = r === tallest || i === rows.length - 1;
    const title = `d${r.degree}: ${shortDuration(r.seconds)}` + (r.projected ? ` → ~${shortDuration(r.projected)}` : '') + (r.basis !== undefined ? ` · ${format(r.basis)}` : '');
    return `<div class="fk-col${r.projected ? ' current' : ''}" title="${esc(title)}">` +
      `<span class="fk-col-value">${labelled ? esc(r.projected ? '~' + shortDuration(r.projected) : shortDuration(r.seconds)) : ''}</span>` +
      `<span class="fk-col-track">${wash ? `<span class="wash" style="height:${(100 * wash).toFixed(1)}%"></span>` : ''}<span class="bar" style="height:${Math.max(1, 100 * solid).toFixed(1)}%"></span></span>` +
      `<span class="fk-col-label">${r.degree}</span></div>`;
  }).join('') + '</div>';
}

export class FomkyrDashboard {
  constructor(root, t, format = (n) => String(n)) {
    this.root = root; this.t = t; this.format = format;
    this.timer = null; this.logOpen = false;
    this.reset(null);
    // The engine log keeps its open/closed state across re-renders.
    root?.addEventListener('toggle', (e) => { if (e.target.classList?.contains('fk-logbox')) this.logOpen = e.target.open; }, true);
  }

  reset(job) {
    this.job = job; this.state = job ? 'running' : 'idle'; this.message = ''; this.outcome = null;
    this.started = performance.now(); this.finished = null;
    this.progress = null; this.capabilities = null; this.memoryPlan = null; this.memoryBytes = null;
    this.degrees = []; this.warnings = []; this.closures = []; this.log = [];
    this.rates = []; this.lastResolved = null; this.lastAt = null; this.lastDegree = null;
  }

  start(job) { this.reset(job); this.render(true); }

  // outcome: the Results chip ({state, text, hint}) for the finish banner.
  finish(state, message = '', outcome = null) {
    if (!this.job || this.state !== 'running') return;
    this.state = state; this.message = message; this.outcome = outcome; this.finished = performance.now();
    this.render(true);
  }

  event(e) {
    if (!this.job || this.state !== 'running') return;
    if (e.type === 'stdout') { this.log.push(...e.text.split('\n').filter(Boolean)); this.log = this.log.slice(-200); }
    else if (e.type === 'progress') this.sample(e);
    else if (e.type === 'capabilities') this.capabilities = e;
    else if (e.type === 'memory-plan') this.memoryPlan = e;
    else if (e.type === 'memory') this.memoryBytes = e.bytes;
    else if (e.type === 'degree' && e.completedThroughDegree) {
      if (!this.degrees.some((d) => d.degree === e.completedThroughDegree))
        this.degrees.push({ degree: e.completedThroughDegree, seconds: Number.isFinite(e.elapsedMs) ? e.elapsedMs / 1000 : null, basis: e.basisSize });
    }
    else if (e.type === 'warning') { this.warnings.push(e.message); this.warnings = this.warnings.slice(-5); }
    else if (/closure/.test(e.type)) this.closures.push(e);
    this.render();
  }

  sample(p) {
    this.progress = p;
    const resolved = Number(p.overlaps?.resolved ?? 0), now = performance.now();
    if (this.lastAt !== null && p.currentDegree === this.lastDegree && resolved >= this.lastResolved && now > this.lastAt)
      this.rates.push((resolved - this.lastResolved) * 60000 / (now - this.lastAt));
    else if (this.lastAt !== null) this.rates.push(0);
    this.lastAt = now; this.lastResolved = resolved; this.lastDegree = p.currentDegree;
    if (this.rates.length > HISTORY) this.rates.shift();
  }

  // Rough overall projection: extrapolate the growth of time per degree.
  projection() {
    const p = this.progress, eta = p?.eta;
    const target = Number(this.job?.degreeBound) || null;
    if (!p || !target || !Number.isFinite(eta?.centralSeconds)) return null;
    const times = [...(p.history ?? []).map((h) => h.elapsedMs / 1000)];
    times.push((p.degreeElapsedMs ?? 0) / 1000 + eta.centralSeconds);
    const ratios = times.slice(1).map((x, i) => (times[i] > 1 ? x / times[i] : null)).filter(Boolean).slice(-3).sort((a, b) => a - b);
    if (!ratios.length) return null;
    const ratio = Math.max(1, ratios[Math.floor(ratios.length / 2)]);
    let last = times.at(-1), total = eta.centralSeconds;
    for (let d = p.currentDegree + 1; d <= target; d++) { last *= ratio; total += last; }
    return { seconds: total, ratio };
  }

  render(now = false) {
    if (!this.root) return;
    if (!now) {
      if (this.timer) return;
      this.timer = setTimeout(() => { this.timer = null; this.render(true); }, RENDER_MS);
      return;
    }
    clearTimeout(this.timer); this.timer = null;
    this.root.innerHTML = this.html();
  }

  html() {
    const t = this.t, f = this.format, p = this.progress, running = this.state === 'running';
    if (!this.job) return `<div class="fk-empty"><p>${esc(t('dash.empty'))}</p></div>`;
    const elapsed = ((this.finished ?? performance.now()) - this.started) / 1000;
    const target = Number(this.job.degreeBound) || null;
    const degree = p?.currentDegree || this.degrees.at(-1)?.degree || null;
    const done = Math.max(p?.completedThroughDegree ?? 0, this.degrees.at(-1)?.degree ?? 0);
    const total = p?.overlaps?.total !== null && p?.overlaps?.total !== undefined ? Number(p.overlaps.total) : null;
    const resolved = Number(p?.overlaps?.resolved ?? 0);
    // A degree closed by dimension evidence skips its last overlaps.
    const closedEarly = !!(p && total && resolved < total && (p.fkGate?.closedDegrees >= degree || p.hilbertClosureEvent?.degree === degree || done >= degree));
    const fraction = total ? (closedEarly ? 1 : resolved / total) : null;
    const eta = running ? p?.eta : null;
    const projection = running ? this.projection() : null;
    let overall = this.state === 'finished' ? 1 : null;
    if (overall === null && projection) overall = elapsed / (elapsed + projection.seconds);
    else if (overall === null && target) overall = Math.min(1, (done + (degree > done ? fraction ?? 0 : 0)) / target);
    const budget = Number(this.job.memoryMiB) * 1048576;
    const memoryShare = this.memoryBytes && budget ? this.memoryBytes / budget : null;
    const basis = this.degrees.at(-1)?.basis;
    const caps = this.capabilities;
    const chip = { running: 'dash.running', finished: 'dash.finished', stopped: 'dash.stopped', error: 'dash.error' }[this.state];

    let html = `<div class="fk-head"><span class="fk-chip" data-state="${this.state}">${esc(t(chip))}</span>` +
      (p && running ? `<span class="fk-phase">${esc(t('dash.phase.' + (p.phase ?? 'initializing')))}</span>` : '') +
      (caps ? `<span class="fk-muted">wasm${caps.bits} · ${esc(t('dash.workers', { n: caps.workers }))} · ${esc(caps.ioMode ?? '')}</span>` : '') + '</div>';

    // Finish banner
    if (this.state === 'finished') {
      const confetti = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      html += `<div class="fk-finish"><span class="fk-confetti" aria-hidden="true">${confetti}</span>` +
        `<span class="fk-finish-mark" aria-hidden="true">✓</span><div><p class="fk-finish-title">${esc(t('dash.done', { degree: done, time: shortDuration(elapsed) }))}</p>` +
        `<p class="fk-finish-sub">${basis !== undefined ? esc(t('dash.rules', { n: f(basis) })) : ''}` +
        (this.outcome ? ` <span class="fk-outcome" data-state="${esc(this.outcome.state)}">${esc(this.outcome.text)}</span> ${esc(this.outcome.hint ?? '')}` : '') + '</p></div></div>';
    } else if (this.state === 'stopped' || this.state === 'error') {
      html += `<div class="fk-finish ${this.state}"><span class="fk-finish-mark" aria-hidden="true">${this.state === 'error' ? '!' : '■'}</span><div><p class="fk-finish-title">${esc(this.message || t(chip))}</p>` +
        `<p class="fk-finish-sub">${esc(t('dash.stoppedSub', { degree: done }))}</p></div></div>`;
    }

    // Stat tiles; the remaining time is the headline while running.
    const remaining = projection ? projection.seconds : eta?.centralSeconds;
    const reducing = ['reducing', 'committing'].includes(p?.phase);
    const tiles = [
      running ? [t('dash.remaining'), Number.isFinite(remaining) ? '~' + shortDuration(remaining) : '—',
        projection ? t('dash.toTarget', { target }) : Number.isFinite(remaining) ? t('dash.thisDegree')
          : p && !reducing ? t('dash.phase.' + (p.phase ?? 'initializing')) : t('dash.estimating'), 'hero']
        : [t('dash.total'), shortDuration(elapsed), t(chip), 'hero'],
      [t('dash.elapsed'), clock(elapsed), caps ? t('dash.workers', { n: caps.workers }) : ''],
      [t('dash.degreeTile'), degree ? (target ? `${degree} / ${target}` : String(degree)) : '—', t('dash.completedThrough', { d: done })],
      [t('dash.overlapsTile'), total ? f(resolved) : '—', total ? t('dash.ofTotal', { total: f(total) }) : t('dash.thisDegree')],
      [t('dash.basis'), basis !== undefined ? f(basis) : '—', t('dash.rulesUnit')],
    ];
    html += '<div class="fk-tiles">' + tiles.map(([label, value, sub, kind = '']) =>
      `<div class="fk-tile ${kind}"><span class="fk-tile-label">${esc(label)}</span><span class="fk-tile-value">${esc(value)}</span><span class="fk-tile-sub">${esc(sub)}</span></div>`).join('') +
      `<div class="fk-tile"><span class="fk-tile-label">${esc(t('dash.memory'))}</span><span class="fk-tile-value">${bytes(this.memoryBytes)}</span>` +
      `${meter(memoryShare, memoryShare > 0.9 ? 'warn' : '', t('dash.memory'))}<span class="fk-tile-sub">${esc(t('dash.ofBudget', { budget: bytes(budget) }))}</span></div></div>`;

    // Progress
    html += `<section class="fk-block"><h2>${esc(t('dash.progress'))}</h2>`;
    html += `<div class="fk-progress"><div class="fk-progress-head"><span>${esc(t('dash.overall'))}</span><span class="fk-num">${overall === null ? esc(t('dash.noTarget')) : percent(overall)}</span></div>${meter(overall, 'overall', t('dash.overall'))}` +
      `<p class="fk-sub">${esc(target ? t('dash.degreeOf', { d: degree ?? '—', target }) : t('dash.degree', { d: degree ?? '—' }))}` +
      (projection ? ` · ${esc(t('dash.rough', { ratio: projection.ratio.toFixed(2) }))}` : '') + '</p></div>';
    if (fraction !== null) {
      const range = eta?.currentDegreeSeconds;
      html += `<div class="fk-progress"><div class="fk-progress-head"><span>${esc(t('dash.degree', { d: degree }))}</span><span class="fk-num">${percent(fraction)}</span></div>${meter(fraction, 'degree', t('dash.degree', { d: degree }))}` +
        `<p class="fk-sub">${esc(t('dash.overlaps', { resolved: f(resolved), total: f(total) }))}` +
        (closedEarly && resolved < total ? ' · ' + esc(t('dash.closedEarly', { n: f(total - resolved) })) : '') +
        (Number.isFinite(eta?.centralSeconds) ? ` · <b>${esc(t('dash.eta', { eta: shortDuration(eta.centralSeconds) }))}</b>` +
          (range && range[1] > range[0] * 1.2 ? ` (${shortDuration(range[0])}–${shortDuration(range[1])})` : '') +
          (eta.observedSeconds ? ` · ${esc(t('dash.observed', { span: shortDuration(eta.observedSeconds) }))}` : '') : '') + '</p></div>';
      if (running && reducing && eta?.reason && (!Number.isFinite(eta.centralSeconds) || eta.stalled)) html += `<p class="fk-reason">${esc(eta.reason)}</p>`;
    } else if (running) html += `<p class="fk-reason">${esc(t('dash.waiting'))}</p>`;
    const gate = p?.fkGate;
    if (gate?.enabled) html += `<p class="fk-reason">${esc(t('dash.fkGate', { closed: gate.closedSectors ?? 0, deficit: gate.deficit ?? '—', through: gate.closedDegrees ?? 0 }))}</p>`;
    if (p?.hilbertClosure) html += `<p class="fk-reason">${esc(t('dash.closure', { d: p.hilbertClosure.degree, upper: p.hilbertClosure.upper, lower: p.hilbertClosure.lower, gap: p.hilbertClosure.gap }))}</p>`;
    html += '</section>';

    // Charts
    const rows = this.degrees.filter((d) => d.seconds !== null).slice(-16);
    if (running && degree && !rows.some((r) => r.degree === degree) && Number.isFinite(p?.eta?.centralSeconds))
      rows.push({ degree, seconds: (p.degreeElapsedMs ?? 0) / 1000, projected: (p.degreeElapsedMs ?? 0) / 1000 + p.eta.centralSeconds });
    html += '<div class="fk-charts">' +
      `<section class="fk-block"><h2>${esc(t('dash.rate'))}</h2>${this.rates.length > 1 ? lineChart(this.rates, { label: t('dash.rate'), unit: t('dash.rateUnit'), format: f }) : `<p class="fk-muted">${esc(t('dash.noRate'))}</p>`}</section>` +
      `<section class="fk-block"><h2>${esc(t('dash.perDegree'))}</h2>${rows.length ? columnChart(rows, { format: (n) => t('dash.rules', { n: f(n) }) }) : `<p class="fk-muted">${esc(t('dash.noDegrees'))}</p>`}</section></div>`;

    // Health
    const issues = [];
    if (running && p?.eta?.stalled) issues.push(['info', t('dash.longReduction')]);
    if (memoryShare > 0.9) issues.push(['warn', t('dash.memoryHigh', { p: percent(memoryShare) })]);
    for (const w of this.warnings) issues.push(['warn', w]);
    html += `<section class="fk-block"><h2>${esc(t('dash.health'))}</h2><ul class="fk-health">` +
      (issues.length ? issues.map(([k, m]) => `<li class="${k}"><span class="fk-icon" aria-hidden="true">${k === 'warn' ? '!' : 'i'}</span>${esc(m)}</li>`).join('')
        : `<li class="ok"><span class="fk-icon" aria-hidden="true">✓</span>${esc(t('dash.healthy'))}</li>`) + '</ul>' +
      (this.memoryPlan ? `<p class="fk-muted">${esc(t('dash.plan', { scratch: bytes(this.memoryPlan.ordinaryScratchBytes), reserve: bytes(this.memoryPlan.rowReserveBytes) }))}</p>` : '') + '</section>';

    // Lanes
    const lanes = running ? [...(p?.activity?.lanes ?? [])].sort((a, b) => Number(b.terms) - Number(a.terms)) : [];
    // Big-row columns appear only while some lane actually holds a big row.
    const big = lanes.some((l) => l.bigRow?.capacity || l.bigRow?.coefficientPoolBytes);
    if (lanes.length) html += `<section class="fk-block"><h2>${esc(t('dash.lanes'))}</h2><div class="table-wrap"><table class="fk-lanes"><thead><tr>` +
      ['dash.lane', 'dash.pair', 'dash.tier', 'dash.terms', ...(big ? ['dash.capacity', 'dash.pool'] : [])].map((k) => `<th scope="col">${esc(t(k))}</th>`).join('') + '</tr></thead><tbody>' +
      lanes.slice(0, 32).map((l) => `<tr><td>${l.lane}</td><td>${l.pair ? `${l.pair.leftRule}/${l.pair.rightRule}` : '—'}</td><td>${esc(l.tier ?? '')}</td>` +
        `<td>${f(Number(l.terms))}</td>` + (big ? `<td>${f(l.bigRow?.capacity ?? 0)}</td><td>${bytes(l.bigRow?.coefficientPoolUsedBytes)} / ${bytes(l.bigRow?.coefficientPoolBytes)}</td>` : '') + '</tr>').join('') +
      '</tbody></table></div></section>';

    // Engine log, collapsed by default
    if (this.log.length) html += `<details class="fk-block fk-logbox"${this.logOpen ? ' open' : ''}><summary>${esc(t('dash.log'))} <span class="fk-muted">${this.log.length}</span></summary>` +
      `<pre class="fk-log">${esc(this.log.slice(-40).join('\n'))}</pre></details>`;
    return html;
  }
}
