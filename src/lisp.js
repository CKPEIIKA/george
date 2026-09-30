// Lexical helpers for the console editor. bergman is read by ECL's Common
// Lisp reader with bergman's syntax: % and ; start comments, ! and \ escape
// the next character, and "..." is a string.

const SYMBOL_STOP = /[\s()"';`,]/;

// Tokens: open, close, string, comment, space, quote, number, symbol.
// Brackets get their nesting depth and the index of their partner (match);
// a close bracket without an opening one is marked stray.
export function tokenize(src) {
  const toks = [];
  const stack = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '(') {
      stack.push(toks.length);
      toks.push({ type: 'open', start: i, end: i + 1, depth: stack.length - 1, match: -1 });
      i++;
    } else if (c === ')') {
      const open = stack.pop();
      const tok = { type: 'close', start: i, end: i + 1, depth: open === undefined ? 0 : stack.length, match: open ?? -1, stray: open === undefined };
      if (open !== undefined) toks[open].match = toks.length;
      toks.push(tok);
      i++;
    } else if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' || src[j] === '!' ? 2 : 1;
      toks.push({ type: 'string', start: i, end: Math.min(j + 1, src.length), closed: j < src.length });
      i = Math.min(j + 1, src.length);
    } else if (c === '%' || c === ';') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = src.length;
      toks.push({ type: 'comment', start: i, end: j });
      i = j;
    } else if (/\s/.test(c)) {
      let j = i;
      while (j < src.length && /\s/.test(src[j])) j++;
      toks.push({ type: 'space', start: i, end: j });
      i = j;
    } else if (c === "'" || c === '`' || c === ',') {
      toks.push({ type: 'quote', start: i, end: i + 1 });
      i++;
    } else {
      let j = i;
      while (j < src.length && !SYMBOL_STOP.test(src[j])) j += src[j] === '!' || src[j] === '\\' ? 2 : 1;
      j = Math.min(j, src.length);
      const text = src.slice(i, j);
      toks.push({ type: /^[+-]?\d+(\.\d+)?$/.test(text) ? 'number' : 'symbol', start: i, end: j, text });
      i = j;
    }
  }
  return toks;
}

// Whether the input is ready to evaluate: every bracket closed, no stray
// close bracket, no unterminated string.
export function balance(src) {
  const toks = tokenize(src);
  const open = toks.filter((t) => t.type === 'open' && t.match < 0).length;
  const stray = toks.filter((t) => t.type === 'close' && t.stray).map((t) => t.start);
  const unterminated = toks.some((t) => t.type === 'string' && !t.closed);
  const empty = !toks.some((t) => t.type !== 'space' && t.type !== 'comment');
  return { open, stray, unterminated, empty, complete: !empty && open === 0 && !stray.length && !unterminated };
}

// The bracket pair touching the cursor: the bracket just after or just
// before it. Returns [a, b] character positions, or null.
export function matchAt(src, cursor, toks = tokenize(src)) {
  const at = (pos) => toks.findIndex((t) => (t.type === 'open' || t.type === 'close') && t.start === pos);
  let k = at(cursor);
  if (k < 0) k = at(cursor - 1);
  if (k < 0 || toks[k].match < 0) return null;
  return [toks[k].start, toks[toks[k].match].start];
}

// The symbol ending at the cursor (for completion), if the cursor is at its end.
export function symbolBefore(src, cursor) {
  if (cursor < src.length && !SYMBOL_STOP.test(src[cursor])) return null;
  let j = cursor;
  while (j > 0 && !SYMBOL_STOP.test(src[j - 1])) j--;
  if (j === cursor) return null;
  return { start: j, text: src.slice(j, cursor) };
}

// The name at the head of the innermost list around the cursor that
// satisfies accept: "(setmaxdeg |" gives "setmaxdeg".
export function enclosingHead(src, cursor, toks = tokenize(src), accept = () => true) {
  const opens = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.type !== 'open' || t.start >= cursor) continue;
    const close = t.match >= 0 ? toks[t.match].start : Infinity;
    if (close >= cursor) opens.push(k);
  }
  for (const open of opens.reverse()) {
    const head = toks.slice(open + 1).find((t) => t.type !== 'space' && t.type !== 'comment');
    const name = head?.type === 'symbol' ? head.text.toLowerCase() : null;
    if (name && accept(name)) return name;
  }
  return null;
}

// Completion: the first candidate (in the given priority order) that
// extends the typed prefix, compared without case.
export function complete(prefix, candidates) {
  if (!prefix || prefix.length < 2) return null;
  const p = prefix.toLowerCase();
  for (const c of candidates) if (c.length > p.length && c.startsWith(p)) return c;
  return null;
}

// Indentation for a new line: two spaces per open bracket before the cursor.
export function indentAt(src, cursor) {
  const b = balance(src.slice(0, cursor));
  return '  '.repeat(Math.max(0, b.open));
}
