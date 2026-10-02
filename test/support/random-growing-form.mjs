// Random invertible diagonal change of generators in the submitted FK6 form.
// It varies exact coefficient arithmetic and preserves graded dimensions.
import {readInputFile,parseRelation,toBergman} from '../../web/src/bergman-syntax.js';
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b)[a,b]=[b,a%b];return a;};
export function randomGrowingForm(inputText,seed=0x464b4736){
  const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+inputText);let state=seed>>>0;
  const choices=[-5,-3,-2,-1,1,2,3,5];
  const scalings=Object.fromEntries(vars.map(v=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return [v,choices[state>>>29]];}));
  const relations=rels.map(source=>{
    const terms=parseRelation(source,vars),coefficients=terms.map(t=>BigInt(t.sign)*BigInt(t.coef)*t.factors.reduce((p,f)=>p*BigInt(scalings[f.v])**BigInt(f.e),1n));
    const divisor=coefficients.reduce(gcd,0n)*(coefficients[0]<0n?-1n:1n);
    return toBergman(terms.map((t,i)=>{const c=coefficients[i]/divisor;return {...t,sign:c<0n?-1:1,coef:(c<0n?-c:c).toString()};}));
  });
  return {description:'Fixed-seed random invertible generator scalings of the submitted FK6 presentation. Preserves its monomial supports, variable order, graded dimensions and growth through degree 9; varies exact rational coefficient arithmetic. This is a graded-isomorphic FK6 presentation.',generator:'test/support/random-growing-form.mjs',seed:seed>>>0,construction:'random-invertible-FK6-generator-scalings',scalings,inputText:`vars ${vars.join(',')};\n${relations.join(',')};\n`};
}
