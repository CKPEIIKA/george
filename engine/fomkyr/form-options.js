// SPDX-License-Identifier: MIT
import {readFomkyrOptions} from './controls.js';
export function optionsFromGeorgeForm(form){
  const o={...readFomkyrOptions()};
  if(form.nativeWorkers!==undefined)o.workers=Number(form.nativeWorkers);
  if(form.monomialPruning!==undefined)o.monomialPruning=!!form.monomialPruning;
  if(form.maxserdeg!==undefined&&String(form.maxserdeg).trim()!=='')o.hilbertDegree=Number(form.maxserdeg);
  const result={...o,...form.fomkyrOptions};
  if(form.task==='anick')Object.assign(result,{anick:true,hilbert:true,hilbertRequired:true});
  if(form.task==='ncpbh')Object.assign(result,{hilbert:true,hilbertRequired:true,poincare:true,poincareRequired:true,...(o.hilbertDegree!==undefined?{poincareDegree:o.hilbertDegree}:{})});
  return result;
}
export function validateFomkyrForm(form){
  if(form.backend!=='fomkyr')return [];
  const errors=[];
  if(form.ring!=='noncomm'||form.order!=='degleftlex'||!['gb','ncpbh','anick'].includes(form.task))errors.push('fomkyr requires the noncommutative degleftlex Gröbner, series or graded algebra Anick task.');
  if(form.legacy||form.strategy==='rabbit'||form.nonhomog==='itemwise')errors.push('fomkyr does not implement legacy, rabbit or inhomogeneous/itemwise computations.');
  if(form.outmode&&form.outmode!=='ALG')errors.push('fomkyr currently exports ALG text, binary records and JSON, not LISP/MACAULAY output.');
  const weights=String(form.weights||'').trim().split(/[\s,]+/).filter(Boolean);
  if(weights.length&&(weights.length!==form.vars.length||weights.some(w=>w!=='1')))errors.push('fomkyr requires unit generator degrees.');
  if(form.vars?.length>16)errors.push('fomkyr supports at most 16 generators.');
  return errors;
}
