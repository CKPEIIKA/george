// SPDX-License-Identifier: MIT
// Small George UI extension: download OPFS files without copying the full basis to JS.
export function attachNativeResultLinks(container,native) {
  if(!native?.runKey)return;
  const box=document.createElement('div');box.className='native-result notice';
  const p=document.createElement('p');
  p.textContent=`Native NC: ${native.basisSize??'?'} rules; completed through degree ${native.completedThroughDegree??0}. ${native.previewTruncated?'The displayed basis is only a bounded preview. ':''}${native.reduced===false?'Primitive degree-truncated basis; tails are not globally interreduced. ':''}Checkpoint: ${native.runKey}.`;
  box.append(p);
  for(const name of ['result.gb','basis.gnb','checkpoint-0.json','checkpoint-1.json']) {
    const button=document.createElement('button');button.type='button';button.className='quiet small';button.textContent='Download '+name;
    button.onclick=async()=>{
      try {
        const root=await navigator.storage.getDirectory();const dir=await (await root.getDirectoryHandle('george-native')).getDirectoryHandle(native.runKey);
        const file=await (await dir.getFileHandle(name)).getFile();const url=URL.createObjectURL(file);
        const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(error){p.textContent='File is not available: '+error.message;}
    };box.append(button);
  }
  container.prepend(box);
}
