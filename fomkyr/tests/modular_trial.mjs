// Reproducible fresh-process end-to-end trial; includes all child startup,
// primes, canonicalization, CRT, verification and final checkpoint (not export).
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [mode,file,degreeString,output,record]=process.argv.slice(2);const source=path.resolve(process.env.FOMKYR_SOURCE??'.');
const {setup}=await import(pathToFileURL(path.join(source,'tests/node-host.mjs')));const {FomkyrEngine}=await import(pathToFileURL(path.join(source,'web/engine.js')));
let Engine=FomkyrEngine;if(mode==='modular')Engine=(await import(pathToFileURL(path.join(source,'web/modular-engine.js')))).ModularEngine;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-endtoend-'));setup(temp);
const options={rationalHeap:process.env.RATIONAL_HEAP==='on',workers:4,bits:32,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,spill:true,resume:false,exportText:false,hilbert:false,progress:false,modularMinPrimes:Number(process.env.MIN_PRIMES??2),modularFallback:false,timeoutMs: Number(process.env.TIMEOUT_MS??120000)};
const fixture=JSON.parse(fs.readFileSync(file));const e=new Engine(options);let report;
try{const start=performance.now(),r=await e.compute(fixture,Number(degreeString),0);report={mode,options,source,fixtureName:fixture.name??path.basename(file),degree:Number(degreeString),endToEndMs:performance.now()-start,result:r,node:process.version,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,peakProcessRSSBytes:process.resourceUsage().maxRSS*1024};if(record)fs.copyFileSync(path.join(temp,'fomkyr',r.runKey,'basis.gnb'),record);}
catch(error){report={mode,degree:Number(degreeString),error:error.message,code:error.code};process.exitCode=1;}
finally{await e.close();fs.rmSync(temp,{recursive:true,force:true});if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({mode,degree:report.degree,ms:report.endToEndMs,error:report.error,primes:report.result?.modular?.primesUsed}));}
