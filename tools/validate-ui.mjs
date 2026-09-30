// Local UI and GitHub Pages project-path checks. No remote deployment.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { staticServer } from './serve.mjs';
import { TUTORIALS, tutorialForm } from '../web/src/tutorials.js';
import { EXAMPLES } from '../web/src/examples.js';
const out = `build/validation/ui-${Date.now()}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const servers = [];
const report = { browser: browser.version(), mounts: [], examples: [], checks: [], errors: [], externalRequests: [] };
let activePage;
const rawFiles = page => page.locator('#filesOut .file').evaluateAll(files => Object.fromEntries(files.map(el => [el.querySelector('.name').textContent, el.querySelector('pre').textContent])));
const formState = page => page.locator('#presentation').evaluate(el => [...el.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id || n.name + ':' + n.value, value: n.value, checked: n.checked ?? null })));
// The theme button cycles automatic, light, dark; the language switch is two buttons.
const setTheme = async (page, value) => {
  for (let i = 0; i < 3 && await page.locator('#theme').getAttribute('data-pref') !== value; i++) await page.locator('#theme').click();
  assert.equal(await page.locator('#theme').getAttribute('data-pref'), value);
};
const setLang = (page, value) => page.locator(`[data-lang="${value}"]`).click();
const currentLang = page => page.locator('[data-lang][aria-pressed="true"]').getAttribute('data-lang');
const ready = page => page.waitForFunction(() => document.querySelector('#engineNote').classList.contains('live'), null, { timeout: 60000 });
const mathReady = page => page.waitForFunction(() => document.querySelectorAll('#guideContent mjx-container[jax="SVG"] svg').length >= 20, null, { timeout: 60000 });
const compute = async page => {
  await page.locator('#go').click();
  await page.waitForFunction(() => !document.querySelector('#stop').hidden, null, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#stop').hidden, null, { timeout: 120000 });
  assert.match(await page.locator('#runStatus').textContent(), /^(Computed|Вычислено)/);
};
try {
  for (const mount of ['/', '/george/']) {
    const server = staticServer('web', mount); servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = origin + mount;
    const context = await browser.newContext({ locale: 'en-US', colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
    await context.route('**/*', route => {
      const requested = new URL(route.request().url());
      if (requested.origin !== origin) { report.externalRequests.push(requested.href); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.on('pageerror', error => report.errors.push(error.message));
    const badResponses = [], requests = [], diagnostics = [];
    page.on('request', request => requests.push(request.url()));
    page.on('response', response => { if (response.status() >= 400) badResponses.push([response.url(), response.status()]); });
    page.on('console', message => { if (message.type() === 'error' || /Invalid option|MathJax\(/.test(message.text())) diagnostics.push(message.text()); });
    console.log('Checking', mount);
    await page.goto(url);
    await ready(page);
    await setTheme(page, 'light');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(238, 242, 243)');
    await setTheme(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(17, 26, 39)');
    await setTheme(page, 'auto');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(238, 242, 243)');
    assert.equal(await page.locator('html').getAttribute('data-theme'), null);
    report.checks.push(`${mount}: explicit light/dark override OS; automatic follows OS`);
    await page.locator('#preset').selectOption('tutorial:weights');
    await compute(page);
    const before = await formState(page), files = await rawFiles(page);
    await setLang(page, 'ru');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.match(await page.locator('#go').textContent(), /Вычислить/);
    assert.match(await page.locator('#runStatus').textContent(), /Вычислено/);
    assert.deepEqual(await formState(page), before);
    assert.deepEqual(await rawFiles(page), files);
    await page.locator('a[data-view="guide"]').click();
    await page.waitForFunction(() => document.querySelector('#guideTitle')?.textContent === 'Руководство пользователя' && document.querySelector('#guideContent').getAttribute('aria-busy') === 'false');
    await mathReady(page);
    assert.equal(await page.locator('#guideTitle').textContent(), 'Руководство пользователя');
    assert.equal(await page.locator('#guideContent [data-mjx-error], #guideContent mjx-merror').count(), 0);
    assert.equal(await page.locator('#mathNotice').isVisible(), false);
    await setTheme(page, 'dark');
    await page.screenshot({ path: `${out}/${mount === '/' ? 'root' : 'project'}-guide-ru-dark.png`, fullPage: true });
    await page.reload();
    await ready(page); await mathReady(page);
    assert.equal(await currentLang(page), 'ru');
    assert.equal(await page.locator('#theme').getAttribute('data-pref'), 'dark');
    assert.deepEqual(await formState(page), before);
    // Exercise queued retypesetting, including a rapid language round trip.
    await setLang(page, 'en');
    await setLang(page, 'ru');
    await setLang(page, 'en');
    await page.waitForFunction(() => document.querySelector('#guideTitle')?.textContent === 'User guide' && document.querySelector('#guideContent').getAttribute('aria-busy') === 'false');
    await mathReady(page);
    assert.equal(await page.locator('#guideContent [data-mjx-error]').count(), 0);
    report.checks.push(`${mount}: EN/RU controls, status, guide; state/files preserved; preferences persist; MathJax retypesets`);
    await page.locator('#guideContent a[href="#guide-options"]').click();
    assert.equal(await page.locator('#view-guide').isVisible(), true);
    assert.equal(new URL(page.url()).hash, '#guide-options');
    for (const item of [
      { vars: 'a, ab, bc, c', rels: 'a*bc-a, ab*c-ab', augmentation: 'graded', betti: [1, 2, 0], names: ['ab', 'bc'] },
      { vars: 'x_1, x_11', rels: 'x_1^2-1', augmentation: 'monoid', betti: [1, 1, 0], names: ['x_1', 'x_11'] }
    ]) {
      await page.goto(url + '#compute');
      await page.locator('#preset').selectOption('tutorial:nonhomogeneous');
      await page.locator('#vars').fill(item.vars);
      await page.locator('#rels').fill(item.rels);
      await page.locator('#maxdeg').fill('8');
      await page.locator('details.advanced').evaluate(el => el.open = true);
      await page.locator('#augmentation').selectOption(item.augmentation);
      await compute(page);
      const files = await rawFiles(page);
      assert.ok(files['resolution.jsonl']);
      assert.deepEqual(JSON.parse(files['homology.json']).betti.slice(0, 3), item.betti);
      const renderedNames = await page.locator('#resolutionOut var').allTextContents();
      for (const name of item.names) assert.ok(renderedNames.includes(name), `whole generator token ${name}`);
      if (item.augmentation === 'graded') assert.equal(await page.locator('#resolutionOut section').nth(1).locator('.tensor-line').count(), 2);
    }
    report.checks.push(`${mount}: overlapping/underscore names; two colliding compact chains retained; exact homology and whole-token rendering`);
    if (mount === '/george/') {
      for (const item of TUTORIALS) {
        await page.goto(url + '#guide-examples'); await ready(page); await mathReady(page);
        await page.locator(`[data-tutorial="${item.id}"]`).click();
        assert.equal(await page.locator('#view-compute').isVisible(), true);
        assert.equal(await page.locator('#preset').inputValue(), 'tutorial:' + item.id);
        const expected = tutorialForm(item.id);
        assert.equal(await page.locator('#vars').inputValue(), expected.vars.join(', '));
        assert.equal(await page.locator('input[name="task"]:checked').inputValue(), expected.task);
        assert.equal(await page.locator('#augmentation').inputValue(), expected.augmentation);
        await compute(page);
        const result = await rawFiles(page);
        if (item.example) {
          const example = EXAMPLES.find(e => e.id === item.example);
          for (const [kind, content] of Object.entries(example.out)) assert.equal(result['result.' + kind], content, item.id + '/' + kind);
        } else {
          const homology = JSON.parse(result['homology.json']);
          assert.deepEqual(homology.betti.slice(0, 5), [1, 1, 0, 0, 0], item.id);
          assert.ok(await page.locator('#resolutionOut .tensor-line').count() > 0);
        }
        report.examples.push({ id: item.id, task: expected.task, outputs: Object.keys(result),
          hashes: Object.fromEntries(Object.entries(result).map(([n, s]) => [n, crypto.createHash('sha256').update(s).digest('hex')])) });
        console.log(item.id, 'PASS');
      }
      // Downloads and the actual MIME type needed for streaming Wasm.
      for (const file of ['engine/ecl.wasm', 'sources/george-source.tar.gz', 'sources/ecl-source.tar.gz', 'licenses/NOTICE.txt', '.nojekyll']) {
        const response = await context.request.get(url + file); assert.equal(response.status(), 200, file);
        if (file.endsWith('.wasm')) assert.match(response.headers()['content-type'], /application\/wasm/);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await setTheme(page, 'light');
      await page.locator('a[data-view="guide"]').click(); await mathReady(page);
      await page.screenshot({ path: `${out}/project-guide-en-light-mobile.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page overflow');
      await page.locator('[data-tutorial="monoid"]').click(); await compute(page);
      await page.screenshot({ path: `${out}/project-result-mobile.png`, fullPage: true });
      // Stored edits to a historical preset must survive reloading too.
      await page.locator('#switchInput').click();
      await page.locator('#preset').selectOption('example:char2');
      await page.locator('#maxdeg').fill('4');
      await page.reload(); await ready(page);
      assert.equal(await page.locator('#maxdeg').inputValue(), '4');
      report.checks.push('project path: all eight guide buttons compute; reference equality and ungraded ranks; MIME/downloads; mobile; edited preset persists');
    }
    assert.deepEqual(badResponses, []); assert.deepEqual(diagnostics, []);
    assert.ok(requests.every(r => new URL(r).pathname.startsWith(mount)), 'all assets use the project prefix');
    assert.ok(requests.every(r => !new URL(r).pathname.includes('//')), 'asset paths contain no double slashes');
    report.mounts.push({ mount, requests: requests.length, mathjaxSVGs: await page.locator('#guideContent mjx-container[jax="SVG"] svg').count(), badResponses, diagnostics });
    await context.close();
  }
  const context = await browser.newContext({ locale: 'ru-RU' });
  await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${servers[0].address().port}/`); await ready(page);
  assert.equal(await currentLang(page), 'ru');
  await page.locator('#preset').selectOption('tutorial:char2'); await compute(page);
  report.checks.push('blocked storage: browser language detected; preferences and computation work');
  await context.close();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(out, 'PASS');
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  if (activePage && !activePage.isClosed()) report.lastState = await activePage.evaluate(() => ({
    language: document.documentElement.lang, title: document.querySelector('#guideTitle')?.textContent,
    mathBusy: document.querySelector('#guideContent')?.getAttribute('aria-busy'), mathNotice: document.querySelector('#mathNotice')?.textContent,
  })).catch(() => null);
  fs.writeFileSync(`${out}/failure.json`, JSON.stringify({ ...report, failure: error.stack }, null, 2));
  throw error;
} finally { await browser.close(); for (const server of servers) server.close(); }
