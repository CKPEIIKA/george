// George 0.6: add isolation headers on static hosts, without an offline cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (new URL(request.url).origin !== self.location.origin
      || (request.cache === 'only-if-cached' && request.mode !== 'same-origin')) return;
  event.respondWith((async () => {
    // Revalidate static assets so a published release also updates returning users.
    const response = await fetch(request, ['GET', 'HEAD'].includes(request.method) ? {cache: 'no-cache'} : {});
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  })());
});
