import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
setup(path.resolve('results/0.6.4/small-budget-storage'));
const f=JSON.parse(fs.readFileSync('fixtures/exterior.json'));const rows=[];
for(const mib of [16,32,64])for(const workers of [1,4]){
 const e=new FomkyrEngine({budgetBytes:mib*1048576,workers,memoryPolicy:'auto',bits:32,spill:false,
  hilbert:true,exportText:false,progress:false,timeoutMs:5000});
 try{const r=await e.compute(f,7,0);assert.equal(r.completedThroughDegree,7);assert(r.allocatedBytes<=r.budgetBytes);
 rows.push({budgetMiB:mib,workers,passed:true,allocatedBytes:r.allocatedBytes,ordinaryScratchBytes:r.ordinaryScratchBytes});}
 catch(error){rows.push({budgetMiB:mib,workers,passed:false,code:error.code,error:error.message});}
 finally{await e.close();}
}
fs.writeFileSync('results/0.6.4/small-budget.json',JSON.stringify(rows,null,2));console.log(rows);
if(rows.some(r=>!r.passed))process.exitCode=1;
