// Unit tests of the service-worker protocol, not browser conformance.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {requestIsolation} from '../web/isolation.js';
const entries=[],handlers={};let fetched=0;
const self={location:new URL('https://example.test/george/fomkyr-isolation-worker.js'),clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(k,f)=>handlers[k]=f};
vm.runInNewContext(fs.readFileSync(new URL('../web/fomkyr-isolation-worker.js',import.meta.url),'utf8'),{self,URL,Headers,Response,fetch:async()=>{fetched++;return new Response('source',{headers:{'Content-Type':'text/plain'}});}});
async function fetchEvent(url,method='GET'){let promise;handlers.fetch({request:{url,method,cache:'default',mode:'same-origin'},respondWith:p=>promise=p});return promise?await promise:null;}
let r=await fetchEvent('https://example.test/george/fomkyr32.wasm');assert.equal(await r.text(),'source');
assert.equal(r.headers.get('Cross-Origin-Opener-Policy'),'same-origin');assert.equal(r.headers.get('Cross-Origin-Embedder-Policy'),'require-corp');
assert.equal(await fetchEvent('https://other.test/x'),null);assert.equal(await fetchEvent('https://example.test/george/','POST'),null);assert.equal(fetched,1);
entries.push('same-origin response headers and cross-origin/POST non-interception');
globalThis.crossOriginIsolated=false;globalThis.isSecureContext=true;
globalThis.location={href:'https://example.test/george/#saved',origin:'https://example.test',reload(){this.reloads=(this.reloads||0)+1;}};
const store=new Map();globalThis.sessionStorage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
function serviceWorker(existing=null){const listeners=new Map();return {controller:existing,registrations:[],addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k);},async register(url,opts){this.registrations.push([String(url),opts]);this.controller={scriptURL:String(url)};listeners.get('controllerchange')?.();return {};}};}
let sw=serviceWorker({scriptURL:'https://example.test/george/isolation-worker.js'});
Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:sw},configurable:true});
r=await requestIsolation({workerURL:'./fomkyr-isolation-worker.js',scope:'./'});assert.equal(r.status,'existing-controller');assert.equal(sw.registrations.length,0);entries.push('existing service worker not replaced');
sw=serviceWorker();navigator.serviceWorker=sw;
r=await requestIsolation({workerURL:'./fomkyr-isolation-worker.js',scope:'./',reload:false});assert.equal(r.status,'reload-required');assert.equal(sw.registrations[0][1].scope,'https://example.test/george/');
r=await requestIsolation({workerURL:'./fomkyr-isolation-worker.js',scope:'./'});assert.equal(r.status,'reloading');assert.equal(location.reloads,1);
r=await requestIsolation({workerURL:'./fomkyr-isolation-worker.js',scope:'./'});assert.equal(r.status,'unavailable');assert.equal(location.reloads,1);entries.push('project scope and one-reload guard');
sw=serviceWorker();sw.register=async()=>new Promise(()=>{});navigator.serviceWorker=sw;
r=await requestIsolation({workerURL:'./fomkyr-isolation-worker.js',scope:'./',timeoutMs:10});assert.equal(r.status,'unavailable');entries.push('activation timeout is bounded');
globalThis.isSecureContext=false;r=await requestIsolation({});assert.equal(r.status,'unavailable');entries.push('insecure-context fallback');
fs.writeFileSync(new URL('../results/static-host-unit-tests.json',import.meta.url),JSON.stringify({passed:true,host:'Node with mocked service-worker events; not a browser test',tests:entries},null,2));console.log(entries.join('\n'));
