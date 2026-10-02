// Real displayed basis: powers stay attached at narrow widths and larger fonts.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {chromium,firefox} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {readInputFile} from '../web/src/bergman-syntax.js';

const out=path.resolve(process.argv[2]??'build/validation/math-layout');fs.mkdirSync(out,{recursive:true});
const report={state:'running',checks:[],errors:[],method:'Actual fomkyr basis of the submitted example through degree 2; Chromium/Firefox, 390/960/1280/1920 px, 16/24 px root fonts. Check superscript/base geometry, wrapping and clipboard text. Cropped list screenshots hide sticky action bars.',
  hashes:Object.fromEntries(['web/style.css','web/src/app.js','web/src/bergman-syntax.js','web/src/math-copy.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const input=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json')).inputText;
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input);
const server=staticServer('web','/',{isolate:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));save();
try{
  for(const [name,launcher,options] of [['chromium',chromium,{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}],
    ['firefox',firefox,{executablePath:path.resolve('build/playwright-browsers/firefox-1543/firefox/firefox')}]]){
    const browser=await launcher.launch({headless:true,...options});
    try{
      const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#engineNote.live').waitFor({timeout:120000});
      await page.locator('#engineSettings').evaluate(node=>node.open=true);await page.locator('#backend').selectOption('fomkyr');
      await page.locator('#memoryMiB').selectOption('512');await page.locator('#nativeWorkers').fill('4');
      await page.locator('#vars').fill(vars.join(','));await page.locator('#rels').fill(rels.join(','));await page.locator('#maxdeg').fill('2');
      await page.locator('#timeoutMinutes').fill('2');await page.locator('#go').click();
      await page.waitForFunction(()=>document.getElementById('stop').hidden,null,{timeout:120000});
      assert.match(await page.locator('#runStatus').textContent(),/^Computed/);
      for(const theme of ['light','dark'])for(const width of [390,960,1280,1920])for(const font of [16,24]){
        await page.setViewportSize({width,height:900});
        await page.evaluate(({theme,font})=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=font+'px';document.getElementById('switchOutput').click();},{theme,font});
        const geometry=await page.locator('#basisOut .polys[data-term-count="1"]').evaluate(node=>[...node.querySelectorAll('.math-power')].map(power=>{
          const base=power.querySelector('var').getBoundingClientRect(),sup=power.querySelector('sup').getBoundingClientRect(),item=power.closest('li');
          return {baseBottom:base.bottom,supBottom:sup.bottom,baseRight:base.right,supLeft:sup.left,height:power.getBoundingClientRect().height,
            lineHeight:parseFloat(getComputedStyle(item).lineHeight),itemWidth:item.clientWidth,scrollWidth:item.scrollWidth};
        }));
        assert.equal(geometry.length,15);
        for(const g of geometry){assert.ok(g.supBottom<g.baseBottom-1,'Exponent is raised');assert.ok(g.supLeft>=g.baseRight-1,'Exponent follows its base');assert.ok(g.height<=g.lineHeight+2,'Power occupies one line');assert.ok(g.scrollWidth<=g.itemWidth+2,'Monomial fits its item');}
        report.checks.push({browser:name,version:browser.version(),theme,width,font,attachedPowers:geometry.length});save();
      }
      await page.setViewportSize({width:1920,height:900});
      await page.evaluate(()=>{document.documentElement.style.fontSize='16px';document.documentElement.dataset.theme='dark';});
      const hidden=await page.addStyleTag({content:'.actions,.pane-switch{visibility:hidden!important}'});
      await page.locator('#basisOut .degree').first().screenshot({path:path.join(out,name+'-basis-desktop.png')});
      await page.locator('#switchInput').evaluate(node=>node.click());
      await page.locator('#relPreviewPanel').screenshot({path:path.join(out,name+'-relations-desktop.png')});
      await page.setViewportSize({width:390,height:900});
      await page.locator('#relPreviewPanel').screenshot({path:path.join(out,name+'-relations-mobile.png')});
      await page.locator('#switchOutput').evaluate(node=>node.click());
      await page.locator('#basisOut .degree').first().screenshot({path:path.join(out,name+'-basis-mobile.png')});await hidden.evaluate(node=>node.remove());
      const copied=await page.evaluate(()=>{
        const node=document.querySelector('#basisOut .polys[data-term-count="1"]'),range=document.createRange();range.selectNodeContents(node);
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);let text='';
        const event=new Event('copy',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{setData(type,value){if(type==='text/plain')text=value;}}});document.dispatchEvent(event);selection.removeAllRanges();return {text,handled:event.defaultPrevented};
      });
      assert.equal(copied.handled,true);assert.equal(copied.text,vars.map(v=>v+'^2,').join('\n'));assert.deepEqual(errors,[]);
      console.log(name,'16 layouts and caret clipboard PASS');
    }finally{await browser.close();}
  }
  report.state='complete';
}catch(error){report.state='failed';report.errors.push(error.stack);throw error;}
finally{save();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
