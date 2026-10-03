// SPDX-License-Identifier: MIT
// Extension to the existing George form. Mathematical options stay in George.
import {requestPersistentStorage,listCachedRuns,deleteCachedRun} from './storage.js';
import {browserCapabilities} from './capabilities.js';
import {requestIsolation} from './isolation.js';
const KEY='fomkyr-options-v3'; // keep existing user tuning on upgrade
const defaults={hilbertClosureMode:'off',hilbertEvidenceText:'',hilbertClosureBatching:true,arithmeticMode:'exact',memoryPolicy:'auto',modularMinPrimes:2,modularMaxPrimes:8,workers:0,execution:'auto',bits:'auto',spill:true,hilbert:true,resume:'auto',ioMode:'auto',monomialPruning:true,heapReduction:true,rationalHeap:true,bigRationalHeap:true,fastBigDivision:true,growingRationalHeap:true,radixHeap:true,reserveInPlace:true,rowReserveMiB:null,compiledRewrites:true,rewriteDegree:4,rewriteSupport:8,rewriteMiB:8,sharedCacheMiB:null,cachePercent:12,heapThreshold:16,batchPairs:null,hashBits:18,scratchMiB:null,hilbertMiB:256,wordMatcher:true,chainCriterion:true,eagerPruning:true,quadraticRewrite:true,costScheduling:true,wordCacheEntries:256,progress:true,progressIntervalMs:1000,midDegreeCheckpoints:true,checkpointIntervalMs:30000,referenceProgress:true};
let state={...defaults};
try{const saved=JSON.parse(globalThis.localStorage?.getItem(KEY)||'{}');for(const key of Object.keys(defaults))if(Object.hasOwn(saved,key))state[key]=saved[key];}catch{}
// Public George controls retain only the measured direct mode. The explicit
// modular API/research module remains for backwards-compatible experiments.
state.arithmeticMode='exact';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
export function readFomkyrOptions(){
  const out={...state};delete out.hilbertClosureMode;delete out.hilbertEvidenceText;
  if(state.hilbertClosureMode!=='off'){
    let data;try{data=JSON.parse(state.hilbertEvidenceText);}catch{throw new Error('Hilbert closure requires a valid JSON certificate or explicitly assumed dimension file.');}
    if(state.hilbertClosureMode==='certificate')out.hilbertClosure={certificate:data};
    else if(state.hilbertClosureMode==='external-assumption')out.hilbertClosure={assume:data};
    else throw new Error('Unknown Hilbert closure mode');
  }
  delete out.scratchMiB;delete out.hilbertMiB;delete out.rewriteMiB;delete out.sharedCacheMiB;delete out.rowReserveMiB;
  out.rewriteBudgetBytes=Number(state.rewriteMiB??8)*1048576;
  if(state.sharedCacheMiB!==null)out.sharedReducerCacheBytes=Number(state.sharedCacheMiB)*1048576;
  if(out.batchPairs===null)delete out.batchPairs;
  if(state.rowReserveMiB!==null)out.rowReserveBytes=Number(state.rowReserveMiB)*1048576;
  if(state.scratchMiB!==null)out.scratchBytes=Number(state.scratchMiB)*1048576;
  if(state.memoryPolicy==='auto'){delete out.scratchBytes;delete out.rowReserveBytes;}
  out.hilbertBudgetBytes=Number(state.hilbertMiB)*1048576;
  if(typeof document!=='undefined'){
    const workers=document.getElementById('nativeWorkers'),prune=document.getElementById('monomialPruning');
    if(workers)out.workers=Number(workers.value);
    if(prune)out.monomialPruning=prune.checked;
  }
  return out;
}
export function installFomkyrControls(){
  const select=document.querySelector('#backend');if(!select||document.getElementById('fomkyr-options'))return;
  const box=document.createElement('fieldset');box.id='fomkyr-options';
  const legend=document.createElement('legend');legend.textContent='fomkyr: runtime, memory and exact Hilbert coefficients';box.append(legend);
  function label(text,parent=box){const el=document.createElement('label');el.style.display='block';el.style.margin='0.35em 0';el.append(document.createTextNode(text+' '));parent.append(el);return el;}
  function choice(key,text,values,parent=box){const row=label(text,parent),input=document.createElement('select');input.id='fomkyr-'+key;for(const [value,name] of values){const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o);}input.value=state[key];input.onchange=()=>{state[key]=input.value;persist();};row.append(input);return input;}
  function number(key,text,min,max,parent=box){const row=label(text,parent),input=document.createElement('input');input.type='number';input.id='fomkyr-'+key;input.min=min;if(max!=null)input.max=max;input.step='1';input.value=state[key]??'';input.placeholder='automatic';input.style.width='7em';input.onchange=()=>{const v=input.value===''?null:Number(input.value);if(v!==null&&(!Number.isInteger(v)||v<min||max!=null&&v>max)){input.setCustomValidity(`Enter an integer from ${min} to ${max??'the available budget'}, or leave automatic.`);return;}input.setCustomValidity('');state[key]=v;persist();};row.append(input);return input;}
  function check(key,text,parent=box){const row=label('',parent),input=document.createElement('input');input.id='fomkyr-'+key;input.type='checkbox';input.checked=!!state[key];input.onchange=()=>{state[key]=key==='resume'?(input.checked?'auto':false):input.checked;persist();if(key==='progress'&&!input.checked){const p=document.getElementById('fomkyr-progress');if(p)p.hidden=true;}};row.append(input,document.createTextNode(' '+text));return input;}
  const closureBox=document.createElement('details');const closureSummary=document.createElement('summary');closureSummary.textContent='Optional Hilbert-guided closure (off by default)';closureBox.append(closureSummary);box.append(closureBox);
  choice('hilbertClosureMode','Authority',[['off','Off: process critical pairs normally'],['certificate','Replay exact integer-dual certificate'],['external-assumption','Trust external dimensions: CONDITIONAL result']],closureBox);
  check('hilbertClosureBatching','Limit speculative batch work near dimension equality',closureBox);
  const evidence=label('Certificate / dimension JSON',closureBox),area=document.createElement('textarea');area.id='fomkyr-hilbertEvidenceText';area.rows=5;area.style.width='100%';area.value=state.hilbertEvidenceText;area.onchange=()=>{state.hilbertEvidenceText=area.value;persist();};evidence.append(area);
  const upload=document.createElement('input');upload.type='file';upload.accept='.json,application/json';upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;if(file.size>64*1048576){alert('Hilbert evidence file exceeds 64 MiB');return;}area.value=await file.text();state.hilbertEvidenceText=area.value;persist();};closureBox.append(upload);
  const closureNote=document.createElement('p');closureNote.textContent='Equality of the normal-word upper bound with an independently justified lower bound closes only that degree. Trusted external dimensions are assumptions, not replayed proofs. Assisted checkpoints require the same evidence file on resume. A deficit is not an ETA.';closureBox.append(closureNote);
  choice('execution','Execution',[['auto','Automatic: shared multicore when available'],['single','Single worker: no shared-memory requirement'],['multicore','Require shared multicore; fail if isolation is unavailable']]);
  if(!document.getElementById('nativeWorkers'))number('workers','CPU lanes (0 = automatic)',0,32);
  choice('bits','WASM addressing',[['auto','Automatic: 32-bit unless the budget needs memory64'],['32','32-bit'],['64','64-bit, with capability fallback']]);
  const memoryChoice=choice('memoryPolicy','Memory policy',[['auto','Automatic: one total ceiling, no per-degree tuning'],['manual','Manual: preserve explicit scratch/reserve settings']]);
  check('spill','Store the basis and resumable checkpoints in OPFS');
  check('resume','Reuse the matching algebra checkpoint, including unfinished-degree progress');
  check('midDegreeCheckpoints','Save committed progress inside an unfinished degree');
  check('hilbert','Compute exact Hilbert coefficients');
  const pruneOriginal=document.getElementById('monomialPruning');
  if(!pruneOriginal)check('monomialPruning','Prune consequences of monomial zero relations');
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Advanced tuning';details.append(summary);box.append(details);
  check('compiledRewrites','Compile exact short-context rewrites (bounded expansion; exact fallback)',details);
  number('rewriteDegree','Compiled local word length (not the calculation degree)',2,4,details);
  number('rewriteSupport','Maximum terms per compiled rewrite',1,64,details);
  number('rewriteMiB','Compiled rewrite cache budget, MiB',0,256,details);
  number('sharedCacheMiB','Shared immutable reducer cache, MiB (blank = bounded automatic; 0 = disabled)',0,14304,details);
  check('rationalHeap','Compact exact rational heap for non-monic rows',details);
  check('bigRationalHeap','Sparse arbitrary-precision rational heap (exact, budgeted fallback)',details);
  check('fastBigDivision','Normalized large-integer division (exact)',details);
  check('growingRationalHeap','Grow compact rational tables without replaying reductions',details);
  check('radixHeap','Monotone radix word queue (same exact leading-word order)',details);
  check('reserveInPlace','Promote a crowded rational row into the shared reserve without replay',details);
  number('rowReserveMiB','Shared overflow workspace, MiB (blank = bounded automatic; 0 = disabled)',0,14304,details);
  check('wordMatcher','Indexed leading-word matching (same monomial order)',details);
  check('chainCriterion','Skip overlaps certified by lower-degree chains',details);
  check('eagerPruning','Discard proved square/commutation zeros before heap insertion',details);
  check('quadraticRewrite','Pre-rewrite known monic quadratic binomials',details);
  check('costScheduling','Dispatch larger input pairs first; keep exact commit order',details);
  number('wordCacheEntries','Exact word-cache entries per lane (power of two; 256 = small cache)',256,1048576,details);
  check('progress','Live overlap-count progress and conservative timing estimates',details);
  number('progressIntervalMs','Progress update interval, milliseconds',250,60000,details);
  number('checkpointIntervalMs','Mid-degree checkpoint interval, milliseconds (at safe frontiers)',0,3600000,details);
  check('referenceProgress','Show published Hilbert reference diagnostics for matching input (never skips work)',details);
  check('heapReduction' ,'Fast sparse heap reduction for short words',details);
  number('cachePercent','Reducer cache (% of each lane workspace)',0,40,details);
  number('heapThreshold','Heap reduction minimum term count',1,1048576,details);
  number('batchPairs','Critical pairs per batch (blank = auto; 0 = low-memory scheduler)',0,512,details);
  number('hashBits','Lookup hash bits',8,26,details);
  number('scratchMiB','Total reduction workspace, MiB (manual mode only)',1,14303,details);
  const refreshMemory=()=>{for(const key of ['scratchMiB','rowReserveMiB']){const input=document.getElementById('fomkyr-'+key);if(input)input.disabled=state.memoryPolicy==='auto';}};
  const saveMemory=memoryChoice.onchange;memoryChoice.onchange=()=>{saveMemory();refreshMemory();};refreshMemory();
  number('hilbertMiB','Additional Hilbert workspace, MiB',0,14304,details);
  choice('ioMode','Parallel file I/O',[['auto','Automatic: probe concurrent handles, otherwise broker'],['broker','Portable: one exclusive OPFS owner'],['direct','Prefer direct concurrent handles; broker if unsupported']],details);
  const note=document.createElement('p');note.textContent='Leave George’s maximal degree blank for completion without a user degree bound. Automatic memory uses George’s total budget, grows crowded rows and reduces concurrency at a safe batch barrier when necessary. It never discovers or claims the amount of free system RAM. Mid-degree saves retain committed results and pending pair descriptors; unfinished active polynomials are replayed. The interval is checked at safe frontiers, not a guaranteed wall-clock save deadline. Homogeneous relations, unit weights, Q or a prime field and degleftlex are supported. Reversing the generator order, timeout and memory controls remain in the main form. Low-terms quick/safe are equivalent for homogeneous input. Rabbit, resolutions and weighted orders are not implemented. Save unsaved input before enabling isolation, which may reload this page.';box.append(note);
  const pruneNote=document.createElement('p');pruneNote.textContent='For fomkyr, “monomial pruning” means exact zero-word shortcuts, not Bergman’s Lisp monomial-storage garbage collection. Both settings produce the same algebra; disabling shortcuts is useful for cross-checks.';box.append(pruneNote);
  const status=document.createElement('pre');status.id='fomkyr-runtime-status';status.style.whiteSpace='pre-wrap';
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{try{await fn();}catch(e){status.textContent=e.message;}};box.append(b);return b;}
  button('Inspect browser capabilities',()=>{status.textContent=JSON.stringify(browserCapabilities(),null,2);});
  button('Enable static-host multicore (one reload)',async()=>{
    const projectRoot=new URL('../../',import.meta.url);
    // Recent George versions already own an isolation worker. Never replace it.
    status.textContent=JSON.stringify(await requestIsolation({workerURL:new URL('fomkyr-isolation-worker.js',projectRoot),scope:projectRoot}),null,2);
  });
  button('Request persistent browser storage',async()=>{status.textContent=JSON.stringify(await requestPersistentStorage(),null,2);});
  const entries=document.createElement('div');
  button('Show cached algebras',async()=>{
    entries.replaceChildren();const runs=await listCachedRuns();status.textContent=`${runs.length} cached run(s). Active runs cannot be deleted.`;
    for(const r of runs){const row=document.createElement('p');row.textContent=`${r.key}: degree ${r.completedThroughDegree??'unverified'}, ${r.diskBytes} bytes${r.partial?`, unfinished degree ${r.currentDegree}, ${r.resolvedOverlaps??'?'} / ${r.totalOverlaps??'?'} overlaps retained`:''} `;
      const del=document.createElement('button');del.type='button';del.textContent='Delete this cache';del.onclick=async()=>{if(!confirm(`Delete cached algebra ${r.key}?`))return;try{await deleteCachedRun(r.key);row.remove();}catch(e){status.textContent=e.message;}};row.append(del);entries.append(row);}
  });
  box.append(status,entries);select.parentElement.insertAdjacentElement('afterend',box);refreshMemory();
  const originalTitles=new Map();
  function update(){
    const active=select.value==='fomkyr';box.hidden=!active;const progressPanel=document.getElementById('fomkyr-progress');if(progressPanel)progressPanel.hidden=!active||!state.progress;
    const workers=document.getElementById('nativeWorkers');if(active&&workers){workers.disabled=false;workers.closest('[hidden]')?.removeAttribute('hidden');}
    if(pruneOriginal){if(!originalTitles.has(pruneOriginal))originalTitles.set(pruneOriginal,pruneOriginal.title);if(active){pruneOriginal.disabled=false;pruneOriginal.title='fomkyr: exact monomial-zero reduction and pair shortcuts (not Lisp garbage collection).';}else pruneOriginal.title=originalTitles.get(pruneOriginal);}
    const max=document.getElementById('maxdeg');if(active&&max){max.removeAttribute('max');max.placeholder='none: complete until stopped or proved';}
    const memory=document.getElementById('memoryMiB');
    if(active&&memory){for(const o of memory.options)o.disabled=Number(o.value)>14304||Number(o.value)<16;if(Number(memory.value)>14304||Number(memory.value)<16){if([...memory.options].some(o=>o.value==='14304'))memory.value='14304';else memory.value='2048';}}
    else if(memory)for(const o of memory.options)o.disabled=false;
    if(active)status.textContent=`${globalThis.crossOriginIsolated?'Isolation available: shared multicore can be selected.':'No isolation: automatic mode will use the unshared single-worker build.'} Actual bitness, worker count and I/O fallbacks are reported for each run.`;
  }
  select.addEventListener('change',()=>queueMicrotask(update));update();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installFomkyrControls,{once:true});else installFomkyrControls();
}
