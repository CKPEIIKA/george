// SPDX-License-Identifier: MIT
// Opt-in static-host isolation. Never replaces an unrelated service worker,
// never loops reloads, and never changes a server's security configuration.
export async function requestIsolation({workerURL,scope,timeoutMs=10000,reload=true}={}){
  if(globalThis.crossOriginIsolated)return {status:'ready'};
  if(!globalThis.isSecureContext||!navigator.serviceWorker)return {status:'unavailable',reason:'HTTPS/localhost and service workers are required. The single-worker build remains available.'};
  const sw=navigator.serviceWorker;
  const url=new URL(workerURL??'./fomkyr-isolation-worker.js',location.href);
  const root=new URL(scope??'./',url);
  if(url.origin!==location.origin||root.origin!==location.origin)throw new Error('Isolation worker and scope must be same-origin');
  if(sw.controller&&sw.controller.scriptURL!==url.href)return {status:'existing-controller',reason:'An existing project service worker controls this page. Its isolation configuration is retained; fomkyr will not replace it.'};
  let timer,listener;
  try{
    const changed=new Promise(resolve=>{listener=()=>{if(sw.controller?.scriptURL===url.href)resolve(true);};sw.addEventListener('controllerchange',listener);});
    const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);});
    const work=(async()=>{await sw.register(url,{scope:root.href,updateViaCache:'none'});return sw.controller?.scriptURL===url.href?true:changed;})();
    if(!await Promise.race([work,timeout]))return {status:'unavailable',reason:'Service worker activation timed out; single-worker execution is still usable.'};
    if(!reload)return {status:'reload-required'};
    const key='fomkyr-isolation-reloaded:'+root.pathname;
    try{if(sessionStorage.getItem(key))return {status:'unavailable',reason:'A reload was already attempted. This context still denies isolation; using the single-worker fallback.'};sessionStorage.setItem(key,'1');}catch{return {status:'reload-required',reason:'Reload manually; session storage is unavailable.'};}
    location.reload();return {status:'reloading'};
  }catch(error){return {status:'unavailable',reason:error.message};}
  finally{clearTimeout(timer);if(listener)sw.removeEventListener('controllerchange',listener);}
}
