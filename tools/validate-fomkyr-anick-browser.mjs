// Main-page Anick selector, actual Betti table, full differential display, OPFS.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright-core';import {staticServer} from './serve.mjs';import {createShareLink} from '../web/src/share.js';
import {certifyResolution} from '../test/support/resolution.mjs';
const out=path.resolve(process.argv[2]??'build/validation/fomkyr-anick/browser');fs.mkdirSync(out,{recursive:true});
const report={state:'running',passed:false,checks:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const [name,launcher,options]of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],['firefox',firefox,{executablePath:path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]){
 const server=staticServer('web','/george/',{isolate:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await launcher.launch({headless:true,...options});const context=await browser.newContext();context.setDefaultTimeout(10000);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/george/`;
  const link=await createShareLink({backend:'fomkyr',task:'gb',varsText:'a,aa',relsText:'a*aa,aa*a-a^2',maxdeg:'6',memoryMiB:256,nativeWorkers:1,fomkyrOptions:{execution:'single',bits:'32',hilbert:false,spill:true}},url);
  await page.goto(link);await page.locator('#engineNote.live').waitFor({timeout:120000});
  assert.equal(await page.locator('#taskSelect option[value="anick"]').isDisabled(),false);await page.locator('#taskSelect').selectOption('anick');
  for(const repeat of [false,true]){
   await page.locator('#go').click();await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});assert.match(await page.locator('#runStatus').textContent(),/^Computed/);
   const files=await page.locator('#filesOut .file').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.querySelector('.name').textContent,n.querySelector('pre').textContent])));
   const result=JSON.parse(files['fomkyr-result.json']);assert.equal(result.anick.available,true);assert.equal(result.anick.originalAlgebraBettiNumbers,true);assert.equal(result.anick.checkedFullSquareZero,true);assert.equal(result.anick.eulerInverseCheck,true);if(repeat)assert.equal(result.cacheHit,true);
   assert.equal(result.anick.coefficients.find(c=>c.homological===2&&c.internal===3).dimension,'0');
   for(const name of ['resolution.jsonl','betti.json','betti.csv','result.anick'])assert.ok(files[name],name);
   assert.ok(certifyResolution(files['resolution.jsonl'],files['result.gb'],['a','aa'],0)>0);
   assert.equal(await page.locator('#bettiOut table.betti').isVisible(),true);
   assert.doesNotMatch(await page.locator('#bettiOut').textContent(),/undefined|NaN/);
   await page.locator('[role="tab"][data-tab="resolution"]').click();assert.ok(await page.locator('#resolutionOut .tensor-line').count()>5);
   assert.match(await page.locator('#resolutionOut').textContent(),/aa/);
   report.checks.push({browser:name,repeat,chains:result.anick.chainCount,terms:result.anick.differentialTerms,cacheHit:result.cacheHit});save();
  }
  await page.locator('#resolutionOut').screenshot({path:path.join(out,name+'-resolution.png')});await page.locator('[role="tab"][data-tab="betti"]').click();await page.locator('#bettiOut').screenshot({path:path.join(out,name+'-betti.png')});assert.deepEqual(errors,[]);await context.close();
 }catch(error){report.error=error.stack;report.state='failed';save();throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));}
}
report.passed=true;report.state='complete';save();console.log(JSON.stringify(report));
