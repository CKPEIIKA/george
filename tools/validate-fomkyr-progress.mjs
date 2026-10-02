// Observe the production UI at a degree boundary; do not complete the expensive degree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {createShareLink} from '../web/src/share.js';

const argument=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const out=path.resolve(argument('--out','build/validation/fomkyr-degree-progress'));
const browserName=argument('--browser','chromium');
const observedDegree=Number(argument('--observe-degree','11'));
const targets=argument('--targets','12,11').split(',').map(Number);
const small=process.argv.includes('--small');
const sharedForm=process.argv.includes('--form')?JSON.parse(fs.readFileSync(argument('--form'))):null;
const input=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).inputText;
const sourceFiles=['web/src/app.js','web/src/engine.js','web/src/fomkyr-options.js','web/src/degree-progress.js',
  ...fs.readdirSync('web/engine/fomkyr').filter(name=>/\.(?:js|wasm)$/.test(name)).map(name=>'web/engine/fomkyr/'+name)];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.mkdirSync(out,{recursive:true});
const report={state:'running',startedAt:new Date().toISOString(),browser:browserName,observedDegree,targets,hashes:hashes(),checks:[],
  method:'Production UI and real OPFS, identical options, each fresh target followed by resume at the other target. Stop after the observed degree starts. Each run has a 120-second deadline; no completion of that expensive degree is claimed.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const server=staticServer('web','/',{isolate:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await (browserName==='firefox'?firefox.launch({headless:true,executablePath:path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}):
  chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}));
report.browserVersion=browser.version();save();
try{
  for(const firstTarget of targets){
    const context=await browser.newContext();
    await context.addInitScript(()=>{
      const Base=window.Worker;
      window.__degreeTrace=[];window.__closed=false;
      window.Worker=class extends Base{
        constructor(...args){
          super(...args);
          this.addEventListener('message',({data})=>{
            if(data.closed)window.__closed=true;
            if(data.event&&['cache','capabilities','degree-start','degree','progress','phase'].includes(data.event.type))
              window.__degreeTrace.push({...data.event,seconds:(performance.now()-window.__runStarted)/1000});
          });
        }
        postMessage(message,...args){
          if(message.command==='run'){
            window.__degreeTrace=[];window.__closed=false;window.__runStarted=performance.now();window.__lastJob=message.job;
          }
          return super.postMessage(message,...args);
        }
      };
    });
    const page=await context.newPage();
    try{
      const initial={backend:'fomkyr',varsText:small?'x,y':input.match(/vars\s+([^;]+);/)[1],
        relsText:small?'x^2,y^2,y*x-x*y':input.slice(input.indexOf(';')+1).replace(/;\s*$/,''),
        maxdeg:String(firstTarget),maxserdeg:'',memoryMiB:2048,nativeWorkers:4,monomialPruning:true,timeoutMinutes:2,
        fomkyrOptions:{hilbert:false,execution:'multicore',bits:'64',resume:'auto',spill:true}};
      const values={...initial,...sharedForm,maxdeg:String(firstTarget),timeoutMinutes:2};
      const link=await createShareLink(values,url);
      await page.goto(link);await page.locator('#engineNote.live').waitFor({timeout:30000});
      await page.locator('details.advanced').evaluate(node=>node.open=true);
      for(const [mode,target] of [['fresh',firstTarget],['resume',targets.find(n=>n!==firstTarget)??firstTarget]]){
        await page.locator('#maxdeg').fill(String(target));
        await page.evaluate(()=>{window.__degreeTrace=[];window.__lastJob=null;window.__closed=false;});
        await page.locator('#go').click();
        await page.waitForFunction(d=>window.__degreeTrace.some(e=>e.type==='degree-start'&&e.degree===d)||document.getElementById('stop').hidden,observedDegree,{timeout:125000});
        const state=await page.evaluate(d=>({trace:window.__degreeTrace,
          start:window.__degreeTrace.find(e=>e.type==='degree-start'&&e.degree===d),
          degreeText:document.getElementById('degreeValue').textContent,
          degreeDescription:document.getElementById('degreeMetric').getAttribute('aria-label'),
          status:document.getElementById('runStatus').textContent,
          bound:window.__lastJob.degreeBound,options:window.__lastJob.fomkyrOptions}),observedDegree);
        fs.writeFileSync(path.join(out,`${firstTarget}-${mode}-events.json`),JSON.stringify(state.trace,null,2)+'\n');
        delete state.trace;
        assert.ok(state.start,`Target ${target} did not reach degree ${observedDegree}: ${state.status}`);
        assert.equal(state.start.completedThroughDegree,observedDegree-1);
        assert.equal(String(state.bound),String(target));
        assert.match(state.degreeText,new RegExp(`^${observedDegree}\\b`));
        assert.doesNotMatch(state.degreeText,/✓/);
        const cache=await page.evaluate(()=>window.__degreeTrace.find(e=>e.type==='cache'));
        assert.equal(cache.resumedFromDegree,mode==='fresh'?0:observedDegree-1);
        if(!small&&observedDegree===11)assert.equal(state.start.basisSize,2155);
        console.log(JSON.stringify({mode,target,degree:observedDegree,startedAfterSeconds:state.start.seconds,
          completedThroughDegree:state.start.completedThroughDegree,degreeText:state.degreeText,basisSize:state.start.basisSize}));
        await page.locator('#stop').click();
        await page.waitForFunction(()=>window.__closed,null,{timeout:10000});
        report.checks.push({mode,target,cache,state});save();
      }
    }finally{await context.close();}
  }
  const fresh=report.checks.filter(row=>row.mode==='fresh');
  assert.ok(fresh.every(row=>row.state.start.basisSize===fresh[0].state.start.basisSize));
  assert.ok(fresh.every(row=>row.state.start.terms===fresh[0].state.start.terms));
  assert.deepEqual(hashes(),report.hashes,'Sources changed during the check');
  report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{report.finishedAt=new Date().toISOString();save();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log(out,'PASS');
