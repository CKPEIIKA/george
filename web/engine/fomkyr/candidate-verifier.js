// SPDX-License-Identifier: MIT
// Reject-only exact verification. It must NEVER complete/repair a bad candidate.
// This establishes (1) F ⊆ <G>, (2) G is GB through D. Ideal equality additionally
// needs the internally computed prime-field leading-ideal rank witness.
import {ProgressTracker,readProgressCounters} from './progress.js';
import {checked,stats,wordCode} from './runtime.js';
import {validateFixture} from './engine.js';
import {encodeRecord,wordCompare} from './rational-lift.js';
export async function checkCandidate(engine,fixture,rows,target){
 validateFixture(fixture);
 if(!Number.isInteger(target)||target<1||target>0xfffffffe)throw new Error('A finite positive verification degree is required');
 if(engine.active||engine.closed)throw new Error('Verifier engine busy/closed');
 engine.active=true;engine.verifyingCandidate=true;const start=performance.now();let timer;
 try{
  if(!engine.e)await engine.open();
  await engine.resetKernel(fixture,target,0);
  engine.tracker=new ProgressTracker({target});engine.progressInterval=engine.options.progressIntervalMs??1000;
  if(engine.options.progress!==false){engine.host.setPulse(()=>engine.publishProgress(false),engine.progressInterval);timer=setInterval(()=>engine.publishProgress(false),engine.progressInterval);}
  if(engine.options.timeoutMs>0)engine.e.gn_deadline(performance.timeOrigin+performance.now()+engine.options.timeoutMs);
  let offset=0;let previous=null;const leaders=new Set();
  for(const row of rows){
   if(engine.cancelRequested)checked(5);
   if(row.degree>target||row.degree<1||row.lm.length!==row.degree||!row.terms.size||leaders.has(row.lm)||previous!==null&&wordCompare(previous,row.lm)>=0)checked(10);
   if([...row.terms].some(([w,c])=>w.length!==row.degree||typeof c!=='bigint'||c===0n||wordCompare(w,row.lm)>0||[...w].some(x=>parseInt(x,16)>=fixture.variables.length||!/[0-9a-f]/.test(x))))checked(10);
   if(!row.terms.has(row.lm))checked(10);leaders.add(row.lm);previous=row.lm;
   const bytes=encodeRecord(row,engine.e.gn_import_capacity()),ptr=engine.e.gn_import_buffer();
   new Uint8Array(engine.memory.buffer,Number(ptr),bytes.length).set(bytes);
   if(engine.spill&&!engine.host.imports.host.write(BigInt(offset),ptr,bytes.length))checked(4);
   checked(engine.e.gn_restore_rule(bytes.length,BigInt(offset)));offset+=bytes.length;
  }
  checked(engine.e.gn_candidate_check());
  let inputs=0;
  engine.setPhase('input');
  for(const r of fixture.relations){
   if(r.degree>target)continue;
   checked(engine.e.gn_input_begin(r.degree,r.terms.length));
   for(const t of r.terms){
    if(t.word.length<=31){const [lo,hi]=wordCode(t.word);checked(engine.e.gn_input_term(lo,hi,BigInt(t.coefficient)));}
    else{if(t.word.length>engine.e.gn_import_capacity())checked(2);new Uint8Array(engine.memory.buffer,Number(engine.e.gn_import_buffer()),t.word.length).set(t.word);checked(engine.e.gn_input_bytes(t.word.length,BigInt(t.coefficient)));}
   }
   checked(engine.e.gn_input_end());inputs++;
  }
  for(let d=1;d<=target;d++){
   if(engine.cancelRequested)checked(5);
   await new Promise(r=>setTimeout(r,0));
   engine.tracker.begin(d,d-1);engine.setPhase('indexing');checked(engine.e.gn_start_degree(d));
   engine.setPhase('reducing');await engine.completeDegree();checked(engine.e.gn_finish_degree());
   engine.tracker.finish(d,readProgressCounters(engine.e));engine.publishProgress(true);
  }
  if(Number(engine.e.gn_stat(0))!==rows.length)throw new Error('Verifier changed the candidate basis');
  return {inputRelationsChecked:inputs,criticalReductions:Number(engine.e.gn_stat(7)),chainCompositionsCertified:Number(engine.e.gn_stat(29)),monomialCompositionsCertified:Number(engine.e.gn_stat(8)),basisAntichain:true,throughDegree:target,exactField:'Q',elapsedMs:performance.now()-start,stats:stats(engine.e)};
 }finally{clearInterval(timer);engine.host?.setPulse(null);engine.active=false;engine.verifyingCandidate=false;}
}
