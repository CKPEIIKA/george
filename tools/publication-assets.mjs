// Include both interpreter variants and the default C runtime when checking
// that Pages serves a prepared release. Verify the manual and bytecode copies.
export function publicationAssets(paths) {
  const required = ['index.html', 'style.css', 'isolation-worker.js', 'engine/build.json', 'engine/worker.js',
    'engine/runner.js', 'sources/george-source.tar.gz', 'fomkyr/index.html'];
  for (const file of required) if (!paths.includes(file)) throw Error('Missing publication asset: ' + file);
  return [...new Set([...required, ...paths.filter(file => /^src\/[^/]+\.js$/.test(file)
    || /^sources\/[^/]+\.tar\.gz$/.test(file)
    || /^engine\/native\/(?:[^/]+\.js|george(?:32|64)\.wasm|build\.json|LICENSE\.txt)$/.test(file)
    || /^engine\/fomkyr\/(?:[^/]+\.js|fomkyr(?:32|64)(?:-single)?\.wasm|build\.json|LICENSE\.txt)$/.test(file)
    || /^engine\/fomkyr\/verification\/[^/]+\.(?:py|h|json|txt)$/.test(file)
    || /^engine\/(?:optimized\/|compiled\/|memory64\/)?(?:build\.json|ecl\.(?:js|wasm|data))$/.test(file))])];
}
