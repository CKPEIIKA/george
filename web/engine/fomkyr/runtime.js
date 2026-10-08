// SPDX-License-Identifier: MIT
// A shared, bounded linear memory. No Emscripten/MEMFS and no full-heap JS view.
export const HARD_BYTES = 15_000_000_000;
export const ERRORS = Object.freeze({1:'MEMORY_BUDGET',2:'SCRATCH_BUDGET',3:'INVALID_INPUT',4:'IO_ERROR',5:'CANCELLED',6:'CORRUPT_RECORD',7:'STATE_ERROR',8:'BATCH_OUTPUT_FULL',9:'REPRESENTATION_LIMIT',10:'CANDIDATE_REJECTED',11:'DEFERRED_ROW',12:'WORKSPACE_PRESSURE'});
export function checked(rc) {
  if (rc) { const e = new Error(`fomkyr: ${ERRORS[Math.abs(rc)] || rc}`); e.code = ERRORS[Math.abs(rc)] || 'KERNEL'; throw e; }
}
export function createMemory(bits, budget, shared = true) {
  const maximum = Math.floor(Math.min(budget, HARD_BYTES, bits === 32 ? 4_294_901_760 : Infinity) / 65536);
  if (maximum < 32) throw new Error('A minimum of 2 MiB is needed just to instantiate the module.');
  const cv = bits === 64 ? BigInt : Number;
  return new WebAssembly.Memory({address:bits === 64 ? 'i64' : 'i32', initial:cv(32), maximum:cv(maximum), shared});
}
export function hostFor(memory, bits, budget, handle = null, diskLimit = Infinity, writable = true) {
  // OPFS BufferSource support varies; use ONE bounded non-shared bounce buffer.
  const bounce = new Uint8Array(65536);
  let lastIOError = null, pulse=null, pulseInterval=1000, lastPulse=0, pulseBusy=false;
  function transfer(write, position, pointer, size) {
    if (!handle || (write && (!writable || Number(position) + size > diskLimit))) return 0;
    try {
      const pos = Number(position), ptr = Number(pointer);
      if (ptr < 0 || ptr + size > memory.buffer.byteLength) return 0;
      let done = 0;
      while (done < size) {
        const n = Math.min(bounce.length, size - done), b = bounce.subarray(0, n);
        if (write) b.set(new Uint8Array(memory.buffer, ptr + done, n));
        const count = write ? handle.write(b, {at:pos + done}) : handle.read(b, {at:pos + done});
        if (!count) return 0;
        if (!write) new Uint8Array(memory.buffer, ptr + done, count).set(b.subarray(0,count));
        done += count;
      }
      return 1;
    } catch (e) { lastIOError = e; return 0; }
  }
  return {
    imports: {
      env: {memory},
      host: {
        ensure(end) {
          end = Number(end);
          if (end > budget || end > HARD_BYTES) return 0;
          const pages = Math.ceil(end / 65536), current = memory.buffer.byteLength / 65536;
          if (pages <= current) return 1;
          if (!writable) return 0;
          try { memory.grow(bits === 64 ? BigInt(pages-current) : pages-current); return 1; }
          catch { return 0; }
        },
        read:(off,ptr,n)=>transfer(false,off,ptr,n),
        write:(off,ptr,n)=>transfer(true,off,ptr,n),
        clock:()=>{
          const now=performance.timeOrigin+performance.now();
          // A forced phase event can already have used the engine's reporting slot.
          // Advance this throttle only when an event was actually accepted;
          // otherwise two independent throttles could starve in-WASM pulses.
          if(pulse&&!pulseBusy&&now-lastPulse>=pulseInterval){pulseBusy=true;try{if(pulse()!==false)lastPulse=now;}catch{pulse=null;}finally{pulseBusy=false;}}
          return now;
        },
      },
    },
    attach(h,limit=Infinity) {handle=h;diskLimit=limit;},
    setPulse(fn,interval=1000){pulse=fn;pulseInterval=interval;lastPulse=0;},
    get lastIOError() { return lastIOError; },
  };
}
export function stats(e) {
  const keys = ['basisSize','terms','completedThroughDegree','currentDegree','allocatedBytes','budgetBytes','diskBytes','pairs','monomialPairsPruned','zeroCommits','workers','prefixNodes','peakAllocatedBytes'];
  const s = Object.fromEntries(keys.map((k,i)=>[k,Number(e.gn_stat(i))]));
  const laneSlots=e.gn_memory_stat?Number(e.gn_memory_stat(1)):s.workers;
  if(e.gn_memory_stat){s.automaticMemory=!!e.gn_memory_stat(0);s.workspaceRetryBatches=Number(e.gn_memory_stat(3));s.workspaceReplayedPairs=Number(e.gn_memory_stat(4));s.ordinaryScratchBytes=Number(e.gn_memory_stat(2));}
  s.rationalCompiledRewritesEnabled=!!e.gn_stat(48);
  s.modulus=e.gn_modulus?Number(e.gn_modulus()):null;
  s.monomialPruning=!!Number(e.gn_stat(21));s.heapReduction=!!Number(e.gn_stat(22));
  s.reductions = 0; s.monomialTermsPruned = 0; s.diskReads=0; s.diskReadBytes=0; s.reducerCacheHits=0;
  for (let i=0;i<laneSlots;i++) { s.reductions+=Number(e.gn_lane_stat(i,0)); s.monomialTermsPruned+=Number(e.gn_lane_stat(i,1)); s.diskReads+=Number(e.gn_lane_stat(i,2));s.diskReadBytes+=Number(e.gn_lane_stat(i,3));s.reducerCacheHits+=Number(e.gn_lane_stat(i,7)); }
  for(const [name,key] of [['sharedReducerCacheBytes',39],['sharedReducerCacheUsedBytes',40],['rewriteDegree',41],['rewriteUsedBytes',42],['rewriteBudgetBytes',43],['rewriteEntries',44],['rewriteDeclined',45],['rewriteTableStatus',46],['rewriteSnapshot',47]])s[name]=Number(e.gn_stat(key));
  s.costScheduling=!!e.gn_stat(36);s.wordCacheEntries=Number(e.gn_stat(37));s.wordCacheBytes=Number(e.gn_stat(38));
  s.chainPairsPruned=Number(e.gn_stat(29));s.matcherNodes=Number(e.gn_stat(25));s.matcherAllocatedBytes=Number(e.gn_stat(26));s.matcherBuilds=Number(e.gn_stat(27));s.matcherFallbacks=Number(e.gn_stat(28));
  for(const [name,key] of [['hashProbes',8],['matcherQueries',9],['matcherCharacters',10],['wordCacheHits',11],['heapAttempts',12],['heapSuccesses',13],['heapFallbacks',14],['insertionPrunes',15],['commutingPrunes',16],['quadraticSwaps',17],['rationalHeapAttempts',21],['rationalHeapSuccesses',22],['rationalHeapFallbacks',23],['pinnedReducerHits',27],['localRewriteHits',26],['integerHeapSteps',24],['rationalHeapSteps',25]]){
    s[name]=0;for(let i=0;i<laneSlots;i++)s[name]+=Number(e.gn_lane_stat(i,key));
  }
  if(e.gn_deep_stat){
    for(const [k,name] of ['rationalCompiledRewriteHits','rationalWorkspaceMisses','rationalCoefficientMisses','rationalArithmeticMisses','rationalTableRetries'].entries()){
      s[name]=0;for(let i=0;i<laneSlots;i++)s[name]+=Number(e.gn_deep_stat(i,k));
    }
  }
  if(e.gn_exact_stat){
    const names=['bigRationalAttempts','bigRationalSuccesses','bigRationalFallbacks','bigRationalSteps','bigCoefficientCollections','bigPoolMisses','bigTableMisses','bigArithmeticWorkspaceMisses'];
    for(const [k,name] of names.entries()){s[name]=0;for(let i=0;i<laneSlots;i++)s[name]+=Number(e.gn_exact_stat(i,k));}
    s.rationalInPlaceGrowths=0;for(let i=0;i<laneSlots;i++)s.rationalInPlaceGrowths+=Number(e.gn_exact_stat(i,10));
    s.bigRowMaxTerms=Number(e.gn_exact_stat(0,18));
    s.bigRows=Array.from({length:laneSlots},(_,i)=>({growths:Number(e.gn_exact_stat(i,12)),peakTerms:Number(e.gn_exact_stat(i,13)),lastCapacity:Number(e.gn_exact_stat(i,14)),reservedCapacity:Number(e.gn_exact_stat(i,15)),coefficientPoolHighWaterBytes:Number(e.gn_exact_stat(i,21)),arithmeticTempHighWaterBytes:Number(e.gn_exact_stat(i,22)),collectedLiveHighWaterBytes:Number(e.gn_exact_stat(i,23)),coefficientPoolUsedBytes:Number(e.gn_exact_stat(i,16)),coefficientPoolBytes:Number(e.gn_exact_stat(i,17)),capacityMisses:Number(e.gn_exact_stat(i,6)),coefficientPoolMisses:Number(e.gn_exact_stat(i,5)),arithmeticWorkspaceMisses:Number(e.gn_exact_stat(i,7)),generalFallbacks:Number(e.gn_exact_stat(i,20)),reserveWaits:Number(e.gn_exact_stat(i,19))}));
    s.bigRationalEnabled=!!e.gn_exact_stat(0,8);s.fastBigDivision=!e.gn_exact_stat(0,9);s.growingRationalHeap=!!e.gn_exact_stat(0,11);
  }
  if(e.gn_reserve_stat){s.rowReserveBytes=Number(e.gn_reserve_stat(0,0));
    for(const [key,name] of [[1,'reserveAttempts'],[2,'reserveSuccesses'],[3,'reserveBusy'],[4,'reserveMisses'],[6,'reservePromotions']]){s[name]=0;for(let lane=0;lane<laneSlots;lane++)s[name]+=Number(e.gn_reserve_stat(lane,key));}
    s.reserveInPlace=!!e.gn_reserve_stat(0,7);s.radixHeap=!!e.gn_reserve_stat(0,8);s.reserveLeased=!!e.gn_reserve_stat(0,9);s.reservePeakBytes=0;for(let lane=0;lane<laneSlots;lane++)s.reservePeakBytes=Math.max(s.reservePeakBytes,Number(e.gn_reserve_stat(lane,5)));
  }
  if(e.gn_pair_plan_stat){const g=k=>Number(e.gn_pair_plan_stat(k));s.pairPlan={active:!!g(0),order:g(1),candidates:g(2),next:g(3),totalRawOverlaps:g(4),adoptedSeen:g(5),adoptedPending:g(6),allocatedBytes:g(7),builds:g(8),declines:g(9),adoptions:g(10),buildMicroseconds:g(11),gateReplans:g(12),gateRankingReady:!!g(13),gateTarget:g(15),gatePromotions:g(16),gateBlockSize:g(17),q14Hint:!!g(14),q14Authority:'conditional-scheduler-only',q14ExplicitPolynomialLoaded:false,q14UsedForPruning:false};}
  if(e.gn_commit_stat){const names=['enabled','calls','eligible','unchangedSnapshot','noMatchingNewLeader','fullFallbackCalls','equalWordProbes','equalWordHits','newLeaderBinarySearchProbes','rewrites','normalFormMicroseconds','copiedRecordBytes','copyMicroseconds','appendMicroseconds','yields','contractFallbacks'];s.commit=Object.fromEntries(names.map((k,i)=>[k,Number(e.gn_commit_stat(i))]));}
  return s;
}
export function setStack(e, lane, bits) {
  const top = e.gn_stack_top(lane);
  e.__stack_pointer.value = bits === 64 ? top : Number(top);
}
export function wordCode(word) {
  let v = 0n;
  for (const x of word) v = (v<<4n)|BigInt(x);
  return [BigInt.asUintN(64,v), v>>64n];
}
export function *recordTerms(memory, offset, variables, {monic=false}={}) {
  const o=Number(offset), h=new DataView(memory.buffer,o,32);
  const n=h.getUint32(8,true), d=h.getUint32(12,true), bytes=h.getUint32(4,true);
  const view=new DataView(memory.buffer,o,bytes);
  function coefficient(at){
    let c=view.getBigUint64(at,true);
    if(!(c&1n))return BigInt.asIntN(64,c)>>1n;
    const p=Number(c&~7n),limbs=view.getUint32(p,true),negative=!!(c&2n);
    // Hexadecimal parsing is linear in the limb count. Repeated BigInt shifts
    // copy the growing integer at each step and are costly on large rows.
    const hex=new Array(limbs);for(let j=0;j<limbs;j++)hex[limbs-1-j]=view.getUint32(p+8+4*j,true).toString(16).padStart(8,'0');
    c=BigInt('0x'+hex.join(''));return negative?-c:c;
  }
  const leading=monic?coefficient(48):1n;
  if(!leading)throw new Error('Cannot normalize a zero leading coefficient');
  const abs=x=>x<0n?-x:x;
  function gcd(a,b){while(b){[a,b]=[b,a%b];}return a;}
  for(let i=0;i<n;i++) {
    const t=32+24*i;
    let w=view.getBigUint64(t,true)|(view.getBigUint64(t+8,true)<<64n), c=view.getBigUint64(t+16,true);
    const wordLo=view.getBigUint64(t,true),wordHi=view.getBigUint64(t+8,true);
    const long=!!(wordHi&(1n<<63n));
    c=monic&&!i?1n:coefficient(t+16);let denominator=1n;
    if(monic&&i&&leading!==1n){const g=gcd(abs(c),abs(leading));c/=g;denominator=leading/g;if(denominator<0n){c=-c;denominator=-denominator;}}
    const sign=c<0n?'-':i?'+':'';if(c<0n)c=-c;
    yield `${sign}${denominator!==1n?`${c}/${denominator}*`:c===1n?'':`${c}*`}`;
    // Stream bounded word fragments. Long runs become x^n; no O(degree) names
    // array or giant joined string exists during text export.
    const at=Number(wordLo);let buffer='',previous=-1,count=0,first=true;
    function factor(letter,n){const text=(first?'':'*')+variables[letter]+(n>1?'^'+n:'');first=false;return text;}
    for(let j=0;j<d;j++){
      const letter=long?view.getUint8(at+j):Number((w>>BigInt(4*(d-1-j)))&15n);
      if(letter===previous)count++;
      else{if(count)buffer+=factor(previous,count);previous=letter;count=1;}
      if(buffer.length>=16384){yield buffer;buffer='';}
    }
    if(count)buffer+=factor(previous,count);if(buffer)yield buffer;
  }
}
