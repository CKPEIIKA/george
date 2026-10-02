// SPDX-License-Identifier: MIT
// OPFS data are origin-local. Persistence is a request, never a backup guarantee.
export const STORE='fomkyr';
export const VERSION='0.6.1';
const encoder=new TextEncoder();
export async function sha256(bytes){
  const hash=await crypto.subtle.digest('SHA-256',typeof bytes==='string'?encoder.encode(bytes):bytes);
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function identityOf(fixture,modulus){
  // Target, thread count, WASM bitness and memory budget are deliberately absent.
  // Order, generator ordering, field and exact relations are deliberately present.
  return sha256(JSON.stringify({semantics:'fomkyr-homogeneous-degleftlex-v1',variables:fixture.variables,relations:fixture.relations,modulus}));
}
export function validKey(key){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key))throw new Error('Invalid cache key');return key;}
export async function acquireRunLock(key){
  validKey(key);
  if(!navigator.locks?.request)return null; // The engine still uses an exclusive OPFS coordinator lock.
  let release,ready,failed;
  const started=new Promise((yes,no)=>{ready=yes;failed=no;});
  const held=navigator.locks.request(`fomkyr:${key}`,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock){const e=new Error('This algebra is already open in another tab or worker.');e.code='CACHE_BUSY';throw e;}
    const gate=new Promise(resolve=>{release=resolve;});ready();await gate;
  });
  held.catch(failed);await started;
  return async()=>{release();await held;};
}
export async function readCheckpoint(file){
  const blob=await file.getFile();
  if(blob.size>65536)throw new Error('Oversized checkpoint metadata');
  const envelope=JSON.parse(await blob.text());
  if(envelope.schema!==2||!envelope.payload||await sha256(JSON.stringify(envelope.payload))!==envelope.sha256)throw new Error('Checkpoint metadata checksum mismatch');
  return envelope.payload;
}
export async function writeJSON(directory,name,payload,{checkpoint=false}={}){
  const value=checkpoint?{schema:2,payload,sha256:await sha256(JSON.stringify(payload))}:payload;
  const bytes=encoder.encode(JSON.stringify(value,null,2));
  const h=await (await directory.getFileHandle(name,{create:true})).createSyncAccessHandle();
  try{h.truncate(0);let at=0;while(at<bytes.length){const n=h.write(bytes.subarray(at),{at});if(!n)throw new Error('Short metadata write');at+=n;}h.flush();}finally{h.close();}
}
export async function checkpointCandidates(directory,identity,diskBytes){
  const result=[];
  for(const name of ['checkpoint-0.json','checkpoint-1.json']){
    try{
      const cp=await readCheckpoint(await directory.getFileHandle(name));
      if(![2,3].includes(cp.abi)||cp.identity!==identity)continue;
      if(!Number.isInteger(cp.completedThroughDegree)||cp.completedThroughDegree<0||cp.completedThroughDegree>0xfffffffe)continue;
      if(!Number.isSafeInteger(cp.basisSize)||cp.basisSize<0||!Number.isSafeInteger(cp.diskBytes)||cp.diskBytes<cp.basisSize*56||cp.diskBytes>diskBytes)continue;
      result.push(cp);
    }catch{}
  }
  return result.sort((a,b)=>b.completedThroughDegree-a.completedThroughDegree);
}
export async function requestPersistentStorage(){
  if(typeof navigator.storage?.persist!=='function')return {persistent:false,reason:'Call from the page, not a worker; API unavailable here.'};
  const persistent=await navigator.storage.persist();
  return {persistent,...await navigator.storage.estimate()};
}
export async function listCachedRuns(){
  const root=await navigator.storage.getDirectory();let directory;
  try{directory=await root.getDirectoryHandle(STORE);}catch(e){if(e.name==='NotFoundError')return [];throw e;}
  const runs=[];
  for await(const [key,dir] of directory.entries()){
    if(dir.kind!=='directory')continue;
    const checkpoints=[];
    for(const name of ['checkpoint-0.json','checkpoint-1.json'])try{checkpoints.push(await readCheckpoint(await dir.getFileHandle(name)));}catch{}
    checkpoints.sort((a,b)=>b.completedThroughDegree-a.completedThroughDegree);
    const cp=checkpoints[0];let diskBytes=0;
    try{diskBytes=(await (await dir.getFileHandle('basis.gnb')).getFile()).size;}catch{}
    runs.push({key,completedThroughDegree:cp?.completedThroughDegree??null,basisSize:cp?.basisSize??null,diskBytes,identity:cp?.identity??null,updatedAt:cp?.updatedAt??null});
  }
  return runs;
}
export async function deleteCachedRun(key){
  validKey(key);
  if(!navigator.locks?.request)throw new Error('Safe cache deletion requires the Web Locks API.');
  const release=await acquireRunLock(key);
  try{const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle(STORE);await dir.removeEntry(key,{recursive:true});}
  finally{await release?.();}
}
