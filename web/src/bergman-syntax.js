// Bergman input/output syntax: parsing relations, typesetting polynomials,
// reading bergman input files, and generating the bergman session script
// for a computation.  No DOM access here except building HTML strings.
import { BACKENDS, validMemoryMiB, memoryLimitMessage, defaultMemoryMiB } from './backends.js';
import { backendCapabilities, backendSettingsErrors, backendRelationErrors } from './backend-capabilities.js';
import { fomkyrEngineOptions } from './fomkyr-options.js';
import { timeoutMilliseconds } from './time-limit.js';

// ------------------------------------------------------------ tokens

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i; while (j < src.length && /[0-9]/.test(src[j])) j++;
      toks.push({ t: 'num', v: src.slice(i, j), at: i }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: 'id', v: src.slice(i, j), at: i }); i = j; continue;
    }
    if ('+-*^().[]{},=/'.includes(c)) { toks.push({ t: 'op', v: c, at: i }); i++; continue; }
    if (c === '−') { toks.push({ t: 'op', v: '-', at: i }); i++; continue; }
    throw new SyntaxError(`Unexpected character “${c}”`);
  }
  return toks;
}

// ------------------------------------------------------------ generators

export function parseVars(text) {
  const names = text.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
  const errors = [];
  const seen = new Set();
  for (const n of names) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) errors.push(`“${n}” is not a valid generator name. Use a letter followed by letters or digits.`);
    else if (seen.has(n)) errors.push(`“${n}” is listed twice.`);
    seen.add(n);
  }
  return { names, errors };
}

// ------------------------------------------------------------ relations

// A relation is a list of terms { sign: 1|-1, coef: string (digits), factors: [{ v, e }] }.
// Juxtaposed single-letter generators ("xyx") are accepted and expanded.

export function splitRelations(text) {
  // Bergman separates relations by commas and ends the list with ';'.
  // Commas inside [a,b] and {a,b} belong to the bracket, not the list.
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && depth > 0) depth--;
    else if (i === text.length || (depth === 0 && (c === ',' || c === ';' || c === '\n'))) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return out.filter(Boolean);
}

// Physics notation: [A,B] = AB − BA, {A,B} = AB + BA and one “=”.
// The relation is expanded into a sum of monomials with like terms combined.
const SUGAR = /[[\]{}=]/;
const MAX_EXPANDED_TERMS = 100000;
const MAX_BRACKET_POWER = 64;

function parseSugar(toks, expandId, maxExponent) {
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  // A polynomial maps a word key to { word: [{v, e}], coef: BigInt }.
  const add = (p, q, s = 1n) => {
    const r = new Map(p);
    for (const [k, m] of q) {
      const c = (r.get(k)?.coef ?? 0n) + s * m.coef;
      if (c) r.set(k, { word: m.word, coef: c }); else r.delete(k);
    }
    return r;
  };
  const concat = (a, b) => {
    if (!a.length) return b;
    if (!b.length) return a;
    const last = a[a.length - 1];
    return last.v === b[0].v ? [...a.slice(0, -1), { v: last.v, e: last.e + b[0].e }, ...b.slice(1)] : [...a, ...b];
  };
  const key = (w) => w.map((f) => `${f.v}^${f.e}`).join(' ');
  const mul = (p, q) => {
    let r = new Map();
    for (const a of p.values()) for (const b of q.values()) {
      const word = concat(a.word, b.word);
      r = add(r, new Map([[key(word), { word, coef: a.coef * b.coef }]]));
      if (r.size > MAX_EXPANDED_TERMS) throw new SyntaxError('The expanded relation is too large');
    }
    return r;
  };
  const one = () => new Map([['', { word: [], coef: 1n }]]);
  const exponent = () => {
    i++;
    const n = peek();
    if (!n || n.t !== 'num') throw new SyntaxError('Exponents must be non-negative integers');
    const e = Number(n.v); i++;
    if (!Number.isSafeInteger(e) || e > maxExponent) throw new SyntaxError(`Exponents must be integers from 0 to ${maxExponent}`);
    return e;
  };
  const power = (p, e) => { let r = one(); for (let k = 0; k < e; k++) r = mul(r, p); return r; };
  function factor() {
    const tk = peek();
    if (!tk) throw new SyntaxError('A term is missing after an operator');
    if (tk.t === 'num') { i++; return new Map([['', { word: [], coef: BigInt(tk.v) }]]); }
    if (tk.t === 'id') {
      const names = expandId(tk);
      i++;
      const e = isOp('^') ? exponent() : 1;
      let word = [];
      names.forEach((v, k) => { const n = k === names.length - 1 ? e : 1; if (n) word = concat(word, [{ v, e: n }]); });
      return new Map([[key(word), { word, coef: 1n }]]);
    }
    if (tk.t === 'op' && (tk.v === '[' || tk.v === '{')) {
      const close = tk.v === '[' ? ']' : '}';
      i++;
      const a = sum([',']);
      if (!isOp(',')) throw new SyntaxError(`Write ${tk.v}A, B${close} with two entries`);
      i++;
      const b = sum([close]);
      if (!isOp(close)) throw new SyntaxError(`Close the bracket with “${close}”`);
      i++;
      const r = add(mul(a, b), mul(b, a), tk.v === '[' ? -1n : 1n);
      if (!isOp('^')) return r;
      const e = exponent();
      if (e > MAX_BRACKET_POWER) throw new SyntaxError(`Exponents must be integers from 0 to ${MAX_BRACKET_POWER}`);
      return power(r, e);
    }
    if (tk.t === 'op' && (tk.v === '(' || tk.v === ')')) throw new SyntaxError('bergman reads relations as sums of monomials: expand the brackets first');
    if (tk.t === 'op' && tk.v === '.') throw new SyntaxError('Coefficients must be integers');
    if (tk.t === 'op' && tk.v === '^') throw new SyntaxError('“^” must follow a generator');
    throw new SyntaxError(`Unexpected “${tk.v}”`);
  }
  function product() {
    let r = factor();
    while (peek() && !(peek().t === 'op' && '+-,]}='.includes(peek().v))) {
      if (isOp('*')) {
        i++;
        const next = peek();
        if (!next || !(['id', 'num'].includes(next.t) || next.v === '[' || next.v === '{')) throw new SyntaxError('A multiplication sign must have a factor on each side');
      }
      r = mul(r, factor());
    }
    return r;
  }
  function sum(stops) {
    let r = new Map();
    let first = true;
    while (peek() && !(peek().t === 'op' && stops.includes(peek().v))) {
      let s = 1n;
      while (isOp('+') || isOp('-')) { if (peek().v === '-') s = -s; i++; }
      if (!peek() || (peek().t === 'op' && stops.includes(peek().v))) throw new SyntaxError('A term is missing after an operator');
      r = add(r, product(), s);
      first = false;
    }
    if (first) throw new SyntaxError('A term is missing after an operator');
    return r;
  }
  let p = sum(['=', ',', ']', '}']);
  if (isOp('=')) { i++; p = add(p, sum(['=', ',', ']', '}']), -1n); }
  if (i < toks.length) throw new SyntaxError(`Unexpected “${peek().v}”`);
  if (p.size === 0) throw new SyntaxError('The relation expands to zero');
  return [...p.values()].map(({ word, coef }) => ({ sign: coef < 0n ? -1 : 1, coef: (coef < 0n ? -coef : coef).toString(), factors: word }));
}

export function parseRelation(src, vars, maxExponent = 10000) {
  const toks = tokenize(src);
  const varSet = new Set(vars);
  const single = vars.every((v) => v.length === 1);
  const terms = [];
  let i = 0;
  const peek = () => toks[i];
  const expandId = (tok) => {
    if (varSet.has(tok.v)) return [tok.v];
    if (single && [...tok.v].every((ch) => varSet.has(ch))) return [...tok.v];
    throw new SyntaxError(`“${tok.v}” is not one of the generators`);
  };
  if (toks.length === 0) throw new SyntaxError('Empty relation');
  if (SUGAR.test(src)) return parseSugar(toks, expandId, maxExponent);
  while (i < toks.length) {
    let sign = 1;
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      if (peek().v === '-') sign = -sign;
      i++;
    }
    let coef = '1';
    const factors = [];
    let seen = false;
    while (i < toks.length) {
      const tk = peek();
      if (tk.t === 'op' && (tk.v === '+' || tk.v === '-')) break;
      if (tk.t === 'op' && tk.v === '*') {
        const next = toks[i + 1];
        if (!seen || toks[i - 1]?.v === '*' || !next || !['id', 'num'].includes(next.t)) {
          throw new SyntaxError('A multiplication sign must have a factor on each side');
        }
        i++; continue;
      }
      if (tk.t === 'op' && (tk.v === '(' || tk.v === ')')) {
        throw new SyntaxError('bergman reads relations as sums of monomials: expand the brackets first');
      }
      if (tk.t === 'op' && tk.v === '.') throw new SyntaxError('Coefficients must be integers');
      if (tk.t === 'op' && tk.v === '^') throw new SyntaxError('“^” must follow a generator');
      if (tk.t === 'num') {
        if (factors.length > 0) throw new SyntaxError('Put the coefficient before the generators');
        coef = (BigInt(coef) * BigInt(tk.v)).toString();
        seen = true;
        i++; continue;
      }
      if (tk.t === 'id') {
        const names = expandId(tk);
        i++;
        let e = 1;
        if (peek() && peek().t === 'op' && peek().v === '^') {
          i++;
          const n = peek();
          if (!n || n.t !== 'num') throw new SyntaxError('Exponents must be non-negative integers');
          e = Number(n.v); i++;
          if (!Number.isSafeInteger(e) || e > maxExponent) throw new SyntaxError(`Exponents must be integers from 0 to ${maxExponent}`);
        }
        for (let k = 0; k < names.length - 1; k++) factors.push({ v: names[k], e: 1 });
        factors.push({ v: names[names.length - 1], e });
        seen = true;
        continue;
      }
      throw new SyntaxError(`Unexpected “${tk.v}”`);
    }
    if (!seen) throw new SyntaxError('A term is missing after an operator');
    terms.push({ sign, coef, factors: factors.filter((f) => f.e > 0) });
  }
  return terms;
}

export function termDegree(term, weights) {
  let d = 0;
  for (const f of term.factors) d += f.e * (weights.get(f.v) ?? 1);
  return d;
}

export function isHomogeneous(terms, weights) {
  const ds = new Set(terms.map((t) => termDegree(t, weights)));
  return ds.size <= 1;
}

// Bergman's algebraic input form of a relation.
export function toBergman(terms) {
  let s = '';
  terms.forEach((t, k) => {
    const neg = t.sign < 0;
    if (k === 0) { if (neg) s += '-'; } else s += neg ? '-' : '+';
    const mon = t.factors.map((f) => (f.e === 1 ? f.v : `${f.v}^${f.e}`)).join('*');
    if (!mon) s += t.coef;
    else if (t.coef === '1') s += mon;
    else s += `${t.coef}*${mon}`;
  });
  return s;
}

// ------------------------------------------------------------ typesetting

// A generator name with trailing digits gets them as a subscript: b0 → b₀,
// a_12 → a₁₂. Names with a longer letter part stay as one upright-spaced unit.
export function varHTML(name) {
  const m = /^([A-Za-z][A-Za-z_]*?)_?(\d+)$/.exec(name);
  const base = m ? m[1] : name;
  const html = `<var>${esc(base)}</var>${m ? `<sub>${m[2]}</sub>` : ''}`;
  return base.replace(/_/g, '').length > 1 ? `<span class="var-long">${html}</span>` : html;
}

// Multiplies a printed polynomial by −1 when its leading coefficient is
// negative, so a basis element reads with a positive leading term.
export function positiveLeading(src) {
  const s = src.trim();
  if (!s.startsWith('-')) return s;
  let depth = 0;
  let out = '';
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    out += depth === 0 && (c === '+' || c === '-') ? (c === '+' ? '-' : '+') : c;
  }
  return out.replace(/^\+/, '');
}

// Which generator is largest. bergman ranks the last listed generator
// highest in its noncommutative degree orders, and the first one highest in
// the elimination and commutative orders; a matrix order compares the
// columns of the matrix. Returns the names from largest to smallest.
export function variableOrder(form) {
  const names = form.reverseVars ? [...form.vars].reverse() : [...form.vars];
  if (form.order === 'matrix') {
    const rows = String(form.matrix || '').trim().split('\n').map((r) => r.trim().split(/[\s,]+/).map(Number));
    if (rows.length !== names.length || rows.some((r) => r.length !== names.length || r.some((v) => !Number.isSafeInteger(v)))) return null;
    const column = (j) => rows.map((r) => r[j]);
    const compare = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return b[k] - a[k]; return 0; };
    const order = names.map((name, j) => ({ name, col: column(j) })).sort((a, b) => compare(a.col, b.col));
    if (order.some((x, k) => k && compare(order[k - 1].col, x.col) === 0)) return null;
    return order.map((x) => x.name);
  }
  return form.ring === 'noncomm' && ['degleftlex', 'homogelim'].includes(form.order) ? names.reverse() : names;
}

// Typesets a bergman output expression such as "-2*y*x^2+x^3" or
// "+t^3*(2*z^2+2*z^3)".  With lead, the first term is marked as the
// leading monomial.
export function typeset(src, { lead = false } = {}) {
  let toks;
  try { toks = tokenize(src.replace(/\s+/g, '')); } catch { return `<span class="raw">${esc(src)}</span>`; }
  let html = '';
  let term = 0;
  let depth = 0;
  let open = false;
  const startTerm = () => {
    if (lead && term === 0 && depth === 0) { html += '<mark class="lm">'; open = true; }
  };
  const endTerm = () => { if (open) { html += '</mark>'; open = false; } };
  let prev = null;
  let atTermStart = true;
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.t === 'op' && (tk.v === '+' || tk.v === '-') && depth === 0) {
      endTerm();
      if (prev !== null) term++;
      const sym = tk.v === '-' ? '−' : '+';
      html += (prev === null) ? (tk.v === '-' ? '<span class="op sign">−</span>' : '') : `<span class="op">${sym}</span>`;
      atTermStart = true;
      prev = tk;
      continue;
    }
    if (atTermStart) { startTerm(); atTermStart = false; }
    if (tk.t === 'op') {
      if (tk.v === '(') depth++;
      if (tk.v === ')') depth--;
      if (tk.v === '*') {
        // multiplication is shown by juxtaposition, except between two numbers
        const nx = toks[i + 1];
        if (prev && prev.t === 'num' && nx && nx.t === 'num') html += '<span class="op times">·</span>';
        prev = tk; continue;
      }
      if (tk.v === '^') {
        const nx = toks[i + 1];
        if (nx) { html += `<sup>${esc(nx.v)}</sup>`; i++; prev = nx; continue; }
      }
      if (tk.v === '+' || tk.v === '-') { html += `<span class="op">${tk.v === '-' ? '−' : '+'}</span>`; prev = tk; continue; }
      html += `<span class="paren">${esc(tk.v)}</span>`;
      prev = tk; continue;
    }
    const base = tk.t === 'num' ? `<span class="num">${esc(tk.v)}</span>` : varHTML(tk.v);
    if (toks[i + 1]?.v === '^' && toks[i + 2]) {
      const exponent = toks[i + 2];
      html += `<span class="math-power">${base}<sup>${esc(exponent.v)}</sup></span>`;
      i += 2; prev = exponent; continue;
    }
    html += base;
    prev = tk;
  }
  endTerm();
  return html || '<span class="num">0</span>';
}

export function typesetTerms(terms) {
  return typeset(toBergman(terms));
}

// ------------------------------------------------------------ bergman output files

// Parse a Groebner basis output file ("% 2\nx*y,\n   y^2,\n   \nDone").
export function parseBasis(text) {
  const groups = [];
  let cur = null;
  let buf = '';
  const flush = () => {
    if (!cur) return;
    for (const p of buf.split(',').map((s) => s.trim()).filter(Boolean)) cur.polys.push(p);
    buf = '';
  };
  let done = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = /^%\s*(\d+)\s*$/.exec(line);
    // Itemwise output repeats the degree header for every element.
    if (m) {
      flush();
      cur = groups.find((g) => g.deg === Number(m[1]));
      if (!cur) { cur = { deg: Number(m[1]), polys: [] }; groups.push(cur); }
      continue;
    }
    if (line === 'Done') { flush(); done = true; continue; }
    if (line.startsWith('%')) continue;
    if (cur) buf += line;
  }
  flush();
  groups.sort((a, b) => a.deg - b.deg);
  return { groups, done };
}

// Parse the anick resolution output (D(i, chain)=... lines, B(i,j)=n lines,
// and the printed Betti tables).  The last printed table is the result.
export function parseAnick(text) {
  const diffs = new Map();
  const betti = new Map();
  let lastTable = null;
  const lines = text.split('\n');
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    let m = /^D\((\d+),\s*([^)]*)\)=(.*)$/.exec(line);
    if (m) {
      const i = Number(m[1]);
      if (!diffs.has(i)) diffs.set(i, []);
      const list = diffs.get(i);
      if (!list.some((d) => d.chain === m[2])) list.push({ chain: m[2], image: m[3] });
      continue;
    }
    m = /^B\((\d+),(\d+)\)=(\d+)$/.exec(line.trim());
    if (m) { betti.set(`${m[1]},${m[2]}`, Number(m[3])); continue; }
    if (/^\s+\+-+$/.test(line) && k > 0) {
      const cols = lines[k - 1].trim().split(/\s+/);
      const rows = [];
      let r = k + 1;
      while (r < lines.length && /^\s*\d+\s*\|/.test(lines[r])) {
        const [lbl, rest] = lines[r].split('|');
        rows.push({ label: lbl.trim(), cells: rest.trim().split(/\s+/) });
        r++;
      }
      lastTable = { cols, rows };
    }
  }
  return { diffs, betti, table: lastTable };
}

// Render a chain or a tensor such as "xx^2.y+xy.x" (chain . algebra element).
export function typesetTensor(src) {
  return src.split(/(?=[+-])/).map((part) => {
    const m = /^([+-]?)(.*)$/.exec(part);
    const sign = m[1] === '-' ? '<span class="op">−</span>' : (m[1] === '+' ? '<span class="op">+</span>' : '');
    const [chain, elt] = m[2].split('.');
    const chainHtml = `<span class="chain">${typesetWord(chain)}</span>`;
    if (elt === undefined) return sign + chainHtml;
    return `${sign}${chainHtml}<span class="op tensor">⊗</span>${elt === '1' ? '<span class="num">1</span>' : typesetWord(elt)}`;
  }).join('');
}

// Words like "xx^2y" (as printed in anick output): a letter, optionally ^n.
export function typesetWord(w) {
  let html = '';
  const re = /([0-9]+)|([A-Za-z_][0-9]*)(\^([0-9]+))?/g;
  let m;
  while ((m = re.exec(w))) {
    if (m[1]) html += `<span class="num">${m[1]}</span>`;
    else html += `${varHTML(m[2])}${m[4] ? `<sup>${m[4]}</sup>` : ''}`;
  }
  return html || esc(w);
}

// ------------------------------------------------------------ bergman input files

// Read a bergman input file (mode commands followed by (ALGFORMINPUT) and
// "vars ...; relations;") into form settings.
export function readInputFile(text) {
  const st = { settings: {}, vars: [], rels: [] };
  const lines = text.split('\n').filter((l) => !/^\s*%/.test(l));
  const body = lines.join('\n');
  const cmds = [...body.matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => m[1].trim());
  for (const c of cmds) {
    const [head, ...args] = c.split(/\s+/);
    const h = head.toUpperCase();
    if (h === 'COMMIFY') st.settings.ring = 'comm';
    else if (h === 'NONCOMMIFY') st.settings.ring = 'noncomm';
    else if (h === 'SETMAXDEG') st.settings.maxdeg = args[0].toUpperCase() === 'NIL' ? '' : args[0];
    else if (h === 'SETMODULUS') st.settings.modulus = args[0];
    else if (h === 'SETWEIGHTS') st.settings.weights = args.join(' ');
    else if (h === 'MATRIXIFY') st.settings.order = 'matrix';
    else if (h === 'ELIMORDER') st.settings.order = 'elim';
    else if (h === 'SETQ' && args[0]) {
      const v = args[0].toUpperCase();
      if (v === 'NMODGEN') st.settings.nmodgen = Number(args[1]);
      if (v === 'NLMODGEN') st.settings.nlmodgen = Number(args[1]);
      if (v === 'NRMODGEN') st.settings.nrmodgen = Number(args[1]);
      if (v === 'MAXSERDEG') st.settings.maxserdeg = args[1];
    } else if (h === 'SETRABBIT') st.settings.rabbit = args.join(' ');
  }
  const alg = body.split(/\(ALGFORMINPUT\)/i)[1] ?? '';
  const vm = /vars\s+([^;]*);([\s\S]*)$/i.exec(alg);
  if (vm) {
    st.vars = vm[1].split(',').map((s) => s.trim()).filter(Boolean);
    const relText = vm[2].split(';')[0];
    st.rels = relText.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return st;
}

// ------------------------------------------------------------ session scripts

export const ORDERS = {
  noncomm: [
    { id: 'degleftlex', label: 'Degree, then left lexicographic', cmd: 'DEGLEFTLEXIFY' },
    { id: 'elim', label: 'Elimination', cmd: 'ELIMORDER' },
    { id: 'homogelim', label: 'Homogeneous elimination', cmd: 'HOMOGELIMORDER' },
    { id: 'invelim', label: 'Inverse elimination', cmd: 'INVELIMORDER' },
    { id: 'invwelim', label: 'Inverse weighted elimination', cmd: 'INVWELIMORDER' },
  ],
  comm: [
    { id: 'degrevlex', label: 'Degree reverse lexicographic', cmd: 'DEGREVLEXIFY' },
    { id: 'deglex', label: 'Degree lexicographic', cmd: 'DEGLEXIFY' },
    { id: 'purelex', label: 'Pure lexicographic', cmd: 'PURELEXIFY' },
    { id: 'matrix', label: 'Matrix order', cmd: 'MATRIXIFY' },
  ],
};

// Computations offered, mapped to bergman top-level procedures.
export const TASKS = [
  { id: 'gb', group: 'Bases and series', label: 'Gröbner basis', button: 'Compute Gröbner basis',
    desc: 'Reduced Gröbner basis, degree by degree.', proc: 'SIMPLE', out: ['gb'] },
  { id: 'hilbert', group: 'Bases and series', label: 'Gröbner basis and Hilbert series', button: 'Compute basis and series',
    desc: 'Hilbert series of the quotient, as a rational function and as a power series.', proc: 'HILBERT', out: ['gb', 'hs'], ring: 'comm' },
  { id: 'ncpbh', group: 'Bases and series', label: 'Hilbert and Poincaré–Betti series', button: 'Compute basis and series',
    desc: 'Gröbner basis, Hilbert series and the double Poincaré–Betti series.', proc: 'NCPBHGROEBNER', out: ['gb', 'pb', 'hs'] },
  { id: 'anick', group: 'Resolutions', label: 'Anick resolution', button: 'Compute Anick resolution',
    desc: 'Chains, differentials and Betti numbers of the trivial module.', proc: 'ANICK', out: ['gb', 'anick'], ring: 'noncomm' },
  { id: 'rmodule', group: 'Resolutions', label: 'Right module Betti numbers', button: 'Compute Betti numbers',
    desc: 'The last generators are module generators.', proc: 'MODULEBETTINUMBERS', out: ['gb', 'anick'], ring: 'noncomm', module: 'right' },
  { id: 'lmodule', group: 'Resolutions', label: 'Left module Betti numbers', button: 'Compute Betti numbers',
    desc: 'The last generators are module generators.', proc: 'LEFTMODULEBETTINUMBERS', out: ['gb', 'anick'], ring: 'noncomm', module: 'left' },
  { id: 'twomod', group: 'Resolutions', label: 'Betti numbers for two modules', button: 'Compute Betti numbers',
    desc: 'A left and a right module over the same algebra.', proc: 'TWOMODBETTINUMBERS', out: ['gb', 'anick'], ring: 'noncomm', module: 'two' },
  { id: 'factalg', group: 'Resolutions', label: 'Factor-algebra Betti numbers', button: 'Compute Betti numbers',
    desc: 'Betti numbers of a factor-algebra, following bergman’s variable conventions.', proc: 'FACTALGBETTINUMBERS', out: ['gb', 'anick'], ring: 'noncomm' },
  { id: 'hochschild', group: 'Resolutions', label: 'Hochschild homology', button: 'Compute Hochschild homology',
    desc: 'Betti numbers of the Hochschild homology, following bergman’s variable conventions.', proc: 'HOCHSCHILD', out: ['gb', 'anick'], ring: 'noncomm' },
];

export const TASK_BY_ID = new Map(TASKS.map((t) => [t.id, t]));
export const DEFAULT_MEMORY_MIB = 2048;
// The wasm32 GC limit is a size_t; 4096 MiB itself cannot fit in 32 bits.
// This is an allowance, not a promise that all of it can be used as Lisp heap.
export const MAX_MEMORY_MIB = 4095;

export function exampleForm(ex) {
  const st=readInputFile(ex.input),s=st.settings,extra=ex.session||{};
  const ring=s.ring||TASK_BY_ID.get(ex.task).ring||'noncomm';
  return {ring,vars:st.vars,rels:st.rels,relsText:st.rels.join(',\n'),task:ex.task,
    field:s.modulus&&s.modulus!=='0'?(s.modulus==='2'?'2':'p'):'0',modulus:s.modulus&&s.modulus!=='2'?s.modulus:5,
    order:s.order||(ring==='comm'?'degrevlex':'degleftlex'),matrix:extra.matrix,maxdeg:s.maxdeg||'',
    weights:s.weights||extra.weights||'',nonhomog:extra.nonhomog||'auto',augmentation:'graded',
    strategy:s.rabbit?'rabbit':'default',rabbit:s.rabbit,maxserdeg:s.maxserdeg,
    nmodgen:s.nmodgen,nlmodgen:s.nlmodgen,nrmodgen:s.nrmodgen};
}

export function monomialPruningAvailable(form) {
  if (form.task !== 'gb' || form.ring !== 'noncomm' || form.nonhomog === 'itemwise' ||
      (form.strategy && form.strategy !== 'default') || (form.backend === 'fomkyr'
        ? String(form.weights || '').trim().split(/[\s,]+/).filter(Boolean).some(w => w !== '1') : String(form.weights || '').trim())) return false;
  try { return (form.rels || []).every(r => isHomogeneous(parseRelation(r, form.vars || [], form.backend === 'fomkyr' ? 0xfffffffe : 10000), new Map())); }
  catch { return false; }
}

export function validateSettings(form) {
  const errors = [];
  const integer = (v, min, max = 2147483647) => /^-?\d+$/.test(String(v)) && Number.isSafeInteger(Number(v)) && Number(v) >= min && Number(v) <= max;
  const n = form.vars?.length || 0;
  if (!TASK_BY_ID.has(form.task)) errors.push('Choose a computation.');
  if (!ORDERS[form.ring]?.some((o) => o.id === form.order)) errors.push('Choose an order for this algebra.');
  if (TASK_BY_ID.get(form.task)?.ring && TASK_BY_ID.get(form.task).ring !== form.ring) errors.push('This computation requires a different algebra type.');
  for (const [key, label] of [['maxdeg', 'Maximal degree'], ['maxserdeg', 'Series degree']]) {
    const maximum = form.backend === 'fomkyr' ? 0xfffffffe : 10000;
    if (form[key] !== undefined && form[key] !== '' && !integer(form[key], 1, maximum)) errors.push(`${label} must be an integer from 1 to ${maximum}.`);
  }
  if (!['0', '2', 'p'].includes(form.field)) errors.push('Choose a coefficient field.');
  const memoryBackend = Object.hasOwn(BACKENDS, form.backend ?? 'standard') ? form.backend ?? 'standard' : 'standard';
  if (form.memoryMiB !== undefined && (!/^\d+$/.test(String(form.memoryMiB)) || !validMemoryMiB(Number(form.memoryMiB), memoryBackend))) errors.push(memoryLimitMessage(memoryBackend));
  if (form.backend !== undefined && !Object.hasOwn(BACKENDS, form.backend)) errors.push('Unknown computation engine.');
  errors.push(...backendSettingsErrors(form, memoryBackend));
  const caps = backendCapabilities(memoryBackend);
  if (form.backend === 'fomkyr') {
    const weights = String(form.weights || '').trim().split(/[\s,]+/).filter(Boolean);
    if (weights.length && (weights.length !== n || weights.some(w => w !== '1'))) errors.push('Fomkyr requires unit generator degrees.');
    try { fomkyrEngineOptions(form); } catch (error) { errors.push(error.message); }
  }
  if (['fomkyr', 'native'].includes(form.backend) && !(form.backend === 'fomkyr' && form.fomkyrOptions?.execution === 'single')
      && form.nativeWorkers !== undefined && !integer(form.nativeWorkers, 0, 32)) errors.push('Worker count must be an integer from 0 to 32 (0 means automatic).');
  if (caps.homogeneous || caps.relationDegrees || caps.maximumCoefficient) {
    try {
      const parsed = (form.rels || []).map(r => parseRelation(r, form.vars || [], form.backend === 'fomkyr' ? 0xfffffffe : 10000));
      errors.push(...backendRelationErrors(parsed, memoryBackend));
    } catch { /* The normal input validation reports malformed relations. */ }
  }
  if (form.monomialPruning !== undefined && typeof form.monomialPruning !== 'boolean') errors.push('Monomial pruning must be on or off.');
  if (form.monomialPruning && !monomialPruningAvailable(form)) errors.push('Monomial pruning requires unweighted homogeneous noncommutative Gröbner basis relations and the default degreewise strategy.');
  try { timeoutMilliseconds(form.timeoutMinutes); } catch (error) { errors.push(error.message); }
  if (form.field === 'p') {
    const p = Number(form.modulus);
    let prime = integer(form.modulus, 2);
    for (let d = 2; prime && d * d <= p; d++) if (p % d === 0) prime = false;
    if (!prime) errors.push('The modulus must be a prime at most 2147483647.');
  }
  const weights = String(form.weights || '').trim().split(/[\s,]+/).filter(Boolean);
  if (weights.length && (weights.length !== n || weights.some((w) => !integer(w, 1, 10000)))) errors.push('Give one positive integer weight per generator (at most 10000).');
  if (form.order === 'matrix') {
    const rows = String(form.matrix || '').trim().split('\n').map((r) => r.trim().split(/[\s,]+/));
    if (rows.length !== n || rows.some((r) => r.length !== n || r.some((v) => !integer(v, -10000, 10000)))) errors.push('The order matrix must be square, with one integer column per generator.');
    else {
      const m = rows.map((r) => r.map(BigInt));
      let rank = 0;
      for (let col = 0; col < n; col++) {
        const pivot = m.findIndex((r, i) => i >= rank && r[col] !== 0n);
        if (pivot < 0) continue;
        [m[rank], m[pivot]] = [m[pivot], m[rank]];
        for (let i = rank + 1; i < n; i++) {
          const a = m[i][col], b = m[rank][col];
          for (let j = col; j < n; j++) m[i][j] = b * m[i][j] - a * m[rank][j];
        }
        rank++;
      }
      if (rank !== n) errors.push('The order matrix must have full rank.');
      if (rows[0].some((v) => Number(v) <= 0)) errors.push('Use a positive first row for the order matrix.');
    }
  }
  if (form.strategy === 'rabbit' && !String(form.rabbit || '').trim().split(/[\s,]+/).every((v) => integer(v, 1, 10000))) errors.push('Rabbit parameters must be positive integers.');
  const mod = TASK_BY_ID.get(form.task)?.module;
  if (mod && mod !== 'two' && !integer(form.nmodgen || 1, 1, n - 1)) errors.push('The module generator count must be positive and smaller than the total generator count.');
  if (mod === 'two' && (!integer(form.nlmodgen || 1, 1, n - 1) || !integer(form.nrmodgen || 1, 1, n - 1) || Number(form.nlmodgen || 1) + Number(form.nrmodgen || 1) >= n)) errors.push('Leave at least one algebra generator after the left and right module generators.');
  if (form.outmode && !['ALG', 'LISP', 'MACAULAY'].includes(form.outmode)) errors.push('Choose a supported output format.');
  return errors;
}

// Build the job for the engine: an input file and a session script.
export function buildJob(form) {
  const errors = validateSettings(form);
  if (errors.length) throw new Error(errors.join(' '));
  const vv = parseVars((form.vars || []).join(','));
  if (!vv.names.length || vv.errors.length) throw new Error(vv.errors.join(' ') || 'Enter generators.');
  const task = TASK_BY_ID.get(form.task);
  const parsed = form.rels.map((r) => parseRelation(r, form.vars, form.backend === 'fomkyr' ? 0xfffffffe : 10000));
  const weights = new Map(String(form.weights || '').trim().split(/[\s,]+/).filter(Boolean).map((w,i) => [form.vars[i], Number(w)]));
  const nonhomogeneous = parsed.some((r) => !isHomogeneous(r, weights));
  const augmentation = form.augmentation || 'graded';
  if (task.id === 'anick') {
    if (!['graded', 'monoid'].includes(augmentation)) throw new Error('Choose a valid augmentation.');
    const p = BigInt(form.field === '2' ? 2 : form.field === 'p' ? form.modulus : 0);
    for (const terms of parsed) {
      let value = terms.filter(t => augmentation === 'monoid' || !t.factors.length).reduce((s,t) => s + BigInt(t.sign) * BigInt(t.coef), 0n);
      if (p) value %= p;
      if (value) throw new Error(`The relations do not respect the ${augmentation} augmentation. Choose the other augmentation or change the relations.`);
    }
  }
  const extended = !form._resolutionStage && !form.legacy && task.id === 'anick' && (nonhomogeneous || form.nonhomog === 'itemwise' || augmentation === 'monoid');
  if (form.legacy && augmentation === 'monoid') throw new Error('Monoid augmentation requires default mode; original Bergman has no monoid augmentation setting.');
  const vars = form.reverseVars ? [...form.vars].reverse() : [...form.vars];
  const input = [];
  const session = [];
  if (task.module === 'right' || task.module === 'left') input.push(`(SETQ NMODGEN ${form.nmodgen || 1})`);
  if (task.module === 'two') {
    input.push(`(SETQ NLMODGEN ${form.nlmodgen || 1})`);
    input.push(`(SETQ NRMODGEN ${form.nrmodgen || 1})`);
  }
  input.push('(ALGFORMINPUT)');
  input.push(`vars ${vars.join(', ')};`);
  input.push(parsed.map(toBergman).join(',\n') + ';');

  session.push('% Generated by George');
  session.push(form.legacy ? '(SETLEGACYMODE T)' : '(SETLEGACYMODE NIL)');
  session.push(form.ring === 'comm' ? '(COMMIFY)' : '(NONCOMMIFY)');
  const orders = ORDERS[form.ring];
  const order = orders.find((o) => o.id === form.order) || orders[0];
  session.push(`(${order.cmd})`);
  if (order.id === 'matrix' && form.matrix) {
    const rows = form.matrix.trim().split('\n').map((r) => `(${r.trim().split(/[\s,]+/).join(' ')})`);
    session.push(`(SETORDERMATRIX (${rows.join(' ')}))`);
  }
  if (form.field === 'p') session.push(`(SETMODULUS ${form.modulus})`);
  else if (form.field === '2') session.push('(SETMODULUS 2)');
  else session.push('(SETMODULUS 0)');
  if (weights.size) session.push(`(SETWEIGHTS ${vars.map(v => weights.get(v)).join(' ')})`);
  session.push(`(SETMAXDEG ${form.maxdeg || (task.group === 'Resolutions' ? 6 : 'NIL')})`);
  if (form.nonhomog === 'itemwise' || (nonhomogeneous && !form._resolutionStage)) {
    session.push('(SETITEMWISE)', '(DESTABILISE)', '(SETSAFELOWTERMSHANDLING)');
  }
  if (form.strategy === 'rabbit' && form.rabbit) session.push(`(SETRABBIT ${form.rabbit.trim().split(/[\s,]+/).join(' ')})`);
  if (form.lowterms === 'safe' && form.nonhomog !== 'itemwise') session.push('(SETSAFELOWTERMSHANDLING)');
  // Pruning discards completed-degree lookup data. Only basis-file jobs use it;
  // resolutions and later polynomial reductions need the retained data.
  if (form.monomialPruning && form.backend !== 'fomkyr') session.push('(SETREDUCTIVITY NIL)');

  const files = { 'input.bg': input.join('\n') + '\n' };
  const outs = { gb: 'result.gb', hs: 'result.hs', pb: 'result.pb', anick: 'result.anick' };
  const q = (s) => `"${s}"`;
  switch (extended ? 'gb' : task.id) {
    case 'gb':
      if (form.strategy === 'rabbit') session.push(`(RABBIT ${q('input.bg')} ${q(outs.gb)})`);
      else session.push(`(SIMPLE ${q('input.bg')} ${q(outs.gb)})`);
      if (form.nonhomog === 'itemwise' || nonhomogeneous) session.push(`(GEORGEWRITEBASIS ${q(outs.gb)})`);
      break;
    case 'hilbert':
      if (form.maxserdeg) session.push(`(SETQ MAXSERDEG ${form.maxserdeg})`);
      session.push('(LOAD HSERIES)', `(HILBERT ${q('input.bg')} ${q(outs.gb)} ${q(outs.hs)})`);
      break;
    case 'ncpbh':
      session.push(`(NCPBHGROEBNER ${q('input.bg')} ${q(outs.gb)} ${q(outs.pb)} ${q(outs.hs)})`);
      break;
    default:
      if (['lmodule','factalg','hochschild'].includes(task.id)) session.push('(LOAD HSERIES)', '(SETRESOLUTIONTYPE ANICK)');
      session.push(`(SETQ ANICKRESOLUTIONOUTPUTFILE ${q(outs.anick)})`);
      session.push(`(${task.proc} ${q('input.bg')} ${q(outs.gb)})`);
      session.push('(CALCULATEANICKRESOLUTIONTOLIMIT (GETMAXDEG))', '(ANICKDISPLAY)');
      if (task.id === 'anick' && !form.legacy) session.push('(GEORGEWRITERESOLUTION "resolution.jsonl")');
  }
  if (form.outmode === 'MACAULAY') session.push('(SETALGOUTMODE MACAULAY)', '(GEORGEWRITEBASIS "result.macaulay")', '(SETALGOUTMODE ALG)');
  if (form.monomialPruning && form.backend !== 'fomkyr') session.push('(SETREDUCTIVITY T)');
  session.push('(CLEARRING)');
  const outputs = {};
  for (const k of extended ? ['gb'] : task.out) outputs[k] = outs[k];
  if (task.id === 'anick' && !form.legacy && !extended) outputs.resolution = 'resolution.jsonl';
  if (form.outmode === 'MACAULAY') outputs.macaulay = 'result.macaulay';
  const job = { task: task.id, files, script: session.join('\n') + '\n', outputs, legacy: !!form.legacy, degreeBound: form.maxdeg || (task.group === 'Resolutions' ? 6 : null), memoryMiB: Number(form.memoryMiB ?? defaultMemoryMiB(form.backend ?? 'standard')), backend: form.backend ?? 'standard' };
  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);
  if (job.backend === 'native') job.nativeOptions = {workers: Number(form.nativeWorkers) || undefined};
  if (job.backend === 'fomkyr') {
    job.fomkyrOptions = fomkyrEngineOptions(form);
    if (job.fomkyrOptions.hilbert) job.outputs.hs = 'result.hs';
  }
  if (extended) {
    job.resolution = { form: { ...form, augmentation }, nonhomogeneous };
    job.outputs.anick = outs.anick; // produced by the second stage
  }
  return job;
}

// What the result display needs to know about a job's presentation. Kept out
// of the job itself, which is exactly what the engines receive.
export function jobFacts(form, job) {
  const task = TASK_BY_ID.get(form.task);
  const parsed = form.rels.map((r) => parseRelation(r, form.vars, form.backend === 'fomkyr' ? 0xfffffffe : 10000));
  const weights = new Map(String(form.weights || '').trim().split(/[\s,]+/).filter(Boolean).map((w, i) => [form.vars[i], Number(w)]));
  const homogeneous = parsed.every((r) => isHomogeneous(r, weights));
  const facts = {
    resolutionTask: task.group === 'Resolutions',
    // Such runs write their basis with GEORGEWRITEBASIS, whose Done marker
    // already certifies that no critical pair was cut off by the bound.
    itemwise: form.nonhomog === 'itemwise' || !homogeneous,
    weighted: [...weights.values()].some((w) => w !== 1),
    seriesBound: task.id === 'hilbert' ? form.maxserdeg || null : task.id === 'ncpbh' ? job.degreeBound : null,
  };
  // Degreewise homogeneous runs can certify completeness from degrees alone.
  if (homogeneous && form.nonhomog !== 'itemwise' && (form.strategy || 'default') === 'default' && !facts.resolutionTask) {
    facts.certificate = {
      relationDegree: Math.max(0, ...parsed.flatMap((terms) => terms.map((term) => termDegree(term, weights)))),
      minWeight: Math.min(...form.vars.map((v) => weights.get(v) ?? 1)),
    };
  }
  return facts;
}

// Apply x = u + 1 over the integers. This preserves leading words in the
// degree orders; it identifies monoid augmentation with u -> 0.
export function shiftRelations(rels, vars) {
  return rels.map(relation => {
    const total = new Map();
    for (const term of parseRelation(relation, vars)) {
      let terms = new Map([['', BigInt(term.sign) * BigInt(term.coef)]]);
      for (const factor of term.factors) for (let e = 0; e < factor.e; e++) {
        const next = new Map(terms);
        for (const [w,c] of terms) { const key = w ? `${w}*${factor.v}` : factor.v; next.set(key, (next.get(key) || 0n) + c); }
        if (next.size > 50000) throw new Error('The augmentation expansion is too large. Reduce the presentation.');
        terms = next;
      }
      for (const [w,c] of terms) total.set(w, (total.get(w) || 0n) + c);
    }
    return [...total].filter(([,c]) => c).map(([w,c]) => `${c < 0n ? '' : '+'}${c}${w ? '*' + w : ''}`).join('') || '0';
  });
}

export function resolutionJob(job, text) {
  const f = job.resolution.form;
  const basis = parseBasis(text);
  if (!basis.done) throw new Error('A completed Gröbner basis is required for a nonhomogeneous resolution.');
  let rels = basis.groups.flatMap(g => g.polys);
  if (f.augmentation === 'monoid') rels = shiftRelations(rels, f.vars);
  const next = buildJob({ ...f, rels: rels.length ? rels : ['0'], augmentation: 'graded', nonhomog: 'degreewise', lowterms: 'safe', _resolutionStage: true });
  next.script = '(SETDEGREEWISE)\n(STABILISE)\n(SETNORESOLUTION)\n' + next.script.replaceAll('input.bg', 'resolution-input.bg').replaceAll('result.gb', 'resolution.gb');
  next.files = { 'resolution-input.bg': next.files['input.bg'] };
  next.outputs.gb = 'resolution.gb';
  return next;
}

// ------------------------------------------------------------ families (as in Bergman 2)

const gen = (i) => String.fromCharCode(97 + i);
const range = (n) => Array.from({ length: n }, (_, i) => i);

export const FAMILIES = {
  exterior: {
    label: 'Exterior algebra', build(n) {
      const v = range(n).map(gen);
      const r = [];
      for (let i = 0; i < n; i++) {
        r.push(`${gen(i)}^2`);
        for (let j = i + 1; j < n; j++) r.push(`${gen(i)}*${gen(j)}+${gen(j)}*${gen(i)}`);
      }
      return { vars: v, rels: r };
    }
  },
  symmetric: {
    label: 'Symmetric algebra (polynomial ring)', build(n) {
      const r = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) r.push(`${gen(i)}*${gen(j)}-${gen(j)}*${gen(i)}`);
      return { vars: range(n).map(gen), rels: r };
    }
  },
  plactic: {
    label: 'Plactic monoid algebra', build(n) {
      const r = [];
      // Knuth relations: yzx = yxz for x < y <= z, and xzy = zxy for x <= y < z
      for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) for (let z = y; z < n; z++) {
        r.push(`${gen(y)}*${gen(z)}*${gen(x)}-${gen(y)}*${gen(x)}*${gen(z)}`);
      }
      for (let x = 0; x < n; x++) for (let y = x; y < n; y++) for (let z = y + 1; z < n; z++) {
        r.push(`${gen(x)}*${gen(z)}*${gen(y)}-${gen(z)}*${gen(x)}*${gen(y)}`);
      }
      return { vars: range(n).map(gen), rels: r };
    }
  },
  pow: {
    label: 'Words x yⁱ x', build(n) {
      const r = range(n).map((i) => ['x', ...Array(i).fill('y'), 'x'].join('*'));
      return { vars: ['x', 'y'], rels: r };
    }
  },
  sklyanin: {
    label: 'Sklyanin-type relation', build(n) {
      const v = range(n).map(gen);
      return { vars: v, rels: [v.map((x) => `${x}^${n}`).join('+') + '+' + v.join('*')] };
    }
  },
  symgroup: {
    label: 'Symmetric group (Coxeter presentation)', nonhomog: true, build(n) {
      // S_n with generators s_1..s_{n-1}
      const k = Math.max(1, n - 1);
      const r = [];
      for (let i = 0; i < k; i++) r.push(`${gen(i)}^2-1`);
      for (let i = 0; i + 1 < k; i++) r.push(`${gen(i)}*${gen(i + 1)}*${gen(i)}-${gen(i + 1)}*${gen(i)}*${gen(i + 1)}`);
      for (let i = 0; i < k; i++) for (let j = i + 2; j < k; j++) r.push(`${gen(i)}*${gen(j)}-${gen(j)}*${gen(i)}`);
      return { vars: range(k).map(gen), rels: r };
    }
  },
};
