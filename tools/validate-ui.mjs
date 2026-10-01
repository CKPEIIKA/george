// Drive the real UI without a debugger during Wasm calculations. Attach only
// after all calculations finish, for screenshots; debugger attachment can
// tier down Wasm and invalidate both runtime limits and performance evidence.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {staticServer} from './serve.mjs';
import {TUTORIALS,tutorialForm} from '../web/src/tutorials.js';
import {EXAMPLES} from '../web/src/examples.js';
import {algebra} from '../test/support/algebra.mjs';
const upstream=JSON.parse(fs.readFileSync('test/fixtures/upstream-cases.json','utf8'));
const out=`build/validation/ui-${Date.now()}`;fs.mkdirSync(out,{recursive:true});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const browserFiles=['web/index.html','web/style.css',...fs.readdirSync('web/src').filter(n=>n.endsWith('.js')).map(n=>'web/src/'+n),'web/engine/worker.js','web/engine/runner.js'];
const report={debuggerDuringCalculations:false,mobileViewportControl:'CDP Emulation only; no Runtime, Debugger or Profiler domains',engine:JSON.parse(fs.readFileSync('web/engine/compiled/build.json','utf8')),sourceHashes:Object.fromEntries(browserFiles.map(p=>[p,sha(p)])),browser:null,mounts:[],console:[],backends:[],examples:[],checks:[],errors:[],externalRequests:[]};
const data={tutorials:TUTORIALS.map(t=>({...t,form:tutorialForm(t.id)})),examples:EXAMPLES,
 upstream:upstream.cases.filter(c=>['sympy-katsura3','singular-gb_braid3-11','gbnp-weighted','gbnp-sl2-quotient'].includes(c.id))};

// Runs in the page, dispatching the same input/change/click events as users.
async function checkUI(){
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 const ok=(x,msg)=>{if(!x)throw Error(msg)},eq=(a,b,msg)=>ok(JSON.stringify(a)===JSON.stringify(b),msg+': '+JSON.stringify(a)+' != '+JSON.stringify(b));
 const wait=async(fn,label,timeout=120000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error(label+' timed out; '+$('#runStatus')?.textContent);await new Promise(r=>setTimeout(r,40));}};
 const data=await(await fetch(new URL('__validation/data',location.href))).json();
 const errors=window.validationErrors;
 const phase=sessionStorage.getItem('validation.phase')||'start';
 const mode=new URL(location.href).searchParams.get('validation')||'desktop';
 const files=()=>Object.fromEntries(all('#filesOut .file').map(e=>[e.querySelector('.name').textContent,e.querySelector('pre').textContent]));
 const form=()=>all('#presentation input:not([readonly]),#presentation select,#presentation textarea').map(n=>({id:n.id||n.name+':'+n.value,value:n.value,checked:n.checked??null}));
 const set=(id,value)=>{const el=$('#'+id);el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
 const radio=(name,value)=>{const el=$(`input[name="${name}"][value="${value}"]`);el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));};
 const language=value=>$(`[data-lang="${value}"]`).click();
 const theme=async value=>{for(let i=0;i<3&&$('#theme').dataset.pref!==value;i++)$('#theme').click();eq($('#theme').dataset.pref,value,'theme selection');};
 const math=()=>wait(()=>all('#guideContent mjx-container[jax="SVG"] svg').length>=20&&$('#guideContent').getAttribute('aria-busy')==='false','MathJax');
 const compute=async()=>{$('#go').click();await wait(()=>$('#stop').hidden,'computation');ok(/^(Computed|Вычислено)/.test($('#runStatus').textContent),'successful form: '+$('#runStatus').textContent);};
 const post=async(kind,value)=>{const r=await fetch(new URL('__validation/'+kind,location.href),{method:'POST',body:JSON.stringify(value)});ok(r.ok,kind+': '+await r.text());};
 const next=value=>{sessionStorage.setItem('validation.phase',value);location.reload();};
 const checkMath=()=>{eq(all('#guideContent [data-mjx-error],#guideContent mjx-merror').length,0,'MathJax errors');ok($('#mathNotice').hidden,'math notice hidden');};
 try{
  await wait(()=>$('#engineNote')?.classList.contains('live'),'engine ready',90000);
  ok($('#engineNote').textContent.includes('bergman-1.001-fix'),'engine version');
  if(mode==='blocked'){
   eq($('[data-lang][aria-pressed="true"]').dataset.lang,'ru','blocked storage browser language');set('preset','tutorial:char2');await compute();await post('done',{mode,errors,checks:['blocked storage: browser language and computation work']});return;
  }
  if(mode==='mobile'){
   eq(innerWidth,390,'mobile CSS viewport');
   language('en');await theme('light');location.hash='#guide';await math();checkMath();ok(document.documentElement.scrollWidth<=innerWidth+1,'mobile guide overflow');
   $('[data-tutorial="monoid"]').click();await compute();ok(!$('#view-compute').hidden,'mobile computed result visible');ok($('#bettiOut').textContent.includes('Ungraded Betti numbers'),'mobile Betti result');ok(document.documentElement.scrollWidth<=innerWidth+1,'mobile result overflow');await post('done',{mode,errors,checks:['390px guide and computed monoid result have no page overflow']});return;
  }
  if(phase==='start'){
   language('en');eq($('.brand-sub').textContent,'an interface to bergman','English interface wording');eq($('.brand-version').textContent,'0.4','application version');
   eq($('#backend').value,'compiled','default backend');
   eq(all('#backend option').map(o=>o.textContent),['C / ECL O3 + LTO','Lisp / ECL O3 + LTO','Lisp / ECL O2'],'explicit backend labels');
   location.hash='#console';
   const command=async(src,expected)=>{
    const term=$('#terminal'),start=term.children.length;
    set('promptInput',src);$('#promptForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await wait(()=>!$('#promptForm button[type="submit"]').disabled&&term.children.length>start,'console '+src);
    const result=[...term.children].slice(start).filter(n=>!n.classList.contains('in')).map(n=>n.textContent).join('');
    if(expected)ok(expected.test(result),'console '+src+': '+result);
    return result;
   };
   eq((await command('t')).trim(),'T','first result has one legitimate T');
   await command('(setq console-marker 73)',/73/);await command('(setmaxdeg 6)');
   await command('(with-open-file (s "kept.txt" :direction :output :if-exists :supersede) (write-line "retained" s))');
   for(const legacy of ['nil','t']){
    await command('(setlegacymode '+legacy+')');
    for(const src of ['(simple)','(simple "missing.bg" "out.gb")','(progn (algforminput))','(progn (rds nil) (ratom))']){
     await command(src,src.includes('missing.bg')?/Cannot open/:/Keyboard input is unavailable/);
     await command('(list console-marker (getmaxdeg))',/\(73 6\)/);await command('(show "kept.txt")',/retained/);
    }
   }
   await command('(setlegacymode nil)');
   await command('?simple',/simple|SIMPLE/);ok($('#terminal .o-help'),'original help is displayed');
   $('#promptInput').focus();set('promptInput','(setma');$('#promptInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));ok($('#promptInput').value.startsWith('(setmaxdeg'),'console Tab completion');set('promptInput','');
   $('#promptInput').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));eq($('#promptInput').value,'?simple','console history');set('promptInput','');
   set('preset','tutorial:char2');$('#pasteJob').click();await wait(()=>!$('#pasteJob').disabled,'console current computation');
   await command('(show "input.bg")',/ALGFORMINPUT/i);await command('(files)',/result/);
   ok(!/session was restarted/.test($('#terminal').textContent),'reader recovery preserves session');
   await post('console',{mount:data.mount,recoveryCases:8,settingsAndFilesRetained:true,firstValue:true,help:true,completion:true,history:true,currentComputation:true});
   location.hash='#compute';$('details.advanced').open=true;
   const {readShareLink}=await import(new URL('src/share.js',location.href));
   const backendRows=[];let reference;
   for(const backend of ['standard','optimized','compiled']){
    set('backend',backend);set('preset','tutorial:char2');eq($('#backend').value,backend,'preset preserves backend');
    await compute();const raw=files();if(reference)eq(raw,reference,'backend output parity');else reference=raw;
    $('#shareLink').value='';$('#share').click();await wait(()=>$('#shareLink').value&&!$('#share').disabled,'backend share');
    eq((await readShareLink(new URL($('#shareLink').value).hash)).backend,backend,'shared backend');
    backendRows.push({backend,outputParity:true,shareRoundTrip:true});
   }
   await post('backends',{mount:data.mount,defaultBackend:'compiled',rows:backendRows});
   set('backend','optimized');
   location.hash='#compute';await theme('light');eq(getComputedStyle(document.body).backgroundColor,'rgb(238, 242, 243)','light theme');await theme('dark');eq(getComputedStyle(document.body).backgroundColor,'rgb(17, 26, 39)','dark theme');await theme('auto');eq(document.documentElement.getAttribute('data-theme'),null,'automatic theme');eq(getComputedStyle(document.body).backgroundColor,matchMedia('(prefers-color-scheme: dark)').matches?'rgb(17, 26, 39)':'rgb(238, 242, 243)','automatic follows OS');
   set('preset','tutorial:weights');await compute();const before=form(),raw=files();language('ru');eq($('.brand-sub').textContent,'интерфейс к bergman','Russian interface wording');eq(document.documentElement.lang,'ru','Russian lang');ok(/Вычислить/.test($('#go').textContent),'Russian controls');ok(/Вычислено/.test($('#runStatus').textContent),'Russian status');eq(form(),before,'language preserves form');eq(files(),raw,'language preserves files');
   location.hash='#guide';await math();eq($('#guideTitle').textContent,'Руководство пользователя','Russian guide');checkMath();await theme('dark');sessionStorage.setItem('validation.savedForm',JSON.stringify(before));next('persist');return;
  }
  if(phase==='persist'){
   eq($('[data-lang][aria-pressed="true"]').dataset.lang,'ru','language persists');eq($('#theme').dataset.pref,'dark','theme persists');eq(form(),JSON.parse(sessionStorage.getItem('validation.savedForm')),'form persists');eq($('#backend').value,'optimized','nondefault backend persists');set('backend','compiled');await math();language('en');await math();language('ru');language('en');await math();checkMath();eq($('#guideTitle').textContent,'User guide','English guide');
   $('#guideContent a[href="#guide-options"]').click();eq(location.hash,'#guide-options','guide link');ok(!$('#view-guide').hidden,'guide visible');
   for(const item of [
    {vars:'a, ab, bc, c',rels:'a*bc-a, ab*c-ab',augmentation:'graded',betti:[1,2,0],names:['ab','bc'],collision:true},
    {vars:'x_1, x_11',rels:'x_1^2-1',augmentation:'monoid',betti:[1,1,0],names:['x_1','x_11']},
    {vars:'a, aa',rels:'a^2-a,aa^2-aa,aa*a*aa-a*aa*a',augmentation:'graded',betti:[1,0,0],names:['a','aa']},
    {vars:'x_1, x_11',rels:'x_1^2-x_1,x_11^2-x_11,x_11*x_1*x_11-x_1*x_11*x_1',augmentation:'monoid',betti:[1,0,0],names:['x_1','x_11'],weights:'2 3',maxdeg:18}
   ]){
    location.hash='#compute';set('preset','tutorial:nonhomogeneous');set('vars',item.vars);set('rels',item.rels);set('maxdeg',item.maxdeg||8);$('details.advanced').open=true;set('weights',item.weights||'');set('augmentation',item.augmentation);await compute();const f=files();ok(f['resolution.jsonl'],'structural export');const h=JSON.parse(f['homology.json']);eq(h.betti.slice(0,3),item.betti,'name/braid Betti');if(item.weights){eq(h.highestCertifiedDegree,2,'weighted certificate');ok(h.truncatedBetti,'partial ranks retained');ok(/only through degree 2/.test($('#bettiOut').textContent),'weighted cutoff notice');}
    const names=all('#resolutionOut var').map(n=>n.textContent);for(const n of item.names)ok(names.includes(n),'whole name '+n);if(item.collision)eq(all('#resolutionOut section')[1].querySelectorAll('.tensor-line').length,2,'colliding compact chains remain separate');
   }
   for(const c of data.upstream){
    location.hash='#compute';set('preset','tutorial:nonhomogeneous');radio('task','gb');radio('ring',c.comm?'comm':'noncomm');radio('field','0');set('order',c.comm?'deglex':'degleftlex');set('vars',c.vars.join(', '));set('rels',c.rels.join(', '));set('maxdeg',c.maxdeg);$('details.advanced').open=true;set('weights',c.weights?.join(' ')||'');await compute();await post('upstream',{id:c.id,files:files()});
   }
   if(data.mount==='/george/'){
    for(const item of data.tutorials){location.hash='#guide-examples';await math();$(`[data-tutorial="${item.id}"]`).click();ok(!$('#view-compute').hidden,'example opens form');eq($('#preset').value,'tutorial:'+item.id,'example preset');eq($('#vars').value,item.form.vars.join(', '),'example generators');eq($('input[name="task"]:checked').value,item.form.task,'example task');eq($('#augmentation').value,item.form.augmentation,'example augmentation');await compute();await post('example',{id:item.id,files:files(),resolutionLines:all('#resolutionOut .tensor-line').length});}
    for(const file of ['engine/ecl.wasm','sources/george-source.tar.gz','sources/ecl-source.tar.gz','licenses/NOTICE.txt','.nojekyll']){const r=await fetch(new URL(file,location.href));eq(r.status,200,'download '+file);if(file.endsWith('.wasm'))ok(r.headers.get('content-type').includes('application/wasm'),'Wasm MIME');}
   }
   location.hash='#compute';set('preset','example:char2');set('maxdeg','4');next('edited');return;
  }
  if(phase==='edited'){
   eq($('#maxdeg').value,'4','edited original preset survives reload');
   const external=performance.getEntriesByType('resource').map(r=>r.name).filter(u=>new URL(u).origin!==location.origin);eq(external,[],'no external assets');
   await post('done',{mode,errors,externalRequests:external,mathjaxSVGs:all('#guideContent mjx-container[jax="SVG"] svg').length,checks:[data.mount+': EN/RU wording, controls, status and guide; state/files preserved; reload persistence; themes; MathJax',data.mount+': overlapping/underscore names, colliding chains, braid and weighted cutoff; exact homology; whole-token rendering',data.mount+': four imported algebra cases in the real form; edited preset persistence',...(data.mount==='/george/'?['project path: eight guide buttons compute; reference equality; MIME and source downloads']:[])]});
  }
 }catch(e){await fetch(new URL('__validation/failure',location.href),{method:'POST',body:JSON.stringify({error:String(e.stack||e),phase,mode,errors,status:$('#runStatus')?.textContent,log:$('#logOut')?.textContent})});}
}

// Configure a 390px viewport without Playwright's automatic debugger/worker
// attachment. Chrome's headless native window has a 500px minimum. Only the
// Emulation and Page domains are used; no debugger or profiler is enabled.
async function mobileViewport(profile,url){
 const portFile=path.join(profile,'DevToolsActivePort'),start=Date.now();
 let port,endpoint;
 while(!endpoint){
  if(fs.existsSync(portFile))[port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split('\n');
  assert.ok(Date.now()-start<30000,'Chrome debugging port');
  if(!endpoint)await new Promise(r=>setTimeout(r,50));
 }
 const socket=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});
 const targets=await call('Target.getTargets'),page=targets.targetInfos.find(t=>t.type==='page');assert.ok(page);
 const {sessionId}=await call('Target.attachToTarget',{targetId:page.targetId,flatten:true});
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false},sessionId);
 await call('Page.navigate',{url},sessionId);return socket;
}

async function run(mount,mode='desktop'){
 const server=staticServer('web',mount),serve=server.listeners('request')[0];server.removeAllListeners('request');
 const requests=[],badResponses=[],failures=[];let resolve,reject;const done=new Promise((a,b)=>{resolve=a;reject=b});
 server.on('request',async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),endpoint=mount+'__validation/';requests.push(url.pathname);
   res.on('finish',()=>{if(res.statusCode>=400)badResponses.push([url.pathname,res.statusCode]);});
   if(url.pathname===endpoint+'data'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...data,mount}));return;}
   if(url.pathname.startsWith(endpoint)&&req.method==='POST'){
    let body='';for await(const b of req)body+=b;const v=JSON.parse(body),kind=url.pathname.slice(endpoint.length);
    if(kind==='failure'){failures.push(v);throw Error(v.error);}
    if(kind==='upstream'){
     const c=data.upstream.find(c=>c.id===v.id);assert.ok(c);const a=algebra(c.vars,c.comm,0,c.weights),gb=a.basis(v.files['result.gb']);a.certify(c.rels.map(a.parse),gb,c.scope==='complete'?Infinity:c.maxdeg);
     if(c.expectedDimensions)assert.deepEqual(a.hilbert(gb,c.maxdeg),c.expectedDimensions);if(c.expectedDimension!==undefined)assert.equal(a.hilbert(gb,10).reduce((s,n)=>s+n,0),c.expectedDimension);
    }else if(kind==='example'){
     const item=TUTORIALS.find(t=>t.id===v.id);assert.ok(item);
     if(item.example){const e=EXAMPLES.find(e=>e.id===item.example);for(const [k,text]of Object.entries(e.out))assert.equal(v.files['result.'+k],text,v.id+'/'+k);}
     else{assert.deepEqual(JSON.parse(v.files['homology.json']).betti.slice(0,5),[1,1,0,0,0]);assert.ok(v.resolutionLines>0);}
     report.examples.push({id:item.id,task:tutorialForm(item.id).task,outputs:Object.keys(v.files),hashes:Object.fromEntries(Object.entries(v.files).map(([n,s])=>[n,crypto.createHash('sha256').update(s).digest('hex')]))});console.log(item.id,'PASS');
    }else if(kind==='backends'){
     assert.equal(v.defaultBackend,'compiled');assert.deepEqual(v.rows.map(r=>r.backend),['standard','optimized','compiled']);
     for(const row of v.rows){assert.equal(row.outputParity,true);assert.equal(row.shareRoundTrip,true);}
     report.backends.push(v);console.log(mount,'backend selection, parity and share PASS');
    }else if(kind==='console'){
     assert.equal(v.recoveryCases,8);for(const key of ['settingsAndFilesRetained','firstValue','help','completion','history','currentComputation'])assert.equal(v[key],true,key);
     report.console.push(v);console.log(mount,'console recovery PASS');
    }else if(kind==='done'){
     assert.deepEqual(v.errors,[]);assert.deepEqual(v.externalRequests||[],[]);report.checks.push(...v.checks);res.end('ok');resolve(v);return;
    }else throw Error('Unknown validation endpoint');
    res.end('ok');return;
   }
   if(url.pathname===mount){
    const init=`<script>window.validationErrors=[];addEventListener('error',e=>validationErrors.push(e.message));addEventListener('unhandledrejection',e=>validationErrors.push(String(e.reason)));${mode==='blocked'?`Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}});Object.defineProperty(navigator,'language',{get(){return 'ru-RU'}});Object.defineProperty(navigator,'languages',{get(){return ['ru-RU','ru']}});`:''}</script>`;
    const html=fs.readFileSync('web/index.html','utf8').replace('<head>','<head>'+init).replace('</body>',`<script type="module">(${checkUI.toString()})();</script></body>`);res.setHeader('Content-Type','text/html');res.end(html);return;
   }
   serve(req,res);
  }catch(e){res.writeHead(500).end(String(e));reject(e);}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'george-ui-'));
 const url=`http://127.0.0.1:${server.address().port}${mount}?validation=${mode}`;
 const browser=spawn(process.env.CHROMIUM||'/usr/bin/chromium',['--headless','--no-sandbox','--no-first-run','--remote-debugging-port=0',...(mode==='desktop'&&mount==='/'?['--force-dark-mode']:[]),'--lang='+ (mode==='blocked'?'ru-RU':'en-US'),`--window-size=${mode==='mobile'?'390,844':'1280,900'}`,`--user-data-dir=${profile}`,mode==='mobile'?'about:blank':url],{stdio:['ignore','ignore','pipe']});
 let stderr='';browser.stderr.on('data',b=>stderr+=b);browser.on('error',reject);
 const timer=setTimeout(()=>reject(Error('UI validation timed out')),600000);
 let attached,viewport;
 try{
  if(mode==='mobile')viewport=await mobileViewport(profile,url);
  const result=await done;assert.deepEqual(badResponses,[]);assert.ok(requests.every(p=>p.startsWith(mount)));assert.ok(requests.every(p=>!p.includes('//')));
  if(mode==='desktop')report.mounts.push({mount,requests:requests.length,mathjaxSVGs:result.mathjaxSVGs,badResponses,diagnostics:[]});
  // No calculations remain. Attaching here cannot affect their execution.
  const port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);attached=await chromium.connectOverCDP('http://127.0.0.1:'+port);report.browser=attached.version();
  const page=attached.contexts()[0].pages().find(p=>p.url().startsWith(`http://127.0.0.1:${server.address().port}`));assert.ok(page);
  if(mode==='desktop'){
   await page.locator('[data-lang="ru"]').click();await page.locator('a[data-view="guide"]').click();await page.waitForFunction(()=>document.querySelector('#guideContent').getAttribute('aria-busy')==='false'&&document.querySelectorAll('#guideContent mjx-container[jax="SVG"] svg').length>=20);
   await page.screenshot({path:`${out}/${mount==='/'?'root':'project'}-guide-ru-dark.png`,fullPage:true});
  }else if(mode==='mobile'){
   await page.screenshot({path:`${out}/project-result-mobile.png`,fullPage:true});await page.locator('a[data-view="guide"]').click();await page.waitForFunction(()=>document.querySelector('#guideContent').getAttribute('aria-busy')==='false');await page.screenshot({path:`${out}/project-guide-en-light-mobile.png`,fullPage:true});
  }
 }catch(e){fs.writeFileSync(`${out}/failure-${mode}-${mount==='/'?'root':'project'}.json`,JSON.stringify({error:String(e.stack||e),failures,requests,badResponses},null,2));throw e;}
 finally{clearTimeout(timer);await attached?.close().catch(()=>{});viewport?.close();browser.kill('SIGTERM');server.close();fs.writeFileSync(`${out}/browser-${mode}-${mount==='/'?'root':'project'}.log`,stderr);}
}
try{for(const mount of ['/','/george/']){console.log('Checking',mount);await run(mount);}await run('/george/','mobile');await run('/','blocked');
 assert.equal(report.examples.length,8);assert.equal(report.mounts.length,2);assert.equal(report.console.length,2);assert.equal(report.backends.length,2);assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);for(const [p,h]of Object.entries(report.sourceHashes))assert.equal(sha(p),h,p+': sources changed during validation');
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(out,'PASS');
}catch(e){console.error(e);process.exitCode=1;}
