// SPDX-License-Identifier: MIT. Real four-variant WASM export, independent oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';
import {encodeRecord} from '../web/rational-lift.js';
import {ModularEngine} from '../web/modular-engine.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-normalization-'));setup(root);
const rational={name:'rational-tail-chain',variables:['x','y'],relations:[
 {degree:2,terms:[{word:[1,1],coefficient:'3'},{word:[0,1],coefficient:'2'}]},
 {degree:2,terms:[{word:[0,1],coefficient:'1'},{word:[0,0],coefficient:'-1'}]},
]};
const load=name=>JSON.parse(fs.readFileSync(new URL(`../fixtures/${name}.json`,import.meta.url)));
const long={name:'long-word',variables:['x','y'],relations:[{degree:33,terms:[{word:Array(33).fill(1),coefficient:'3'},{word:Array(33).fill(0),coefficient:'2'}]}]};
const jobs=[[rational,4,0],[rational,4,2],[rational,4,101],[long,33,0],[load('big-coefficients'),4,0],[load('fk6'),6,0]];
const entries=[];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
try{
 for(const bits of [32,64])for(const execution of ['single','multicore'])for(const [fixture,degree,modulus] of jobs){
  const key=`case-${entries.length}`,e=new FomkyrEngine({bits,execution,workers:4,normalizationWorkers:execution==='multicore'?4:1,budgetBytes:256*1048576,runKey:key,resume:false,hilbert:false,hashBits:16,previewBytes:40,timeoutMs:120000});
  try{
   const result=await e.compute(fixture,degree,modulus);
   assert.equal(result.reduced,true);assert.equal(result.tailReduced,true);assert.equal(result.normalization,'monic-tail-reduced');
   const directory=path.join(root,'fomkyr',key),record=path.join(directory,'basis.gnb'),text=path.join(directory,'result.gb');
   assert.ok(fs.readFileSync(text,'utf8').endsWith('Done\n'));
   if(result.previewTruncated)assert.ok(!/^Done$/m.test(result.preview));
   const before=hash(fs.readFileSync(record)),normalized=fs.readFileSync(text,'utf8');
   // Re-exporting and raw opt-out must preserve the committed byte prefix.
   const again=await e.exportText(fixture.variables);assert.equal(again.reduced,true);
   assert.equal(fs.readFileSync(text,'utf8'),normalized);
   e.options.normalizeOutput=false;const raw=await e.exportText(fixture.variables);assert.equal(raw.reduced,false);
   const rawText=fs.readFileSync(text,'utf8');if(fixture===rational&&modulus===0)assert.notEqual(rawText,normalized);
   assert.equal(hash(fs.readFileSync(record)),before);
   fs.writeFileSync(text,normalized);
   entries.push({fixture,degree,modulus,record,text,bits,execution,normalizationSeconds:result.normalizationSeconds,rows:result.basisSize});
   console.log('NORMALIZE WASM',bits,execution,fixture.name,modulus,result.basisSize,result.normalizationSeconds.toFixed(4));
  }finally{await e.close();}
 }
 // Arbitrary precision also applies to text output; no historical 4096-limb
 // formatting ceiling. Test a valid imported record independently of completion.
 for(const bits of [32,64])for(const execution of ['single','multicore']){
  const e=new FomkyrEngine({bits,execution,workers:4,budgetBytes:128*1048576,spill:false,resume:false,hilbert:false});
  try{
   await e.compute({variables:['x','y'],relations:[]},2,0);
   const a=(1n<<131104n)+1n,b=a+2n,record=encodeRecord({degree:2,lm:'11',terms:new Map([['11',a],['00',b]])},1048576);
   const pointer=e.e.gn_import_buffer();new Uint8Array(e.memory.buffer,Number(pointer),record.length).set(record);
   assert.equal(e.e.gn_restore_rule(record.length,0n),0);
   const r=await e.exportText(['x','y']);assert.equal(r.reduced,true);
   assert.ok(r.preview.includes(`y^2+${b}/${a}*x^2`));
   console.log('LARGE NORMALIZATION',bits,execution,'131105 bits PASS');
  }finally{await e.close();}
 }
 for(const bits of [32,64])for(const execution of ['single','multicore']){
  const e=new ModularEngine({bits,execution,workers:4,budgetBytes:256*1048576,resume:false,hilbert:false,modularMinPrimes:1,modularFallback:false});
  try{
   const r=await e.compute(rational,4,0);assert.equal(r.reduced,true);assert.equal(r.certification.deterministic,true);
   const directory=path.join(root,'fomkyr',r.runKey);
   entries.push({fixture:rational,degree:4,modulus:0,record:path.join(directory,'basis.gnb'),text:path.join(directory,'result.gb'),bits,execution,normalizationSeconds:r.normalizationSeconds,rows:r.basisSize,arithmetic:'modular-verified'});
   console.log('VERIFIED NORMALIZATION',bits,execution,'PASS');
  }finally{await e.close();}
 }
 const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(entries));
 const checked=spawnSync('python3',[new URL('./verify_normalization.py',import.meta.url).pathname,manifest],{encoding:'utf8',timeout:120000});
 assert.equal(checked.status,0,checked.stdout+checked.stderr);process.stdout.write(checked.stdout);
 if(process.env.FOMKYR_NORMALIZER_REPORT)fs.writeFileSync(process.env.FOMKYR_NORMALIZER_REPORT,JSON.stringify({passed:true,largeCoefficientCases:4,cases:entries.map(({fixture,record,text,...entry})=>({...entry,name:fixture.name}))},null,2)+'\n');
 console.log('NORMALIZATION WASM PASS',entries.length+4);
}finally{fs.rmSync(root,{recursive:true,force:true});}
