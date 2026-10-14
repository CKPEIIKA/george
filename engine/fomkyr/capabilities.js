// SPDX-License-Identifier: MIT
// Capabilities, never user-agent/browser-name branching.
export function sharedMemoryAvailable(){
 if(!globalThis.crossOriginIsolated||typeof SharedArrayBuffer==='undefined')return false;
 try{return new WebAssembly.Memory({initial:1,maximum:2,shared:true}).buffer instanceof SharedArrayBuffer;}catch{return false;}
}
export function browserCapabilities(){return {
 secureContext:globalThis.isSecureContext??false,crossOriginIsolated:!!globalThis.crossOriginIsolated,
 sharedMemory:sharedMemoryAvailable(),webAssembly:typeof WebAssembly!=='undefined',
 opfs:typeof globalThis.navigator?.storage?.getDirectory==='function',
 webLocks:typeof globalThis.navigator?.locks?.request==='function',
 logicalCPUs:globalThis.navigator?.hardwareConcurrency??1,
 // memory64 is decided by actual module compilation + instantiation, not this hint.
};}
export async function probeUnsafeAccess(directory){
 const name=`access-probe-${crypto.randomUUID()}`;let first,second;
 try{const f=await directory.getFileHandle(name,{create:true});first=await f.createSyncAccessHandle({mode:'readwrite-unsafe'});second=await f.createSyncAccessHandle({mode:'readwrite-unsafe'});return true;}
 catch{return false;}
 finally{try{second?.close();}catch{}try{first?.close();}catch{}try{await directory.removeEntry(name);}catch{}}
}
