// Install before loading the app. A first visit to a static host reloads once;
// blocked service workers leave the other computation engines available.
export async function prepareIsolation(env = globalThis, timeoutMs = 10000) {
  if (env.crossOriginIsolated) return 'ready';
  const worker = env.navigator?.serviceWorker;
  if (!env.isSecureContext || !worker || worker.controller) return 'unavailable';
  let listener, timer;
  const controlled = new Promise(resolve => {
    listener = () => { if (worker.controller) resolve(true); };
    worker.addEventListener('controllerchange', listener);
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    const registered = worker.register(new URL('../isolation-worker.js', import.meta.url), {
      scope: new URL('../', import.meta.url).href, updateViaCache: 'none',
    });
    // The timeout also covers registration, including blocked/private contexts.
    const registration = await Promise.race([registered, controlled.then(value => value ? true : false)]);
    if (!registration || (!worker.controller && !await controlled)) return 'unavailable';
    env.location.reload();
    return 'reloading';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
    worker.removeEventListener('controllerchange', listener);
  }
}
