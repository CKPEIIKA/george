import assert from 'node:assert/strict';

export function sameRationalPolynomial(left,right) {
 if(left.size!==right.size)return false;
 for(const [word,[n,d]] of left){
  const c=right.get(word);
  if(!c||(n!==c[0]||d!==c[1])&&n*c[1]!==c[0]*d)return false;
 }
 return true;
}

export function mutualIdealMembership(candidate,oracle,a) {
 const index=basis=>{
  const result=new Map();
  for(const f of basis){const lead=a.lead(f),group=result.get(lead)??[];group.push(f);result.set(lead,group);}
  return result;
 };
 const oracleIndex=index(oracle),candidateIndex=index(candidate);
 let identical=0,reductions=0;
 const check=(polys,basis,lookup,message)=>{
  for(const f of polys){
   // Equality gives membership directly. Any difference still requires NF.
   const matches=lookup.get(a.lead(f));
   if(matches?.some(g=>sameRationalPolynomial(f,g))){identical++;continue;}
   let residual=f;
   // Each matching polynomial is already in the target ideal. Subtracting
   // it cancels the leading term and shared tails before the exact check.
   if(matches?.length){
    residual=new Map(f);
    for(const [word,[n,d]] of matches[0])a.put(residual,word,a.q(-n,d));
   }
   reductions++;assert.equal(a.nf(residual,basis).size,0,message);
  }
 };
 check(candidate,oracle,oracleIndex,'Candidate belongs to Singular ideal');
 check(oracle,candidate,candidateIndex,'Singular basis belongs to candidate ideal');
 return {identicalPolynomials:identical,normalFormChecks:reductions};
}
