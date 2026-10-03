import assert from 'node:assert/strict';
import fs from 'node:fs';import {planMemory,chooseMemoryPolicy} from '../web/memory-policy.js';
let count=0;
for(const mib of [32,64,128,256,512,1024,2048,3584,4095,8192,14304])for(const w of [1,2,4,8]) {
 const p=planMemory(mib*1048576,w,{memoryPolicy:'auto',scratchBytes:1,rowReserveBytes:2});
 assert(p.ordinaryScratchBytes+p.rowReserveBytes<p.budgetBytes);assert.equal(p.policy,'auto');assert.equal(p.ignoredManualWorkspaceSettings,true);assert.equal(p.physicalMemoryDetection,false);count++;
}
const p=planMemory(3584*1048576,4,{});assert.equal(p.ordinaryScratchBytes,2048*1048576);assert.equal(p.rowReserveBytes,512*1048576);
assert.equal(chooseMemoryPolicy({scratchBytes:32*1048576}),'manual');assert.equal(chooseMemoryPolicy({}),'auto');
assert.throws(()=>chooseMemoryPolicy({memoryPolicy:'oops'}));
const manual=planMemory(512*1048576,4,{scratchBytes:128*1048576,rowReserveBytes:64*1048576});assert.equal(manual.ordinaryScratchBytes,128*1048576);assert.equal(manual.rowReserveBytes,64*1048576);
fs.writeFileSync('results/0.6.4/planner.json',JSON.stringify({passed:true,cases:count+6,allocationTest:false,policy:'pure bounded planner'},null,2));console.log('MEMORY PLANNER PASS',count);
