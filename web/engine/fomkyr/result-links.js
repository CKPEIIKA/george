// SPDX-License-Identifier: MIT
// Download complete OPFS files without materializing the full basis in JS.
export function attachFomkyrResultLinks(container, result, t) {
  if (!result?.runKey) return;
  const box = document.createElement('div'); box.className = 'native-result notice';
  const summary = document.createElement('p');
  summary.textContent = t('native.summary', {n: result.basisSize ?? '?', d: result.completedThroughDegree ?? 0});
  box.append(summary);
  const runtime = document.createElement('p');
  runtime.textContent = t('fomkyr.runtime', {bits: result.bits, workers: result.workers, mode: result.ioMode}); box.append(runtime);
  if (result.storage !== 'opfs') {
    const note = document.createElement('p'); note.textContent = t('fomkyr.ramOnly'); box.append(note);
  } else {
    const names = ['result.gb', 'basis.gnb', 'fomkyr-result.json'];
    if (result.hilbert) names.push('hilbert.json');
    if (result.hilbert?.coefficients) names.push('hilbert.csv');
    if (result.completedThroughDegree > 0) names.push(`checkpoint-${result.completedThroughDegree % 2}.json`);
    for (const name of names) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet small';
      button.textContent = t('download') + ' ' + name;
      button.onclick = async () => {
        try {
          const root = await navigator.storage.getDirectory();
          const directory = await (await root.getDirectoryHandle('fomkyr')).getDirectoryHandle(result.runKey);
          const file = await (await directory.getFileHandle(name)).getFile(), url = URL.createObjectURL(file);
          const link = document.createElement('a'); link.href = url; link.download = name;
          document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {summary.textContent = t('native.unavailable', {msg: error.message});}
      };
      box.append(button);
    }
  }
  for (const message of result.fallbacks || []) {
    const note = document.createElement('p'); note.textContent = message; box.append(note);
  }
  container.prepend(box);
}
export function renderFomkyrSeries(container, hilbert, t) {
  container.replaceChildren();
  const summary = document.createElement('p');
  if (!hilbert?.coefficients) {
    summary.textContent = t('fomkyr.hilbertUnavailable', {msg: hilbert?.error || 'disabled'}); container.append(summary); return;
  }
  summary.textContent = t('fomkyr.hilbertSummary', {field: hilbert.field, degree: hilbert.certifiedThroughDegree}) + ' ' +
    t(hilbert.basisCompletionProved ? 'fomkyr.completeBasis' : 'fomkyr.truncatedHilbert'); container.append(summary);
  const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = hilbert.coefficients.slice(0, 512).map((coefficient, degree) => `${degree}: ${coefficient}`).join('\n'); container.append(pre);
  if (hilbert.coefficients.length > 512) {
    const note = document.createElement('p'); note.textContent = t('fomkyr.hilbertPreview'); container.append(note);
  }
}
