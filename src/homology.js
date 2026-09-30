// Exact homology of the augmented, ungraded complex printed by Bergman.
// Nonhomogeneous differentials can lower internal degree; computing each
// internal degree separately (the historical Betti routine) misses these maps.
import { parseAnick, parseRelation, parseBasis, termDegree } from './bergman-syntax.js';
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
  const word=s=>s==='1'?'':parseRelation(s,vars)[0].factors.map(f=>f.v.repeat(f.e)).join('');
  const diffs=parseAnick(text).diffs;
  const top=Math.max(...diffs.keys())+1;
  if(!Number.isFinite(top))throw new Error('The resolution has no differentials.');
  const chains=[['']];
  for(let n=1;n<=top;n++)chains[n]=(diffs.get(n-1)||[]).map(d=>word(d.chain));
  const matrices=[[]],ranks=[0];
  for(let n=1;n<=top;n++){
    const a=chains[n-1].map(()=>chains[n].map(()=>q(0)));
    for(const [col,d] of (diffs.get(n-1)||[]).entries()){
      for(const term of d.image.replaceAll(' ','').match(/[+-]?[^+-]+/g)||[]){
        const m=/^([+-]?)(?:(\d+)(?:\/(\d+))?)?([^.]*)\.(.*)$/.exec(term);
        if(!m)throw new Error(`Cannot read differential term: ${term}`);
        const [,sign,num,den,target,elt]=m;
        if(elt!=='1')continue; // augmentation of shifted generators is zero
        const row=chains[n-1].indexOf(word(target.replace(/^\*/, '')||'1'));
        if(row<0)throw new Error(`Missing target chain ${target}`);
        a[row][col]=add(a[row][col],q((sign==='-'?-1n:1n)*BigInt(num||1),BigInt(den||1)));
      }
    }
    matrices[n]=a;ranks[n]=rank(a);
    if(n>=2){const b=matrices[n-1];for(let i=0;i<b.length;i++)for(let j=0;j<chains[n].length;j++){
      let v=q(0);for(let k=0;k<a.length;k++)v=add(v,mul(b[i][k],a[k][j]));
      if(v[0])throw new Error(`The augmented differentials do not compose to zero at degree ${n}.`);
    }}
  }
  const betti=chains.slice(0,top).map((c,n)=>c.length-ranks[n]-ranks[n+1]);
  let finiteTailZero=false;
  if(completion?.completeBasis && completion.degreeBound){
    const weights=new Map(vars.map((v,i)=>[v,Number(String(completion.weights||'').trim().split(/[\s,]+/)[i])||1]));
    const degree=s=>Math.max(0,...parseRelation(s,vars).map(t=>termDegree(t,weights)));
    const maxRelation=Math.max(0,...parseBasis(completion.basis).groups.flatMap(g=>g.polys).map(degree));
    const maxChain=Math.max(0,...(diffs.get(top-1)||[]).map(d=>degree(d.chain)));
    // Every next Anick chain extends a current chain by a proper tail of
    // a leading word. If all possible extensions fit and none exists, the
    // chain complex ends here. This also certifies its zero tail.
    finiteTailZero=maxChain+maxRelation-Math.min(...weights.values())<=Number(completion.degreeBound);
    if(finiteTailZero)betti.push(chains[top].length-ranks[top]);
  }
  if(betti.some(n=>n<0))throw new Error('Invalid homology dimensions.');
  return { kind:'ungraded', coefficientField:modulus?`F_${modulus}`:'Q', betti, chainDimensions:chains.map(c=>c.length), differentialRanks:ranks, checkedSquareZero:true, highestCertifiedDegree:betti.length-1, finiteTailZero };
}
