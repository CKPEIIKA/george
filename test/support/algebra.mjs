// Independent, exact arithmetic checker. This is test code, not the engine.
import assert from 'node:assert/strict';
import { parseRelation, parseBasis } from '../../web/src/bergman-syntax.js';
const gcd = (a,b) => { a=a<0n?-a:a; b=b<0n?-b:b; while(b) [a,b]=[b,a%b]; return a; };
export function algebra(vars, comm=false, modulus=0) {
  const p=BigInt(modulus);
  const q=(a,b=1n)=>{a=BigInt(a);b=BigInt(b); if(p){a=(a%p+p)%p;b=(b%p+p)%p;assert.notEqual(b,0n);let x=b,k=p-2n,v=1n;while(k){if(k&1n)v=v*x%p;x=x*x%p;k>>=1n;}return [a*v%p,1n];}assert.notEqual(b,0n);const d=gcd(a,b)*(b<0n?-1n:1n);return [a/d,b/d];};
  const add=(a,b)=>q(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
  const mul=(a,b)=>q(a[0]*b[0],a[1]*b[1]);
  const div=(a,b)=>q(a[0]*b[1],a[1]*b[0]);
  const neg=a=>q(-a[0],a[1]);
  const word=w=>comm?[...w].sort().join(''):w;
  const mon=(v)=>String.fromCharCode(65+vars.indexOf(v));
  const cmp=(a,b)=>a.length-b.length || (comm?-1:1)*(a>b?1:a<b?-1:0);
  const lead=f=>[...f.keys()].sort(cmp).at(-1);
  const put=(f,w,c)=>{const v=add(f.get(w)||q(0),c);if(v[0])f.set(w,v);else f.delete(w);};
  const parse=s=>{const f=new Map();for(const t of parseRelation(s,vars)){put(f,word(t.factors.map(a=>mon(a.v).repeat(a.e)).join('')),q(BigInt(t.sign)*BigInt(t.coef)));}return f;};
  const scale=(f,c,left='',right='')=>{const r=new Map();for(const [w,a] of f)put(r,word(left+w+right),mul(c,a));return r;};
  const sub=(f,g)=>{const r=new Map(f);for(const [w,c] of g)put(r,w,neg(c));return r;};
  const quotient=(w,v)=>{
    if(!comm){const i=w.indexOf(v);return i<0?null:[w.slice(0,i),w.slice(i+v.length)];}
    let s=w;for(const ch of v){const i=s.indexOf(ch);if(i<0)return null;s=s.slice(0,i)+s.slice(i+1);}return [s,''];
  };
  const nf=(f,basis)=>{f=new Map(f);const result=new Map();let steps=0;while(f.size){assert.ok(++steps<100000,'reduction terminates');const w=lead(f),c=f.get(w);let reduced=false;for(const g of basis){const v=lead(g),lr=quotient(w,v);if(lr){f=sub(f,scale(g,div(c,g.get(v)),...lr));reduced=true;break;}}if(!reduced){put(result,w,c);f.delete(w);}}return result;};
  const monic=f=>f.size?scale(f,div(q(1),f.get(lead(f)))):f;
  const basis=text=>parseBasis(text).groups.flatMap(g=>g.polys).map(parse).filter(f=>f.size).map(monic);
  function certify(input,gb,bound=Infinity){
    for(const f of input)assert.equal(nf(f,gb).size,0,'input reduces to zero');
    let ambiguities=0;
    const check=(f,g,left1,right1,left2,right2,w)=>{if(w.length>bound)return;ambiguities++;assert.equal(nf(sub(scale(f,q(1),left1,right1),scale(g,q(1),left2,right2)),gb).size,0,`critical ambiguity ${w}`);};
    for(const f of gb)for(const g of gb){const a=lead(f),b=lead(g);if(comm){let w=a;for(const c of new Set(b)){const want=[...b].filter(x=>x===c).length-[...a].filter(x=>x===c).length;if(want>0)w+=c.repeat(want);}w=word(w);check(f,g,...quotient(w,a),...quotient(w,b),w);}else{
      for(let k=1;k<=Math.min(a.length,b.length);k++)if(a.slice(-k)===b.slice(0,k)){const w=a+b.slice(k);check(f,g,'',b.slice(k),a.slice(0,-k),'',w);}
      for(let i=0;i<=a.length-b.length;i++)if(a.slice(i,i+b.length)===b)check(f,g,'','',a.slice(0,i),a.slice(i+b.length),a);
    }}
    return ambiguities;
  }
  function hilbert(gb,max){const leading=gb.map(lead);let layer=[''];const dims=[];for(let d=0;d<=max;d++){dims.push(layer.length);layer=layer.flatMap(w=>vars.map((_,i)=>w+String.fromCharCode(65+i))).filter(w=>(!comm||w===word(w))&&!leading.some(v=>quotient(w,v)));}return dims;}
  const multiply=(f,g)=>{const r=new Map();for(const [u,a] of f)for(const [v,b] of g)put(r,word(u+v),mul(a,b));return r;};
  return {parse,basis,certify,nf,hilbert,lead,monic,q,put,scale,multiply};
}
