// The reduced Gröbner basis in canonical form, from an engine's basis text.
//
// Every element becomes monic, elements whose leading monomial is a multiple
// of another's are dropped, and no term of any element is divisible by
// another element's leading monomial. This reduced basis is unique for the
// ideal, order and degree bound, so it is the same whichever engine computed
// it. Engines print each leading monomial first; reducing a tail never needs
// the order itself, because an admissible order makes every reduction step
// replace a term by smaller ones. The order is used only to print the terms.
import { parseBasis, parseRelation, ORDERS } from './bergman-syntax.js';

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };

// Exact coefficients: rationals over Q, residues modulo a prime p.
function field(p) {
  if (p) {
    const norm = (a) => ((a % p) + p) % p;
    const inv = (a) => { let r = 1n, b = norm(a), e = p - 2n; while (e) { if (e & 1n) r = r * b % p; b = b * b % p; e >>= 1n; } return r; };
    return { from: (n) => norm(n), zero: (a) => a === 0n, mul: (a, b) => a * b % p, sub: (a, b) => norm(a - b), div: (a, b) => a * inv(b) % p,
      text: (a) => [a.toString(), false] };
  }
  const make = (n, d) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
  return { from: (n) => [n, 1n], zero: (a) => a[0] === 0n, mul: (a, b) => make(a[0] * b[0], a[1] * b[1]),
    sub: (a, b) => make(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), div: (a, b) => make(a[0] * b[1], a[1] * b[0]),
    text: (a) => [(a[0] < 0n ? -a[0] : a[0]).toString() + (a[1] === 1n ? '' : '/' + a[1]), a[0] < 0n] };
}

// Monomials as keys. Noncommutative words are strings with one character per
// generator; commutative monomials are exponent vectors joined by commas.
function monomials(vars, commutative) {
  const index = new Map(vars.map((v, i) => [v, i]));
  if (!commutative) {
    const ch = (i) => String.fromCharCode(0xe000 + i);
    return {
      key: (factors) => factors.map((f) => ch(index.get(f.v)).repeat(f.e)).join(''),
      letters: (key) => [...key].map((c) => c.charCodeAt(0) - 0xe000),
      times: (a, key, b) => a + key + b,
      degree: (key, w) => [...key].reduce((s, c) => s + w[c.charCodeAt(0) - 0xe000], 0),
    };
  }
  const vec = (key) => key.split(',').map(Number);
  return {
    key: (factors) => { const e = vars.map(() => 0); for (const f of factors) e[index.get(f.v)] += f.e; return e.join(','); },
    exponents: vec,
    times: (q, key) => vec(key).map((e, i) => e + q[i]).join(','),
    degree: (key, w) => vec(key).reduce((s, e, i) => s + e * w[i], 0),
  };
}

// Leading-term comparison for the orders whose definition is explicit here.
// Returns null for orders that are only implemented inside bergman.
export function termOrder({ vars, ring, order, weights, matrix, monomial }) {
  const rank = new Map(); // larger rank = larger variable, as bergman ranks them
  const listedHighFirst = !(ring === 'noncomm' && ['degleftlex', 'homogelim'].includes(order));
  vars.forEach((_, i) => rank.set(i, listedHighFirst ? vars.length - i : i + 1));
  const w = weights;
  const byDegree = (a, b) => monomial.degree(a, w) - monomial.degree(b, w);
  if (ring === 'noncomm' && order === 'degleftlex') return (a, b) => byDegree(a, b) || (() => {
    const x = monomial.letters(a), y = monomial.letters(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return rank.get(x[i]) - rank.get(y[i]);
    return x.length - y.length;
  })();
  if (ring !== 'comm') return null;
  const high = vars.map((_, i) => i).sort((i, j) => rank.get(j) - rank.get(i)); // greatest variable first
  const lex = (x, y) => { for (const i of high) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const e = (k) => monomial.exponents(k);
  if (order === 'purelex') return (a, b) => lex(e(a), e(b));
  if (order === 'deglex') return (a, b) => byDegree(a, b) || lex(e(a), e(b));
  if (order === 'degrevlex') return (a, b) => byDegree(a, b) || (() => {
    const x = e(a), y = e(b);
    for (const i of [...high].reverse()) if (x[i] !== y[i]) return y[i] - x[i];
    return 0;
  })();
  if (order === 'matrix' && matrix) return (a, b) => {
    const x = e(a), y = e(b);
    for (const row of matrix) { const d = row.reduce((s, m, i) => s + m * (x[i] - y[i]), 0); if (d) return d; }
    return 0;
  };
  return null;
}

export function normalizeBasis({ text, vars, ring = 'noncomm', modulus = 0, weights, order = 'degleftlex', matrix = null, onProgress = () => {} }) {
  const commutative = ring === 'comm';
  const F = field(BigInt(modulus || 0));
  const M = monomials(vars, commutative);
  const w = weights ?? vars.map(() => 1);
  // Parse each element; its first printed term is its leading monomial.
  const elements = [];
  for (const group of parseBasis(text).groups) for (const source of group.polys) {
    const terms = new Map();
    let lead = null;
    for (const t of parseRelation(source, vars, 0xfffffffe)) {
      const key = M.key(t.factors);
      const c = F.from(BigInt(t.sign) * BigInt(t.coef));
      const sum = terms.has(key) ? F.sub(terms.get(key), F.sub(F.from(0n), c)) : c;
      if (F.zero(sum)) terms.delete(key); else terms.set(key, sum);
      lead ??= key;
    }
    if (!terms.size || !terms.has(lead)) continue;
    const lc = terms.get(lead);
    for (const [k, c] of terms) terms.set(k, F.div(c, lc));
    elements.push({ lead, terms, degree: M.degree(lead, w) });
  }
  // Divisor lookup on leading monomials.
  let divides;
  if (!commutative) {
    const byLead = new Map(elements.map((e) => [e.lead, e]));
    const lengths = [...new Set(elements.map((e) => e.lead.length))].sort((a, b) => a - b);
    divides = (word, self) => {
      for (const n of lengths) {
        if (n > word.length) break;
        for (let i = 0; i + n <= word.length; i++) {
          const h = byLead.get(word.slice(i, i + n));
          if (h && h !== self && h.kept !== false) return { h, a: word.slice(0, i), b: word.slice(i + n) };
        }
      }
      return null;
    };
  } else {
    divides = (key, self) => {
      const x = M.exponents(key);
      for (const h of elements) {
        if (h === self || h.kept === false) continue;
        const y = h.leadExp ??= M.exponents(h.lead);
        if (y.every((v, i) => v <= x[i])) return { h, q: x.map((v, i) => v - y[i]) };
      }
      return null;
    };
  }
  // A leading monomial that is a multiple of another one is redundant.
  const sorted = [...elements].sort((a, b) => a.degree - b.degree || (a.lead < b.lead ? -1 : a.lead > b.lead ? 1 : 0));
  for (const e of sorted) if (divides(e.lead, e)) e.kept = false;
  const basis = sorted.filter((e) => e.kept !== false);
  // Interreduce: rewrite every tail term divisible by another leading monomial.
  let lastDegree = null;
  for (const g of basis) {
    if (g.degree !== lastDegree) { lastDegree = g.degree; onProgress({ degree: g.degree }); }
    const pending = [...g.terms.keys()].filter((k) => k !== g.lead);
    while (pending.length) {
      const key = pending.pop();
      const c = g.terms.get(key);
      if (c === undefined) continue;
      const found = divides(key, g);
      if (!found) continue;
      for (const [u, d] of found.h.terms) {
        const k = commutative ? M.times(found.q, u) : M.times(found.a, u, found.b);
        const next = F.sub(g.terms.get(k) ?? F.from(0n), F.mul(c, d));
        if (F.zero(next)) g.terms.delete(k);
        else { if (!g.terms.has(k)) pending.push(k); g.terms.set(k, next); }
      }
    }
  }
  // Print in a canonical sequence. Tails follow the monomial order when it
  // is known and agrees with every printed leading monomial.
  let compare = termOrder({ vars, ring, order, weights: w, matrix, monomial: M });
  if (compare && !basis.every((g) => [...g.terms.keys()].every((k) => k === g.lead || compare(g.lead, k) > 0))) compare = null;
  const fallback = (a, b) => M.degree(b, w) - M.degree(a, w) || (a < b ? 1 : a > b ? -1 : 0);
  const descending = compare ? (a, b) => compare(b, a) : fallback;
  basis.sort((a, b) => a.degree - b.degree || descending(a.lead, b.lead));
  const word = (key) => {
    const parts = [];
    if (commutative) M.exponents(key).forEach((e, i) => { if (e) parts.push(e === 1 ? vars[i] : `${vars[i]}^${e}`); });
    else for (const i of M.letters(key)) {
      const last = parts.at(-1);
      if (last && last.v === i) last.e++; else parts.push({ v: i, e: 1 });
    }
    return commutative ? parts.join('*') : parts.map(({ v, e }) => (e === 1 ? vars[v] : `${vars[v]}^${e}`)).join('*');
  };
  const polynomial = (g) => [g.lead, ...[...g.terms.keys()].filter((k) => k !== g.lead).sort(descending)].map((k, i) => {
    const [abs, negative] = F.text(g.terms.get(k)), mono = word(k);
    const coefficient = mono && abs === '1' ? '' : mono ? abs + '*' : abs;
    return (negative ? '-' : i ? '+' : '') + coefficient + mono;
  }).join('');
  const lines = [];
  let degree = null;
  for (const g of basis) {
    if (g.degree !== degree) { degree = g.degree; lines.push(`% ${degree}`); }
    lines.push(polynomial(g) + ',');
  }
  return { text: lines.join('\n') + '\n', size: basis.length, dropped: elements.length - basis.length, orderedTails: !!compare };
}

// Ring, order, field and weights from a George session script.
export function scriptSettings(script, vars) {
  const has = (cmd) => script.includes(`(${cmd})`);
  const ring = has('COMMIFY') ? 'comm' : 'noncomm';
  const order = ORDERS[ring].find((o) => has(o.cmd))?.id ?? ORDERS[ring][0].id;
  const modulus = Number(/\(SETMODULUS (\d+)\)/.exec(script)?.[1] ?? 0);
  const w = /\(SETWEIGHTS ([\d ]+)\)/.exec(script)?.[1].trim().split(/\s+/).map(Number);
  const m = /\(SETORDERMATRIX \((.*)\)\)/.exec(script)?.[1];
  const matrix = m ? [...m.matchAll(/\(([^()]*)\)/g)].map((r) => r[1].trim().split(/\s+/).map(Number)) : null;
  return { ring, order, modulus, weights: w?.length === vars.length ? w : vars.map(() => 1), matrix };
}
