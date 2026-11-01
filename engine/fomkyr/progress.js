// SPDX-License-Identifier: MIT
// Count progress is exact. Wall-clock forecasts are deliberately NOT certificates.
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
const fraction=(a,b)=>b>0n?Number(a*1000000n/b)/1000000:null;
const safeBig=v=>typeof v==='bigint'?v:BigInt(v??0);
// Current-degree throughput is measured over several windows that all end NOW,
// so a long reduction without finished overlaps lowers the rate instead of
// hiding the estimate. Long windows dominate the central value; the range
// covers every window. The degree history is thinned, never truncated, so the
// whole-degree window stays available for degrees that take hours.
const WINDOWS_MS=[120e3,600e3,1800e3,7200e3,Infinity],LONG_MS=600e3,MIN_SPAN_MS=2000,MIN_EVENTS=8n;
const LOG_STEP_MS=1000,LOG_CAP=4096,SMOOTH_MS=120e3,STALL_MS=30e3;
const span=ms=>ms>=3600e3?`${(ms/3600e3).toFixed(1)} h`:ms>=60e3?`${Math.round(ms/60e3)} min`:`${Math.round(ms/1000)} s`;
export class ProgressTracker {
  constructor({target=null,now=()=>performance.now()}={}){this.target=target;this.now=now;this.history=[];this.degree=0;this.phase='initializing';this.started=now();this.clearSamples();}
  clearSamples(){this.log=[];this.smooth=null;this.lastAdvance=null;this.lastCounter=0n;this.lastLive=0n;this.liveTime=null;this.replay=0;}
  windowRates(now,resolved){
    const rates=[],seen=new Set();
    for(const window of WINDOWS_MS){
      const point=this.log.find(x=>x.t>=now-window)??this.log[0];
      if(!point||seen.has(point))continue;seen.add(point);
      const elapsed=now-point.t,done=resolved-point.resolved;
      if(elapsed>=MIN_SPAN_MS&&done>=MIN_EVENTS)rates.push({window,elapsed,perMs:Number(done)/elapsed});
    }
    return rates;
  }
  begin(degree,completed){this.degree=degree;this.completed=completed;this.degreeStart=this.now();this.clearSamples();this.phase='input';}
  setPhase(phase){this.phase=phase;}
  finish(degree,stats){
    const elapsedMs=this.now()-this.degreeStart;
    this.history.push({degree,elapsedMs,candidates:String(stats?.total??0),scheduled:String(stats?.scheduled??0)});
    if(this.history.length>8)this.history.shift();this.completed=degree;return elapsedMs;
  }
  forecast(){
    // Deliberately refuse a 10-degree projection from 2-3 timings. Even the
    // limited projection is a scenario, never an upper bound or a probability.
    if(this.target===null)return {targetSeconds:null,reason:'No finite target was requested.'};
    const h=this.history.slice(-4);
    if(h.length<3||h.some(x=>x.elapsedMs<20||BigInt(x.candidates)===0n))return {targetSeconds:null,reason:'Insufficient nontrivial degree timings.'};
    if(h.some((x,i)=>i&&x.degree!==h[i-1].degree+1))return {targetSeconds:null,reason:'Degree timings are not consecutive.'};
    const ratios=h.slice(1).map((x,i)=>x.elapsedMs/h[i].elapsedMs);
    const last=h.at(-1),distance=this.target-last.degree;
    const growth=median(ratios);
    if(distance<1||distance>2)return {targetSeconds:null,recentDegreeGrowth:ratios,reason:'Target is outside the two-degree forecasting horizon.'};
    if(Math.max(...ratios)/Math.min(...ratios)>4)return {targetSeconds:null,recentDegreeGrowth:ratios,reason:'Recent degree growth is unstable.'};
    let mid=0,lo=0,hi=0;
    for(let k=1;k<=distance;k++){mid+=last.elapsedMs*growth**k;lo+=last.elapsedMs*(Math.min(...ratios)*0.5)**k;hi+=last.elapsedMs*(Math.max(...ratios)*2)**k;}
    return {targetSeconds:null,conditionalNextDegrees:{fromDegree:last.degree+1,throughDegree:this.target,centralSeconds:mid/1000,scenarioSeconds:[lo/1000,hi/1000],label:'Conditional extrapolation; not a completion-time bound.'},recentDegreeGrowth:ratios};
  }
  forecastForSample(eta,now){
    const historical=this.forecast();
    if(!historical.conditionalNextDegrees)return historical;
    const stalled=!!eta.stalled||/heterogeneous|long unresolved/.test(eta.reason??'');
    const exceeded=this.degreeStart!=null && now-this.degreeStart>historical.conditionalNextDegrees.centralSeconds*1000;
    if(stalled||exceeded)return {targetSeconds:null,recentDegreeGrowth:historical.recentDegreeGrowth,
      reason:stalled?'Historical projection withdrawn: current overlap timings are not predictive.':'Historical projection withdrawn: the current degree has exceeded the projected duration.'};
    return historical;
  }
  sample(raw){
    const now=this.now();
    // A new degree's ledger is not available while relations/index are loaded.
    if(['initializing','input','indexing'].includes(this.phase))raw={...raw,total:0n,seen:0n,committed:0n,scheduled:0n,monomialSkipped:0n,chainSkipped:0n,totalKnown:false};
    const total=safeBig(raw.total),resolved=safeBig(raw.committed)+safeBig(raw.monomialSkipped)+safeBig(raw.chainSkipped),live=safeBig(raw.reductions);
    if(raw.replay!==this.replay){this.clearSamples();this.replay=raw.replay;}
    if(resolved<this.lastCounter){this.clearSamples();this.replay=raw.replay;}
    if(this.lastAdvance===null||resolved>this.lastCounter){this.lastAdvance=now;this.lastCounter=resolved;}
    const counting=this.phase==='reducing'||this.phase==='committing';
    if(counting&&(!this.log.length||now-this.log.at(-1).t>=LOG_STEP_MS)){
      this.log.push({t:now,resolved});
      // Halve the resolution of a long degree; its first point is always kept.
      if(this.log.length>LOG_CAP)this.log=this.log.filter((_,i)=>i%2===0);
    }
    let reductionRate=null;
    if(this.liveTime!==null&&live>=this.lastLive&&now>this.liveTime)reductionRate=Number(live-this.lastLive)*1000/(now-this.liveTime);
    this.lastLive=live;this.liveTime=now;
    const remaining=total>resolved?total-resolved:0n,staleMs=now-this.lastAdvance;
    let eta={currentDegreeSeconds:null,label:'Heuristic current-degree estimate, not a statistical confidence interval.',reason:'Collecting timing samples.'};
    if(!counting)eta.reason='Current phase is not overlap reduction.';
    else if(!raw.totalKnown)eta.reason='Exact overlap total is unavailable.';
    else if(!remaining)eta={...eta,currentDegreeSeconds:[0,0],centralSeconds:0,reason:'Overlap work resolved; checkpoint/output work may remain.'};
    else if(!Number.isSafeInteger(Number(remaining)))eta.reason='Remaining count exceeds the safe floating-point forecasting range.';
    else {
      const rates=this.windowRates(now,resolved);
      if(rates.length){
        const long=rates.filter(r=>r.window>=LONG_MS),central=median((long.length?long:rates).map(r=>r.perMs));
        // Smooth the central rate in log space so the estimate does not jump with each batch.
        const a=this.smooth?1-Math.exp(-(now-this.smooth.t)/SMOOTH_MS):1;
        this.smooth={t:now,log:this.smooth?this.smooth.log+a*(Math.log(central)-this.smooth.log):Math.log(central)};
        const n=Number(remaining),perMs=rates.map(r=>r.perMs),mid=n/Math.exp(this.smooth.log)/1000;
        const observed=Math.max(...rates.map(r=>r.elapsed)),stalled=staleMs>=Math.max(STALL_MS,3*LOG_STEP_MS);
        eta={...eta,currentDegreeSeconds:[Math.min(mid,n/Math.max(...perMs)/1000),Math.max(mid,n/Math.min(...perMs)/1000)],centralSeconds:mid,
          observedSeconds:observed/1000,windows:rates.length,stalled,
          reason:stalled?`No overlap has finished for ${span(staleMs)} while a long reduction runs; the estimate includes this pause.`
            :`Throughput over up to ${span(observed)} of this degree; heterogeneous pairs can still exceed the range.`};
      }
    }
    return {engine:'fomkyr',phase:this.phase,target:this.target,currentDegree:this.degree,completedThroughDegree:this.completed??0,
      elapsedMs:now-this.started,degreeElapsedMs:this.degreeStart==null?0:now-this.degreeStart,
      overlaps:{total:raw.totalKnown?String(total):null,resolved:String(resolved),enumerated:String(raw.seen),scheduled:String(raw.scheduled),committed:String(raw.committed),monomialSkipped:String(raw.monomialSkipped),chainSkipped:String(raw.chainSkipped),
        fraction:raw.totalKnown?(total?fraction(resolved,total):null):null,kind:'overlap-count-not-time',replay:raw.replay},
      activity:{lanes:raw.lanes??[],activeLanes:raw.activeLanes,maxActiveRowTerms:String(raw.maxTerms),sampledReductions:String(live),sampledReductionsPerSecond:reductionRate,sampleIsApproximate:true},
      eta,forecast:this.forecastForSample(eta,now),history:[...this.history]};
  }
}
export function readProgressCounters(e){
  const p=k=>e.gn_progress_stat(k),workers=Number(e.gn_stat(10));let reductions=0n,maxTerms=0n,activeLanes=0;const lanes=[];
  for(let i=0;i<(e.gn_memory_stat?Number(e.gn_memory_stat(1)):workers);i++){reductions+=e.gn_live_stat(i,0);const busy=e.gn_live_stat(i,7),terms=e.gn_live_stat(i,4);if(busy){activeLanes++;if(terms>maxTerms)maxTerms=terms;
    lanes.push({lane:i,tier:['unknown','compact-integer','compact-rational','arbitrary-precision','sparse-big-rational','reserve-rational','reserve-big-rational'][Number(e.gn_live_stat(i,9))]??'unknown',
      terms:String(terms),bigRow:{capacity:Number(e.gn_live_stat(i,14)),reservedCapacity:Number(e.gn_live_stat(i,15)),peakTerms:Number(e.gn_live_stat(i,16)),coefficientPoolUsedBytes:Number(e.gn_live_stat(i,17)),coefficientPoolBytes:Number(e.gn_live_stat(i,18)),growths:Number(e.gn_live_stat(i,19)),capacityMisses:Number(e.gn_live_stat(i,20)),coefficientPoolMisses:Number(e.gn_live_stat(i,21)),arithmeticWorkspaceMisses:Number(e.gn_live_stat(i,22)),generalFallbacks:Number(e.gn_live_stat(i,23)),reserveWaits:Number(e.gn_live_stat(i,24))},exactFallbacks:String(e.gn_live_stat(i,10)),pair:{leftRule:Number(e.gn_live_stat(i,11)),rightRule:Number(e.gn_live_stat(i,12)),overlap:Number(e.gn_live_stat(i,13))}});}}
  return {total:p(0),seen:p(1),committed:p(2),scheduled:p(3),monomialSkipped:p(4),chainSkipped:p(5),replay:Number(p(6)),totalKnown:!!p(7),reductions,maxTerms,activeLanes,lanes};
}
