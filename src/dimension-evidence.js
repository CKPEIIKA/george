// Hilbert dimension evidence for fomkyr's degree closure.
//
// "assume": external dimensions, accepted as an explicit assumption. Every
// result is then labelled conditional on them. Accepted forms:
//   - fomkyr's JSON document {schema: 1, kind: "external-dimensions", ...},
//     whose identity must match the presentation;
//   - a Hilbert series 1, 15, 125, … starting at degree 0;
//   - "degree dimension" lines, e.g. fomkyr's hilbert.csv;
//   - JSON {"2": "125", …}, [{degree, dimension}, …] or {coefficients: […]}.
// "certificate": an integer-dual certificate document, replayed exactly by
// the engine before it is used.
// Plain dimensions carry no identity; the worker binds them to the
// presentation it computes, so they cannot be applied to another one.
const MAX_ENTRIES = 1024;
const MAX_TEXT = 64 * 1048576;
const fail = (message) => { throw new Error(message); };

function entriesFromPairs(pairs) {
  const entries = [];
  let previous = 0;
  for (const [degree, dimension] of pairs) {
    const d = Number(degree), n = String(dimension).trim();
    if (!Number.isSafeInteger(d) || d < 0 || !/^(0|[1-9][0-9]*)$/.test(n)) fail('Dimension evidence must pair nonnegative integer degrees with nonnegative integer dimensions.');
    if (d === 0) { if (n !== '1') fail('The dimension in degree 0 must be 1.'); continue; }
    if (d <= previous) fail('Dimension evidence degrees must increase.');
    previous = d;
    entries.push({ degree: d, dimension: n });
  }
  if (!entries.length) fail('Dimension evidence needs at least one degree above 0.');
  if (entries.length > MAX_ENTRIES) fail('Dimension evidence is limited to 1024 degrees.');
  return entries;
}

const seriesEntries = (values) => {
  if (String(values[0]).trim() !== '1') fail('A dimension series starts with degree 0, whose dimension is 1.');
  return entriesFromPairs(values.map((v, d) => [d, v]));
};

export function parseDimensionEvidence(text, mode) {
  const source = String(text ?? '').trim();
  if (!source) fail('Enter dimensions or load a file for the dimension evidence.');
  if (source.length > MAX_TEXT) fail('Dimension evidence exceeds 64 MiB.');
  if (/^[{[]/.test(source)) {
    let data;
    try { data = JSON.parse(source); } catch { fail('The dimension evidence is not valid JSON.'); }
    if (data && !Array.isArray(data) && data.schema !== undefined) {
      const kind = mode === 'certificate' ? 'integer-duals' : 'external-dimensions';
      if (data.schema !== 1 || data.kind !== kind) fail(mode === 'certificate'
        ? 'A certificate must be a fomkyr integer-dual document (schema 1).'
        : 'An external-dimensions document must have schema 1 and kind "external-dimensions".');
      return { mode, document: data };
    }
    if (mode === 'certificate') fail('A certificate must be a fomkyr integer-dual document (schema 1).');
    if (Array.isArray(data)) return { mode, entries: data.every((x) => typeof x === 'object' && x)
      ? entriesFromPairs(data.map((x) => [x.degree, x.dimension])) : seriesEntries(data) };
    if (Array.isArray(data?.coefficients)) return { mode, entries: seriesEntries(data.coefficients) };
    if (data && typeof data === 'object') return { mode, entries: entriesFromPairs(Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]))) };
    fail('Unsupported dimension evidence.');
  }
  if (mode === 'certificate') fail('A certificate must be a fomkyr integer-dual document (schema 1).');
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('%'));
  const numbers = (line) => line.split(/[\s,;:]+/).filter(Boolean);
  // One line of several values is a series; otherwise each line is "degree dimension".
  if (lines.length === 1 && numbers(lines[0]).length > 2) return { mode, entries: seriesEntries(numbers(lines[0])) };
  const pairs = lines.filter((line) => /^\d/.test(line)).map((line) => numbers(line).slice(0, 2));
  if (pairs.some((p) => p.length < 2)) fail('Write one "degree dimension" pair per line, or a series 1, 15, 125, …');
  return { mode, entries: entriesFromPairs(pairs) };
}

// The engine's hilbertClosure option for one presentation identity.
export function hilbertClosureOption(evidence, identity, modulus) {
  if (!evidence) return undefined;
  if (evidence.document) return evidence.mode === 'certificate' ? { certificate: evidence.document } : { assume: evidence.document };
  return { assume: { schema: 1, kind: 'external-dimensions', identity, modulus, source: 'Supplied in George', entries: evidence.entries } };
}
