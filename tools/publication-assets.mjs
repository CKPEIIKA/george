// Include both interpreter variants and the default C runtime when checking
// that Pages serves a prepared release. Bytecode copies are also verified.
export function publicationAssets(paths) {
  const required = ['index.html', 'style.css', 'engine/build.json', 'engine/worker.js',
    'engine/runner.js', 'sources/george-source.tar.gz'];
  for (const file of required) if (!paths.includes(file)) throw Error('Missing publication asset: ' + file);
  return [...new Set([...required, ...paths.filter(file => /^src\/[^/]+\.js$/.test(file)
    || /^engine\/(?:optimized\/|compiled\/|memory64\/)?(?:build\.json|ecl\.(?:js|wasm|data))$/.test(file))])];
}
