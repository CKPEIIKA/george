// SPDX-License-Identifier: MIT
import {NativeEngine} from './engine.js';
import {parseNativeJob} from './job-adapter.js';
let enabled=false,engine=null;
export async function dispatchNative(message,send=postMessage) {
  const {id,command,job,backend}=message;
  if(backend==='native'||job?.backend==='native')enabled=true;
  else if(command==='init')enabled=false;
  if(!enabled)return false;
  if(command==='cancel'){engine?.cancel();return true;}
  if(command==='init'){
    send({id,result:{name:'George Native NC',version:'0.1.0-experimental',backend:'native',ready:true,startupMs:0}});return true;
  }
  if(engine){send({id,error:'Native NC is busy',code:'BUSY'});return true;}
  // Reserve the dispatcher before any awaited identity/storage operation.
  engine={cancel(){}};
  let stdout='',owned=null;
  try {
    if(!job)throw new Error('Native NC does not evaluate Lisp. Use the presentation form or another backend.');
    const {fixture,target,modulus}=parseNativeJob(job);
    // Same input/order/field gets a stable checkpoint directory. User can request resume:false.
    const signature=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({fixture,modulus})));
    const key='job-'+[...new Uint8Array(signature)].slice(0,16).map(x=>x.toString(16).padStart(2,'0')).join('');
    const options=job.nativeOptions??{};
    let resume=options.resume??true;
    if(resume){
      try {
        const root=await navigator.storage.getDirectory();
        const dir=await (await root.getDirectoryHandle('george-native')).getDirectoryHandle(options.runKey??key);
        await dir.getFileHandle('basis.gnb');
        let found=false;
        for(const name of ['checkpoint-0.json','checkpoint-1.json']) {
          try {const cp=JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
            if(Number.isInteger(cp.completedThroughDegree)&&cp.completedThroughDegree<=target)found=true;
          } catch {}
        }
        resume=found;
      } catch {resume=false;}
    }
    engine=new NativeEngine({budgetBytes:Number(job.memoryMiB??2048)*1048576,runKey:key,resume,timeoutMs:job.timeoutMs??0,...options,resume,onEvent:event=>{
      if(event.type==='control')send({id,event});
      else if(event.type==='degree'||event.type==='stdout') {
        const text=event.type==='stdout'?event.text:`Native degree ${event.completedThroughDegree}: ${event.basisSize} rules, ${event.terms} terms, ${event.allocatedBytes} allocated bytes, ${event.diskBytes} bytes on disk.\n`;
        stdout=(stdout+text).slice(-32768);send({id,event:{type:'stdout',text}});
      } else send({id,event});
    }});
    owned=engine;
    const native=await engine.compute(fixture,target,modulus);
    const preview=native.preview??'';delete native.preview;
    const files={'result.gb':preview,'native-result.json':JSON.stringify(native,null,2)};
    send({id,result:{files,native,stdout,connected:true,elapsedMs:native.elapsedMs,memoryBytes:engine.memory.buffer.byteLength}});
  } catch(error) {
    const native=error.native??null;
    send({id,error:error.message||String(error),code:error.code,partialResult:{files:{'native-result.json':JSON.stringify(native??{error:String(error)},null,2)},native,stdout,interrupted:true}});
  } finally {
    if(owned)await owned.close();
    engine=null;
  }
  return true;
}
