// Real WASM benchmark; browser OPFS is emulated by Node fs in this harness.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './node-host.mjs';import {NativeEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'george-bench-'));setup(root);
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/fk6.json',import.meta.url)));
const target=Number(process.argv[2]??10),bits=Number(process.argv[3]??32),workers=Number(process.argv[4]??4),degrees=[];
const e=new NativeEngine({bits,workers,spill:true,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,runKey:'bench',previewBytes:65536,onEvent:x=>{if(x.type==='degree'){degrees.push(x);console.log(JSON.stringify(x));}}});
let report;
try{const result=await e.compute(fixture,target,0);delete result.preview;
  const out=new URL(`../results/fk6-degree${target}-output/`,import.meta.url);
  fs.mkdirSync(out,{recursive:true});
  fs.cpSync(path.join(root,'george-native','bench'),out,{recursive:true});
  report={host:'Node22 worker_threads; OPFS emulated by fs',fixture:'fk6.json',exactField:'Q',target,bits,workers,degrees,result,peakProcessRSSBytes:process.resourceUsage().maxRSS*1024};console.log(JSON.stringify(report));}
catch(error){report={error:String(error),native:error.native,degrees};console.error(error);process.exitCode=1;}
finally{await e.close();fs.writeFileSync(new URL(`../results/fk6-degree${target}-wasm${bits}.json`,import.meta.url),JSON.stringify(report,null,2));fs.rmSync(root,{recursive:true,force:true});}
