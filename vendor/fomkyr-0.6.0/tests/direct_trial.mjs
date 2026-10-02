// Fresh-process matched direct-exact trial. All startup and checkpoints included.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [file,degreeString,output,record]=process.argv.slice(2);const source=path.resolve(process.env.FOMKYR_SOURCE??'.');
const {setup}=await import(pathToFileURL(path.join(source,'tests/node-host.mjs')));
const {FomkyrEngine}=await import(pathToFileURL(path.join(source,'web/engine.js')));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-direct-'));setup(temp);
const options={workers:4,bits:32,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,spill:true,resume:false,exportText:false,hilbert:false,progress:false,rationalHeap:true,timeoutMs:120000,...JSON.parse(process.env.TRIAL_OPTIONS??'{}')};
const fixture=JSON.parse(fs.readFileSync(file));const e=new FomkyrEngine(options);let report;
try{const start=performance.now(),r=await e.compute(fixture,Number(degreeString),0);report={options,source,fixtureName:fixture.name??path.basename(file),degree:Number(degreeString),endToEndMs:performance.now()-start,result:r,node:process.version,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,peakProcessRSSBytes:process.resourceUsage().maxRSS*1024};if(record)fs.copyFileSync(path.join(temp,'fomkyr',r.runKey,'basis.gnb'),record);}
catch(error){report={options,source,degree:Number(degreeString),error:error.message,code:error.code};process.exitCode=1;}
finally{await e.close();fs.rmSync(temp,{recursive:true,force:true});if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({degree:report.degree,ms:report.endToEndMs,error:report.error,rules:report.result?.basisSize,steps:report.result?.reductions,hits:report.result?.localRewriteHits}));}
