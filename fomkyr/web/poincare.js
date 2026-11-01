// SPDX-License-Identifier: MIT
// Formatting and checks for Fomkyr's shared C associated-monomial PB counter.
import {checked} from './runtime.js';
export function computePoincare(e,degree,extraBudget,hilbert=null,outputBudget=32*1048576){
  if(typeof e.gn_poincare!=='function')throw new Error('This Fomkyr kernel lacks Poincare counting; deploy matching JS and Wasm.');
  if(!Number.isInteger(degree)||degree<0||degree>0xfffffffe)throw new Error('Invalid Poincare internal-degree bound');
  const digits=Math.ceil(degree*Math.log10(Math.max(2,Number(e.gn_stat(15)))))+1;
  if(!Number.isFinite(outputBudget)||outputBudget<0||(degree+1)**2*(96+digits*2)>outputBudget){const error=new Error('Poincare output exceeds its byte budget; the GB checkpoint is retained.');error.code='POINCARE_OUTPUT_BUDGET';throw error;}
  if(!Number.isFinite(extraBudget)||extraBudget<0)throw new Error('Invalid Poincare workspace budget');
  checked(e.gn_poincare(degree,BigInt(Math.floor(extraBudget))));
  try{
    const coefficients=[],chi=Array(degree+1).fill(0n),limbs=e.gn_poincare_limbs();
    for(let p=0;p<=degree;p++)for(let d=p;d<=degree;d++){
      let value=0n;for(let i=limbs-1;i>=0;i--)value=(value<<32n)|BigInt(e.gn_poincare_limb(p,d,i)>>>0);
      if(value){coefficients.push({homological:p,internal:d,dimension:String(value)});chi[d]+=p%2?-value:value;}
    }
    let eulerInverseCheck=null;
    if(hilbert?.coefficients?.length>degree){
      const h=hilbert.coefficients.slice(0,degree+1).map(BigInt);
      for(let d=0;d<=degree;d++){let n=0n;for(let k=0;k<=d;k++)n+=h[k]*chi[d-k];if(n!==(d===0?1n:0n))throw new Error('Poincare/Euler check against the independent Hilbert automaton failed');}
      eulerInverseCheck=true;
    }
    return {available:true,algebra:'associated-monomial',field:Number(e.gn_stat(16))?`F_${e.gn_stat(16)}`:'Q',coefficients,certifiedThroughDegree:degree,
      homologicalVariable:'z',internalVariable:'t',indexing:'C0=1; C1=surviving generators; C2=minimal nonlinear leading obstructions',
      monomialBettiNumbers:true,originalAlgebraBettiNumbers:false,originalBettiInterpretation:'coefficientwise upper bounds, not computed minimal Betti numbers',
      algorithm:'minimal-leading-obstruction Anick tail graph + exact limb path counts',eulerInverseCheck,
      tailStates:Number(e.gn_poincare_stat(0)),edges:Number(e.gn_poincare_stat(1)),minimalObstructions:Number(e.gn_poincare_stat(2)),activeGenerators:Number(e.gn_poincare_stat(3)),temporaryBytes:Number(e.gn_poincare_stat(4)),extrapolated:false};
  }finally{e.gn_poincare_release();}
}
export function poincareCSV(result){
  const conditional=!!(result.conditionalOnExternalDimensions||result.conditionalOnImportedFkDimensions);
  return 'homological_degree,internal_degree,monomial_betti,conditional\n'+result.coefficients.map(c=>`${c.homological},${c.internal},${c.dimension},${conditional}`).join('\n')+'\n';
}
export function poincareText(result){
  const byDegree=new Map();for(const c of result.coefficients){if(!byDegree.has(c.internal))byDegree.set(c.internal,[]);byDegree.get(c.internal).push(`${c.dimension}*z^${c.homological}`);}
  return [...byDegree].sort((a,b)=>a[0]-b[0]).map(([d,terms])=>`+t^${d}*(${terms.join('+')})`).join('\n')+`\n+O(t^${result.certifiedThroughDegree+1})\n`;
}
