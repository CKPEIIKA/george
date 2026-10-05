// Focused production UI regression: truncated preview totals, expansion and seconds.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {createShareLink} from '../web/src/share.js';
import {readInputFile} from '../web/src/bergman-syntax.js';
import {execFileSync} from 'node:child_process';
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
    Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>12});
    window.__previewCap=128;window.__timerSamples=[];
    const Base=Worker;
    window.Worker=class extends Base {
     postMessage(message,...args) {
      if(message.job?.backend==='fomkyr')window.__lastFomkyrJob=structuredClone(message.job);
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
   assert.equal(await page.title(),'George '+JSON.parse(fs.readFileSync('package.json')).version);
   async function compute() {
    await page.locator('#go').click();await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});
    assert.match(await page.locator('#runStatus').textContent(),/^Computed in \d+\.\d{2} s\./);
    const metadata=await page.locator('#filesOut .file').evaluateAll(nodes=>JSON.parse(nodes.find(n=>n.querySelector('.name').textContent==='fomkyr-result.json').querySelector('pre').textContent));
    return metadata;
   }
   const small=await compute();assert.equal(small.previewTruncated,true);assert.equal(small.basisSize,265);assert.equal(small.completedThroughDegree,4);
   async function verificationDownload(label) {
    await page.locator('[data-tab="files"]').click();
    const next=page.waitForEvent('download');await page.locator('#downloadVerificationBundle').click();
    const downloaded=await next,file=path.join(output,name+'-'+label+'-verification.zip');await downloaded.saveAs(file);await page.locator('[data-tab="basis"]').click();
    const verified=JSON.parse(execFileSync('python3',['fomkyr/tools/verify-computation.py',file],{encoding:'utf8',timeout:120000,maxBuffer:1048576}));
    assert.equal(verified.independentGroebnerCertificate,true);assert.equal(verified.completedThroughDegree,4);
    await page.waitForFunction(()=>!document.getElementById('downloadVerificationBundle').disabled);
    return verified;
   }
   assert.match(await page.locator('#basisOut .summary').textContent(),/265 elements, in degrees 2 to 4/);
   assert.match(await page.locator('#runChipWrap').textContent(),/Through degree 4.*Computed through degree 4/s);
   assert.doesNotMatch(await page.locator('#basisOut').textContent(),/computation did not finish|incomplete/i);
   assert.deepEqual(await page.locator('#basisOut .degree h3').allTextContents(),['Degree 2100 elements','Degree 376 elements','Degree 489 elements']);
   assert.ok(await page.locator('#basisOut .polys li').count()<265);
   // Download while the screen contains only a short preview: the ZIP must
   // still contain the complete OPFS text and usable algebraic notation.
   await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
   const downloadPromise=page.waitForEvent('download');
   await page.locator('[data-tab="files"]').click();
   await page.locator('#downloadResultsZip').click();
   const download=await downloadPromise,zip=path.join(output,name+'-degree4.zip');
   await download.saveAs(zip);
   const exported=JSON.parse(execFileSync('python3',['-c',
    'import sys,zipfile,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))',zip],{encoding:'utf8'}));
   assert.ok(exported['input.txt']);assert.ok(exported['fomkyr-result.json']);
   assert.ok(exported['result.txt'].includes('a^2'));assert.ok(exported['result.txt'].length>128);
   assert.equal(JSON.parse(exported['fomkyr-result.json']).basisSize,265);
   fs.writeFileSync(path.join(output,name+'-degree4-zip.gb'),exported['result.txt']);
   await page.locator('[data-tab="basis"]').click();
   const ordinaryVerified=await verificationDownload('ordinary');
   await page.locator('#basisMore').click();await page.waitForFunction(()=>!document.getElementById('basisMore'),null,{timeout:15000});
   assert.equal(await page.locator('#basisOut .polys li').count(),265);
   assert.equal((await page.locator('#basisOut [data-math-source="a^2"]').count()),1);
   await page.evaluate(()=>window.__previewCap=null);
   await page.locator('#maxdeg').fill('5');
   const large=await compute();assert.equal(large.basisSize,360);assert.equal(large.completedThroughDegree,5);
   assert.match(await page.locator('#basisOut .summary').textContent(),/360 elements, in degrees 2 to 5/);
   assert.equal(large.basisByDegree.reduce((n,row)=>n+row.count,0),360);
   if(!large.previewTruncated)assert.equal(await page.locator('#basisOut .polys li').count(),360);
   const timers=await page.evaluate(()=>window.__timerSamples);assert.ok(timers.length);assert.ok(timers.every(s=>/^\d+\.\d s$/.test(s)),JSON.stringify(timers));
   let coefficientRules;
   if(process.argv.includes('--coefficient-case')) {
    await page.locator('#engineSettings').evaluate(node=>node.open=true);
    for(const key of ['bigRationalHeap','fastBigDivision','growingRationalHeap'])assert.equal(await page.locator('#fomkyr-'+key).isChecked(),true);
    const input=JSON.parse(fs.readFileSync('test/fixtures/coefficient-workloads/affine-q-serre-q2.json')).inputText;
    const parsed=readInputFile('(ALGFORMINPUT)\n'+input);
    await page.locator('#vars').fill(parsed.vars.join(','));await page.locator('#rels').fill(parsed.rels.join(','));await page.locator('#maxdeg').fill('14');
    await page.locator('#fomkyr-group-scheduling').evaluate(node=>node.open=true);
    await page.locator('#fomkyr-pairOrder').selectOption('overlap');
    await page.locator('#fomkyr-planMinDegree').fill('12');
    const coefficient=await compute();assert.equal(coefficient.basisSize,21);assert.equal(coefficient.completedThroughDegree,14);
    assert.ok(coefficient.bigRationalSuccesses>0);assert.equal(coefficient.fastBigDivision,true);assert.equal(coefficient.growingRationalHeap,true);
    assert.ok(coefficient.pairPlan.builds>0);assert.equal(coefficient.pairPlan.order,1);
    await page.locator('#fomkyr-group-scheduling').evaluate(node=>node.open=false);
    coefficientRules=coefficient.basisSize;
    const basis=await page.locator('#filesOut .file').evaluateAll(nodes=>nodes.find(n=>n.querySelector('.name').textContent==='result.gb').querySelector('pre').textContent);
    fs.writeFileSync(path.join(output,name+'-q-serre-d14.gb'),basis);
   }
   let defaultWorkspace;
   if(process.argv.includes('--defaults-case')) {
    await page.locator('#preset').selectOption('tutorial:fk6');
    assert.equal(await page.locator('#backend').inputValue(),'fomkyr');
    assert.equal(await page.locator('#memoryMiB').inputValue(),'14304');
    assert.equal(await page.locator('#nativeWorkers').inputValue(),'');
    assert.equal(await page.locator('#nativeWorkers').getAttribute('placeholder'),'Automatic');
    assert.equal(await page.locator('#maxdeg').inputValue(),'11');
    assert.equal(await page.locator('#fomkyr-bits').inputValue(),'auto');
    assert.equal(await page.locator('#fomkyr-pairOrder').inputValue(),'overlap');
    assert.equal(await page.locator('#fomkyr-planMinDegree').inputValue(),'12');
    assert.equal(await page.locator('#monomialPruning').isChecked(),true);
    await page.locator('#engineSettings').evaluate(node=>node.open=true);
    assert.equal(await page.locator('#fomkyrOptions > details').count(),5);
    assert.equal(await page.locator('#fomkyrOptions > details[open]').count(),0);
    await page.locator('#fomkyrOptions > details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
    await page.locator('#memoryMiB').selectOption('3584');
    await page.locator('details.advanced').evaluate(node=>node.open=true);
    await page.locator('#fomkyr-hilbertGate').uncheck();
    assert.equal(await page.locator('#fomkyr-memoryPolicy').inputValue(),'auto');
    assert.equal(await page.locator('#fomkyr-scratchMiB').isDisabled(),true);
    assert.equal(await page.locator('#fomkyr-rowReserveMiB').isDisabled(),true);
    await page.locator('#fomkyr-batchPairs').fill('');
    await page.locator('#nativeWorkers').fill('4');
    for(const key of ['radixHeap','reserveInPlace'])assert.equal(await page.locator('#fomkyr-'+key).isChecked(),true);
    await page.locator('#vars').fill(vars.join(','));await page.locator('#rels').fill(rels.join(','));await page.locator('#maxdeg').fill('5');
    const calculated=await compute();assert.equal(calculated.basisSize,360);assert.equal(calculated.completedThroughDegree,5);
    const job=await page.evaluate(()=>window.__lastFomkyrJob);
    assert.equal(job.memoryMiB,3584);assert.equal(job.fomkyrOptions.arithmeticMode,'exact');
    assert.equal(job.fomkyrOptions.memoryPolicy,'auto');assert.equal(job.fomkyrOptions.scratchBytes,undefined);
    assert.equal(calculated.memoryPlan.ordinaryScratchBytes,2048*1048576);assert.equal(job.fomkyrOptions.batchPairs,128);
    assert.equal(calculated.rowReserveBytes,512*1048576);assert.equal(calculated.radixHeap,true);
    assert.equal(calculated.reserveInPlace,true);assert.equal(calculated.reserveLeased,false);
    defaultWorkspace={budgetMiB:3584,scratchMiB:2048,reserveMiB:512,batchPairs:128,verified:true};
   }
   await page.locator('#preset').selectOption('tutorial:fk6');
   assert.equal(await page.locator('#fomkyr-hilbertGate').isChecked(),true);
   assert.equal(await page.locator('#fomkyr-hilbertSectors').isDisabled(),false);
   await page.locator('details.advanced').evaluate(node=>node.open=true);
   // Exercise assisted computation in a fresh job.
   await page.locator('#engineSettings').evaluate(node=>node.open=true);
   await page.locator('#fomkyrOptions > details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
   await page.locator('#fomkyr-resume').uncheck();
   await page.locator('#fomkyr-hilbertGate').check();
   assert.equal(await page.locator('#fomkyr-hilbertSectors').isDisabled(),false);
   await page.locator('#maxdeg').fill('4');
   const gated=await compute();assert.equal(gated.completedThroughDegree,4);
   assert.equal(gated.conditionalOnImportedFkDimensions,true);assert.equal(gated.fkGateProofReplayedHere,false);
   assert.match(await page.locator('#basisOut').textContent(),/conditional on imported FK6 dimensions/i);
   const verifiedGated=await verificationDownload('gated');
   assert.equal(verifiedGated.verificationDependsOnImportedDimensions,false);
   await page.locator('[name=field][value=p]').check();await page.locator('#modulus').fill('101');
   assert.equal(await page.locator('#fomkyr-hilbertGate').isDisabled(),true);
   assert.deepEqual(errors,[]);report.checks.push({browser:name,independentVerifications:2,verifiedRules:[ordinaryVerified.rules,verifiedGated.rules],engineSubmenus:true,fk6PresetMemoryMiB:14304,fkGateOptIn:true,conditionalResultNotice:true,primeFieldDisablesGate:true,fullTextZip:true,truncatedTotals:true,allDegreeCounts:true,expandedPolynomials:265,fk6Degree5Rules:360,timerOnlySeconds:true,coefficientRules,defaultWorkspace});
   console.log(name,'PASS');await context.close();
  } finally {await browser.close();}
 }
 report.state='complete';
} catch(error) {report.state='failed';report.error=error.stack;throw error;}
finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(resolve=>server.close(resolve));}
