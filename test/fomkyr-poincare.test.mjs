import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJob,validateSettings} from '../web/src/bergman-syntax.js';
import {backendAllows} from '../web/src/backend-capabilities.js';
import {parseNativeJob} from '../web/engine/fomkyr/job-adapter.js';
import {computePoincare,poincareCSV,poincareText} from '../fomkyr/web/poincare.js';
const form={backend:'fomkyr',task:'ncpbh',ring:'noncomm',order:'degleftlex',field:'0',vars:['a'],rels:['a^3'],maxdeg:'8',memoryMiB:128,fomkyrOptions:{hilbert:false}};
test('existing monomial-series task is a real Fomkyr capability',()=>{
  assert.equal(backendAllows('fomkyr','task','ncpbh'),true);
  for(const task of ['rmodule','lmodule','twomod','factalg','hochschild'])assert.equal(backendAllows('fomkyr','task',task),false);
  assert.deepEqual(validateSettings(form),[]);const job=buildJob(form);
  assert.equal(job.fomkyrOptions.poincare,true);assert.equal(job.fomkyrOptions.poincareRequired,true);assert.equal(job.fomkyrOptions.hilbert,true);
  assert.equal(job.outputs.pb,'result.pb');assert.equal(job.outputs.hs,'result.hs');assert.equal(parseNativeJob(job).target,8);
  assert.throws(()=>parseNativeJob({...job,task:'gb'}),/Missing fomkyr job setting/);
  assert.throws(()=>parseNativeJob({...job,script:job.script+'\n(SIMPLE "input.bg" "result.gb")'}),/exactly one/);
  const bounded=buildJob({...form,maxserdeg:'6'});assert.equal(bounded.fomkyrOptions.poincareDegree,6);assert.equal(bounded.fomkyrOptions.hilbertDegree,6);
});
test('series exports keep exact decimal counts, variable meanings and conditional status',()=>{
  const result={certifiedThroughDegree:16,coefficients:[{homological:0,internal:0,dimension:'1'},{homological:16,internal:16,dimension:'18446744073709551616'}]};
  assert.match(poincareCSV(result),/16,16,18446744073709551616,false/);
  assert.match(poincareCSV({...result,conditionalOnExternalDimensions:true}),/16,16,18446744073709551616,true/);
  assert.match(poincareText(result),/t\^16\*\(18446744073709551616\*z\^16\)/);
  assert.match(poincareText(result),/O\(t\^17\)/);
});
test('postprocessing refuses oversized output before entering C and releases failed Euler work',()=>{
  let calls=0,releases=0;
  const api={gn_stat:()=>2n,gn_poincare(){calls++;return 0;},gn_poincare_limbs:()=>1,gn_poincare_limb:(p,d)=>p===0&&d===0?1:0,gn_poincare_release(){releases++;},gn_poincare_stat:()=>0n};
  assert.throws(()=>computePoincare(api,1000,1024,null,1),/output exceeds/);assert.equal(calls,0);
  assert.throws(()=>computePoincare(api,1,1024,{coefficients:['1','2']}),/Euler check/);assert.equal(releases,1);
});
