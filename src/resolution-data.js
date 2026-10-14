// Versioned JSON Lines export from Bergman's chain and tensor objects.
// Generator indices are 1-based in the header's order; [] denotes the unit.
import { parseAnick, parseRelation, esc } from './bergman-syntax.js';

export const chainKey = word => JSON.stringify(word);

export function readResolution(source, vars, modulus = null) {
  if (typeof source !== 'string') throw new Error('Expected a resolution export.');
  const diffs = new Map();
  if (source.trimStart().startsWith('{')) {
    const [header, ...records] = source.trim().split(/\r?\n/).map(line => JSON.parse(line));
    if (header.format !== 'george-resolution' || header.version !== 1)
      throw new Error('Unsupported structural resolution format.');
    const names = header.generators;
    if (!Array.isArray(names) || names.length !== vars.length || new Set(names).size !== names.length || names.some(v => !vars.includes(v)))
      throw new Error('The resolution generator order does not match the presentation.');
    if (!Number.isSafeInteger(header.modulus) || header.modulus < 0 || (modulus !== null && header.modulus !== Number(modulus)))
      throw new Error('The resolution coefficient field does not match the presentation.');
    const word = indices => {
      if (!Array.isArray(indices) || indices.some(i => !Number.isSafeInteger(i) || i < 1 || i > names.length))
        throw new Error('Invalid generator index in the resolution.');
      return indices.map(i => names[i - 1]);
    };
    for (const record of records) {
      const n = record.degree;
      if (!Number.isSafeInteger(n) || n < 0 || !Array.isArray(record.terms))
        throw new Error('Invalid structural differential.');
      const chain = word(record.chain);
      if (!chain.length) throw new Error('An Anick chain must be nonempty.');
      const terms = record.terms.map(term => {
        const c = term.coefficient;
        if (!Array.isArray(c) || c.length !== 2 || c.some(v => typeof v !== 'string' || !/^-?\d+$/.test(v)) || BigInt(c[1]) === 0n)
          throw new Error('Invalid exact coefficient in the resolution.');
        return { target: word(term.target), word: word(term.word), coefficient: c };
      });
      if (!diffs.has(n)) diffs.set(n, []);
      diffs.get(n).push({ chain, terms });
    }
  } else {
    // Historical fixtures remain readable when every generator is one letter.
    // Never guess how to split a compact printed chain with longer names.
    if (vars.some(v => !/^[A-Za-z]$/.test(v)))
      throw new Error('Long generator names require the structural resolution export.');
    const word = s => {
      if (s === '1') return [];
      const parsed = parseRelation(s.replace(/^\*/, ''), vars);
      if (parsed.length !== 1 || parsed[0].sign !== 1 || parsed[0].coef !== '1')
        throw new Error(`Invalid printed chain: ${s}`);
      return parsed[0].factors.flatMap(f => Array(f.e).fill(f.v));
    };
    if (/^D\([^\n]*\)=Nil\s*$/m.test(source)) throw new Error('Cannot read an uncalculated differential.');
    for (const [n, rows] of parseAnick(source).diffs) diffs.set(n, rows.map(row => ({
      chain: word(row.chain),
      terms: (row.image.replaceAll(' ', '').match(/[+-]?[^+-]+/g) || []).map(term => {
        const m = /^([+-]?)(?:(\d+)(?:\/(\d+))?)?([^.]*)\.(.*)$/.exec(term);
        if (!m) throw new Error(`Cannot read differential term: ${term}`);
        const [, sign, num, den, target, elt] = m;
        return { target: word(target || '1'), word: word(elt), coefficient: [(sign === '-' ? '-' : '') + (num || '1'), den || '1'] };
      })
    })));
  }
  const top = Math.max(...diffs.keys()) + 1;
  if (!Number.isFinite(top)) throw new Error('The resolution has no differentials.');
  let previous = new Set([chainKey([])]);
  for (let n = 0; n < top; n++) {
    const rows = diffs.get(n);
    if (!rows) throw new Error(`Missing differential degree ${n}.`);
    const current = new Set(rows.map(row => chainKey(row.chain)));
    if (current.size !== rows.length) throw new Error(`Duplicate chain at degree ${n}.`);
    for (const row of rows) for (const term of row.terms)
      if (!previous.has(chainKey(term.target))) throw new Error(`Missing target chain ${chainKey(term.target)} at degree ${n}.`);
    previous = current;
  }
  return { diffs, top };
}

// The display uses whole tokens too; aa and a*a must look different.
export function structuralResolutionDisplay(source, vars) {
  const { diffs } = readResolution(source, vars);
  const wordHTML = word => word.length ? word.map(v => `<var>${esc(v)}</var>`).join('<span class="op times">·</span>') : '<span class="num">1</span>';
  return { diffs: new Map([...diffs].map(([n, rows]) => [n, rows.map(row => ({
    chainHTML: wordHTML(row.chain),
    imageHTML: row.terms.map((term, i) => {
      const negative = term.coefficient[0].startsWith('-');
      const num = term.coefficient[0].replace(/^-/, ''), den = term.coefficient[1];
      const sign = negative ? '−' : i ? '+' : '';
      const coefficient = num === '1' && den === '1' ? '' : `<span class="num">${esc(num)}${den === '1' ? '' : '/' + esc(den)}</span><span class="op">·</span>`;
      return `<span class="op">${sign}</span>${coefficient}<span class="chain">${wordHTML(term.target)}</span><span class="op tensor">⊗</span>${wordHTML(term.word)}`;
    }).join('') || '<span class="num">0</span>'
  }))])) };
}
