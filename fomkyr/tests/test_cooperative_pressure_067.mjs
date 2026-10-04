import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.7/cooperative-pressure');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
class Pressure extends FomkyrEngine{async open(){await super.open();this.scratch=6*1048576;this.memoryPlan.rowReserveBytes=0;}}
const fixture=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q3.json'));const events=[];
let e;let stopped=false;
e=new Pressure({bits:32,workers:4,spill:true,resume:false,runKey:'pressure',memoryPolicy:'auto',budgetBytes:128*1048576,quantumMs:2,lookahead:16,hilbert:true,exportText:false,timeoutMs:90000,onEvent:x=>{
 if(x.type==='memory-adaptation'){events.push(x);if(events.length===2){stopped=true;e.cancel();}}
}});
let error;try{await e.compute(fixture,17,0);}catch(x){error=x;}
const pressure=e.cooperativeStats(),checkpoint=e.lastCheckpoint;
await e.close();
assert(stopped);assert.equal(error?.code,'CANCELLED');assert.equal(events.length,2);
assert(pressure.capacityReplayPairs>0);assert(checkpoint?.partial);
// Resume the exact retained frontier with ordinary automatic workspace. This
// checks pressure recovery without requiring a tiny general-reducer arena to
// finish every coefficient-heavy row inside the regression deadline.
e=new FomkyrEngine({bits:32,workers:1,spill:true,resume:true,runKey:'pressure',memoryPolicy:'auto',budgetBytes:128*1048576,quantumMs:250,lookahead:16,hilbert:true,exportText:false,timeoutMs:90000});
let r;try{r=await e.compute(fixture,17,0);}finally{await e.close();}
assert.equal(r.completedThroughDegree,17);assert(r.cooperative.quantumMs>0);
fs.writeFileSync('results/0.6.7/cooperative-pressure.json',JSON.stringify({passed:true,fixture,events,pressure,checkpoint,result:r,record:path.join(root,'fomkyr/pressure/basis.gnb')},null,2));console.log(JSON.stringify({passed:true,events,result:r.cooperative}));

const manifest=path.join(root,'manifest.json');
fs.writeFileSync(manifest,JSON.stringify([{fixture,record:path.join(root,'fomkyr/pressure/basis.gnb'),degree:17,modulus:0,name:'cooperative-pressure',hilbert:r.hilbert.coefficients}]));
const audit=spawnSync('python3',['tests/verify_062_wasm.py',manifest,'results/0.6.7/cooperative-pressure-audit.json'],{encoding:'utf8',timeout:120000});
assert.equal(audit.status,0,audit.stdout+audit.stderr);
console.log('Independent pressure-recovery certificate passed.');
