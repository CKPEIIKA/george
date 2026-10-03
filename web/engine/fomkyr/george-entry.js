// SPDX-License-Identifier: MIT
import {FomkyrEngine} from './engine.js';
import {parseNativeJob} from './job-adapter.js';
import {hilbertCSV} from './hilbert.js';
import {VERSION} from './storage.js';
let enabled=false,engine=null;
export async function dispatchFomkyr(message,send=postMessage){
  const {id,command,job,backend}=message;
  if(backend==='fomkyr'||job?.backend==='fomkyr')enabled=true;
  else if(command==='init')enabled=false;
  if(!enabled)return false;
  if(command==='cancel'){engine?.cancel();return true;}
  if(command==='init'){send({id,result:{name:'fomkyr',version:VERSION,backend:'fomkyr',ready:true,startupMs:0}});return true;}
  if(engine){send({id,error:'fomkyr is busy',code:'BUSY'});return true;}
  engine={cancel(){}};let stdout='',owned=null;
  try{
    if(!job)throw new Error('fomkyr does not evaluate Lisp. Use a homogeneous presentation and the Gröbner basis task.');
    const {fixture,target,modulus}=parseNativeJob(job);
    const options=job.fomkyrOptions??job.nativeOptions??{};
    engine=new FomkyrEngine({budgetBytes:Number(job.memoryMiB??3584)*1048576,timeoutMs:job.timeoutMs??0,...options,onEvent:event=>{
      if(['degree-start','degree','progress','phase','capabilities'].includes(event.type)&&engine?.memory)send({id,event:{type:'memory',bytes:engine.memory.buffer.byteLength}});
      if(event.type==='degree')send({id,event});
      if(event.type==='cache'&&event.resumedFromDegree>0)send({id,event:{type:'degree',completedThroughDegree:event.resumedFromDegree,source:'checkpoint'}});
      if(event.type==='degree'||event.type==='stdout'){
        const text=event.type==='stdout'?event.text:`fomkyr degree ${event.completedThroughDegree}: ${event.basisSize} rules; ${event.allocatedBytes} allocated bytes; ${event.diskBytes} disk bytes.\n`;
        stdout=(stdout+text).slice(-32768);send({id,event:{type:'stdout',text}});
      }else {
        if(event.type==='warning'){const text='fomkyr warning: '+event.message+'\n';stdout=(stdout+text).slice(-32768);send({id,event:{type:'stdout',text}});}
        if(event.type==='capabilities'){const text=`fomkyr runtime: wasm${event.bits}, ${event.shared?'shared':'single-worker'}, ${event.workers} CPU lane(s), ${event.ioMode}; budget ${event.effectiveBudgetBytes} bytes.\n`;stdout=(stdout+text).slice(-32768);send({id,event:{type:'stdout',text}});}
        if(event.type==='memory-plan'||event.type==='memory-adaptation'){const text='fomkyr '+event.type+': '+JSON.stringify(event)+'\n';stdout=(stdout+text).slice(-32768);send({id,event:{type:'stdout',text}});}
        send({id,event});
      }
    }});owned=engine;
    const result=await engine.compute(fixture,target,modulus),preview=result.preview??'';delete result.preview;
    const files={'result.gb':preview,'fomkyr-result.json':JSON.stringify({...result,elapsedSeconds:result.elapsedMs/1000,elapsedMs:undefined},null,2)};
    if(result.hilbert){
      files['hilbert.json']=JSON.stringify(result.hilbert,null,2);
      if(result.hilbert.coefficients){
        files['hilbert.csv']=hilbertCSV(result.hilbert);
        files['result.hs']=(result.hilbert.conditionalOnExternalDimensions?'% CONDITIONAL ON EXPLICITLY ASSUMED EXTERNAL DIMENSIONS; evidence '+result.hilbert.hilbertEvidenceId+'\n':'')+'% Exact coefficients through degree '+result.hilbert.certifiedThroughDegree+'; no rational extrapolation\n'+result.hilbert.coefficients.map((c,d)=>`${c}*t^${d}`).join(' + ')+` + O(t^${result.hilbert.certifiedThroughDegree+1})\n`;
      }
    }
    send({id,result:{files,fomkyr:result,stdout,connected:true,elapsedMs:result.elapsedMs,memoryBytes:engine.memory.buffer.byteLength}});
  }catch(error){
    const result=error.native??null;
    send({id,error:error.message||String(error),code:error.code,partialResult:{files:{'fomkyr-result.json':JSON.stringify(result??{error:String(error)},null,2)},fomkyr:result,checkpoint:engine?.lastCheckpoint??null,stdout,interrupted:true}});
  }finally{try{if(owned)await owned.close();}finally{engine=null;send({closed:true});}}
  return true;
}
export {dispatchFomkyr as dispatchNative};
