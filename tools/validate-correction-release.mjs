// Focused production UI regression: truncated preview totals, expansion and seconds.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {createShareLink} from '../web/src/share.js';
import {readInputFile} from '../web/src/bergman-syntax.js';
const output=path.resolve(process.argv[2]??'local/validation/correction-release');
fs.mkdirSync(output,{recursive:true});
const fixture=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+fixture.inputText);
const report={state:'running',checks:[]};
const server=staticServer('web','/george/',{isolate:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/george/`;
try {
 for(const [name,launcher,options] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],['firefox',firefox,{executablePath:process.env.GEORGE_FIREFOX??path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]) {
  if(process.argv.includes('--browser=firefox')&&name!=='firefox')continue;
  const browser=await launcher.launch({headless:true,...options});
  try {
   const context=await browser.newContext();
   await context.addInitScript(()=>{
    window.__previewCap=128;window.__timerSamples=[];
    const Base=Worker;
    window.Worker=class extends Base {
     postMessage(message,...args) {
      if(message.job?.backend==='fomkyr'&&window.__previewCap!==null)message.job.fomkyrOptions={...message.job.fomkyrOptions,previewBytes:window.__previewCap};
      return super.postMessage(message,...args);
     }
    };
    document.addEventListener('DOMContentLoaded',()=>{
     const timer=document.getElementById('timeValue');
     if(!timer)return;
     new MutationObserver(()=>window.__timerSamples.push(timer.textContent)).observe(timer,{childList:true});
    });
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const share=await createShareLink({backend:'fomkyr',varsText:vars.join(','),relsText:rels.join(','),maxdeg:'4',memoryMiB:512,nativeWorkers:4,monomialPruning:true,timeoutMinutes:2,fomkyrOptions:{resume:false,hilbert:false,scratchMiB:32}},url);
   await page.goto(share);await page.locator('#engineNote.live').waitFor({timeout:120000});
   assert.equal(await page.title(),'George 0.6.1');
   async function compute() {
    await page.locator('#go').click();await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});
    assert.match(await page.locator('#runStatus').textContent(),/^Computed in \d+\.\d{2} s\./);
    const metadata=await page.locator('#filesOut .file').evaluateAll(nodes=>JSON.parse(nodes.find(n=>n.querySelector('.name').textContent==='fomkyr-result.json').querySelector('pre').textContent));
    return metadata;
   }
   const small=await compute();assert.equal(small.previewTruncated,true);assert.equal(small.basisSize,265);assert.equal(small.completedThroughDegree,4);
   assert.match(await page.locator('#basisOut .summary').textContent(),/265 elements, in degrees 2 to 4/);
   assert.match(await page.locator('#basisOut').textContent(),/Computed up to degree 4|Computed through degree 4/);
   assert.doesNotMatch(await page.locator('#basisOut').textContent(),/computation did not finish|incomplete/i);
   assert.deepEqual(await page.locator('#basisOut .degree h3').allTextContents(),['Degree 2100 elements','Degree 376 elements','Degree 489 elements']);
   assert.ok(await page.locator('#basisOut .polys li').count()<265);
   await page.locator('#basisMore').click();await page.waitForFunction(()=>!document.getElementById('basisMore'),null,{timeout:15000});
   assert.equal(await page.locator('#basisOut .polys li').count(),265);
   assert.equal((await page.locator('#basisOut [data-math-source="a^2"]').count()),1);
   await page.evaluate(()=>window.__previewCap=null);
   await page.locator('#maxdeg').fill('9');
   const large=await compute();assert.equal(large.basisSize,1451);assert.equal(large.completedThroughDegree,9);
   assert.match(await page.locator('#basisOut .summary').textContent(),/1451 elements, in degrees 2 to 9/);
   assert.equal(large.basisByDegree.reduce((n,row)=>n+row.count,0),1451);
   if(!large.previewTruncated)assert.equal(await page.locator('#basisOut .polys li').count(),1451);
   const timers=await page.evaluate(()=>window.__timerSamples);assert.ok(timers.length);assert.ok(timers.every(s=>/^\d+\.\d s$/.test(s)),JSON.stringify(timers));
   assert.deepEqual(errors,[]);report.checks.push({browser:name,truncatedTotals:true,allDegreeCounts:true,expandedPolynomials:265,fk6Degree9Rules:1451,timerOnlySeconds:true});
   console.log(name,'PASS');await context.close();
  } finally {await browser.close();}
 }
 report.state='complete';
} catch(error) {report.state='failed';report.error=error.stack;throw error;}
finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(resolve=>server.close(resolve));}
