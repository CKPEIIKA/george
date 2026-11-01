// SPDX-License-Identifier: MIT
// Pure exact host arithmetic. No floating-point coefficient decisions.
// Word keys use one hexadecimal character per generator, in left-lex order.
export const abs = a => a < 0n ? -a : a;
export function gcd(a,b){a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a;}
export function mod(a,p){a%=p;return a<0n?a+p:a;}
export function inverse(a,p){let [r,s,t,u]=[p,mod(a,p),0n,1n];while(s){const q=r/s;[r,s]=[s,r-q*s];[t,u]=[u,t-q*u];}if(r!==1n)throw new Error('Noninvertible residue');return mod(t,p);}
export function isqrt(a){if(a<0n)throw new Error('Negative integer root');if(a<2n)return a;let x=1n<<BigInt((a.toString(2).length+1)>>1);for(;;){const y=(x+a/x)>>1n;if(y>=x)return x;x=y;}}
export function reconstruct(residue,M){
 const A=mod(residue,M);if(!A)return [0n,1n];const B=isqrt((M-1n)/2n);
 let [r0,r1,t0,t1]=[M,A,0n,1n];
 while(abs(r1)>B){const q=r0/r1;[r0,r1]=[r1,r0-q*r1];[t0,t1]=[t1,t0-q*t1];}
 if(!t1||abs(t1)>B||gcd(r1,t1)!==1n)return null;
 if(t1<0n){r1=-r1;t1=-t1;}
 if(mod(r1-A*t1,M))return null;return [r1,t1];
}
export function wordCompare(a,b){return a.length-b.length||(a<b?-1:a>b?1:0);}
const hex='0123456789abcdef',MASK=(1n<<64n)-1n;
export function checksum(bytes){let h=1469598103934665603n;for(const b of bytes)h=((h^BigInt(b))*1099511628211n)&MASK;return h;}
export function decodeRecord(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<32||dv.getUint32(0,true)!==0x31424e47||dv.getUint32(4,true)!==bytes.length)throw new Error('Invalid record header');
 const n=dv.getUint32(8,true),degree=dv.getUint32(12,true),floor=32+24*n,terms=new Map();
 if(floor>bytes.length||checksum(bytes.subarray(32))!==dv.getBigUint64(16,true))throw new Error('Record checksum/size failure');
 for(let i=0;i<n;i++){
  const at=32+24*i,lo=dv.getBigUint64(at,true),hi=dv.getBigUint64(at+8,true),tag=dv.getBigUint64(at+16,true);let word='';
  if(hi>>63n){const off=Number(lo);if(hi!==((1n<<63n)|BigInt(degree))||off<floor||off+degree>bytes.length)throw new Error('Invalid long word');for(let j=0;j<degree;j++){if(bytes[off+j]>15)throw new Error('Invalid letter');word+=hex[bytes[off+j]];}}
  else{let v=(hi<<64n)|lo;word=v.toString(16).padStart(degree,'0');if(word.length!==degree)throw new Error('Invalid short word');}
  let c;if(tag&1n){const off=Number(tag&~7n);if(off<floor||off+8>bytes.length)throw new Error('Invalid coefficient pointer');const limbs=dv.getUint32(off,true);if(!limbs||off+8+4*limbs>bytes.length)throw new Error('Invalid coefficient length');c=0n;for(let j=limbs-1;j>=0;j--)c=(c<<32n)|BigInt(dv.getUint32(off+8+4*j,true));if(tag&2n)c=-c;}
  else c=BigInt.asIntN(64,tag)>>1n;
  if(!c||terms.has(word))throw new Error('Zero/duplicate term in record');terms.set(word,c);
 }
 return {degree,lm:[...terms.keys()].sort().at(-1),terms};
}
export function encodeRecord(row,maxBytes=64*1048576){
 const terms=[...row.terms].filter(([,c])=>c).sort(([a],[b])=>a<b?1:a>b?-1:0),d=row.degree,small=(1n<<62n)-1n;
 if(!terms.length)throw new Error('Cannot import a zero rule');
 const align=x=>Math.ceil(x/8)*8;let size=32+24*terms.length;
 for(const [w,c]of terms){if(w.length!==d||!/^[0-9a-f]+$/.test(w))throw new Error('Malformed word');if(d>31)size+=align(d);if(abs(c)>small)size+=align(8+4*Math.ceil(abs(c).toString(2).length/32));}
 if(size>maxBytes||size>0xffffffff)throw Object.assign(new Error('Candidate record exceeds workspace'),{code:'LIFT_WORKSPACE'});
 const bytes=new Uint8Array(size),dv=new DataView(bytes.buffer);dv.setUint32(0,0x31424e47,true);dv.setUint32(4,size,true);dv.setUint32(8,terms.length,true);dv.setUint32(12,d,true);let tail=32+24*terms.length;
 for(let i=0;i<terms.length;i++){
  const [w,c]=terms[i],at=32+24*i;
  if(d<=31){const v=BigInt('0x'+w);dv.setBigUint64(at,v&MASK,true);dv.setBigUint64(at+8,v>>64n,true);}
  else{dv.setBigUint64(at,BigInt(tail),true);dv.setBigUint64(at+8,(1n<<63n)|BigInt(d),true);for(let j=0;j<d;j++)bytes[tail+j]=parseInt(w[j],16);tail+=align(d);}
  if(abs(c)<=small)dv.setBigUint64(at+16,BigInt.asUintN(64,c<<1n),true);
  else{const len=Math.ceil(abs(c).toString(2).length/32);dv.setBigUint64(at+16,BigInt(tail)|1n|(c<0n?2n:0n),true);dv.setUint32(tail,len,true);let v=abs(c);for(let j=0;j<len;j++){dv.setUint32(tail+8+4*j,Number(v&0xffffffffn),true);v>>=32n;}tail+=align(8+4*len);}
 }
 dv.setBigUint64(16,checksum(bytes.subarray(32)),true);return bytes;
}
function bitsOf(a){return abs(a).toString(2).length;}
function workspaceError(){return Object.assign(new Error('Reconstructed coefficient exceeds lift workspace'),{code:'LIFT_WORKSPACE'});}
export function primitiveRow(row,fractions,maxBits=Infinity){
 let denominator=1n;for(const [,b]of fractions){const factor=denominator/gcd(denominator,b);if(bitsOf(factor)+bitsOf(b)>maxBits+1)throw workspaceError();denominator=factor*b;if(bitsOf(denominator)>maxBits)throw workspaceError();}
 const words=[...row.terms.keys()],terms=new Map();let content=0n;
 for(let i=0;i<words.length;i++){const [a,b]=fractions[i],factor=denominator/b;if(bitsOf(a)+bitsOf(factor)>maxBits+1)throw workspaceError();const c=a*factor;if(bitsOf(c)>maxBits)throw workspaceError();if(c){terms.set(words[i],c);content=gcd(content,c);}}
 if(!terms.size)return null;if(terms.get(row.lm)<0n)content=-content;
 if(content!==1n)for(const [w,c]of terms)terms.set(w,c/content);
 return {degree:row.degree,lm:row.lm,terms};
}
// Conservative logical workspace charge, NOT a promise about JS engine RSS.
export function rowCharge(row,bits=64){return 256+[...row.terms].reduce((n,[w,c])=>n+160+2*w.length+8*Math.ceil(Math.max(bits,bitsOf(c))/32),0);}
export class CRTGroup{
 constructor(rows,prime,budget){this.rows=rows.map(r=>({degree:r.degree,lm:r.lm,terms:new Map(r.terms)}));this.M=BigInt(prime);this.primes=[prime];this.budget=budget;this.checkBudget();}
 checkBudget(){const bits=this.M.toString(2).length;this.chargedBytes=this.rows.reduce((n,r)=>n+rowCharge(r,bits),0);if(this.chargedBytes>this.budget)throw Object.assign(new Error('CRT logical workspace budget exhausted'),{code:'LIFT_WORKSPACE'});}
 matches(rows){return rows.length===this.rows.length&&rows.every((r,i)=>r.lm===this.rows[i].lm);}
 merge(rows,prime){
  if(!this.matches(rows)||this.primes.includes(prime))throw new Error('Mismatched shape or repeated prime');
  const p=BigInt(prime),inv=inverse(this.M,p),M=this.M;
  // Charge the union BEFORE modifying it, including the new modulus size.
  let charge=0,bits=(M*p).toString(2).length;
  for(let i=0;i<rows.length;i++){charge+=256;for(const w of new Set([...rows[i].terms.keys(),...this.rows[i].terms.keys()]))charge+=160+2*w.length+8*Math.ceil(bits/32);}
  if(charge>this.budget)throw Object.assign(new Error('CRT union exceeds workspace'),{code:'LIFT_WORKSPACE'});
  for(let i=0;i<rows.length;i++){
   const a=this.rows[i].terms,b=rows[i].terms;
   for(const [w,r]of a)a.set(w,r+M*mod(((b.get(w)??0n)-mod(r,p))*inv,p));
   for(const [w,c]of b)if(!a.has(w))a.set(w,M*mod(c*inv,p));
  }
  this.M*=p;this.primes.push(prime);this.chargedBytes=charge;
 }
 reconstruct(budget=this.budget){
  const out=[];let used=0;
  for(const row of this.rows){const overhead=256+[...row.terms.keys()].reduce((n,w)=>n+160+2*w.length,0);const available=budget-used-overhead;if(available<8*row.terms.size)throw workspaceError();const maxBits=Math.floor(4*available/(row.terms.size+2));const fs=[];for(const c of row.terms.values()){const f=reconstruct(c,this.M);if(!f)return null;fs.push(f);}const r=primitiveRow(row,fs,maxBits);if(!r||!r.terms.has(row.lm))return null;used+=rowCharge(r,0);if(used>budget)throw workspaceError();out.push(r);}
  return out;
 }
}
