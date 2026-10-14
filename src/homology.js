// Exact homology of the augmented, ungraded structural Bergman complex.
// Nonhomogeneous differentials can lower internal degree; computing each
// internal degree separately (the historical Betti routine) misses these maps.
import { parseRelation, parseBasis, termDegree } from './bergman-syntax.js';
import { readResolution, chainKey } from './resolution-data.js';
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b)[a,b]=[b,a%b];return a;};
export function augmentedHomology(text, vars, modulus=0, completion=null) {
  const p=BigInt(modulus);
  const q=(a,b=1n)=>{
    a=BigInt(a);b=BigInt(b);
    if(p){a=(a%p+p)%p;b=(b%p+p)%p;if(!b)throw new Error('Zero denominator in the coefficient field.');let k=p-2n,v=1n;while(k){if(k&1n)v=v*b%p;b=b*b%p;k>>=1n;}return [a*v%p,1n];}
    if(!b)throw new Error('Zero denominator.');const d=gcd(a,b)*(b<0n?-1n:1n);return [a/d,b/d];
  };
  const add=(a,b)=>q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
  const mul=(a,b)=>q(a[0]*b[0],a[1]*b[1]);
  const div=(a,b)=>q(a[0]*b[1],a[1]*b[0]);
  const neg=a=>q(-a[0],a[1]);
  const rank=matrix=>{
    const a=matrix.map(r=>r.slice());let row=0;
    for(let col=0;col<(a[0]?.length||0)&&row<a.length;col++){
      const pivot=a.findIndex((r,i)=>i>=row&&r[col][0]);if(pivot<0)continue;
      [a[row],a[pivot]]=[a[pivot],a[row]];
      for(let i=row+1;i<a.length;i++){if(!a[i][col][0])continue;const f=div(a[i][col],a[row][col]);for(let j=col;j<a[i].length;j++)a[i][j]=add(a[i][j],neg(mul(f,a[row][j])));}
      row++;
    }return row;
  };
  const {diffs,top}=readResolution(text,vars,modulus);
  const chains=[[[]]];
  for(let n=1;n<=top;n++)chains[n]=diffs.get(n-1).map(d=>d.chain);
  const matrices=[[]],ranks=[0];
  for(let n=1;n<=top;n++){
    const a=chains[n-1].map(()=>chains[n].map(()=>q(0)));
    const targets=new Map(chains[n-1].map((word,i)=>[chainKey(word),i]));
    for(const [col,d] of (diffs.get(n-1)||[]).entries()){
      for(const term of d.terms){
        if(term.word.length)continue; // augmentation of shifted generators is zero
        const row=targets.get(chainKey(term.target));
        a[row][col]=add(a[row][col],q(...term.coefficient));
      }
    }
    matrices[n]=a;ranks[n]=rank(a);
    if(n>=2){const b=matrices[n-1];for(let i=0;i<b.length;i++)for(let j=0;j<chains[n].length;j++){
      let v=q(0);for(let k=0;k<a.length;k++)v=add(v,mul(b[i][k],a[k][j]));
      if(v[0])throw new Error(`The augmented differentials do not compose to zero at degree ${n}.`);
    }}
  }
  let betti=chains.slice(0,top).map((c,n)=>c.length-ranks[n]-ranks[n+1]);
  let finiteTailZero=false;
  let truncatedBetti;
  if(completion?.completeBasis && completion.degreeBound){
    const weights=new Map(vars.map((v,i)=>[v,Number(String(completion.weights||'').trim().split(/[\s,]+/)[i])||1]));
    const degree=s=>Math.max(0,...parseRelation(s,vars).map(t=>termDegree(t,weights)));
    const maxRelation=Math.max(0,...parseBasis(completion.basis).groups.flatMap(g=>g.polys).map(degree));
    const maxChain=Math.max(0,...diffs.get(top-1).map(d=>d.chain.reduce((s,v)=>s+weights.get(v),0)));
    const maxTail=Math.max(0,maxRelation-Math.min(...weights.values()));
    const maxGenerator=Math.max(...weights.values());
    // Every next Anick chain extends a current chain by a proper tail of
    // a leading word. If all possible extensions fit and none exists, the
    // chain complex ends here. This also certifies its zero tail.
    finiteTailZero=maxGenerator+(top-1)*maxTail<=Number(completion.degreeBound)
      && maxChain+maxTail<=Number(completion.degreeBound);
    if(finiteTailZero)betti.push(chains[top].length-ranks[top]);
    else {
      // H_n needs every chain of C_(n+1), including heavier chains whose
      // homological degree is lower than the largest observed one. Each
      // extension adds at most a proper leading-word tail, so this bound
      // certifies completeness without treating a truncated rank as Tor.
      const certified=maxTail?Math.floor((Number(completion.degreeBound)-maxGenerator)/maxTail):betti.length-1;
      const count=Math.max(0,Math.min(betti.length,certified+1));
      if(count<betti.length){truncatedBetti=betti;betti=betti.slice(0,count);}
    }
  }
  if(betti.some(n=>n<0))throw new Error('Invalid homology dimensions.');
  return { kind:'ungraded', coefficientField:modulus?`F_${modulus}`:'Q', betti, chainDimensions:chains.map(c=>c.length), differentialRanks:ranks, checkedSquareZero:true, highestCertifiedDegree:betti.length-1, finiteTailZero, ...(truncatedBetti?{truncatedBetti}:{}) };
}
