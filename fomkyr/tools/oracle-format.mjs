// SPDX-License-Identifier: MIT
// Strict interchange parser: integer/rational scalar times a word, no evaluation.
export function rationalTerms(text,variables){
 const names=new Set(variables),source=String(text).replace(/\s+/g,'');
 if(source==='0')return [];
 if(!source||/[+-]{2}|[+-]$/.test(source))throw new Error('Malformed oracle polynomial');
 const out=[];let rebuilt='';
 for(const m of source.matchAll(/([+-]?)([^+-]+)/g)){
  rebuilt+=m[0];let body=m[2],numerator=m[1]==='-'?-1n:1n,denominator=1n;
  const c=/^(\d+)(?:\/(\d+))?(?:\*|$)/.exec(body);
  if(c){numerator*=BigInt(c[1]);denominator=BigInt(c[2]??1);body=body.slice(c[0].length);}
  if(!denominator)throw new Error('Zero oracle denominator');
  const word=[];
  if(body)for(const f of body.split('*')){
   const v=/^([A-Za-z_][A-Za-z_0-9]*)(?:\^(\d+))?$/.exec(f);
   if(!v||!names.has(v[1]))throw new Error('Unknown oracle word factor: '+f);
   const exponent=Number(v[2]??1);if(!Number.isSafeInteger(exponent)||exponent>1000000)throw new Error('Oracle word exceeds interchange budget');
   for(let k=0;k<exponent;k++)word.push(v[1]);
  }
  if(numerator)out.push({numerator,denominator,word});
 }
 if(rebuilt!==source)throw new Error('Unparsed oracle input');return out;
}
export function oraclePolynomial(text,a,variables){
 const result=new Map();
 for(const t of rationalTerms(text,variables)){
  const unit=a.parse(t.word.length?t.word.join('*'):'1');
  for(const [w,c] of a.scale(unit,a.q(t.numerator,t.denominator)))a.put(result,w,c);
 }
 return result;
}
