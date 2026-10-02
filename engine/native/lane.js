// SPDX-License-Identifier: MIT
import {hostFor,setStack} from './runtime.js';
let e, host, handle, lane, bits;
self.onmessage=async ({data:m})=>{
  try {
    if(m.command==='init') {
      ({lane,bits}=m);
      handle=m.file ? await m.file.createSyncAccessHandle({mode:'readwrite-unsafe'}) : null;
      host=hostFor(m.memory,bits,m.budget,handle,m.diskLimit,false);
      e=(await WebAssembly.instantiate(m.module,host.imports)).exports;
      postMessage({id:m.id,result:{ready:true}});
    } else if(m.command==='stack') {setStack(e,lane,bits);postMessage({id:m.id,result:0});}
    else if(m.command==='reduce') {const rc=e.gn_reduce_pair(lane);postMessage({id:m.id,result:rc});}
    else if(m.command==='close') {handle?.close();handle=null;postMessage({id:m.id,result:0});}
    else throw new Error('Unknown lane command');
  } catch(error) {postMessage({id:m.id,error:String(error.message||error)});}
};
