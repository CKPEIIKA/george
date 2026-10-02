// Real George UI, real Wasm/OPFS: Chromium and Firefox, isolated and plain hosts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {chromium, firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {createShareLink} from '../web/src/share.js';

const out = path.resolve(process.argv[2] || 'build/validation/fomkyr-browser');
fs.mkdirSync(out, {recursive:true});
const report = {state:'running', startedAt:new Date().toISOString(), checks:[], errors:[],
  method:'Real browsers use the production George form, workers and OPFS. Tests are serial. Every computation has a 120-second deadline.',
  hashes:Object.fromEntries(['web/index.html','web/style.css','web/src/i18n.js','web/src/app.js','web/src/engine.js','web/src/share.js','web/src/fomkyr-options.js','web/src/degree-progress.js',
    ...fs.readdirSync('web/engine/fomkyr').map(name=>'web/engine/fomkyr/'+name)].map(file=>
    [file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
const save = () => fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const meta = page => page.evaluate(() => {
  const file = [...document.querySelectorAll('#filesOut .file')].find(node=>node.querySelector('.name').textContent==='fomkyr-result.json');
  return file ? JSON.parse(file.querySelector('pre').textContent) : null;
});
async function run(page) {
  await page.locator('#go').click();
  await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});
  assert.match(await page.locator('#runStatus').textContent(),/^Computed/);
  assert.doesNotMatch(await page.locator('#runStatus').textContent(),/\bms\b|мс/);
  const result = await meta(page); assert.ok(result?.complete);
  assert.ok(Number.isFinite(result.elapsedSeconds));assert.equal(result.elapsedMs,undefined);
  assert.ok((await page.locator('#engineNote').textContent()).startsWith('fomkyr'));
  return result;
}
try {
  for (const [name, launcher, options] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],
    ['firefox',firefox,{executablePath:process.env.GEORGE_FIREFOX || path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]) {
    const requested=process.argv.find(arg=>arg.startsWith('--browser='))?.split('=')[1];
    if(requested && requested!==name)continue;
    const browser = await launcher.launch({headless:true,...options});
    try {
      for (const mount of ['/', '/george/']) for (const isolated of [true,false]) {
        console.log(name,mount,isolated?'isolated':'plain','starting');
        const server = staticServer('web',mount,{isolate:isolated});
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const url = `http://127.0.0.1:${server.address().port}${mount}`;
        const context = await browser.newContext({serviceWorkers:isolated?'allow':'block',acceptDownloads:true});
        if (!isolated) await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
        await context.addInitScript(()=>{
          window.__fomkyrPhases=[];
          const Base=window.Worker;
          window.Worker=class extends Base{
            constructor(...args){super(...args);this.addEventListener('message',({data})=>{
              if(data.event?.type==='phase')window.__fomkyrPhases.push(data.event.phase);
            });}
          };
        });
        const page = await context.newPage(), errors=[], external=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('request',request=>{if(new URL(request.url()).origin!==new URL(url).origin)external.push(request.url());});
        try {
          await page.goto(url);await page.locator('#engineNote.live').waitFor({timeout:120000});
          await page.locator('details.advanced').evaluate(node=>node.open=true);
          assert.equal(await page.locator('#engineSettings').evaluate(node=>node.open),false);
          assert.equal(await page.locator('details.advanced #backend').count(),0);
          assert.equal(await page.locator('#engineSettings').evaluate(node=>node.closest('details.advanced')),null);
          assert.equal(await page.locator('#backend').isVisible(),false);
          assert.equal(await page.locator('#augmentation').isVisible(),true);
          await page.locator('#engineSettings > summary').click();
          await page.locator('#backend').selectOption('fomkyr');
          assert.equal(await page.locator('#monomialPruning').isChecked(),true);
          for(const option of ['spill','resume','heapReduction','wordMatcher','chainCriterion','eagerPruning','quadraticRewrite','costScheduling','progress'])assert.equal(await page.locator('#fomkyr-'+option).isChecked(),true);
          assert.equal(await page.locator('#fomkyr-hilbert').isChecked(),false);
          assert.equal(await page.locator('#nativeWorkers').inputValue(),'0');
          assert.equal(await page.locator('#fomkyr-batchPairs').inputValue(),'');
          assert.equal(await page.locator('#fomkyr-scratchMiB').inputValue(),'');
          await page.locator('#vars').fill('a,b');
          await page.locator('#rels').fill('a^2,b^2,b*a-a*b');
          assert.equal(await page.locator('#monomialPruning').isChecked(),true);
          await page.locator('#monomialPruning').uncheck();
          await page.locator('#backend').selectOption('compiled');await page.locator('#backend').selectOption('fomkyr');
          assert.equal(await page.locator('#monomialPruning').isChecked(),false);
          // Legacy links migrate the public selector to fomkyr; the fragment is preserved.
          const legacy = await createShareLink({backend:'native',varsText:'x,y',relsText:'x^2,y^2,y*x-x*y',maxdeg:'4',maxserdeg:'4',
            memoryMiB:512,nativeWorkers:4,monomialPruning:true},url);
          await page.goto(legacy); await page.locator('#engineNote.live').waitFor({timeout:120000});
          console.log(name,'UI ready');
          assert.equal(await page.evaluate(()=>crossOriginIsolated),isolated);
          assert.equal(await page.locator('#backend').inputValue(),'fomkyr');
          assert.equal(await page.title(),'George 0.6');
          assert.equal(await page.locator('.release-tag').count(),0);
          assert.equal(await page.locator('#backend option[value="fomkyr"]').evaluate(node=>node.disabled),false);
          assert.equal(new URL(page.url()).hash,new URL(legacy).hash);
          await page.locator('details.advanced').evaluate(node=>node.open=true);
          await page.locator('#engineSettings').evaluate(node=>node.open=true);
          assert.equal(await page.locator('#engineSettings #fomkyr-hilbert').count(),0);
          assert.equal(await page.locator('#fomkyrMathOptions #fomkyr-hilbert').count(),1);
          assert.equal(await page.locator('input[name="task"][value="anick"]').isDisabled(),true);
          assert.equal(await page.locator('#weights').isDisabled(),false);
          assert.equal(await page.locator('#monomialPruning').isDisabled(),false);
          await page.locator('#timeoutMinutes').fill('2');
          await page.locator('#fomkyr-hilbert').check();
          const first = await run(page);
          console.log(name,'shared32 / single32 finished',JSON.stringify({workers:first.workers,ioMode:first.ioMode,fallbacks:first.fallbacks}));
          report.latest={browser:name,mount,isolated,first};save();
          assert.equal(first.bits,32);assert.equal(first.shared,isolated);assert.equal(first.workers,isolated?4:1);
          if (name==='firefox' && isolated) assert.equal(first.ioMode,'broker-exclusive');
          assert.deepEqual(first.hilbert.coefficients,['1','2','1','0','0']);
          assert.equal(first.monomialPruning,true);
          assert.deepEqual(await page.evaluate(()=>[...new Set(window.__fomkyrPhases)]),['checkpoint','hilbert','export']);
          assert.match(await page.locator('#degreeMetric').getAttribute('aria-label'),/Basis completed through degree/);
          assert.equal(first.version,'0.4.0');assert.equal(first.progress.phase,'done');
          await page.locator('#fomkyr-bits').selectOption('64');
          await page.locator('#fomkyr-ioMode').selectOption('broker');
          await page.locator('#maxdeg').fill('5');await page.locator('#maxserdeg').fill('5');
          const second = await run(page);
          console.log(name,'64-bit resume finished');
          assert.equal(second.bits,64);assert.equal(second.resumedFromDegree,4);assert.equal(second.workers,isolated?4:1);
          await page.locator('#fomkyr-spill').uncheck();
          await page.locator('#fomkyr-resume').uncheck();
          await page.locator('#weights').fill('1 1');await page.locator('#lowterms').selectOption('safe');
          await page.locator('#monomialPruning').uncheck();
          await page.locator('#maxdeg').fill('');
          const unlimited = await run(page);
          console.log(name,'unbounded finished');
          assert.equal(unlimited.storage,'memory');assert.equal(unlimited.unrestrictedBasisComplete,true);
          assert.equal(unlimited.monomialPruning,false);assert.equal(unlimited.target,null);
          assert.match(await page.locator('#basisOut').textContent(),/A finite complete Gröbner basis was proved/);
          await page.locator('#share').click();await page.locator('#sharePanel').waitFor({state:'visible'});
          const share = await page.locator('#shareLink').inputValue();
          const restored = await context.newPage();
          await restored.goto(share);await restored.locator('#engineNote.live').waitFor({timeout:120000});
          assert.equal(await restored.locator('#backend').inputValue(),'fomkyr');
          assert.equal(await restored.locator('#fomkyr-spill').isChecked(),false);
          assert.equal(await restored.locator('#fomkyr-bits').inputValue(),'64');
          assert.equal(await restored.locator('#nativeWorkers').inputValue(),'4');
          await restored.close();
          // Long words cross the former fixed limits using the full UI parser.
          await page.locator('#weights').fill('');await page.locator('#rels').fill('y^33-x^33');
          await page.locator('#maxdeg').fill('34');await page.locator('#maxserdeg').fill('34');
          const long = await run(page);assert.equal(long.basisSize,2);assert.equal(long.hilbert.certifiedThroughDegree,34);
          console.log(name,'long words finished');
          await page.locator('#fomkyr-hilbert').uncheck();
          // Cancellation releases the engine before the next fresh run.
          const fixture = JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
          const input = fixture.inputText;
          const vars = input.match(/vars\s+([^;]+);/)[1], relations = input.slice(input.indexOf(';')+1).replace(/;\s*$/,'');
          await page.locator('#vars').fill(vars);await page.locator('#rels').fill(relations);
          await page.locator('#maxdeg').fill('');await page.locator('#maxserdeg').fill('');
          await page.locator('#fomkyr-spill').check();await page.locator('#fomkyr-resume').check();
          await page.locator('#go').click();
          await page.waitForFunction(()=>/\d/.test(document.getElementById('degreeValue').textContent),null,{timeout:30000});
          assert.ok(await page.locator('#memoryValue').textContent());
          await page.locator('#stop').click();
          await page.locator('#vars').fill('x,y');await page.locator('#rels').fill('x^2,y^2,y*x-x*y');
          await page.locator('#maxdeg').fill('4');await run(page);
          assert.match(await page.locator('#seriesOut').textContent(),/did not produce an output file/);
          // A saved unfinished numeric draft must not discard the presentation.
          await page.locator('#fomkyr-cachePercent').fill('99');
          await page.evaluate(()=>history.replaceState(null,'',location.pathname));
          await page.reload();await page.locator('#engineNote.live').waitFor({timeout:120000});
          assert.deepEqual((await page.locator('#vars').inputValue()).split(/\s*,\s*/),['x','y']);
          assert.equal(await page.locator('#fomkyr-cachePercent').inputValue(),'99');
          await page.locator('details.advanced').evaluate(node=>node.open=true);
          await page.locator('#engineSettings').evaluate(node=>node.open=true);
          await page.locator('#fomkyr-cachePercent').fill('12');
          await page.screenshot({path:path.join(out,`${name}-${isolated?'isolated':'plain'}-${mount==='/'?'root':'project'}-fomkyr.png`),fullPage:true});
          if (mount==='/' && isolated) {
            await page.setViewportSize({width:390,height:844});
            for (const language of ['en','ru']) {
              await page.locator(`[data-lang="${language}"]`).click();
              const help=page.locator('#fomkyr-spill').locator('..').locator('.help-btn');
              await help.click();assert.equal(await help.getAttribute('aria-expanded'),'true');
              assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
              await page.screenshot({path:path.join(out,`${name}-mobile-${language}-fomkyr.png`)});
              await help.click();
            }
            await page.setViewportSize({width:1280,height:720});
            await page.locator('[data-lang="en"]').click();
          }
          await page.locator('#backend').selectOption('compiled');
          assert.equal(await page.locator('input[name="task"][value="anick"]').isDisabled(),false);
          await page.locator('[data-lang="ru"]').click();
          assert.equal(await page.locator('#backend option[value="fomkyr"]').textContent(),'fomkyr / C O3 + LTO (экспериментальный)');
          assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
          await page.screenshot({path:path.join(out,`${name}-${isolated?'isolated':'plain'}-${mount==='/'?'root':'project'}.png`),fullPage:true});
          report.checks.push({browser:name,version:browser.version(),mount,isolated,first,
            second,unlimited:{completedThroughDegree:unlimited.completedThroughDegree,proved:unlimited.unrestrictedBasisComplete},
            longWord:true,share:true,legacyMigration:true,cancellationAndRestart:true,metrics:true,
            stableReleaseBrand:true,unfinishedDraftRestore:true,noStaleHilbertSeries:true,fastDefaults:true,explicitPhases:true,engineSubmenu:true,
            mobileHelp:mount==='/'&&isolated,externalRequests:0});
          console.log(name,mount,isolated?'isolated':'unshared','PASS');save();
        } finally {
          await context.close().catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
        }
      }
    } finally {await browser.close().catch(()=>{});}
  }
  report.state='complete';
} catch (error) {report.state='failed';report.errors.push(error.stack);throw error;}
finally {report.finishedAt=new Date().toISOString();save();}
console.log(out,'PASS');
