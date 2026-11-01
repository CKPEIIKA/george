// SPDX-License-Identifier: MIT
import {IO_HEADER} from './io-broker.js';
let handle=null,ports=[];
self.onmessage=async({data:m})=>{
 try{
  if(m.command==='init'){
   handle=await m.file.createSyncAccessHandle();ports=m.ports;
   for(let lane=0;lane<ports.length;lane++){
    const buffer=m.buffers[lane],c=new Int32Array(buffer,0,16),view=new DataView(buffer),shared=new Uint8Array(buffer,IO_HEADER);
    // OPFS accepts a non-shared buffer everywhere; this single buffer is reused.
    const bounce=new Uint8Array(shared.length);
    ports[lane].onmessage=()=>{
     if(Atomics.load(c,0)!==1)return;
     try{
      const op=c[1],size=c[2],at=Number(view.getBigUint64(16,true));
      if(size<0||size>bounce.length||!Number.isSafeInteger(at))throw new Error('Invalid mailbox');
      if(op===1){const n=handle.read(bounce.subarray(0,size),{at});shared.set(bounce.subarray(0,n));c[3]=n;}
      else if(op===2){bounce.set(shared.subarray(0,size));c[3]=handle.write(bounce.subarray(0,size),{at});}
      else if(op===3)view.setBigUint64(32,BigInt(handle.getSize()),true);
      else if(op===4)handle.truncate(at);
      else if(op===5)handle.flush();
      else throw new Error('Unknown I/O opcode');
      Atomics.store(c,0,2);
     }catch(e){c[6]=e.name==='QuotaExceededError'?1:2;Atomics.store(c,0,-1);}
     finally{Atomics.notify(c,0,1);}
    };
    ports[lane].start();
   }
   postMessage({id:m.id,result:{ready:true}});
  }else if(m.command==='close'){handle?.flush();handle?.close();handle=null;for(const p of ports)p.close();postMessage({id:m.id,result:0});}
 }catch(e){postMessage({id:m.id,error:e.message});}
};
