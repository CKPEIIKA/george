// A yielded exact row retains its lease; checkpoints contain descriptors, not pointers.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=path.resolve('results/0.6.7/cooperative-reserve');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/published/affine-q-serre-q3.json'));let e,observed=[];
const options={bits:32,execution:'multicore',workers:4,budgetBytes:256*1048576,scratchBytes:6*1048576,rowReserveBytes:64*1048576,memoryPolicy:'manual',spill:true,hilbert:true,exportText:false,progress:true,runKey:'leased',resume:false,quantumMs:2,lookahead:16,timeoutMs:90000,checkpointIntervalMs:0};
e=new FomkyrEngine({...options,onEvent:x=>{
 if(x.type==='checkpoint'&&e.e.gn_reserve_stat(0,9)!==0n&&e.cooperativeStats().lanes.some(l=>l.yields>0)){
  observed.push({degree:x.currentDegree,committed:x.retainedCommittedPairs,cooperative:e.cooperativeStats()});if(observed.length===2)e.cancel();
 }
}});
let err;try{await e.compute(fixture,18,0);}catch(x){err=x;}const final=e.cooperativeStats(),released=e.e.gn_reserve_stat(0,9)===0n,cp=e.lastCheckpoint;await e.close();
assert.equal(err?.code,'CANCELLED');assert.equal(observed.length,2,'must checkpoint twice with yielded reserve owner');assert(released);assert(final.quantumMs>0);assert(cp.partial);
e=new FomkyrEngine({...options,bits:64,execution:'single',workers:1,scratchBytes:64*1048576,resume:true,quantumMs:5,checkpointIntervalMs:30000});let r;try{r=await e.compute(fixture,18,0);}finally{await e.close();}assert.equal(r.completedThroughDegree,18);
const record=path.join(root,'fomkyr/leased/basis.gnb');const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify([{fixture,record,degree:17,modulus:0,name:'yielded-reserve-resume',hilbert:r.hilbert.coefficients.slice(0,18)}]));
const audit=spawnSync('python3',['tests/verify_062_wasm.py',manifest,'results/0.6.7/cooperative-reserve-audit.json'],{encoding:'utf8',timeout:120000});fs.writeFileSync('results/0.6.7/cooperative-reserve-audit.log',audit.stdout+audit.stderr);assert.equal(audit.status,0,audit.stdout+audit.stderr);
fs.writeFileSync('results/0.6.7/cooperative-reserve.json',JSON.stringify({passed:true,completedThroughDegree:18,independentCertificateThroughDegree:17,observed,released,checkpoint:cp,cancellation:final,resumed:r,record},null,2));console.log('COOPERATIVE LEASE + CHECKPOINT + CROSS-MODE RESUME PASSED');
