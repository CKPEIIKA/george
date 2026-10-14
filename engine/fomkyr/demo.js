// SPDX-License-Identifier: MIT
import {requestIsolation} from './isolation.js';
let worker,control;const $=id=>document.getElementById(id),log=$('log');
window.runNative=async(options={})=>new Promise((resolve,reject)=>{
  worker=new Worker('./demo-worker.js',{type:'module'});log.textContent='';control=null;
  worker.onmessage=({data:m})=>{
    if(m.event?.type==='control'){control=m.event;return;}
    log.textContent=(log.textContent+JSON.stringify(m)+'\n').slice(-32768);
    if(m.result){window.lastResult=m.result;control=null;worker.terminate();resolve(m.result);}
    if(m.error){window.lastError=m;control=null;worker.terminate();reject(Object.assign(new Error(m.error),{code:m.code}));}
  };worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
  const degree=Object.hasOwn(options,'degree')?options.degree:($('degree').value===''?null:Number($('degree').value));
  worker.postMessage({degree,fixture:options.fixture,data:options.data,modulus:options.modulus??0,options:{budgetBytes:128*1048576,scratchBytes:32*1048576,workers:+$('workers').value,bits:$('bits').value,execution:$('execution').value,spill:$('spill').checked,monomialPruning:$('pruning').checked,...options}});
});
window.enableFomkyrIsolation=(reload=true)=>requestIsolation({workerURL:new URL('./fomkyr-isolation-worker.js',import.meta.url),scope:new URL('./',import.meta.url),reload});
$('run').onclick=()=>window.runNative().catch(e=>log.textContent+='\n'+e);
$('isolate').onclick=async()=>{log.textContent=JSON.stringify(await window.enableFomkyrIsolation());};
$('stop').onclick=()=>{if(control?.shared&&control.memory)Atomics.store(new Int32Array(control.memory.buffer,control.cancelOffset,1),0,1);worker?.postMessage({command:'cancel'});};
$('context').textContent=`crossOriginIsolated=${globalThis.crossOriginIsolated}; service workers=${!!navigator.serviceWorker}`;
