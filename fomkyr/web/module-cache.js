// SPDX-License-Identifier: MIT
import {VERSION,sha256} from './storage.js';
import {WASM_HASHES} from './build-info.js';
// Cache small immutable WASM assets, never polynomial strings. Verify a cached
// binary before compiling so an old service worker cannot silently mix ABIs.
export async function loadKernel(bits,customURL,single=false){
  const key=`${bits}${single?'-single':''}`;
  const url=customURL??new URL(`fomkyr${key}.wasm`,import.meta.url);
  const expected=customURL?null:WASM_HASHES[key];
  let cache=null;
  try{if(globalThis.caches&&!customURL)cache=await caches.open(`fomkyr-kernel-${VERSION}`);}catch{}
  if(cache){
    try{const hit=await cache.match(url);if(hit){const b=await hit.arrayBuffer();if(await sha256(b)===expected)return WebAssembly.compile(b);await cache.delete(url);}}
    catch{try{await cache.delete(url);}catch{}}
  }
  const response=await fetch(url,{cache:'no-cache'});
  if(!response.ok)throw new Error(`Cannot load fomkyr WASM: HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(expected&&await sha256(bytes)!==expected)throw new Error('WASM build checksum mismatch. Refresh the deployed assets/service worker.');
  const module=await WebAssembly.compile(bytes);
  try{await cache?.put(url,new Response(bytes,{headers:{'Content-Type':'application/wasm'}}));}catch{}
  return module;
}
