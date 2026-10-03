// SPDX-License-Identifier: MIT
import {checked} from './runtime.js';
export function computeHilbert(e,degree,extraBudget,outputBudget=32*1048576){
  // Conservative bound using <=16 generators; avoid an enormous JS string/list
  // outside the kernel budget. This is a tunable byte limit, not a degree cap.
  const upperDigits=Math.ceil(degree*Math.log10(16))+1;
  if(!Number.isFinite(outputBudget)||outputBudget<0||(degree+1)*(upperDigits*2+48)>outputBudget){const error=new Error('Hilbert decimal output exceeds hilbertOutputBudgetBytes; exact GB checkpoint is retained.');error.code='HILBERT_OUTPUT_BUDGET';throw error;}
  checked(e.gn_hilbert(degree,BigInt(Math.max(0,Math.floor(extraBudget)))));
  const coefficients=[];
  const limbs=e.gn_hilbert_limbs();
  for(let d=0;d<=degree;d++){let n=0n;for(let i=limbs-1;i>=0;i--)n=(n<<32n)|BigInt(e.gn_hilbert_limb(d,i)>>>0);coefficients.push(n.toString());}
  const zero=coefficients.findIndex((c,d)=>d>0&&c==='0');
  // In a connected algebra generated in degree 1, A_d=0 implies A_{d+1}=0.
  const finiteDimensionalProved=zero>0;
  const dimension=finiteDimensionalProved?coefficients.reduce((s,c)=>s+BigInt(c),0n).toString():null;
  return {
    grading:'total-word-degree; all generators degree 1',field:Number(e.gn_stat(16))?`F_${e.gn_stat(16)}`:'Q',
    coefficients,certifiedThroughDegree:degree,finiteDimensionalProved,dimension,
    rationalFunction:null,extrapolated:false,
    automatonStates:Number(e.gn_stat(19)),temporaryBytes:Number(e.gn_stat(20)),
    algorithm:'leading-word avoidance automaton + exact dynamically sized limb arithmetic',
    validity:'Exact coefficient prefix from the certified leading-word basis; not a guessed rational series or a gauge/trace projection.'
  };
}
export function hilbertCSV(result){return 'degree,dimension,certified\n'+result.coefficients.map((c,d)=>`${d},${c},true`).join('\n')+'\n';}
