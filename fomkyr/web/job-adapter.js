// SPDX-License-Identifier: MIT
// Deliberately accepts only George's generated homogeneous GB job, never Lisp.
export function parseNativeJob(job) {
  if(job?.task!=='gb'||job.resolution||job.legacy)throw new Error('fomkyr supports only homogeneous two-sided GB jobs; no legacy mode, modules, resolutions, or console Lisp.');
  const lines=String(job.script??'').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('%'));
  const allowed=[/^\(SETLEGACYMODE NIL\)$/,/^\(NONCOMMIFY\)$/,/^\(DEGLEFTLEXIFY\)$/,/^\(SETMODULUS \d+\)$/,/^\(SETMAXDEG (?:\d+|NIL)\)$/,/^\(SETSAFELOWTERMSHANDLING\)$/,/^\(SETDEGREEWISE\)$/,/^\(SETWEIGHTS(?: 1)+\)$/,/^\(STABILISE\)$/,/^\(SIMPLE "input\.bg" "result\.gb"\)$/,/^\(CLEARRING\)$/];
  for(const line of lines)if(!allowed.some(re=>re.test(line)))throw new Error(`Unsupported fomkyr setting: ${line}`);
  for(const required of ['(NONCOMMIFY)','(DEGLEFTLEXIFY)','(SIMPLE "input.bg" "result.gb")'])if(!lines.includes(required))throw new Error('Missing fomkyr job setting: '+required);
  const one=(pattern,label)=>{const ms=lines.map(x=>pattern.exec(x)).filter(Boolean);if(ms.length!==1)throw new Error('Expected exactly one '+label);return Number(ms[0][1]);};
  const degrees=lines.map(x=>/^\(SETMAXDEG (\d+|NIL)\)$/.exec(x)).filter(Boolean);
  if(degrees.length!==1)throw new Error('Expected exactly one degree bound');
  const target=degrees[0][1]==='NIL'?null:Number(degrees[0][1]);const modulus=one(/^\(SETMODULUS (\d+)\)$/,'coefficient characteristic');
  if(target!==null&&(!Number.isInteger(target)||target<1||target>0xfffffffe))throw new Error('Use a positive 32-bit degree index, or leave the degree blank for completion.');
  const src=String(job.files?.['input.bg']??'');
  // These are byte/workspace guards, not a fixed degree bound. JavaScript
  // input/identity objects are outside the kernel allocator.
  const budget=Number(job.fomkyrOptions?.inputBudgetBytes??Math.min(32*1048576,Number(job.memoryMiB??512)*1048576/16));
  if(!Number.isFinite(budget)||budget<1024||src.length*2>budget)throw new Error('Input exceeds its host-side workspace budget');
  let expandedBytes=src.length*2;
  const input=/^\s*\(ALGFORMINPUT\)\s*vars\s+([^;]+);\s*([^;]*);\s*$/i.exec(src);
  if(!input)throw new Error('Unsupported input.bg layout');
  const variables=input[1].split(',').map(x=>x.trim());
  if(variables.length<1||variables.length>16||new Set(variables).size!==variables.length||variables.some(x=>!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x)))throw new Error('fomkyr requires 1..16 distinct generator names');
  const weights=lines.filter(x=>x.startsWith('(SETWEIGHTS'));
  if(weights.length>1||weights.length===1&&weights[0].slice(1,-1).split(/\s+/).length-1!==variables.length)throw new Error('SETWEIGHTS must specify exactly one unit weight per generator');
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
        if(!Number.isInteger(exponent)||exponent<0||word.length+exponent>0xfffffffe)throw new Error('Word degree exceeds the 32-bit index representation');
        expandedBytes+=exponent*16;
        if(expandedBytes>budget)throw new Error('Expanded words exceed the input workspace budget; increase inputBudgetBytes deliberately.');
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
