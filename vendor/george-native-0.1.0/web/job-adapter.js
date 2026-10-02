// SPDX-License-Identifier: MIT
// Deliberately accepts only George's generated homogeneous GB job, never Lisp.
export function parseNativeJob(job) {
  if(job?.task!=='gb'||job.resolution||job.legacy)throw new Error('Native NC supports only homogeneous two-sided GB jobs; no legacy mode, modules, resolutions, or console Lisp.');
  const lines=String(job.script??'').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('%'));
  const allowed=[/^\(SETLEGACYMODE NIL\)$/,/^\(NONCOMMIFY\)$/,/^\(DEGLEFTLEXIFY\)$/,/^\(SETMODULUS \d+\)$/,/^\(SETMAXDEG \d+\)$/,/^\(SETSAFELOWTERMSHANDLING\)$/,/^\(SETDEGREEWISE\)$/,/^\(STABILISE\)$/,/^\(SIMPLE "input\.bg" "result\.gb"\)$/,/^\(CLEARRING\)$/];
  for(const line of lines)if(!allowed.some(re=>re.test(line)))throw new Error(`Unsupported Native NC setting: ${line}`);
  for(const required of ['(NONCOMMIFY)','(DEGLEFTLEXIFY)','(SIMPLE "input.bg" "result.gb")'])if(!lines.includes(required))throw new Error('Missing Native NC job setting: '+required);
  const one=(pattern,label)=>{const ms=lines.map(x=>pattern.exec(x)).filter(Boolean);if(ms.length!==1)throw new Error('Expected exactly one '+label);return Number(ms[0][1]);};
  const target=one(/^\(SETMAXDEG (\d+)\)$/,'degree bound');const modulus=one(/^\(SETMODULUS (\d+)\)$/,'coefficient characteristic');
  if(!Number.isInteger(target)||target<1||target>20)throw new Error('Native NC degree bound must be from 1 to 20');
  const src=String(job.files?.['input.bg']??'');
  if(src.length>1024*1024)throw new Error('Native input is limited to 1 MiB');
  const input=/^\s*\(ALGFORMINPUT\)\s*vars\s+([^;]+);\s*([^;]*);\s*$/i.exec(src);
  if(!input)throw new Error('Unsupported input.bg layout');
  const variables=input[1].split(',').map(x=>x.trim());
  if(variables.length<1||variables.length>16||new Set(variables).size!==variables.length||variables.some(x=>!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x)))throw new Error('Native NC requires 1..16 distinct generator names');
  const ids=new Map(variables.map((v,i)=>[v,i]));const relations=[];
  for(const raw of input[2].split(',')) {
    const text=raw.replace(/\s/g,'');if(!text||text==='0')continue;
    if(!/^[A-Za-z0-9_*^+-]+$/.test(text)||/[+-]{2}/.test(text)||/[+-]$/.test(text))throw new Error('Unsupported relation syntax');
    const terms=[];
    for(const m of text.matchAll(/([+-]?)([^+-]+)/g)) {
      let c=m[1]==='-'?-1n:1n;const word=[];
      for(const factor of m[2].split('*')) {
        if(/^\d+$/.test(factor)){c*=BigInt(factor);continue;}
        const f=/^([A-Za-z_][A-Za-z0-9_]*)(?:\^(\d+))?$/.exec(factor);
        if(!f||!ids.has(f[1]))throw new Error('Unknown factor: '+factor);
        const exponent=Number(f[2]??1);
        if(!Number.isInteger(exponent)||exponent<0||word.length+exponent>20)throw new Error('Word degree exceeds 20');
        for(let j=0;j<exponent;j++)word.push(ids.get(f[1]));
      }
      if(c){if(!word.length)throw new Error('Nonzero constants are not supported');terms.push({word,coefficient:String(c)});}
    }
    if(!terms.length)continue;
    const degrees=new Set(terms.map(t=>t.word.length));
    if(degrees.size!==1)throw new Error('Only homogeneous relations with generator degrees all 1 are supported');
    relations.push({degree:terms[0].word.length,terms});
  }
  return {fixture:{variables,relations},target,modulus};
}
