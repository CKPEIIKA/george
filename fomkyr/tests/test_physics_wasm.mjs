// Actual serialized shared-WASM output, then independent field oracle.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-physics-'));setup(root);
const fixtureFile=new URL('../fixtures/physics-matrix.json',import.meta.url);
let made=spawnSync('python3',['-c',"import sys,json;sys.path.insert(0,'tests');from physics_cases import cases;json.dump(cases(),open('fixtures/physics-matrix.json','w'),indent=2)"],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);
const fixtures=JSON.parse(fs.readFileSync(fixtureFile));const entries=[];
try{
 for(const fixture of fixtures)for(const modulus of fixture.testDegree<30?[0,2,101]:[0]){
  const key=`case-${entries.length}`;const progress=[];const e=new FomkyrEngine({workers:4,bits:32,spill:true,budgetBytes:128*1048576,scratchBytes:16*1048576,hashBits:16,runKey:key,resume:false,exportText:false,onEvent:v=>{if(v.type==='progress'&&v.phase==='checkpoint')progress.push(v);}});
  try{const r=await e.compute(fixture,fixture.testDegree,modulus);if(fixture.expectedHilbert)assert.deepEqual(r.hilbert.coefficients,fixture.expectedHilbert.map(String));
   for(const v of progress){assert.equal(v.overlaps.total,v.overlaps.resolved);assert.equal(v.overlaps.total,v.overlaps.enumerated);}
   entries.push({name:fixture.name,fixture,modulus,degree:fixture.testDegree,record:path.join(root,'fomkyr',key,'basis.gnb'),hilbert:r.hilbert.coefficients,shared:r.shared,bits:r.bits,workers:r.workers,progressError:r.progressError});
  }finally{await e.close();}
 }
 const manifest=path.join(root,'matrix.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const verify=spawnSync('python3',[new URL('./verify_physics_wasm.py',import.meta.url).pathname,manifest],{encoding:'utf8',timeout:180000});assert.equal(verify.status,0,verify.stdout+verify.stderr);console.log(verify.stdout);
}finally{fs.rmSync(root,{recursive:true,force:true});}
