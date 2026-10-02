// Actual old/new workers share browser OPFS; certify the extended prefix independently.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {buildJob,readInputFile} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';

const out=path.resolve(process.argv[2]||'build/validation/fomkyr-upgrade-04');fs.mkdirSync(out,{recursive:true});
const report={state:'running',checks:[],method:'Actual 0.3 wasm32 workers write browser OPFS checkpoints; the production 0.4 memory64 UI extends them. Fresh 0.4 output and an independent exact critical-pair checker verify the results. Each computation has a 120-second cap.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const input=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).inputText;
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input);
const server=staticServer('web','/',{isolate:true}),old=staticServer('vendor/fomkyr-0.3.0/web','/previous-fomkyr/',{isolate:true});
const currentHandler=server.listeners('request')[0],oldHandler=old.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>(req.url.startsWith('/previous-fomkyr/')?oldHandler:currentHandler)(req,res));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;save();
try{
  for(const [name,launcher,options] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],
    ['firefox',firefox,{executablePath:path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]){
    const browser=await launcher.launch({headless:true,...options});
    try{const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);await page.locator('#engineNote.live').waitFor({timeout:30000});
      await page.locator('details.advanced').evaluate(e=>e.open=true);await page.locator('#engineSettings').evaluate(e=>e.open=true);
      await page.locator('#backend').selectOption('fomkyr');await page.locator('#memoryMiB').selectOption('512');
      await page.locator('#vars').fill(vars.join(','));await page.locator('#rels').fill(rels.join(','));
      await page.locator('#maxdeg').fill('5');await page.locator('#nativeWorkers').fill('2');await page.locator('#fomkyr-bits').selectOption('64');
      await page.locator('#timeoutMinutes').fill('2');
      const workerRun=async(workerURL,job)=>page.evaluate(({workerURL,job})=>new Promise((resolve,reject)=>{
        const w=new Worker(workerURL,{type:'module'});let result;
        const timer=setTimeout(()=>{w.terminate();reject(new Error('Upgrade worker deadline'));},120000);
        w.onerror=e=>{clearTimeout(timer);w.terminate();reject(new Error(e.message));};
        w.onmessage=({data})=>{
          if(data.error){clearTimeout(timer);w.terminate();reject(new Error(data.error));return;}
          if(data.id===1&&data.result)w.postMessage({id:2,command:'run',job});
          if(data.id===2&&data.result)result=data.result;
          if(data.closed&&result){clearTimeout(timer);w.terminate();resolve(result);}
        };w.postMessage({id:1,command:'init',backend:'fomkyr'});
      }),{workerURL,job});
      for(const prime of [0,101]){
        const form={task:'gb',ring:'noncomm',order:'degleftlex',backend:'fomkyr',vars,rels,field:prime?'p':'0',modulus:String(prime),
          maxdeg:'4',memoryMiB:512,nativeWorkers:2,timeoutMinutes:2,monomialPruning:true,
          fomkyrOptions:{bits:'32',hilbert:false,resume:false}};
        const before=await workerRun('/previous-fomkyr/george-worker.js',buildJob(form));
        assert.equal(before.fomkyr.version,'0.3.0');assert.equal(before.fomkyr.completedThroughDegree,4);
        await page.locator(`input[name="field"][value="${prime?'p':'0'}"]`).check();if(prime)await page.locator('#modulus').fill(String(prime));
        await page.locator('#go').click();await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:125000});
        assert.match(await page.locator('#runStatus').textContent(),/^Computed/);
        const result=await page.evaluate(()=>{
          const files=Object.fromEntries([...document.querySelectorAll('#filesOut .file')].map(n=>[n.querySelector('.name').textContent,n.querySelector('pre').textContent]));
          return {meta:JSON.parse(files['fomkyr-result.json']),basis:files['result.gb']};
        });
        assert.equal(result.meta.version,'0.4.0');assert.equal(result.meta.resumedFromDegree,4);assert.equal(result.meta.completedThroughDegree,5);assert.equal(result.meta.bits,64);
        const freshJob=buildJob({...form,maxdeg:'5',fomkyrOptions:{bits:'64',hilbert:false,resume:false}});
        freshJob.fomkyrOptions.runKey='upgrade-fresh-'+prime;
        const fresh=await workerRun('/engine/fomkyr/george-worker.js',freshJob);
        const a=algebra(vars,false,prime),cachedGB=a.basis(result.basis),freshGB=a.basis(fresh.files['result.gb']);
        assert.deepEqual(cachedGB.map(a.lead).sort(),freshGB.map(a.lead).sort());
        for(const p of cachedGB)assert.equal(a.nf(p,freshGB).size,0);
        for(const p of freshGB)assert.equal(a.nf(p,cachedGB).size,0);
        const ambiguities=a.certify(rels.map(r=>a.parse(r)),cachedGB,5);
        fs.writeFileSync(path.join(out,`${name}-p${prime}-cached.gb`),result.basis);
        fs.writeFileSync(path.join(out,`${name}-p${prime}-fresh.gb`),fresh.files['result.gb']);
        report.checks.push({browser:name,browserVersion:browser.version(),modulus:prime,oldVersion:before.fomkyr.version,newVersion:result.meta.version,
          resumedFromDegree:4,completedThroughDegree:5,bits:64,workers:result.meta.workers,rules:cachedGB.length,ambiguities,mutualReduction:true});save();
        console.log(name,prime,'old wasm32 checkpoint → new memory64 degree5 + independent certificate PASS');
      }
      assert.deepEqual(errors,[]);await context.close();
    }finally{await browser.close();}
  }
  report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{save();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
