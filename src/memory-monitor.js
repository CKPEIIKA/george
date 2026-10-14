// Emscripten republishes HEAPU8 whenever its memory views are refreshed.
// Observe that assignment so growth is reported even during synchronous Wasm.
export function observeWasmMemory(options, onChange) {
  let view, bytes;
  Object.defineProperty(options, 'HEAPU8', {
    enumerable: true, configurable: true,
    get() {return view;},
    set(next) {
      view = next;
      if (next && next.byteLength !== bytes) {bytes = next.byteLength; onChange(bytes);}
    },
  });
  return options;
}

export function formatMemorySize(bytes, locale = 'en') {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return null;
  const gib = bytes >= 1073741824;
  return {amount: new Intl.NumberFormat(locale, {maximumFractionDigits: gib ? 2 : 1}).format(bytes / (gib ? 1073741824 : 1048576)),
    unit: gib ? 'GiB' : 'MiB'};
}
