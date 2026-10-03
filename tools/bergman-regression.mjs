// Assess fresh alternating comparisons. Missing or changing conditions never pass.
import {powerSignature} from './benchmark-environment.mjs';
export const median = values => {
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

export function assessBergmanRegression(report,{minimumTrials=3,maxSlowdown=1.15,maxSpread=1.15}={}) {
  const reasons=[],groups=[];
  if(report.state!=='complete')reasons.push('Measurement did not complete');
  const baselineRows=report.rows.filter(row=>row.id==='compiled-previous');
  const currentRows=report.rows.filter(row=>row.id==='compiled');
  if(baselineRows.length+currentRows.length!==report.rows.length)reasons.push('Unexpected configurations');
  let power=null,browser=null;
  for(const row of report.rows){
    if(row.status!=='complete')reasons.push('Incomplete run: '+row.id+', degree '+row.degree+', trial '+row.trial);
    const host=row.hostEnvironment;
    const knownLimits=host?.first?.cpuLimitsKnown??(host?.first?.policies?.length>0&&host.first.policies.every(policy=>
      policy.governor&&Number.isFinite(policy.maxKHz)&&policy.maxKHz>0));
    if(!knownLimits||!host.stablePower)reasons.push('Missing or changing CPU power conditions');
    else {
      const signature=powerSignature(host.first);power??=signature;
      if(signature!==power)reasons.push('Power conditions changed between runs');
      if(host.minAvailableMiB<1024||host.swapInPages>4096||host.swapOutPages>4096)reasons.push('Memory pressure during measurement');
    }
    const agent=row.environment?.userAgent;browser??=agent;
    if(!agent||agent!==browser)reasons.push('Missing or changing browser version');
  }
  for(const degree of report.degrees){
    const old=baselineRows.filter(row=>row.degree===degree),now=currentRows.filter(row=>row.degree===degree);
    const trials=new Set(old.map(row=>row.trial));
    if(old.length!==trials.size||now.length!==trials.size||trials.size<minimumTrials)reasons.push('Need distinct matched trials for degree '+degree);
    const pairs=[];
    for(const trial of trials){
      const a=old.find(row=>row.trial===trial),b=now.find(row=>row.trial===trial);
      if(!b){reasons.push('Missing trial '+trial);continue;}
      if(!a.jobScriptSha256||!a.inputFilesSha256||a.jobScriptSha256!==b.jobScriptSha256||a.inputFilesSha256!==b.inputFilesSha256
        ||a.memoryMiB!==b.memoryMiB||a.timeLimitSeconds!==b.timeLimitSeconds)reasons.push('Mathematical settings or allowances differ');
      if(!a.basisSha256||a.basisSha256!==b.basisSha256||!a.outputHasDone||!b.outputHasDone)reasons.push('Exact output mismatch or incomplete basis');
      if(![a.jobWallSeconds,b.jobWallSeconds,a.coldWallSeconds,b.coldWallSeconds].every(value=>Number.isFinite(value)&&value>0)){
        reasons.push('Missing positive timing');continue;
      }
      pairs.push({trial,ratio:b.jobWallSeconds/a.jobWallSeconds,baselineSeconds:a.jobWallSeconds,currentSeconds:b.jobWallSeconds,
        coldRatio:b.coldWallSeconds/a.coldWallSeconds});
    }
    if(!pairs.length)continue;
    const ratios=pairs.map(pair=>pair.ratio),spread=Math.max(...ratios)/Math.min(...ratios);
    if(spread>maxSpread)reasons.push('Timing spread exceeds '+maxSpread+' for degree '+degree);
    groups.push({degree,trials:pairs.length,baselineMedianSeconds:median(pairs.map(pair=>pair.baselineSeconds)),
      currentMedianSeconds:median(pairs.map(pair=>pair.currentSeconds)),medianRatio:median(ratios),
      coldMedianRatio:median(pairs.map(pair=>pair.coldRatio)),ratioSpread:spread,pairs});
  }
  if(!groups.length)reasons.push('No matched measurements');
  return {state:reasons.length?'inconclusive':groups.some(group=>group.medianRatio>maxSlowdown)?'regression':'passed',
    reasons:[...new Set(reasons)],maxSlowdown,maxSpread,minimumTrials,groups};
}
