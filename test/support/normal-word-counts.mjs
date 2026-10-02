// Independent automaton and BigInt dynamic program for a monomial NC ideal.
// Test implementation: it shares no engine Hilbert-series code.
export function normalWordCounts(alphabetSize, forbidden, bound) {
  if (!Number.isInteger(alphabetSize) || alphabetSize < 1 || alphabetSize > 26
    || !Number.isInteger(bound) || bound < 0) throw new RangeError('Invalid alphabet or degree.');
  const nodes = [{next: Array(alphabetSize).fill(-1), fail: 0, terminal: false}];
  for (const word of new Set(forbidden)) {
    let state = 0;
    for (const char of word) {
      const letter = char.charCodeAt(0) - 65;
      if (letter < 0 || letter >= alphabetSize) throw new RangeError('Word outside alphabet.');
      if (nodes[state].next[letter] < 0) {
        nodes[state].next[letter] = nodes.length;
        nodes.push({next: Array(alphabetSize).fill(-1), fail: 0, terminal: false});
      }
      state = nodes[state].next[letter];
    }
    nodes[state].terminal = true;
  }
  const queue = [];
  for (let c = 0; c < alphabetSize; c++) {
    const child = nodes[0].next[c];
    if (child < 0) nodes[0].next[c] = 0; else queue.push(child);
  }
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head], node = nodes[state];
    node.terminal ||= nodes[node.fail].terminal;
    for (let c = 0; c < alphabetSize; c++) {
      const child = node.next[c];
      if (child < 0) node.next[c] = nodes[node.fail].next[c];
      else {nodes[child].fail = nodes[node.fail].next[c]; queue.push(child);}
    }
  }
  let layer = Array(nodes.length).fill(0n); layer[0] = nodes[0].terminal ? 0n : 1n;
  const counts = [];
  for (let d = 0; d <= bound; d++) {
    counts.push(layer.reduce((sum, n) => sum + n, 0n).toString());
    if (d === bound) break;
    const next = Array(nodes.length).fill(0n);
    for (let s = 0; s < nodes.length; s++) if (layer[s])
      for (const t of nodes[s].next) if (!nodes[t].terminal) next[t] += layer[s];
    layer = next;
  }
  return counts;
}
