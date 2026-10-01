import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildJob } from '../web/src/bergman-syntax.js';
const out = `build/validation/browser-${Date.now()}`;
fs.mkdirSync(out, { recursive: true });
// Normal-browser full-suite checks and timings are in the uninstrumented tool.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GEORGE_URL || 'http://127.0.0.1:8000/');
  await page.waitForFunction(() => document.querySelector('#engineNote').textContent.includes('is ready'), null, { timeout: 60000 });
  await page.evaluate(async () => { const { EclEngine } = await import('./src/engine.js'); window.testEngine = new EclEngine(); window.ticks = 0; window.tickTimer = setInterval(() => window.ticks++, 20); });
  console.log('Browser ready');
  const report = [];
  for (const legacy of [true, false]) {
    console.log('Regression', legacy);
    const job=buildJob({task:'gb',vars:['x','y'],rels:['x*y','x^2-y^2'],ring:'noncomm',order:'degleftlex',field:'0',maxdeg:6,legacy});
    const r = await page.evaluate(async job => { const ticks = window.ticks; const t = performance.now(); const result = await window.testEngine.run(job); return { ...result, totalMs: performance.now() - t, ticks: window.ticks - ticks, isolated: crossOriginIsolated }; }, job);
    fs.writeFileSync(`${out}/${legacy ? 'legacy' : 'fixed'}.log`, r.stdout);
    assert.match(r.files['result.gb'],/x\^3/);
    assert.ok(r.ticks > 1, 'main thread remains responsive');
    assert.equal(r.isolated, false, 'no COOP/COEP needed');
    console.log({legacy, elapsedMs:r.elapsedMs,totalMs:r.totalMs});
    report.push({ legacy, totalMs: r.totalMs, computationMs: r.elapsedMs, memoryBytes: r.memoryBytes, ticks: r.ticks });
  }
  console.log('Cancellation');
  const cancelled = await page.evaluate(async () => {
    const p = window.testEngine.eval('(LOOP)').then(() => 'unexpected', e => e.name);
    await new Promise(r => setTimeout(r, 150)); window.testEngine.cancel();
    const name = await p;
    const r = await window.testEngine.eval('(EXPT 3 40)');
    return { name, stdout: r.stdout };
  });
  assert.equal(cancelled.name, 'AbortError');
  assert.match(cancelled.stdout, /12157665459056928801/);
  const growth=await page.evaluate(async()=>window.testEngine.eval('(PROGN (SETQ GEORGESTRESS (MAKE-ARRAY 100000000 :ELEMENT-TYPE \'(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 7)) (PRINT (AREF GEORGESTRESS 99999999)) (SETQ GEORGESTRESS NIL) (GC) (EXPT 3 40))'));
  assert.match(growth.stdout,/12157665459056928801/);assert.ok(growth.memoryBytes>67108864);
  const limit=await page.evaluate(async()=>window.testEngine.eval("(EXT:GET-LIMIT 'EXT:HEAP-SIZE)"));
  assert.match(limit.stdout,/2147483648/,'default Lisp heap allows 2 GiB');
  let largeMemory=null;
  if(process.env.GEORGE_LARGE_MEMORY==='1'){
    largeMemory=await page.evaluate(async()=>window.testEngine.eval(`(PROGN
      (EXT:SET-LIMIT 'EXT:HEAP-SIZE 3758096384)
      (SETQ GEORGESTRESS NIL)
      (DOTIMES (I 27) (PUSH (MAKE-ARRAY 125829120 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 7) GEORGESTRESS))
      (PRINT (LIST (LENGTH GEORGESTRESS) (AREF (FIRST GEORGESTRESS) 125829119)))
      (SETQ GEORGESTRESS NIL) (EXT:GC) (EXPT 3 40))`));
    assert.match(largeMemory.stdout,/\(27 7\)/);assert.match(largeMemory.stdout,/12157665459056928801/);
    assert.ok(largeMemory.memoryBytes>3221225472,'allocation and access work beyond 3 GiB');
    console.log('Large memory passed',largeMemory.memoryBytes);
  }
  const memoryFailure=await page.evaluate(async()=>{
    const {buildJob}=await import('./src/bergman-syntax.js');
    const job=buildJob({task:'gb',vars:['x'],rels:['x^2'],ring:'noncomm',order:'degleftlex',field:'0',memoryMiB:128});
    job.script=job.script.replace('(CLEARRING)',`(SETQ GEORGESTRESS (LIST
      (MAKE-ARRAY 80000000 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 1)
      (MAKE-ARRAY 80000000 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 2)))`);
    try {await window.testEngine.run(job);throw new Error('expected exhaustion');}
    catch(error){return {code:error.code,files:error.partialResult?.files,interrupted:error.partialResult?.interrupted,released:!window.testEngine.worker};}
  });
  assert.equal(memoryFailure.code,'memory-limit');assert.match(memoryFailure.files['result.gb'],/x\^2/);
  assert.equal(memoryFailure.interrupted,true);assert.equal(memoryFailure.released,true);
  assert.match((await page.evaluate(async()=>window.testEngine.eval('(+ 1 2)'))).stdout,/3/);
  await page.locator('details').evaluate(el=>el.open=true);
  await page.locator('#memoryMiB').selectOption('3584');
  // Drive the form's actual memory-failure path with a small, reproducible heap.
  await page.evaluate(async()=>{
    const {EclEngine}=await import('./src/engine.js');const run=EclEngine.prototype.run;
    EclEngine.prototype.run=function(job,onEvent){
      EclEngine.prototype.run=run;job.memoryMiB=128;
      job.script=job.script.replace('(CLEARRING)',`(SETQ GEORGESTRESS (LIST
        (MAKE-ARRAY 80000000 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 1)
        (MAKE-ARRAY 80000000 :ELEMENT-TYPE '(UNSIGNED-BYTE 8) :INITIAL-ELEMENT 2)))`);
      return run.call(this,job,onEvent);
    };
  });
  await page.locator('#go').click();
  await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.startsWith('Stopped after reaching'),null,{timeout:60000});
  assert.match(await page.locator('#basisOut .notice').textContent(),/saved partial basis/);
  assert.ok(await page.locator('#basisOut .polys li').count()>0);
  await page.locator('[data-lang="ru"]').click();
  assert.match(await page.locator('#runStatus').textContent(),/предел памяти 128/);
  assert.match(await page.locator('#basisOut .notice').textContent(),/частичный/);
  await page.locator('[data-lang="en"]').click();
  await page.locator('#go').click();
  await page.waitForFunction(() => document.querySelector('#runStatus').textContent.startsWith('Computed'), null, { timeout: 60000 });
  assert.ok(await page.locator('#basisOut .polys li').count() > 0);
  await page.locator('#vars').fill('x, y');
  await page.locator('#rels').fill('x^2-1');
  await page.locator('#maxdeg').fill('6');
  await page.locator('input[name="task"][value="anick"]').check();
  await page.locator('details').evaluate(el=>el.open=true);
  await page.locator('#augmentation').selectOption('monoid');
  await page.locator('#go').click();
  await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.startsWith('Computed'),null,{timeout:60000});
  assert.match(await page.locator('#bettiOut').textContent(),/Ungraded Betti numbers/);
  assert.match(await page.locator('#resolutionOut').textContent(),/shift/i);
  await page.goto((process.env.GEORGE_URL||'http://127.0.0.1:8000/')+'#console');
  await page.locator('#promptInput').fill('(LOOP)');
  await page.locator('#promptInput').press('Enter');
  await page.locator('#stopConsole').waitFor({state:'visible'});
  await page.waitForTimeout(150);
  await page.locator('#stopConsole').click();
  await page.waitForFunction(()=>document.querySelector('#terminal').textContent.includes('Stopped.'));
  await page.locator('#promptInput').fill('(EXPT 3 40)');
  await page.locator('#promptInput').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#terminal').textContent.includes('12157665459056928801'));
  await page.goto((process.env.GEORGE_URL||'http://127.0.0.1:8000/')+'#compute');
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#switchOutput').click();
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ report, cancellation: cancelled.name, exactInteger: cancelled.stdout.trim(), memoryGrowthBytes:growth.memoryBytes, largeMemoryBytes:largeMemory?.memoryBytes, memoryFailure, errors, browser: browser.version() }, null, 2));
  console.log(JSON.stringify({ out, report, cancellation: cancelled.name, errors }, null, 2));
} finally { await browser.close(); }
