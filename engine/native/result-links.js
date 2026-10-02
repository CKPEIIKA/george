// SPDX-License-Identifier: MIT
// Small George UI extension: download OPFS files without copying the full basis to JS.
export function attachNativeResultLinks(container,native,t) {
  if(!native?.runKey)return;
  const box=document.createElement('div');box.className='native-result notice';
  const p=document.createElement('p');
  p.textContent=t('native.summary',{n:native.basisSize??'?',d:native.completedThroughDegree??0})+' '+
    (native.previewTruncated?t('native.preview')+' ':'')+(native.reduced===false?t('native.unreduced'):'');
  box.append(p);
  const checkpoint=native.checkpoint||native.lastCheckpoint;
  const names=[...(native.fullBasisPath?['result.gb']:[]),
    ...(native.fullBasisPath||checkpoint?['basis.gnb']:[]),
    ...(checkpoint?[`checkpoint-${checkpoint.completedThroughDegree%2}.json`]:[])];
  for(const name of names) {
    const button=document.createElement('button');button.type='button';button.className='quiet small';button.textContent=t('download')+' '+name;
    button.onclick=async()=>{
      try {
        const root=await navigator.storage.getDirectory();const dir=await (await root.getDirectoryHandle('george-native')).getDirectoryHandle(native.runKey);
        const file=await (await dir.getFileHandle(name)).getFile();const url=URL.createObjectURL(file);
        const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(error){p.textContent=t('native.unavailable',{msg:error.message});}
    };box.append(button);
  }
  container.prepend(box);
}
