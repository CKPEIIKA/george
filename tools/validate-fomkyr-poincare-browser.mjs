// Actual main-page task selection, Wasm, OPFS reuse and downloadable results.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';import {createShareLink} from '../web/src/share.js';
const out=path.resolve(process.argv[2]??'build/validation/fomkyr-poincare/browser');fs.mkdirSync(out,{recursive:true});
const report={state:'running',passed:false,checks:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const [name,launcher,options]of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],['firefox',firefox,{executablePath:path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]){
 const server=staticServer('web','/george/',{isolate:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await launcher.launch({headless:true,...options});const context=await browser.newContext();context.setDefaultTimeout(10000);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/george/`;
  const link=await createShareLink({backend:'fomkyr',task:'gb',varsText:'a',relsText:'a^3',maxdeg:'8',maxserdeg:'8',memoryMiB:128,nativeWorkers:1,fomkyrOptions:{execution:'single',bits:'32',hilbert:false,spill:true}},url);
  await page.goto(link);await page.locator('#engineNote.live').waitFor({timeout:120000});
  assert.equal(await page.locator('#taskSelect option[value="ncpbh"]').isDisabled(),false);
  await page.locator('#taskSelect').selectOption('ncpbh');
  await page.locator('details.advanced').evaluate(n=>n.open=true);
  assert.equal(await page.locator('#maxserdeg').isDisabled(),false);
  assert.equal(await page.locator('#fomkyr-hilbert').isChecked(),false);
  assert.equal(await page.locator('#fomkyr-hilbertMiB').isDisabled(),false);
  for(const repeat of [false,true]){
   await page.locator('#go').click();await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});
   assert.match(await page.locator('#runStatus').textContent(),/^Computed/);
   const files=await page.locator('#filesOut .file').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.querySelector('.name').textContent,n.querySelector('pre').textContent])));
   const result=JSON.parse(files['fomkyr-result.json']);assert.equal(result.poincare.available,true);assert.equal(result.poincare.originalAlgebraBettiNumbers,false);assert.equal(result.poincare.eulerInverseCheck,true);assert.equal(result.poincare.field,'Q');assert.equal(result.poincare.certifiedThroughDegree,8);assert.ok(result.elapsedSeconds>=0);assert.equal(result.elapsedMs,undefined);if(repeat)assert.equal(result.cacheHit,true);
   assert.deepEqual(result.hilbert.coefficients,['1','1','1','0','0','0','0','0','0']);
   assert.equal(result.poincare.coefficients.find(c=>c.homological===4&&c.internal===6)?.dimension,'1');
   for(const file of ['poincare.json','poincare.csv','result.pb','result.hs'])assert.ok(files[file],file);
   assert.equal(await page.locator('#seriesOut .monomial-poincare tbody tr').count(),6);
   assert.match(await page.locator('#seriesOut').textContent(),/associated monomial algebra/);
   assert.doesNotMatch(await page.locator('#seriesOut').textContent(),/undefined|NaN/);
   report.checks.push({browser:name,repeat,cacheHit:result.cacheHit,coefficients:result.poincare.coefficients.length});save();
  }
  await page.locator('[role="tab"][data-tab="series"]').click();
  assert.equal(await page.locator('#seriesOut .monomial-poincare').isVisible(),true);
  await page.locator('#seriesOut').screenshot({path:path.join(out,name+'-series.png')});assert.deepEqual(errors,[]);await context.close();
 }catch(error){report.error=error.stack;report.state='failed';save();throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));}
}
report.passed=true;report.state='complete';save();console.log(JSON.stringify(report));
