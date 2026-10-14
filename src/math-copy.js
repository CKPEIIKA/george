// Plain-text copying keeps powers and multiplication in the input syntax.
export function mathClipboardText(node, sources = new Map()) {
  if (node.nodeType === 3) return node.textContent;
  const source = node.getAttribute?.('data-math-source');
  if (source !== null && source !== undefined && sources.get(source) === node.textContent) return source;
  const tag = node.tagName?.toLowerCase();
  if (tag === 'sup') return '^' + node.textContent;
  if (tag === 'sub') return '_' + node.textContent;
  if (tag === 'br') return '\n';
  const text = [...node.childNodes].map(child => mathClipboardText(child, sources)).join('');
  if (tag === 'li') return text.trim() + ',\n';
  if (['ol', 'p', 'h3', 'section'].includes(tag)) return text + '\n';
  return text;
}

export function copyMathSelection(event, root = document) {
  if (event.target?.closest?.('input, textarea, [contenteditable]')) return;
  const selection = root.getSelection();
  if (!event.clipboardData || !selection || selection.isCollapsed) return;
  const containers = [...root.querySelectorAll('#relPreview, #basisOut')];
  const sources = new Map([...root.querySelectorAll('[data-math-source]')]
    .map(node => [node.dataset.mathSource, node.textContent]));
  const parts = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (!containers.some(node => node.contains(range.commonAncestorContainer))) return;
    const ancestor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const expression = ancestor.closest?.('[data-math-source]');
    if (expression && range.toString() === expression.textContent) {
      parts.push(expression.dataset.mathSource);
      continue;
    }
    parts.push(mathClipboardText(range.cloneContents(), sources));
  }
  event.clipboardData.setData('text/plain', parts.join('\n').replace(/\n{3,}/g, '\n\n').trim());
  event.preventDefault();
}
