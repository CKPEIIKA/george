import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox',...(process.env.OPTIMIZED_V8?['--js-flags=--no-liftoff']:[])]});
try{
const page=await browser.newPage();await page.goto('http://127.0.0.1:8000/engine/');
const r=await page.evaluate(async()=>{const {EclEngine}=await import('/src/engine.js');const e=new EclEngine();const start=performance.now();await e.init();const startup=performance.now()-start;const t=performance.now();const r=await e.eval('(DOTIMES (I 100000) (+ I 2))');e.cancel();return {startup,elapsed:performance.now()-t,stdout:r.stdout};});
console.log(r);
}finally{await browser.close();}
