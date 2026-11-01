// SPDX-License-Identifier: MIT
// This file must be installed at the static project's root, not /engine/fomkyr/.
// No offline cache and no cross-origin interception. COEP=require-corp avoids
// depending on credentialless support. Project assets remain same-origin.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const r=event.request,u=new URL(r.url);
  if(u.origin!==self.location.origin||!['GET','HEAD'].includes(r.method)||
      (r.cache==='only-if-cached'&&r.mode!=='same-origin'))return;
  event.respondWith((async()=>{
    const response=await fetch(r,{cache:'no-cache'});
    if(response.type==='opaque'||response.status===0)return response;
    const headers=new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy','same-origin');
    headers.set('Cross-Origin-Embedder-Policy','require-corp');
    headers.set('Cross-Origin-Resource-Policy','same-origin');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  })());
});
