// SPDX-License-Identifier: MIT. Exact scalar fractions in expanded basis output.
// Input relations keep the integer-coefficient parser and its validation rules.
import {parseRelation} from './bergman-syntax.js';
export function parseOutputRelation(source,vars,maxExponent=10000){
  if(!String(source).includes('/'))return parseRelation(source,vars,maxExponent);
  const terms=[],text=String(source).replace(/\s+/g,'');let processed='';
  for(const match of text.matchAll(/([+-]?)([^+-]+)/g)){
    processed+=match[0];
    if(!match[2].includes('/')){terms.push(...parseRelation(match[0],vars,maxExponent));continue;}
    const fraction=/^(\d+)\/(\d+)(?=\*|[A-Za-z_]|$)/.exec(match[2]);
    if(!fraction)throw new SyntaxError('Put a rational coefficient before the generators');
    if(BigInt(fraction[2])===0n)throw new SyntaxError('Zero coefficient denominator');
    const parsed=parseRelation(match[1]+fraction[1]+match[2].slice(fraction[0].length),vars,maxExponent);
    for(const term of parsed)terms.push({...term,coefDen:fraction[2]});
  }
  if(!terms.length||processed!==text)throw new SyntaxError('Malformed output polynomial');
  return terms;
}
