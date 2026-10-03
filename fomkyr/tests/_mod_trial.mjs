import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup} from './node-host.mjs';import {ModularEngine} from '../web/modular-engine.js';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-mod-'));setup(temp);
const file=process.argv[2]??'fixtures/fk3.json',d=Number(process.argv[3]??5),workers=Number(process.argv[4]??4),minPrimes=Number(process.argv[5]??2);
const e=new ModularEngine({workers,bits:32,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,spill:true,resume:false,exportText:false,progress:false,modularMinPrimes:minPrimes,modularFallback:false,onEvent:v=>{if(['stdout','warning'].includes(v.type))console.error(v.text??v.message);}});
try{const r=await e.compute(JSON.parse(fs.readFileSync(file)),d,0);console.log(JSON.stringify(r,null,2));if(process.env.OUTDIR){fs.mkdirSync(process.env.OUTDIR,{recursive:true});fs.copyFileSync(path.join(temp,'fomkyr',r.runKey,'basis.gnb'),path.join(process.env.OUTDIR,'basis.gnb'));fs.writeFileSync(path.join(process.env.OUTDIR,'result.json'),JSON.stringify(r,null,2));}}
finally{await e.close();fs.rmSync(temp,{recursive:true,force:true});}
