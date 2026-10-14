// SPDX-License-Identifier: MIT
// Degree-bounded modular lifting with a deterministic homogeneous certificate.
// Primes run sequentially, each retaining the original multicore kernel. This
// avoids nested-worker oversubscription and several active linear memories.
import {FomkyrEngine,validateFixture} from './engine.js';
import {CRTGroup,decodeRecord,rowCharge,wordCompare} from './rational-lift.js';
import {checkCandidate} from './candidate-verifier.js';
import {identityOf,sha256,VERSION,writeJSON,deleteCachedRun} from './storage.js';
import {stats,checked} from './runtime.js';
import {computeHilbert,hilbertCSV} from './hilbert.js';
const MiB=1048576;
export const DEFAULT_PRIMES=[1000000007,1000000009,998244353,1004535809,469762049,985661441,943718401,935329793];
const yieldTurn=()=>new Promise(r=>setTimeout(r,0));
function sameLeaders(a,b){return a.length===b.length&&a.every((r,i)=>r.lm===b[i].lm);}
export class ModularEngine{
 constructor(options={}){this.options=options;this.child=null;this.active=false;this.cancelled=false;this.attempts=[];this.stage='initializing';this.closed=false;this.quarantineKey=null;}
 get memory(){return this.child?.memory;}
 get e(){return this.child?.e;}
 emit(event){this.options.onEvent?.(event);}
 event(event){
  if(this.stage==='exact-fallback'||this.stage==='exact-direct'){this.emit(event);return;}
  if(event.type==='progress')this.emit({...event,arithmeticStage:this.stage,prime:this.currentPrime??null,rationalCertifiedThroughDegree:0,completedThroughDegree:0,fieldCompletedThroughDegree:event.completedThroughDegree,forecast:{targetSeconds:null,reason:'Prime count and exact verification cost are not yet known.'}});
  else if(event.type==='degree')this.emit({type:'modular-stage',stage:this.stage,prime:this.currentPrime??null,fieldCompletedThroughDegree:event.completedThroughDegree,rationalCertifiedThroughDegree:0});
  else this.emit(event);
 }
 cancel(){this.cancelled=true;this.child?.cancel();}
 remaining(){if(this.cancelled)checked(5);if(!this.deadline)return 0;const t=this.deadline-performance.now();if(t<=0)checked(5);return t;}
 async childFor(extra){
  if(this.child){await this.child.close();this.child=null;}
  if(this.quarantineKey){const key=this.quarantineKey;this.quarantineKey=null;try{await deleteCachedRun(key);}catch{/* No checkpoint exists; safe cleanup may be unavailable. */}}
  this.remaining();
  this.child=new FomkyrEngine({...this.options,...extra,arithmeticMode:'exact',timeoutMs:this.remaining(),onEvent:e=>this.event(e)});
  return this.child;
 }
 async canonical(engine,target,workspace){
  const rows=[];let charge=0;const n=Number(engine.e.gn_stat(0));
  this.stage='canonicalizing';
  for(let id=1;id<=n;id++){
   if(Number(engine.e.gn_rule_stat(id,2))>target)continue;
   if(!(id&31)){this.remaining();await yieldTurn();this.emit({type:'modular-stage',stage:this.stage,prime:this.currentPrime,canonicalRules:id,totalRules:n,rationalCertifiedThroughDegree:0});}
   const ptr=engine.e.gn_canonical_rule(id);if(!ptr)checked(Number(engine.e.gn_lane_stat(0,5))||7);
   const size=engine.e.gn_export_size();if(size>workspace-charge)throw Object.assign(new Error('Canonical image exceeds lift workspace'),{code:'LIFT_WORKSPACE'});
   const row=decodeRecord(new Uint8Array(engine.memory.buffer,Number(ptr),size));charge+=rowCharge(row,32);
   if(charge>workspace)throw Object.assign(new Error('Canonical image exceeds lift workspace'),{code:'LIFT_WORKSPACE'});rows.push(row);
  }
  rows.sort((a,b)=>wordCompare(a.lm,b.lm));return rows;
 }
 async finish(fixture,target,rows,witness,verification,started){
  const engine=this.child,identity=await identityOf(fixture,0);
  // No probabilistic test. The witness was computed from THIS input over F_p;
  // exact leading-word equality gives all degree-wise Hilbert equalities.
  if(!sameLeaders(rows,witness))throw Object.assign(new Error('Modular leading-ideal witness mismatch'),{code:'CANDIDATE_REJECTED'});
  const proof={method:'homogeneous-rank-sandwich',deterministic:true,throughDegree:target,field:'Q',witnessPrime:this.currentWitnessPrime,leadingWordsSha256:await sha256(JSON.stringify(rows.map(r=>r.lm))),...verification};
  const lastInputDegree=fixture.relations.reduce((n,r)=>Math.max(n,r.degree),0),globallyComplete=target>=lastInputDegree&&BigInt(target)>=engine.e.gn_completion_bound();
  let hilbert=null;
  if(this.options.hilbert!==false){
   try{const d=this.options.hilbertDegree??target;if(d>target&&!globallyComplete)throw new Error('Hilbert degree exceeds the certified bound');hilbert=computeHilbert(engine.e,d,Math.min(engine.budget-Number(engine.e.gn_stat(4)),this.options.hilbertBudgetBytes??256*MiB),this.options.hilbertOutputBudgetBytes);hilbert.basisCompletionProved=globallyComplete;hilbert.certification=globallyComplete?'complete-basis':'degree-truncated-basis';}
   catch(error){if(error.code==='CANCELLED'||this.options.hilbertRequired)throw error;hilbert={available:false,error:error.message,certifiedThroughDegree:null};}
  }
  const result={...stats(engine.e),engine:'fomkyr',version:VERSION,arithmeticMode:'modular-verified',modulus:0,order:'degleftlex',target,identity,complete:true,reduced:false,tailReduced:true,normalization:'primitive-integer; divide each row by its leading coefficient for monic reduced Q form',unrestrictedBasisComplete:globallyComplete,certification:proof,
   runKey:engine.runKey,storage:engine.spill?'opfs':'memory',shared:engine.shared,bits:engine.bits,ioMode:engine.ioMode,executionMode:`wasm${engine.bits}-${engine.shared?'shared':'single'}`,fallbacks:engine.fallbacks??[],requestedBudgetBytes:engine.requestedBudget,linearMemoryBytes:engine.memory.buffer.byteLength,hilbert,
   modular:{attempts:this.attempts,primesUsed:this.acceptedPrimes,verificationCount:this.verificationCount,logicalWorkspaceBudgetBytes:this.workspace,totalAlgorithmMs:performance.now()-started,signaturesImplemented:false},elapsedMs:performance.now()-started,scheduler:engine.scheduler};
  if(this.options.exportText!==false)Object.assign(result,await engine.exportText(fixture.variables,{tailReduced:true}));
  result.elapsedMs=performance.now()-started;
  // The first rational checkpoint is published ONLY AFTER every proof check.
  await engine.checkpoint(identity);this.quarantineKey=null;
  if(engine.directory){await writeJSON(engine.directory,'certification.json',proof);if(hilbert)await writeJSON(engine.directory,'hilbert.json',hilbert);if(hilbert?.coefficients)await engine.writeSmallText('hilbert.csv',hilbertCSV(hilbert));const {preview,...metadata}=result;await writeJSON(engine.directory,'fomkyr-result.json',metadata);}
  this.emit({type:'degree',...stats(engine.e),certification:proof});
  this.emit({type:'stdout',text:`fomkyr modular lift certified exactly over Q through degree ${target}; ${this.acceptedPrimes.length} prime(s), ${this.verificationCount} verification attempt(s).\n`});return result;
 }
 async compute(fixture,target=20,modulus=0){
  if(this.active||this.closed)throw new Error('Modular engine busy/closed');this.active=true;this.cancelled=false;
  try{return await this.computeActive(fixture,target,modulus);}finally{this.active=false;}
 }
 async computeActive(fixture,target,modulus){
  const started=performance.now();this.deadline=this.options.timeoutMs>0?started+this.options.timeoutMs:0;
  this.attempts=[];this.verificationCount=0;this.fallbackReason=null;
  try{
   validateFixture(fixture);
   if(target===null||modulus!==0){this.stage='exact-direct';this.emit({type:'warning',message:target===null?'Modular certification uses a finite degree window. Unbounded completion retains the exact engine.':'A requested finite field is computed directly; it is not lifted to Q.'});const e=await this.childFor({});return await e.compute(fixture,target,modulus);}
   if(!Number.isInteger(target)||target<1||target>0xfffffffe)throw new Error('Invalid target degree');
   const primes=this.options.modularPrimes??DEFAULT_PRIMES,minPrimes=this.options.modularMinPrimes??2,maxPrimes=this.options.modularMaxPrimes??primes.length;
   if(!Array.isArray(primes)||!primes.length||primes.some(p=>!Number.isInteger(p)||p<3||p>2147483647)||new Set(primes).size!==primes.length)throw new Error('Use distinct prime integers in 3..2147483647');
   if(!Number.isInteger(minPrimes)||minPrimes<1||!Number.isInteger(maxPrimes)||maxPrimes<minPrimes||maxPrimes>primes.length)throw new Error('Invalid modular prime limits');
   this.workspace=Number(this.options.modularWorkspaceBytes??Math.min(64*MiB,Number(this.options.budgetBytes??512*MiB)/2));
   if(!Number.isFinite(this.workspace)||this.workspace<MiB)throw new Error('Modular workspace must be finite and >=1 MiB');
   const id=await identityOf(fixture,0);let group=null,witness=null,bestShapeCount=0;const shapeCounts=new Map();let shapeBytes=0;
   for(const prime of primes.slice(0,maxPrimes)){
    this.remaining();this.currentPrime=prime;this.stage='modular-prime';
    this.emit({type:'stdout',text:`fomkyr modular stage: F_${prime}, target degree ${target}; not yet certified over Q.\n`});
    const begin=performance.now(),engine=await this.childFor({runKey:`mp-${id.slice(0,40)}-${prime}`,resume:this.options.resume,hilbert:false,exportText:false});
    const modularResult=await engine.compute(fixture,target,prime);
    if(modularResult.modulus!==prime||modularResult.identity!==await identityOf(fixture,prime)||modularResult.completedThroughDegree<target)throw new Error('Invalid modular witness provenance');
    const canonicalStart=performance.now(),image=await this.canonical(engine,target,this.workspace/3),canonicalMs=performance.now()-canonicalStart;
    const shape=JSON.stringify(image.map(r=>r.lm)),count=(shapeCounts.get(shape)??0)+1;if(!shapeCounts.has(shape)){shapeBytes+=2*shape.length+128;if(shapeBytes>this.workspace/16)throw Object.assign(new Error('Leading-shape history exceeds lift workspace'),{code:'LIFT_WORKSPACE'});}shapeCounts.set(shape,count);
    // At most a small number of shape strings; primes are explicitly bounded.
    const trial={prime,computationMs:modularResult.elapsedMs,canonicalMs,elapsedMs:performance.now()-begin,basisSize:image.length,resumedFromDegree:modularResult.resumedFromDegree};this.attempts.push(trial);
    this.stage='reconstruction';
    if(!group||(!group.matches(image)&&count>bestShapeCount)){
     group=new CRTGroup(image,prime,this.workspace/3);witness=image;bestShapeCount=count;this.currentWitnessPrime=prime;trial.shape='new-group';
    }else if(group.matches(image)){group.merge(image,prime);bestShapeCount=count;trial.shape='matching';}
    else{trial.shape='discarded-mismatch';continue;}
    this.emit({type:'modular-stage',stage:this.stage,prime,matchingPrimes:group.primes.length,modulusBits:group.M.toString(2).length,rationalCertifiedThroughDegree:0});
    if(group.primes.length<minPrimes)continue;
    const liftStart=performance.now(),rows=group.reconstruct(this.workspace-shapeBytes-group.chargedBytes-witness.reduce((n,r)=>n+rowCharge(r,32),0));trial.reconstructionMs=performance.now()-liftStart;
    if(!rows){trial.reconstruction='insufficient-modulus';continue;}
    // All groups and candidate rows together have a separately bounded logical
    // workspace. Exact BigInts/Maps are GC managed, so RSS is reported, not capped.
    if(rows.reduce((n,r)=>n+rowCharge(r,group.M.toString(2).length),0)+group.chargedBytes+witness.reduce((n,r)=>n+rowCharge(r,32),0)>this.workspace-shapeBytes)throw Object.assign(new Error('Lifted candidate exceeds workspace'),{code:'LIFT_WORKSPACE'});
    this.stage='exact-verification';this.currentPrime=null;this.verificationCount++;
    const verifyEngine=await this.childFor({runKey:`qv-${id.slice(0,28)}-${crypto.randomUUID().slice(0,8)}`,resume:false});
    this.quarantineKey=verifyEngine.options.runKey;
    try{
     const verified=await checkCandidate(verifyEngine,fixture,rows,target);trial.verification='passed';trial.verificationMs=verified.elapsedMs;this.acceptedPrimes=[...group.primes];
     return await this.finish(fixture,target,rows,witness,verified,started);
    }catch(error){if(error.code!=='CANDIDATE_REJECTED')throw error;trial.verification='rejected';this.emit({type:'warning',message:`Exact verification rejected the ${group.primes.length}-prime lift. No rational checkpoint was published.`});}
   }
   this.fallbackReason='Prime budget exhausted without an exact certificate';
  }catch(error){
   if(!['LIFT_WORKSPACE'].includes(error.code))throw error;
   this.fallbackReason=error.message;
  }
  if(this.options.modularFallback===false)throw Object.assign(new Error(this.fallbackReason),{code:'MODULAR_UNCERTIFIED'});
  this.stage='exact-fallback';this.emit({type:'warning',message:this.fallbackReason+'; continuing with the original exact engine.'});
  const engine=await this.childFor({runKey:this.options.runKey});
  const result=await engine.compute(fixture,target,modulus);result.arithmeticMode='exact-fallback';result.modular={attempts:this.attempts,fallbackReason:this.fallbackReason};result.elapsedMs=performance.now()-started;return result;
 }
 async close(){this.cancel();if(this.child)await this.child.close();this.child=null;this.closed=true;if(this.quarantineKey){const key=this.quarantineKey;this.quarantineKey=null;try{await deleteCachedRun(key);}catch{}}}
}
export function createEngine(options={}){
 const mode=options.arithmeticMode??'exact';if(!['exact','modular-verified'].includes(mode))throw new Error('Unknown arithmeticMode');
 return mode==='modular-verified'?new ModularEngine(options):new FomkyrEngine(options);
}
