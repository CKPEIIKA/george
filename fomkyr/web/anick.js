// SPDX-License-Identifier: MIT
// Serialization only: chains, full differentials and exact ranks come from C.
import {checked} from './runtime.js';
export function computeAnick(e,generators,degree,workspace,hilbert=null,outputBudget=32*1048576){
 if(typeof e.gn_anick!=='function')throw new Error('Deploy matching Fomkyr JS and Wasm with Anick support.');
 if(!Number.isInteger(degree)||degree<1||degree>0xfffffffe)throw new Error('Anick internal degree must be a positive 32-bit index.');
 if(!Number.isFinite(workspace)||workspace<0||!Number.isFinite(outputBudget)||outputBudget<0)throw new Error('Invalid Anick byte budget.');
 if((degree+1)**2*160>outputBudget)throw Object.assign(new Error('Anick table exceeds its output budget; the GB checkpoint is retained.'),{code:'ANICK_OUTPUT_BUDGET'});
 checked(e.gn_anick(degree,BigInt(Math.floor(workspace))));
 try{
  const n=Number(e.gn_anick_stat(0)),terms=Number(e.gn_anick_stat(1));
  if(n*(degree*2+128)+terms*128>outputBudget)throw Object.assign(new Error('Anick differential export exceeds its byte budget; the GB checkpoint is retained.'),{code:'ANICK_OUTPUT_BUDGET'});
  const modulus=Number(e.gn_modulus()),chains=Array.from({length:n},(_,id)=>Array.from({length:e.gn_anick_chain_stat(id,1)},(_,j)=>e.gn_anick_chain_letter(id,j)+1));
  const lines=[JSON.stringify({format:'george-resolution',version:1,modulus,generators,engine:'fomkyr',internalDegreeBound:degree,emptyResolution:n===1})];let bytes=lines[0].length*2;
  function charge(s){bytes+=s.length*2+2;if(bytes>outputBudget)throw Object.assign(new Error('Anick output exceeds its byte budget; the GB checkpoint is retained.'),{code:'ANICK_OUTPUT_BUDGET'});return s;}
  function coefficient(id,t,den){let v=0n;for(let j=e.gn_anick_term_stat(id,t,den?3:2)-1;j>=0;j--)v=(v<<32n)|BigInt(e.gn_anick_term_limb(id,t,den?1:0,j)>>>0);return String(!den&&e.gn_anick_term_stat(id,t,4)?-v:v);}
  for(let id=1;id<n;id++){
   const terms=Array.from({length:e.gn_anick_chain_stat(id,2)},(_,t)=>({
    target:chains[e.gn_anick_term_stat(id,t,0)],word:Array.from({length:e.gn_anick_term_stat(id,t,1)},(_,j)=>e.gn_anick_term_letter(id,t,j)+1),coefficient:[coefficient(id,t,false),coefficient(id,t,true)]
   }));
   lines.push(charge(JSON.stringify({degree:e.gn_anick_chain_stat(id,0)-1,chain:chains[id],terms})));
  }
  const coefficients=[],chi=Array(degree+1).fill(0n);
  for(let p=0;p<=degree;p++)for(let d=p;d<=degree;d++){
   const c=e.gn_anick_count(p,d),rho=e.gn_anick_rank(p,d),incoming=e.gn_anick_rank(p+1,d),b=c-rho-incoming;
   if(b<0)throw new Error('Invalid negative Anick homology dimension.');
   if(c)coefficients.push({homological:p,internal:d,chains:String(c),differentialRank:String(rho),incomingRank:String(incoming),dimension:String(b)});
   chi[d]+=p%2?-BigInt(b):BigInt(b);
  }
  let eulerInverseCheck=null;
  if(hilbert?.coefficients?.length>degree){for(let d=0;d<=degree;d++){let s=0n;for(let j=0;j<=d;j++)s+=BigInt(hilbert.coefficients[j])*chi[d-j];if(s!==BigInt(d===0))throw new Error('Actual Betti/Euler consistency check failed.');}eulerInverseCheck=true;}
  const result={available:true,kind:'graded',algebra:'original',field:modulus?`F_${modulus}`:'Q',modulus,certifiedThroughDegree:degree,augmentation:'generators-to-zero',moduleSide:'right',originalAlgebraBettiNumbers:true,minimalResolutionConstructed:false,checkedFullSquareZero:true,exactRanks:true,eulerInverseCheck,
   indexing:'C0=A; C1=surviving generators; exported degree=p-1',coefficients,chainCount:n,differentialTerms:terms,steps:Number(e.gn_anick_stat(2)),persistentBytes:Number(e.gn_anick_stat(3)),algorithm:'Anick obstruction graph; decreasing-word contracting lifts; exact augmentation ranks',extrapolated:false};
  const jsonl=lines.join('\n')+'\n',csv=anickCSV(result),text=anickText(result);charge(csv);charge(text);
  return {result,files:{'resolution.jsonl':jsonl,'betti.json':JSON.stringify(result,null,2),'betti.csv':csv,'result.anick':text}};
 }finally{e.gn_anick_release();}
}
export function anickCSV(result){
 const conditional=!!(result.conditionalOnExternalDimensions||result.conditionalOnImportedFkDimensions);
 return 'homological_degree,internal_degree,chain_count,differential_rank,incoming_rank,betti,conditional\n'+result.coefficients.map(c=>`${c.homological},${c.internal},${c.chains},${c.differentialRank},${c.incomingRank},${c.dimension},${conditional}`).join('\n')+'\n';
}
export function anickText(result){
 const D=result.certifiedThroughDegree,by=new Map(result.coefficients.map(c=>[`${c.homological},${c.internal}`,c.dimension]));
 return '% Fomkyr: actual graded Betti numbers of the original algebra.\n% Full right-module differentials: resolution.jsonl.\n% Certified only through internal degree '+D+'.\n'+
  '      '+Array.from({length:D+1},(_,p)=>p).join(' ')+'\n      +'+ '-'.repeat(3*(D+1))+'\n'+Array.from({length:D+1},(_,r)=>`${r} | `+Array.from({length:D+1},(_,p)=>p+r>D?'':by.get(`${p},${p+r}`)==='0'||!by.has(`${p},${p+r}`)?'-':by.get(`${p},${p+r}`)).join(' ').trimEnd()).join('\n')+'\n';
}
