// SPDX-License-Identifier: MIT
// Count progress is exact. Wall-clock forecasts are deliberately NOT certificates.
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null;};
const fraction=(a,b)=>b>0n?Number(a*1000000n/b)/1000000:null;
const safeBig=v=>typeof v==='bigint'?v:BigInt(v??0);
export class ProgressTracker {
  constructor({target=null,now=()=>performance.now()}={}){this.target=target;this.now=now;this.history=[];this.degree=0;this.phase='initializing';this.started=now();this.clearSamples();}
  clearSamples(){this.samples=[];this.lastAdvance=null;this.lastCounter=0n;this.lastLive=0n;this.liveTime=null;this.replay=0;}
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
    const stalled=/heterogeneous|long unresolved/.test(eta.reason??'');
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
    if(this.lastAdvance===null){this.lastAdvance=now;this.lastCounter=resolved;}
    else if((this.phase==='reducing'||this.phase==='committing')&&resolved>this.lastCounter){
      const dt=now-this.lastAdvance,dn=Number(resolved-this.lastCounter);
      if(dt>=100&&dn>0){this.samples.push({msPerCandidate:dt/dn,dt});if(this.samples.length>12)this.samples.shift();this.lastAdvance=now;this.lastCounter=resolved;}
    }
    let reductionRate=null;
    if(this.liveTime!==null&&live>=this.lastLive&&now>this.liveTime)reductionRate=Number(live-this.lastLive)*1000/(now-this.liveTime);
    this.lastLive=live;this.liveTime=now;
    const remaining=total>resolved?total-resolved:0n,staleMs=now-this.lastAdvance;
    let eta={currentDegreeSeconds:null,label:'Heuristic current-degree estimate, not a statistical confidence interval.',reason:'Collecting timing samples.'};
    if(this.phase!=='reducing'&&this.phase!=='committing')eta.reason='Current phase is not overlap reduction.';
    else if(!raw.totalKnown)eta.reason='Exact overlap total is unavailable.';
    else if(!remaining)eta={...eta,currentDegreeSeconds:[0,0],reason:'Overlap work resolved; checkpoint/output work may remain.'};
    else if(this.samples.length>=3&&now-this.degreeStart>=2000){
      const rates=this.samples.map(x=>x.msPerCandidate),dt=median(this.samples.map(x=>x.dt));
      if(Math.max(...rates)>8*Math.min(...rates))eta.reason='Observed overlap costs are too heterogeneous for an informative time estimate.';
      else if(staleMs>Math.max(3000,dt*3))eta.reason='A long unresolved batch is active; previous throughput is no longer predictive.';
      else if(Number.isSafeInteger(Number(remaining))){
        const n=Number(remaining),lo=Math.min(...rates)*0.5*n/1000,hi=Math.max(...rates)*2*n/1000;
        eta={...eta,currentDegreeSeconds:[lo,hi],centralSeconds:median(rates)*n/1000,reason:'Recent resolved-overlap throughput; heterogeneous pairs may exceed this range.'};
      }else eta.reason='Remaining count exceeds the safe floating-point forecasting range.';
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
      terms:String(terms),exactFallbacks:String(e.gn_live_stat(i,10)),pair:{leftRule:Number(e.gn_live_stat(i,11)),rightRule:Number(e.gn_live_stat(i,12)),overlap:Number(e.gn_live_stat(i,13))}});}}
  return {total:p(0),seen:p(1),committed:p(2),scheduled:p(3),monomialSkipped:p(4),chainSkipped:p(5),replay:Number(p(6)),totalKnown:!!p(7),reductions,maxTerms,activeLanes,lanes};
}
