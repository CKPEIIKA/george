// Verify the release on a Pages-like server without COOP/COEP headers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {staticServer} from './serve.mjs';

const out = process.argv[2] || `build/validation/static-isolation-${Date.now()}`;
fs.mkdirSync(out, {recursive: true});
const report = {version: JSON.parse(fs.readFileSync('package.json')).version, startedAt: new Date().toISOString(),
  state: 'running', serverIsolationHeaders: false, checks: [], errors: [],
  sourceHashes: Object.fromEntries(['web/index.html','web/src/start.js','web/src/isolation.js','web/isolation-worker.js',
    'web/src/app.js','web/engine/native/george32.wasm','web/engine/native/george64.wasm'].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();
const browser = await chromium.launch({executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-dev-shm-usage']});
try {
  for (const mount of ['/', '/george/']) {
    const server = staticServer('web', mount);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}${mount}`;
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [], external = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('request', r => {if(new URL(r.url()).origin !== new URL(url).origin) external.push(r.url());});
    try {
      const direct = await fetch(url); assert.equal(direct.headers.has('cross-origin-opener-policy'), false);
      await page.goto(url);
      await page.locator('#engineNote.live').waitFor({timeout: 120000});
      assert.equal(await page.evaluate(() => crossOriginIsolated), true);
      assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
      assert.equal(await page.locator('.brand-version').textContent(), '0.6');
      assert.equal(await page.locator('.release-tag').textContent(), 'experimental');
      assert.equal(await page.locator('#backend option[value="native"]').evaluate(el => el.disabled), false);
      await page.locator('#vars').fill('x,y');
      await page.locator('#rels').fill('x^2,y^2,y*x-x*y');
      await page.locator('#maxdeg').fill('4');
      await page.locator('details.advanced').evaluate(el => el.open = true);
      await page.locator('#backend').selectOption('native');
      await page.locator('#memoryMiB').selectOption('512');
      await page.locator('#nativeWorkers').fill('2');
      const run = async () => {
        await page.locator('#go').click();
        await page.waitForFunction(() => document.getElementById('stop').hidden && /^Computed/.test(document.getElementById('runStatus').textContent), null, {timeout: 120000});
        return page.evaluate(() => JSON.parse([...document.querySelectorAll('#filesOut .file')]
          .find(e => e.querySelector('.name').textContent === 'native-result.json').querySelector('pre').textContent));
      };
      const first = await run(); assert.equal(first.bits, 32); assert.equal(first.workers, 2);
      await page.locator('#memoryMiB').selectOption('6144');
      const second = await run(); assert.equal(second.bits, 64);
      await page.reload(); await page.locator('#engineNote.live').waitFor({timeout: 120000});
      assert.equal(await page.locator('#backend').inputValue(), 'native');
      assert.equal(await page.locator('#nativeWorkers').inputValue(), '2');
      assert.equal(await page.evaluate(async () => (await fetch('./index.html')).headers.get('cross-origin-opener-policy')), 'same-origin');
      assert.deepEqual(await page.evaluate(() => caches.keys()), []);
      await page.locator('[data-lang="ru"]').click();
      assert.equal(await page.locator('.release-tag').textContent(), 'экспериментальная');
      assert.deepEqual(pageErrors, []); assert.deepEqual(external, []);
      report.checks.push({mount, isolated: true, native32Workers: 2, native64: true, reloadPreservesSettings: true, offlineCache: false, externalRequests: 0});
      await context.close();
      const blocked = await browser.newContext({serviceWorkers: 'block'});
      await blocked.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', {value: undefined}));
      const fallback = await blocked.newPage();
      await fallback.goto(url); await fallback.locator('#engineNote.live').waitFor({timeout: 120000});
      assert.equal(await fallback.evaluate(() => crossOriginIsolated), false);
      assert.equal(await fallback.locator('#backend option[value="native"]').evaluate(el => el.disabled), true);
      assert.equal(await fallback.locator('#backend').inputValue(), 'memory64');
      report.checks.push({mount, serviceWorkersBlocked: true, bergmanAvailable: true, nativeDisabled: true});
      await blocked.close(); save();
    } finally {
      await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
  }
  report.state = 'complete';
} catch (error) {
  report.state = 'failed'; report.errors.push(error.stack); throw error;
} finally {
  report.finishedAt = new Date().toISOString(); save(); await browser.close();
}
console.log(out, 'PASS');
