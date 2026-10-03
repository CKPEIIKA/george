// SPDX-License-Identifier: MIT
// Small George UI extension: download OPFS files without copying the full basis to JS.
export function attachFomkyrResultLinks(container,native) {
  if(!native?.runKey)return;
  const box=document.createElement('div');box.className='native-result notice';
  const p=document.createElement('p');
  p.textContent=`fomkyr: ${native.basisSize??'?'} rules; completed through degree ${native.completedThroughDegree??0}. ${native.previewTruncated?'The displayed basis is only a bounded preview. ':''}${native.reduced===false?'Primitive degree-truncated basis; tails are not globally interreduced. ':''}${native.storage==='memory'?'RAM-only run: no persistent checkpoint.':'Checkpoint: '+native.runKey+'.'}`;
  box.append(p);
  if(native.hilbertEvidenceId){const n=document.createElement('p');n.textContent=native.conditionalOnExternalDimensions?'Conditional completion: external Hilbert dimensions were explicitly trusted. Fomkyr did not independently prove those dimensions.':'Hilbert closure used exact integer-dual witnesses replayed against the original relations.';box.append(n);}
  if(native.hilbert?.coefficients){const h=document.createElement('p');h.textContent='Hilbert dimensions (degrees 0..'+native.hilbert.certifiedThroughDegree+'): '+native.hilbert.coefficients.slice(0,256).join(', ')+(native.hilbert.coefficients.length>256?' ... (full prefix in Hilbert CSV)':'');box.append(h);}
  if(native.storage==='memory'){container.prepend(box);return;}
  for(const name of ['result.gb','basis.gnb','hilbert.json','hilbert.csv','fomkyr-result.json',...(native.hilbertEvidenceId?['hilbert-evidence.json']:[]),'checkpoint-0.json','checkpoint-1.json']) {
    const button=document.createElement('button');button.type='button';button.className='quiet small';button.textContent='Download '+name;
    button.onclick=async()=>{
      try {
        const root=await navigator.storage.getDirectory();const dir=await (await root.getDirectoryHandle('fomkyr')).getDirectoryHandle(native.runKey);
        const file=await (await dir.getFileHandle(name)).getFile();const url=URL.createObjectURL(file);
        const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(error){p.textContent='File is not available: '+error.message;}
    };box.append(button);
  }
  container.prepend(box);
}

export function renderFomkyrSeries(container,hilbert){
  container.replaceChildren();const summary=document.createElement('p');
  if(!hilbert?.coefficients){summary.textContent='Hilbert output unavailable: '+(hilbert?.error||'disabled');container.append(summary);return;}
  summary.textContent=`Exact ${hilbert.field} dimensions through degree ${hilbert.certifiedThroughDegree}. ${hilbert.basisCompletionProved?'A finite complete Gröbner basis was proved.':'Certification is degree-truncated.'} No rational extrapolation.`;container.append(summary);
  if(hilbert.conditionalOnExternalDimensions){const n=document.createElement('p');n.textContent='The claimed dimensions/completeness are conditional on the supplied external Hilbert data.';container.append(n);}
  const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';
  pre.textContent=hilbert.coefficients.slice(0,512).map((c,d)=>`${d}: ${c}`).join('\n');container.append(pre);
  if(hilbert.coefficients.length>512){const note=document.createElement('p');note.textContent='The page shows the first 512 coefficients. The full exact prefix is in hilbert.csv and hilbert.json.';container.append(note);}
}
