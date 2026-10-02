import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {prepareIsolation} from '../web/src/isolation.js';

function browser(register) {
  const listeners = new Set();
  const worker = {controller: null, register,
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn)};
  const env = {isSecureContext: true, crossOriginIsolated: false, navigator: {serviceWorker: worker},
    reloads: 0, location: {reload: () => env.reloads++}};
  return {env, worker, listeners, control() {worker.controller = {}; for (const fn of listeners) fn();}};
}

test('static isolation waits for control and reloads once before starting the app', async () => {
  const b = browser(async (url, options) => {
    assert.ok(url.pathname.endsWith('/web/isolation-worker.js'));
    assert.ok(options.scope.endsWith('/web/')); assert.equal(options.updateViaCache, 'none');
    queueMicrotask(() => b.control()); return {};
  });
  assert.equal(await prepareIsolation(b.env), 'reloading'); assert.equal(b.env.reloads, 1);
  assert.equal(b.listeners.size, 0);
  assert.equal(await prepareIsolation(b.env), 'unavailable'); assert.equal(b.env.reloads, 1);
  b.env.crossOriginIsolated = true; assert.equal(await prepareIsolation(b.env), 'ready');
});

test('blocked or unavailable isolation leaves the app usable without reload loops', async () => {
  for (const register of [async () => {throw Error('blocked');}, () => new Promise(() => {})]) {
    const b = browser(register); assert.equal(await prepareIsolation(b.env, 5), 'unavailable');
    assert.equal(b.env.reloads, 0); assert.equal(b.listeners.size, 0);
  }
  assert.equal(await prepareIsolation({isSecureContext: false}), 'unavailable');
  assert.equal(await prepareIsolation({isSecureContext: true, navigator: {}}), 'unavailable');
});

test('isolation worker preserves response content and revalidates same-origin assets', async () => {
  const handlers = {}, requests = [];
  const self = {location: {origin: 'https://example.org'}, addEventListener: (kind, fn) => handlers[kind] = fn};
  vm.runInNewContext(fs.readFileSync('web/isolation-worker.js', 'utf8'), {self, URL, Headers, Response,
    fetch: async (request, options) => {requests.push({request, options}); return new Response('fresh', {headers: {'content-type': 'application/wasm'}});}});
  let response;
  handlers.fetch({request: new Request('https://example.org/george/engine/native/george32.wasm'), respondWith: p => response = p});
  const r = await response;
  assert.equal(await r.text(), 'fresh'); assert.equal(r.headers.get('content-type'), 'application/wasm');
  assert.equal(r.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(r.headers.get('cross-origin-embedder-policy'), 'require-corp');
  assert.equal(requests[0].options.cache, 'no-cache');
  handlers.fetch({request: new Request('https://other.example/'), respondWith: () => assert.fail('outside site scope')});
  assert.equal(requests.length, 1);
});
