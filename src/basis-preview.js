// Extend the visible prefix on demand, ending at a complete polynomial.
// Read only the next portion of the disk file; the complete result stays on disk.
export async function nextBasisPreview(file, offset, pageBytes = 1024 * 1024) {
  let end = Math.min(file.size, offset + pageBytes);
  while (true) {
    const text = await file.slice(offset, end).text();
    const boundary = text.lastIndexOf(',\n');
    if (end === file.size) return {text, offset: end, truncated: false};
    if (boundary >= 0) {
      const complete = text.slice(0, boundary + 2);
      return {text: complete, offset: offset + new TextEncoder().encode(complete).length, truncated: true};
    }
    end = Math.min(file.size, end + pageBytes);
  }
}
