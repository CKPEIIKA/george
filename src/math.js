// Local MathJax; rendering failure must never interrupt the algebra engine.
let loaded;
let queue = Promise.resolve();
const generations = new WeakMap();
export function loadMath() {
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    const base = new URL('../vendor/mathjax/', import.meta.url).href.replace(/\/$/, '');
    window.MathJax = {
      loader: { paths: { mathjax: base, fonts: base, 'mathjax-newcm': `${base}/newcm` } },
      output: { font: 'mathjax-newcm', fontPath: `${base}/newcm` },
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
      svg: { fontCache: 'local' },
      options: { enableMenu: false, enableEnrichment: false, enableExplorer: false, enableSpeech: false, enableBraille: false },
      startup: { typeset: false },
    };
    const script = document.createElement('script');
    script.src = `${base}/tex-svg.js`;
    script.onload = () => window.MathJax.startup.promise.then(resolve, reject);
    script.onerror = () => reject(new Error('Cannot load the local mathematical renderer.'));
    document.head.append(script);
  });
  return loaded;
}
export function clearMath(element) {
  window.MathJax?.typesetClear?.([element]);
}
export function renderMath(element, html) {
  const generation = (generations.get(element) || 0) + 1;
  generations.set(element, generation);
  queue = queue.catch(() => {}).then(async () => {
    try { await loadMath(); }
    catch (error) { if (html !== undefined) element.innerHTML = html; throw error; }
    if (generation !== generations.get(element)) return;
    if (html !== undefined) { clearMath(element); element.innerHTML = html; }
    await window.MathJax.typesetPromise([element]);
  });
  return queue;
}
