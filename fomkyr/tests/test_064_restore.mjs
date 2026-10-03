import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.4/large-row-storage');setup(root);
const terms=Array.from({length:16384},(_,i)=>({word:Array.from({length:14},(_,j)=>(i>>(13-j))&1),coefficient:1}));
const fixture={variables:['a','b'],relations:[{degree:14,terms}]};
const normal=new FomkyrEngine({memoryPolicy:'auto',workers:4,budgetBytes:128*1048576,runKey:'large-record',resume:false,spill:true,hilbert:false,exportText:false,progress:false});
const first=await normal.compute(fixture,14,0);await normal.close();
const file=path.join(root,'fomkyr','large-record','basis.gnb');const before=fs.readFileSync(file);
class PressureEngine extends FomkyrEngine {async open(){await super.open();this.scratch=4*1048576;this.memoryPlan.rowReserveBytes=0;return this;}}
const events=[];
const e=new PressureEngine({memoryPolicy:'auto',workers:4,budgetBytes:128*1048576,runKey:'large-record',resume:true,spill:true,hilbert:false,exportText:false,progress:false,onEvent:x=>{if(x.type==='memory-adaptation')events.push(x);}});
const r=await e.compute(fixture,14,0);await e.close();
assert.equal(r.resumedFromDegree,14);assert.equal(r.workers,1);assert.equal(r.basisSize,1);assert.equal(events.length,2);
assert.deepEqual(fs.readFileSync(file),before);
fs.writeFileSync('results/0.6.4/auto-restore.json',JSON.stringify({passed:true,recordBytes:before.length,terms:terms.length,completedThroughDegree:14,events,
 inputKind:'dense homogeneous synthetic single-relation I/O test, not a hard degree-14 completion',
 sha256:crypto.createHash('sha256').update(before).digest('hex')},null,2));
console.log('AUTOMATIC LARGE-ROW RESTORE PASS');
