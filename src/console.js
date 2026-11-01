// The Lisp console: a multi-line editor with highlighting, bracket
// matching, completion, persistent history and a help catalogue, over the
// engine's persistent bergman session.
import { tokenize, balance, matchAt, symbolBefore, enclosingHead, complete, indentAt } from './lisp.js';
import { GROUPS, COMMANDS, BY_NAME, COMPLETIONS, expandShortcut, parseHelp, parseHelpTexts } from './console-commands.js';
import { t, tn, getLanguage, translateMessage } from './i18n.js';

const HISTORY_KEY = 'george.console.history.v1';
const HISTORY_MAX = 200;
const CHIPS = ['(help)', '(files)', '(printsetup)', '(noncommify)', '(setmaxdeg 6)', '(simple "input.bg" "out.gb")', '(show "out.gb")'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const describe = (c) => c[getLanguage()] ?? c.en;
const signature = (c) => `(${c.name}${c.args ? ' ' + c.args : ''})`;

let helpTexts = new Map();
let helpLoad;
function loadHelpTexts() {
  helpLoad ??= fetch(new URL('../vendor/bergman/helptexts', import.meta.url))
    .then((r) => (r.ok ? r.text() : ''))
    .then((text) => { helpTexts = parseHelpTexts(text); })
    .catch(() => {});
  return helpLoad;
}
const candidates = () => [...COMPLETIONS, ...helpTexts.keys()];
const known = (name) => BY_NAME.has(name) || helpTexts.has(name);

// Syntax-highlighted HTML for the source; the ghost completion is drawn at the cursor.
export function highlight(src, { cursor = -1, ghost = '' } = {}) {
  const toks = tokenize(src);
  const pair = cursor >= 0 ? matchAt(src, cursor, toks) : null;
  let html = '';
  let pending = ghost;
  const flushGhost = (pos) => {
    if (pending && pos === cursor) { html += `<span class="ghost">${esc(pending)}</span>`; pending = ''; }
  };
  flushGhost(0);
  for (const tok of toks) {
    const text = src.slice(tok.start, tok.end);
    let cls = '';
    if (tok.type === 'open' || tok.type === 'close') {
      cls = `br d${tok.depth % 4}`;
      if (tok.stray || (tok.type === 'open' && tok.match < 0)) cls += ' br-bad';
      if (pair && pair.includes(tok.start)) cls += ' br-pair';
    } else if (tok.type === 'string') cls = 'k-str';
    else if (tok.type === 'comment') cls = 'k-com';
    else if (tok.type === 'number') cls = 'k-num';
    else if (tok.type === 'quote') cls = 'k-q';
    else if (tok.type === 'symbol') {
      const name = tok.text.toLowerCase();
      if (name === 't' || name === 'nil' || name.startsWith(':')) cls = 'k-const';
      else if (known(name)) cls = 'k-cmd';
    }
    html += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
    flushGhost(tok.end);
  }
  return html;
}

// Friendly hints after common Lisp errors.
const bare = (s) => s.replace(/^[^:\s]*::?/, '').replace(/^\|(.*)\|$/, '$1').toLowerCase();
function errorHint(line) {
  let m = /The function (\S+?)\.? is undefined/i.exec(line);
  if (m) return t('console.hint.undefined', { name: esc(bare(m[1])) });
  m = /The variable (\S+?)\.? is unbound/i.exec(line);
  if (m) return t('console.hint.unbound', { name: esc(bare(m[1])) });
  if (/cannot open|can't open|no such file|does not exist/i.test(line)) return t('console.hint.file');
  return null;
}

export function initConsole({ $, engine, storage, runCurrent }) {
  const term = $('terminal');
  const input = $('promptInput');
  const hl = $('promptHl');
  const sig = $('promptSig');
  const bal = $('promptBal');
  const label = $('promptLabel');
  const chips = $('consoleChips');
  let busy = false;
  let enabled = true;
  let count = 1;
  let ghost = '';
  let dismissed = null;
  let nav = null; // { list, pos, draft } while browsing history
  let history = [];
  try { history = JSON.parse(storage?.getItem(HISTORY_KEY) ?? '[]').filter((s) => typeof s === 'string'); } catch { history = []; }

  function remember(src) {
    history = history.filter((s) => s !== src);
    history.push(src);
    if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
    try { storage?.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* storage unavailable */ }
  }

  // ---------------------------------------------------------- output

  function scroll() { term.scrollTop = term.scrollHeight; }
  function write(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    term.append(span);
    scroll();
  }
  function writeHTML(html, cls) {
    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = html;
    term.append(div);
    scroll();
  }
  function echo(src) {
    writeHTML(`<span class="prompt-echo">${count} lisp&gt; </span>${highlight(src)}`, 'in');
  }
  // Bergman output streams in whole lines; errors are coloured, with a hint.
  function writeOutput(text) {
    for (const line of text.split(/(?<=\n)/)) {
      if (/^Error:/.test(line)) {
        write(line, 'o-err');
        const hint = errorHint(line);
        if (hint) writeHTML(hint, 'o-tip');
      } else if (/^\*{3,}/.test(line)) write(line, 'o-warn');
      else write(line, 'o-out');
    }
  }

  const cmd = (src, text = src) => `<button type="button" class="cmd" data-insert="${esc(src)}">${esc(text)}</button>`;
  function welcome() {
    writeHTML(t('console.welcome', {
      help: cmd('(help)'), topic: cmd('?simple'), files: cmd('(files)'), show: cmd('(show "out.gb")'),
    }), 'o-tip welcome');
  }

  // ---------------------------------------------------------- help

  async function showHelp(name) {
    await loadHelpTexts();
    if (!name) {
      let html = `<p>${t('console.help.intro')}</p>`;
      for (const group of GROUPS) {
        const names = COMMANDS.filter((c) => c.group === group.id);
        html += `<p><b>${esc(group[getLanguage()] ?? group.en)}</b><br>${names.map((c) => cmd('?' + c.name, c.name)).join(' ')}</p>`;
      }
      const topics = [...helpTexts.keys()].filter((k) => !BY_NAME.has(k));
      if (topics.length) {
        html += `<details><summary>${t('console.help.topics', { n: topics.length })}</summary><p>${topics.map((k) => cmd('?' + k, k)).join(' ')}</p></details>`;
      }
      html += `<p class="keys">${t('console.help.keys')}</p>`;
      writeHTML(html, 'o-help');
      return;
    }
    const c = BY_NAME.get(name);
    const text = helpTexts.get(name);
    if (!c && !text) {
      const near = [...new Set([...COMPLETIONS, ...helpTexts.keys()])].filter((k) => k.includes(name) || (name.length > 3 && name.includes(k) && k.length > 3)).slice(0, 12);
      writeHTML(`<p>${t('console.help.none', { name: esc(name) })}${near.length ? ' ' + t('console.help.near') + ' ' + near.map((k) => cmd('?' + k, k)).join(' ') : ''}</p>`, 'o-help');
      return;
    }
    let html = '';
    if (c) {
      html += `<p><code class="sig-name">${esc(signature(c))}</code> — ${esc(describe(c))}</p>`;
      html += `<p>${t('console.help.example')} ${cmd(c.ex)}</p>`;
    } else html += `<p><code class="sig-name">${esc(name)}</code></p>`;
    if (text) html += `<p class="src">${t('console.help.bergman')}</p><pre>${esc(text)}</pre>`;
    writeHTML(html, 'o-help');
  }

  // ---------------------------------------------------------- evaluation

  // "setmaxdeg 6" becomes "(setmaxdeg 6)" when the first word is a command.
  function wrapBare(src) {
    const m = /^([A-Za-z][\w*-]*)(\s|$)/.exec(src);
    return m && !/^[('"`?]/.test(src) && known(m[1].toLowerCase()) && !['t', 'nil'].includes(m[1].toLowerCase()) ? `(${src})` : src;
  }

  async function submit(force = false) {
    if (busy || !enabled) return;
    const raw = input.value.trim();
    if (!raw) return;
    const b = balance(raw);
    if (!force && !b.complete && !parseHelp(raw)) { status(true); return; }
    const src = wrapBare(raw);
    remember(raw);
    nav = null;
    setValue('');
    echo(src);
    count++;
    label.textContent = `${count} lisp>`;
    const help = parseHelp(src);
    if (help) { await showHelp(help.name); return; }
    await evaluate(expandShortcut(src) ?? src);
  }

  async function evaluate(src) {
    setBusy(true);
    let streamed = false;
    const onEvent = (e) => {
      streamed = true;
      writeOutput(e.text);
    };
    try {
      await engine.eval(src, onEvent);
    } catch (error) {
      if (error.name === 'AbortError') write(`${t('status.stopped')}\n`, 'o-warn');
      else if (error.code === 'timeout') write(`${t('status.timeout')}\n`, 'o-warn');
      else {
        // The worker's message is a summary followed by the last output lines,
        // which have been shown already when they streamed.
        const [first, ...rest] = error.message.split('\n');
        const detail = rest.join('\n').trim();
        if (!streamed && detail) writeOutput(detail + '\n');
        if (first === 'Bergman evaluation failed.') { if (!streamed && !detail) write(`${t('console.failed')}\n`, 'o-err'); }
        else write(`${translateMessage(first)}\n`, 'o-err');
      }
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value) {
    busy = value;
    $('promptForm').querySelector('button[type=submit]').disabled = value || !enabled;
    $('pasteJob').disabled = value || !enabled;
    input.disabled = !enabled;
    for (const button of chips.querySelectorAll('button')) button.disabled = !enabled;
    $('stopConsole').hidden = !value;
    status();
  }

  // ---------------------------------------------------------- editor

  function setValue(value, cursor = value.length) {
    input.value = value;
    input.setSelectionRange(cursor, cursor);
    render();
  }
  // Inserting through execCommand keeps the browser's undo history.
  function insert(text, select = 0) {
    input.focus();
    if (!document.execCommand('insertText', false, text)) input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
    if (select) input.setSelectionRange(input.selectionStart - select, input.selectionStart - select);
    render();
  }

  function suggestion() {
    const { value: src, selectionStart: at, selectionEnd } = input;
    if (at !== selectionEnd || document.activeElement !== input) return '';
    // No completion inside a string or a comment.
    if (tokenize(src.slice(0, at)).some((tk) => (tk.type === 'string' && !tk.closed) || (tk.type === 'comment' && tk.end === at))) return '';
    const sym = symbolBefore(src, at);
    if (sym && !sym.text.startsWith('?')) {
      const word = complete(sym.text, candidates());
      if (word) return word.slice(sym.text.length);
    }
    const q = /\?([\w*-]{2,})$/.exec(src.slice(0, at));
    if (q && at === src.length) {
      const word = complete(q[1], candidates());
      if (word) return word.slice(q[1].length);
    }
    const before = src.slice(0, at);
    const after = src.slice(at);
    if (before.trim().length < 2 || /\n/.test(after.replace(/\)*\s*$/, ''))) return '';
    for (let k = history.length - 1; k >= 0; k--) {
      const h = history[k];
      if (h.length > src.length && h.startsWith(before) && h.endsWith(after)) return h.slice(before.length, h.length - after.length);
    }
    return '';
  }

  function render() {
    const src = input.value;
    ghost = suggestion();
    if (dismissed === src + '\u0000' + input.selectionStart) ghost = '';
    hl.innerHTML = highlight(src, { cursor: input.selectionStart, ghost }) + '\n';
    input.style.height = 'auto';
    // A hidden console measures 0; keep the natural one-row height then.
    input.style.height = input.scrollHeight ? `${input.scrollHeight}px` : '';
    status();
  }

  function status(pressed = false) {
    const src = input.value;
    const at = input.selectionStart;
    let c = null;
    const sym = symbolBefore(src, at);
    if (ghost && sym) c = BY_NAME.get((sym.text + ghost).toLowerCase());
    c ??= BY_NAME.get(enclosingHead(src, at, undefined, (name) => BY_NAME.has(name)) ?? '');
    if (c) sig.innerHTML = `<code>${esc(signature(c))}</code> ${esc(describe(c))} <span class="more">${t('console.sig.more', { name: esc(c.name) })}</span>`;
    else sig.textContent = src.trim() ? '' : t('console.keys');
    const b = balance(src);
    let msg = '';
    let cls = 'bal';
    if (busy) msg = t('console.busy');
    else if (b.stray.length) { msg = t('console.stray'); cls += ' bad'; }
    else if (b.unterminated) { msg = t('console.unterminated'); cls += ' bad'; }
    else if (b.open && !parseHelp(src)) { msg = tn('console.missing', b.open); cls += pressed ? ' bad' : ''; }
    bal.textContent = msg;
    bal.className = cls;
  }

  function accept() {
    if (!ghost) return false;
    let text = ghost;
    const sym = symbolBefore(input.value, input.selectionStart);
    const c = sym && BY_NAME.get((sym.text + ghost).toLowerCase());
    if (c?.args && input.value[input.selectionStart] !== ' ') text += ' ';
    insert(text);
    return true;
  }

  function browse(dir) {
    if (!nav) {
      const draft = input.value;
      const prefix = draft.trim();
      nav = { list: history.filter((h) => h.startsWith(prefix)), draft };
      nav.pos = nav.list.length;
    }
    const pos = nav.pos + dir;
    if (pos < 0 || pos > nav.list.length) return;
    nav.pos = pos;
    const value = pos === nav.list.length ? nav.draft : nav.list[pos];
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    render();
  }

  input.addEventListener('keydown', (e) => {
    const { value: src, selectionStart: a, selectionEnd: z } = input;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && !e.isComposing) {
      if (e.shiftKey) { e.preventDefault(); insert('\n' + indentAt(src, a)); return; }
      e.preventDefault();
      if (mod || balance(src).complete || parseHelp(src)) { submit(mod); return; }
      if (!src.trim()) return;
      insert('\n' + indentAt(src, a));
      status(true);
      return;
    }
    if ((e.key === 'Tab' && !e.shiftKey) || (e.key === 'ArrowRight' && a === z && ghost && !mod)) {
      if (accept()) e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && ghost) { dismissed = src + '\u0000' + a; e.preventDefault(); render(); return; }
    if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); term.textContent = ''; return; }
    if (e.key === 'ArrowUp' && !src.slice(0, a).includes('\n') && !e.shiftKey) { e.preventDefault(); browse(-1); return; }
    if (e.key === 'ArrowDown' && !src.slice(z).includes('\n') && !e.shiftKey) { e.preventDefault(); browse(1); return; }
    if (mod || e.altKey) return;
    const next = src[z];
    const inString = tokenize(src.slice(0, a)).some((tk) => tk.type === 'string' && !tk.closed);
    if (e.key === '(' && !inString) {
      e.preventDefault();
      if (a !== z) insert(`(${src.slice(a, z)})`);
      else if (next === undefined || /[\s)]/.test(next)) insert('()', 1);
      else insert('(');
    } else if (e.key === ')' && next === ')' && a === z && !inString) {
      e.preventDefault(); input.setSelectionRange(a + 1, a + 1); render();
    } else if (e.key === '"') {
      e.preventDefault();
      if (inString && next === '"' && a === z) { input.setSelectionRange(a + 1, a + 1); render(); }
      else if (inString) insert('"');
      else if (a !== z) insert(`"${src.slice(a, z)}"`);
      else insert('""', 1);
    } else if (e.key === 'Backspace' && a === z && a > 0 && ((src[a - 1] === '(' && next === ')') || (src[a - 1] === '"' && next === '"'))) {
      e.preventDefault();
      input.setSelectionRange(a - 1, a + 1);
      insert('');
    }
  });
  input.addEventListener('input', () => { nav = null; render(); });
  for (const type of ['click', 'keyup', 'focus', 'blur', 'select']) input.addEventListener(type, (e) => {
    if (type === 'keyup' && !/^Arrow|Home|End|Page/.test(e.key)) return;
    render();
  });
  input.addEventListener('scroll', () => { hl.scrollTop = input.scrollTop; });

  $('promptForm').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  $('stopConsole').addEventListener('click', () => engine.cancel());
  $('clearTerm').addEventListener('click', () => { term.textContent = ''; input.focus(); });
  $('pasteJob').addEventListener('click', async () => {
    if (busy || !enabled) return;
    let job;
    try { job = runCurrent.build(); } catch (error) { write(`${error.message}\n`, 'o-err'); return; }
    writeHTML(`<span class="prompt-echo">% input.bg</span>\n${highlight(job.files['input.bg'])}\n${highlight(job.script)}`, 'in');
    setBusy(true);
    try {
      const result = await engine.run(job, (e) => writeOutput(e.text));
      runCurrent.done(job, result.files);
      writeHTML(t('console.current.done', { files: cmd('(files)') }), 'o-tip');
    } catch (error) {
      if (error.name === 'AbortError') write(`${t('status.stopped')}\n`, 'o-warn');
      else if (error.code === 'timeout') write(`${t('status.timeout')}\n`, 'o-warn');
      else write(`${translateMessage(error.message.split('\n')[0])}\n`, 'o-err');
    } finally { setBusy(false); }
  });

  // Command buttons in the transcript: ?name runs help, anything else goes into the editor.
  term.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-insert]');
    if (!button) return;
    const src = button.dataset.insert;
    if (src.startsWith('?')) { echo(src); count++; label.textContent = `${count} lisp>`; showHelp(src.slice(1)); return; }
    place(src);
  });
  chips.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-insert]');
    if (button) place(button.dataset.insert);
  });
  // Put an example in the editor with the cursor on its first argument.
  function place(src) {
    const quote = src.indexOf('"');
    const space = src.indexOf(' ');
    const cursor = quote > 0 ? quote + 1 : space > 0 ? space + 1 : src.length;
    input.focus();
    setValue(src, cursor);
    if (quote > 0) input.setSelectionRange(quote + 1, src.indexOf('"', quote + 1));
    render();
  }

  function renderChips() {
    chips.innerHTML = CHIPS.map((src) => `<button type="button" class="chip" data-insert="${esc(src)}">${esc(src)}</button>`).join('');
  }
  renderChips();
  welcome();
  render();
  loadHelpTexts().then(render);

  return {
    setEnabled(value) {enabled = value; setBusy(busy);},
    updateLanguage() { renderChips(); setBusy(busy); render(); },
    // The prompt can only be measured while the view is visible.
    shown() { render(); },
  };
}
