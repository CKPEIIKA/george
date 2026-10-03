import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {setup} from './node-host.mjs';import {ModularEngine} from '../web/modular-engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-mod-matrix-'));setup(root);
const made=spawnSync('python3',['-c',"import json,sys;sys.path.insert(0,'tests');from physics_cases import cases;print(json.dumps(cases()))"],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);
const fixtures=JSON.parse(made.stdout),entries=[];
try{
 for(const fixture of fixtures){const d=fixture.testDegree>30?fixture.testDegree:fixture.name==='FK6-original-order'?4:Math.min(fixture.testDegree,6);const e=new ModularEngine({workers:4,bits:32,budgetBytes:128*1048576,scratchBytes:32*1048576,hashBits:16,resume:false,spill:true,exportText:false,progress:false,modularMinPrimes:2,modularFallback:false});
 try{const r=await e.compute(fixture,d,0);assert(r.certification.deterministic);assert.equal(r.certification.throughDegree,d);if(fixture.expectedHilbert)assert.deepEqual(r.hilbert.coefficients,fixture.expectedHilbert.slice(0,d+1).map(String));entries.push({name:fixture.name,fixture,modulus:0,degree:d,record:path.join(root,'fomkyr',r.runKey,'basis.gnb'),hilbert:r.hilbert.coefficients,shared:r.shared,bits:r.bits,workers:r.workers,certification:r.certification,modular:r.modular});console.log('MODULAR PASS '+fixture.name+' d'+d);}
 finally{await e.close();}}
 const manifest=path.join(root,'matrix.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const v=spawnSync('python3',['tests/verify_modular_matrix.py',manifest],{encoding:'utf8',timeout:180000});assert.equal(v.status,0,v.stdout+v.stderr);console.log(v.stdout);
}finally{fs.rmSync(root,{recursive:true,force:true});}
