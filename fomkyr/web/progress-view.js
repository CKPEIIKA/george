// SPDX-License-Identifier: MIT
// Main-thread presentation. Bounded text only; no per-pair DOM work or log growth.
let panel,summary,bar,activity,estimate;
const seconds=v=>v<60?`${v.toFixed(1)} s`:v<3600?`${(v/60).toFixed(1)} min`:`${(v/3600).toFixed(1)} h`;
function ensurePanel(){
 if(panel?.isConnected)return;
 panel=document.getElementById('fomkyr-progress');
 if(!panel){panel=document.createElement('section');panel.id='fomkyr-progress';panel.setAttribute('aria-label','fomkyr computation progress');
  const anchor=document.getElementById('fomkyr-options')??document.getElementById('backend')?.parentElement;
  if(anchor)anchor.insertAdjacentElement('afterend',panel);else document.body.append(panel);
 }
 panel.replaceChildren();summary=document.createElement('p');bar=document.createElement('progress');bar.max=1;bar.style.width='100%';
 activity=document.createElement('p');estimate=document.createElement('p');panel.append(summary,bar,activity,estimate);
}
export function forwardFomkyrProgress(event){
 if(typeof document==='undefined'||event?.engine!=='fomkyr')return;
 if(!event.overlaps)return;ensurePanel();panel.hidden=false;
 const o=event.overlaps,a=event.activity;
 summary.textContent=(event.arithmeticStage?`Stage: ${event.arithmeticStage}${event.prime?' (F_'+event.prime+')':''}. Rational certificate: ${event.rationalCertifiedThroughDegree??0}. `:'')+`Certified through degree ${event.completedThroughDegree}. Degree ${event.currentDegree}: ${event.phase}. `+
  (o.total!==null?`${o.resolved} / ${o.total} overlaps resolved.`:'Preparing the overlap count.');
 if(o.fraction!==null){bar.value=o.fraction;bar.setAttribute('aria-label','Fraction of overlap checks resolved, not fraction of total runtime');}
 else bar.removeAttribute('value');
 activity.textContent=`${a.activeLanes} active lane(s); ${a.maxActiveRowTerms} terms in the largest sampled active row; ${a.sampledReductions} sampled reductions. `+
  `${o.chainSkipped} lower-degree chain skips. This bar measures overlap count, not elapsed-time completion.`;
 const general=(a.lanes??[]).filter(l=>l.tier==='arbitrary-precision');
 if(general.length)activity.textContent+=` ${general.length} lane(s) using the exact arbitrary-precision fallback.`;
 const sparse=(a.lanes??[]).filter(l=>l.tier==='sparse-big-rational');
 if(sparse.length)activity.textContent+=` ${sparse.length} lane(s) in the sparse arbitrary-precision rational tier.`;
 const eta=event.eta.currentDegreeSeconds;
 estimate.textContent=eta?`Current-degree estimate: ${seconds(eta[0])}–${seconds(eta[1])}. ${event.eta.reason}`:`Remaining time: unknown. ${event.eta.reason}`;
 if(o.replay)estimate.textContent+=` Degree replay ${o.replay}: earlier throughput has been discarded.`;
}
