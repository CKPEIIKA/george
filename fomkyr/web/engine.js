import {FkGate,FK_GATE_PROFILE_ID} from './fk-gate.js';
import {prepareHilbertClosure,replayHilbertCertificate,hilbertMetadata,beginHilbertClosure,tryHilbertClosure,hilbertGap,closureBatchLimit} from './hilbert-closure.js';
import {planMemory,chooseMemoryPolicy,sharedCacheAllowance} from './memory-policy.js';
// SPDX-License-Identifier: MIT
import {ProgressTracker,readProgressCounters} from './progress.js';
import {HARD_BYTES,createMemory,hostFor,stats,checked,wordCode,recordTerms} from './runtime.js';
import {STORE,VERSION,identityOf,acquireRunLock,checkpointCandidates,writeJSON} from './storage.js';
import {loadKernel} from './module-cache.js';
import {computeHilbert,hilbertCSV} from './hilbert.js';
import {beginReference,referenceSnapshot} from './hilbert-reference.js';
import {browserCapabilities,sharedMemoryAvailable,probeUnsafeAccess} from './capabilities.js';
import {BrokerHandle,makeMailbox,IO_CHUNK,IO_HEADER} from './io-broker.js';
import {computeWorkers} from './worker-count.js';
const MiB=1048576,enc=new TextEncoder(),hexDecoder=new TextDecoder('ascii'),hexDigits=new TextEncoder().encode('0123456789abcdef');
export function validateFixture(fixture){
  if(!fixture||!Array.isArray(fixture.variables)||!Array.isArray(fixture.relations))throw new Error('Invalid fixture');
  const vars=fixture.variables;
  if(vars.length<1||vars.length>16||new Set(vars).size!==vars.length||vars.some(x=>typeof x!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x)))throw new Error('Use 1..16 distinct generator names');
  for(const r of fixture.relations){
    if(!Number.isInteger(r.degree)||r.degree<1||r.degree>0xfffffffe||!Array.isArray(r.terms)||!r.terms.length)throw new Error('Use homogeneous relations of positive word degree (32-bit degree indices)');
    for(const t of r.terms){
      if(!Array.isArray(t.word)||t.word.length!==r.degree||t.word.some(x=>!Number.isInteger(x)||x<0||x>=vars.length))throw new Error('Invalid generator or nonhomogeneous relation');
      if(!/^-?\d+$/.test(String(t.coefficient)))throw new Error('Input coefficients must be integers (clear rational denominators first)');
      const c=BigInt(t.coefficient);
      if(!c||c>4611686018427387903n||c< -4611686018427387903n)throw new Error('Input coefficient exceeds the nonzero signed 63-bit ABI; internal arithmetic is arbitrary precision');
    }
  }
}
export class FomkyrEngine {
  constructor(options={}){this.options=options;this.pool=[];this.active=false;this.closed=false;this.lastCheckpoint=null;this.scheduler={epochs:0,dispatchedPairs:0,rpcMessages:0,reduceMs:0,commitMs:0,fallbacks:0};}
  emit(type,payload={}){this.options.onEvent?.({type,...payload});}
  slotFor(worker,lane){
    const slot={worker,pending:new Map(),serial:0,lane};
    worker.onmessage=({data:m})=>{const p=slot.pending.get(m.id);if(!p)return;slot.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error)):p.resolve(m.result);};
    worker.onerror=event=>{for(const p of slot.pending.values()){clearTimeout(p.timer);p.reject(new Error(event.message));}slot.pending.clear();};
    return slot;
  }
  rpc(slot,message,transfer=[]){
    this.scheduler.rpcMessages++;
    return new Promise((resolve,reject)=>{
      const id=++slot.serial;
      const timer=message.command==='init'?setTimeout(()=>{slot.pending.delete(id);reject(new Error('Worker initialization timed out'));},20000):null;
      slot.pending.set(id,{resolve,reject,timer});
      try{slot.worker.postMessage({...message,id},transfer);}catch(e){slot.pending.delete(id);clearTimeout(timer);reject(e);}
    });
  }
  publishProgress(force=false){
    if(this.options.progress===false||!this.tracker||!this.e||this.publishingProgress)return false;
    const now=performance.now();if(!force&&now-(this.lastProgressSent??-Infinity)<this.progressInterval)return false;
    this.publishingProgress=true;this.lastProgressSent=now;
    try{this.lastProgress=this.tracker.sample(readProgressCounters(this.e));this.lastProgress.hilbertReference=referenceSnapshot(this.e,this.hilbertReference);this.lastProgress.hilbertClosure=hilbertGap(this.e,this.hilbertClosure);this.lastProgress.conditionalOnExternalDimensions=this.hilbertClosure?.assumed??false;this.lastProgress.hilbertClosureEvent=this.hilbertClosure?.events.find(x=>x.degree===this.lastProgress.currentDegree)??null;this.lastProgress.cooperative=this.cooperativeStats();this.lastProgress.fkGate=this.fkGate?.snapshot();this.lastProgress.conditionalOnImportedFkDimensions=!!this.fkGate?.enabled;this.lastProgress.checkpoint=this.lastCheckpoint?{partial:!!this.lastCheckpoint.partial,currentDegree:this.lastCheckpoint.currentDegree,completedThroughDegree:this.lastCheckpoint.completedThroughDegree,retainedCommittedPairs:this.lastCheckpoint.retainedCommittedPairs,updatedAt:this.lastCheckpoint.updatedAt}:null;this.emit('progress',this.lastProgress);}
    catch(error){this.progressError=String(error.message??error);}finally{this.publishingProgress=false;}
    return true;
  }
  setPhase(phase,force=true){if(this.tracker)this.tracker.setPhase(phase);this.publishProgress(force);}
  warn(message){this.emit('warning',{message});(this.fallbacks??=[]).push(message);}
  async open(){
    const o=this.options;this.capabilities=browserCapabilities();
    const execution=o.execution??'auto';
    if(!['auto','multicore','single'].includes(execution))throw new Error('execution must be auto, multicore or single');
    const sharedAvailable=sharedMemoryAvailable();
    if(execution==='multicore'&&!sharedAvailable){const e=new Error('Multicore requires cross-origin isolation. Enable the project service worker or use execution:auto for the single-worker fallback.');e.code='ISOLATION_REQUIRED';throw e;}
    this.shared=execution!=='single'&&sharedAvailable;
    if(!this.shared&&execution==='auto')this.warn('Shared memory is unavailable: using the non-shared single-worker WASM build.');
    const requested=Math.floor(Math.min(Number(o.budgetBytes??512*MiB),HARD_BYTES)/65536)*65536;
    if(!Number.isFinite(requested)||requested<16*MiB)throw new Error('budgetBytes must be finite and >=16 MiB');
    let bits=o.bits==null||o.bits==='auto'?(requested>4_294_901_760?64:32):Number(o.bits);
    if(![32,64].includes(bits))throw new Error('bits must be auto, 32 or 64');
    for(;;){
      this.bits=bits;this.budget=Math.min(requested,bits===32?4_294_901_760:HARD_BYTES);
      try{
        this.memory=createMemory(bits,this.budget,this.shared);
        this.module=await loadKernel(bits,o.wasmURL,!this.shared);
        this.host=hostFor(this.memory,bits,this.budget,null,Infinity,true);
        this.e=(await WebAssembly.instantiate(this.module,this.host.imports)).exports;
        if(this.e.gn_abi()!==3||typeof this.e.gn_optimize!=='function'||typeof this.e.gn_word_cache!=='function'||typeof this.e.gn_progress_stat!=='function'||typeof this.e.gn_candidate_check!=='function'||typeof this.e.gn_local_rewrites!=='function'||typeof this.e.gn_pin_cache!=='function'||typeof this.e.gn_rational_rewrites!=='function'||typeof this.e.gn_modulus!=='function'||typeof this.e.gn_big_rational_heap!=='function'||typeof this.e.gn_legacy_big_division!=='function'||typeof this.e.gn_growing_rational!=='function'||typeof this.e.gn_row_reserve!=='function'||typeof this.e.gn_reserve_growth!=='function'||typeof this.e.gn_radix_queue!=='function'||typeof this.e.gn_memory_policy!=='function'||typeof this.e.gn_batch_retry!=='function'||typeof this.e.gn_frontier_export!=='function'||typeof this.e.gn_hilbert_gate_begin!=='function')throw new Error('Kernel/host API mismatch. Deploy matching fomkyr JS and WASM together.');
        break;
      }catch(error){
        if(bits!==64||o.strictCapabilities||o.wasmURL)throw error;
        this.warn(`memory64 could not be initialized (${error.message}); falling back to WASM32 with its lower memory budget.`);bits=32;
      }
    }
    this.requestedBudget=requested;
    const autoWorkerMiB=o.autoWorkerMiB??0;
    if(!Number.isInteger(autoWorkerMiB)||autoWorkerMiB<0||autoWorkerMiB>14304)throw new Error('autoWorkerMiB must be an integer from 0 to 14304');
    this.workers=computeWorkers(o.workers,{shared:this.shared,execution,
      ordinaryScratchBytes:planMemory(this.budget,1,o).ordinaryScratchBytes,
      minWorkerMiB:chooseMemoryPolicy(o)==='auto'?autoWorkerMiB:0,
      coordinator:(o.scheduler??'cooperative')==='cooperative'&&o.batchPairs!==0});
    if(!Number.isFinite(this.workers))throw new Error('Invalid worker count');
    this.memoryPlan=planMemory(this.budget,this.workers,o);
    this.scratch=this.memoryPlan.ordinaryScratchBytes;
    this.autoMemory=this.memoryPlan.policy==='auto';
    if(this.memoryPlan.ignoredManualWorkspaceSettings)this.warn('Automatic memory management overrides saved scratch/reserve values; switch to manual policy to use them.');
    this.emit('memory-plan',this.memoryPlan);
    this.batchPairs=o.batchPairs===0?0:Math.min(512,Math.max(1,Math.floor(o.batchPairs??this.workers*(this.autoMemory&&this.scratch/this.workers>=128*MiB?32:8))));
    if(!Number.isFinite(this.batchPairs))throw new Error('Invalid batchPairs');
    this.spill=o.spill!==false;this.runKey=String(o.runKey??`run-${crypto.randomUUID()}`);
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(this.runKey))throw new Error('Invalid runKey');
    this.ioMode='memory';this.brokerClients=[];
    if(this.spill){
      try{
        if(!navigator.storage?.getDirectory)throw new Error('OPFS is unavailable');
        this.releaseRunLock=await acquireRunLock(this.runKey);
        const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle(STORE,{create:true});
        this.directory=await dir.getDirectoryHandle(this.runKey,{create:true});
        try{this.lockHandle=await(await this.directory.getFileHandle('coordinator.lock',{create:true})).createSyncAccessHandle();}
        catch(error){if(error.name==='NoModificationAllowedError'){error.code='CACHE_BUSY';}throw error;}
        this.file=await this.directory.getFileHandle('basis.gnb',{create:true});
        if(this.workers>1){
          const choice=o.ioMode??'auto';if(!['auto','broker','direct'].includes(choice))throw new Error('Invalid ioMode');
          const direct=choice!=='broker'&&await probeUnsafeAccess(this.directory);
          this.ioMode=direct?'direct-unsafe':'broker-exclusive';
          if(!direct){
            const worker=new Worker(new URL('io-worker.js',import.meta.url),{type:'module'});
            this.broker=this.slotFor(worker,-1);const buffers=[],ports=[];
            for(let lane=0;lane<this.workers;lane++){
              const channel=new MessageChannel(),buffer=makeMailbox();
              buffers.push(buffer);ports.push(channel.port2);this.brokerClients.push({buffer,port:channel.port1});
            }
            await this.rpc(this.broker,{command:'init',file:this.file,buffers,ports},ports);
            this.handle=new BrokerHandle(this.brokerClients[0],o.ioTimeoutMs);
          }else this.handle=await this.file.createSyncAccessHandle({mode:'readwrite-unsafe'});
        }else{this.ioMode='exclusive';this.handle=await this.file.createSyncAccessHandle();}
        if(o.resume===false){
          this.handle.truncate(0);
          for(const name of ['checkpoint-0.json','checkpoint-1.json','partial-0.json','partial-1.json'])try{await this.directory.removeEntry(name);}catch(e){if(e.name!=='NotFoundError')throw e;}
        }
        const estimate=await navigator.storage.estimate(),remaining=Math.max(0,(estimate.quota??Infinity)-(estimate.usage??0));
        this.diskLimit=Math.min(Number(o.diskLimitBytes??Infinity),this.handle.getSize()+Math.floor(remaining*.85));
        if(Number.isNaN(this.diskLimit)||this.diskLimit<0)throw new Error('Invalid diskLimitBytes');
        this.emit('storage',{runKey:this.runKey,...estimate,persistent:await navigator.storage.persisted?.()??false,diskLimitBytes:this.diskLimit,ioMode:this.ioMode});
      }catch(error){
        if(error.code==='CACHE_BUSY'||o.resume===true||o.storageFallback===false)throw error;
        await this.closeStorage();this.spill=false;this.directory=null;this.file=null;this.ioMode='memory';
        this.warn(`Persistent OPFS storage unavailable (${error.message}); using bounded RAM without a persistent checkpoint.`);
      }
    }
    this.host.attach(this.handle,this.diskLimit??Infinity);
    try{
      // All shared instances must be instantiated BEFORE gn_init writes State.
      for(let lane=1;lane<this.workers;lane++){
        const worker=new Worker(new URL('lane.js',import.meta.url),{type:'module'});
        const slot=this.slotFor(worker,lane);this.pool[lane]=slot;
        const broker=this.ioMode==='broker-exclusive'?this.brokerClients[lane]:null;
        await this.rpc(slot,{command:'init',module:this.module,memory:this.memory,lane,bits:this.bits,budget:this.budget,file:broker?null:this.file,broker,ioTimeoutMs:o.ioTimeoutMs,diskLimit:this.diskLimit},broker?[broker.port]:[]);
      }
    }catch(error){
      for(const slot of this.pool.filter(Boolean)){for(const p of slot.pending.values())clearTimeout(p.timer);slot.worker.terminate();}this.pool=[];
      if(o.strictCapabilities)throw error;
      this.workers=1;this.warn(`Additional compute workers could not start (${error.message}); continuing on the coordinator lane.`);
    }
    this.emit('capabilities',{...this.capabilities,shared:this.shared,bits:this.bits,workers:this.workers,ioMode:this.ioMode,requestedBudgetBytes:requested,effectiveBudgetBytes:this.budget});
    return this;
  }
  requestCheckpoint(){this.checkpointRequested=true;}
  cancel(){this.cancelRequested=true;if(this.cancelView&&this.shared)Atomics.store(this.cancelView,0,1);else this.e?.gn_cancel(1);}
  async resetKernel(fixture,target,modulus){
    checked(this.e.gn_init(fixture.variables.length,target??0,this.workers,BigInt(this.budget),BigInt(this.scratch),(this.restoreHashBits??this.options.hashBits??18),modulus,this.spill?1:0));
    checked(this.e.gn_memory_policy(this.autoMemory?1:0));
    checked(this.e.gn_rational_heap(this.options.rationalHeap!==false?1:0));
    checked(this.e.gn_big_rational_heap(this.options.bigRationalHeap!==false?1:0));
    const bigRowMaxTerms=this.options.bigRowMaxTerms??0;
    if(!Number.isInteger(bigRowMaxTerms)||bigRowMaxTerms<0||bigRowMaxTerms>1073741824||(bigRowMaxTerms&&(bigRowMaxTerms<128||(bigRowMaxTerms&(bigRowMaxTerms-1)))))throw new Error('bigRowMaxTerms must be 0 (automatic) or a power of two from 128 to 1073741824');
    if(typeof this.e.gn_big_row_limit!=='function')throw new Error('Kernel/host API mismatch: big-row capacity option missing');
    checked(this.e.gn_big_row_limit(bigRowMaxTerms));
    checked(this.e.gn_legacy_big_division(this.options.fastBigDivision===false?1:0));
    checked(this.e.gn_growing_rational(this.options.growingRationalHeap!==false?1:0));
    if(this.e.gn_rational_rewrites)checked(this.e.gn_rational_rewrites(this.options.rationalRewrites!==false?1:0));
    const pin=sharedCacheAllowance(this.options.sharedReducerCacheBytes,this.memoryPlan);
    if(this.options.sharedReducerCacheBytes!=null&&pin<this.options.sharedReducerCacheBytes)this.warn(`Shared reducer cache reduced to ${Math.floor(pin/MiB)} MiB to fit the effective automatic memory plan.`);
    const local=this.options.rewriteBudgetBytes??Math.min(this.budget/16,8*MiB);
    for(const [name,value] of [['sharedReducerCacheBytes',pin],['rewriteBudgetBytes',local]])if(!Number.isSafeInteger(value)||value<0)throw new Error(`${name} must be a nonnegative integer`);
    const localDegree=this.options.rewriteDegree??4,localSupport=this.options.rewriteSupport??8;
    if(![2,3,4].includes(localDegree)||!Number.isInteger(localSupport)||localSupport<1||localSupport>64)throw new Error('Rewrite degree must be 2..4 and rewrite support must be 1..64');
    checked(this.e.gn_pin_cache(BigInt(pin)));
    checked(this.e.gn_local_rewrites(this.options.compiledRewrites===false?0:localDegree,BigInt(local),localSupport));
    checked(this.e.gn_tune((this.options.monomialPruning!==false?1:0)|(this.options.heapReduction!==false?2:0),this.options.cachePercent??12,this.options.heapThreshold??16));
    checked(this.e.gn_optimize((this.options.wordMatcher!==false?1:0)|(this.options.chainCriterion!==false?2:0)|(this.options.progress!==false?4:0)|(this.options.eagerPruning!==false?8:0)|(this.options.quadraticRewrite!==false?16:0)|(this.options.costScheduling!==false?32:0),BigInt(this.options.matcherBudgetBytes??Math.min(this.budget/16,64*MiB))));
    checked(this.e.gn_word_cache(this.options.wordCacheEntries??256));
    if(this.e.gn_radix_queue)checked(this.e.gn_radix_queue(this.options.radixHeap!==false?1:0));
    if(this.e.gn_reserve_growth)checked(this.e.gn_reserve_growth(this.options.reserveInPlace===false?0:1));
    if(this.e.gn_row_reserve){
      const reserve=this.memoryPlan.rowReserveBytes;
      if(!Number.isSafeInteger(reserve)||reserve<0)throw new Error('rowReserveBytes must be a nonnegative integer');
      checked(this.e.gn_row_reserve(BigInt(reserve)));
    }
    if(this.batchPairs)checked(this.e.gn_batch_mode(1));
    if(!['cooperative','barrier'].includes(this.options.scheduler??'cooperative'))throw new Error('scheduler must be cooperative or barrier');
    this.cooperative=this.batchPairs>0&&this.options.scheduler!=='barrier'&&!!this.e.gn_cooperative;
    const quantum=this.options.quantumMs??250,lookahead=this.options.lookahead??Math.max(this.batchPairs,128);
    if(!Number.isInteger(quantum)||quantum<1||quantum>10000||!Number.isInteger(lookahead)||lookahead<1||lookahead>512)throw new Error('Invalid cooperative quantum/lookahead');
    this.lookahead=lookahead;
    const maxLookahead=this.options.maxLookahead??512;
    if(!Number.isInteger(maxLookahead)||maxLookahead<1||(this.options.elasticWindow!==false&&maxLookahead<lookahead)||maxLookahead>512)throw new Error('maxLookahead must be between lookahead and 512 when elastic scheduling is enabled');
    if(this.e.gn_radix_cache)checked(this.e.gn_radix_cache(this.options.radixMaxCache===false?0:1));
    if(this.e.gn_cooperative){checked(this.e.gn_cooperative(this.cooperative?quantum:0,lookahead));if(this.cooperative&&!Number(this.e.gn_coop_stat(0))){this.cooperative=false;this.emit('scheduler-fallback',{reason:'Workspace too small for a separate commit arena; retaining the legacy exact scheduler',scheduler:'barrier'});}}
    if(this.e.gn_coop_policy)checked(this.e.gn_coop_policy((this.options.elasticWindow===false?0:1)|(this.options.sectorPriority===false?0:2),maxLookahead));
    if(this.cooperative){const each=Number(this.e.gn_coop_stat(11));this.memoryPlan={...this.memoryPlan,initialBytesPerLane:each,commitWorkspaceBytes:each,scheduler:'cooperative'};}else this.memoryPlan={...this.memoryPlan,commitWorkspaceBytes:0,scheduler:'barrier'};
    this.fkGate?.bind(this.e,this.memory);
    this.cancelView=new Int32Array(this.memory.buffer,Number(this.e.gn_cancel_ptr()),1);
    this.emit('control',this.shared?{memory:this.memory,cancelOffset:Number(this.e.gn_cancel_ptr()),runKey:this.runKey,shared:true}:{runKey:this.runKey,shared:false,cancellation:'worker-message'});
    await Promise.all(this.pool.filter(Boolean).map(s=>this.rpc(s,{command:'stack'})));
  }
  async restore(cp,{truncate=true}={}){
    const header=new Uint8Array(32),dv=new DataView(header.buffer);let off=0;
    for(let i=0;i<cp.basisSize;i++){
      if(off+32>cp.diskBytes||this.handle.read(header,{at:off})!==32)throw new Error('Truncated record header');
      const size=dv.getUint32(4,true);
      if(size<56||off+size>cp.diskBytes)throw new Error('Invalid checkpoint record extent');
      // Restore is a quiescent boundary: no lane holds an active polynomial.
      // Already imported rules own permanent records, so re-partitioning scratch
      // here cannot invalidate them. Do not ask the user to tune an I/O arena.
      while(size>this.e.gn_import_capacity()&&this.autoMemory&&this.workers>1){
        const before=this.workers;this.workers=Math.max(1,Math.floor(before/2));
        checked(this.e.gn_workers(this.workers));
        this.emit('memory-adaptation',{reason:'checkpoint row capacity',previousWorkers:before,
          workers:this.workers,scratchBytes:this.scratch,bytesPerLane:Math.floor(this.scratch/this.workers),
          replay:'none: completed checkpoint records are retained',budgetBytes:this.budget});
      }
      if(size>this.e.gn_import_capacity())throw new Error(this.autoMemory?'Checkpoint row exceeds the available single-lane workspace; raise the overall memory ceiling':'Checkpoint row exceeds the manual I/O workspace');
      const ptr=this.e.gn_import_buffer();
      if(!this.host.imports.host.read(BigInt(off),ptr,size))throw new Error('Checkpoint read failed');
      checked(this.e.gn_restore_rule(size,BigInt(off)));off+=size;
    }
    if(off!==cp.diskBytes)throw new Error('Checkpoint byte count mismatch');
    if(cp.partial){
      const bytes=Uint8Array.from(cp.frontier.match(/../g),x=>parseInt(x,16));
      if(bytes.length>this.e.gn_import_capacity())throw new Error('Frontier exceeds import workspace');
      new Uint8Array(this.memory.buffer,Number(this.e.gn_import_buffer()),bytes.length).set(bytes);
      checked(this.e.gn_frontier_restore(bytes.length));
      this.restoredPending=this.e.gn_frontier_pending();
      if(this.restoredPending&&!this.batchPairs){this.batchPairs=1;this.warn('Restored outstanding descriptors use the bounded-batch scheduler.');}
    }else checked(this.e.gn_restored_through(cp.completedThroughDegree));
    if(this.hilbertClosure)this.hilbertClosure.events=[...(cp.hilbertClosureEvents??[])];
    this.lastCheckpoint=cp;this.checkpointSequence=Math.max(this.checkpointSequence??0,cp.sequence??0);
    // Cache-only lower-degree requests MUST NOT destroy a newer partial frontier.
    if(truncate)this.handle.truncate(off);
  }
  async checkpoint(identity){
    if(!this.directory)return;
    const cp={abi:this.fkGate?.enabled?5:this.hilbertClosure?4:3,...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata(),version:VERSION,identity,...stats(this.e),partial:false,sequence:++this.checkpointSequence,runKey:this.runKey,updatedAt:new Date().toISOString(),cumulativeElapsedMs:(this.priorElapsedMs??0)+performance.now()-this.sessionStart};
    this.handle.flush();
    await writeJSON(this.directory,`checkpoint-${cp.completedThroughDegree%2}.json`,cp,{checkpoint:true});this.lastCheckpoint=cp;
    this.safePoint=null;this.lastDurableAt=performance.now();
    this.emit('checkpoint',{partial:false,completedThroughDegree:cp.completedThroughDegree,basisSize:cp.basisSize,diskBytes:cp.diskBytes});
  }
  captureSafePoint(){
    if(this.verifyingCandidate||!this.directory||this.options.midDegreeCheckpoints===false||!this.e.gn_stat(3)||((this.hilbertClosure||this.fkGate?.enabled)&&this.e.gn_hilbert_gate_stat(3)))return;
    const ptr=this.e.gn_frontier_export();if(!ptr)throw new Error('Kernel refused a non-quiescent checkpoint frontier');
    const bytes=new Uint8Array(this.memory.buffer,Number(ptr),this.e.gn_frontier_size());
    const text=new Uint8Array(bytes.length*2);for(let i=0;i<bytes.length;i++){text[2*i]=hexDigits[bytes[i]>>>4];text[2*i+1]=hexDigits[bytes[i]&15];}const frontier=hexDecoder.decode(text);
    this.safePoint={abi:this.fkGate?.enabled?5:this.hilbertClosure?4:3,...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata(),version:VERSION,identity:this.identityHash,basisSize:Number(this.e.gn_stat(0)),terms:Number(this.e.gn_stat(1)),completedThroughDegree:Number(this.e.gn_stat(2)),currentDegree:Number(this.e.gn_stat(3)),diskBytes:Number(this.e.gn_stat(6)),partial:true,
      frontier,hilbertReference:referenceSnapshot(this.e,this.hilbertReference),hashBits:this.e.gn_frontier_hash_bits(),retainedCommittedPairs:Number(this.e.gn_progress_stat(2)),
      resolvedOverlaps:Number(this.e.gn_progress_stat(2)+this.e.gn_progress_stat(4)+this.e.gn_progress_stat(5)),
      totalOverlaps:Number(this.e.gn_progress_stat(0)),pendingPairs:this.e.gn_frontier_pending(),
      runKey:this.runKey,updatedAt:new Date().toISOString(),sessionElapsedMs:performance.now()-this.sessionStart,
      cumulativeElapsedMs:(this.priorElapsedMs??0)+performance.now()-this.sessionStart};
  }
  async persistSafePoint(force=false){
    if(!this.safePoint||!this.directory)return;
    const now=performance.now();if(!force&&!this.checkpointRequested&&now-(this.lastDurableAt??0)<this.checkpointInterval)return;
    const cp={...this.safePoint,sequence:++this.checkpointSequence,sessionElapsedMs:now-this.sessionStart,cumulativeElapsedMs:(this.priorElapsedMs??0)+now-this.sessionStart,updatedAt:new Date().toISOString()};
    // The file is append-only. A safe prefix may precede a cancelled/failed write.
    this.handle.flush();
    await writeJSON(this.directory,`partial-${cp.sequence%2}.json`,cp,{checkpoint:true});
    this.lastCheckpoint=cp;this.lastDurableAt=performance.now();this.checkpointRequested=false;
    this.emit('checkpoint',{partial:true,currentDegree:cp.currentDegree,completedThroughDegree:cp.completedThroughDegree,
      retainedCommittedPairs:cp.retainedCommittedPairs,resolvedOverlaps:cp.resolvedOverlaps,totalOverlaps:cp.totalOverlaps,
      pendingPairs:cp.pendingPairs,basisSize:cp.basisSize,diskBytes:cp.diskBytes,sequence:cp.sequence,hilbertReference:cp.hilbertReference});
  }
  async shrinkAndReplay(){
    if(this.workers<=1)return false;
    this.workers=Math.max(1,Math.floor(this.workers/2));
    checked(this.e.gn_workers(this.workers));checked(this.e.gn_rewind_degree());
    this.emit('stdout',{text:`Scratch pressure: ${this.workers} active lanes; replaying degree ${Number(this.e.gn_stat(3))}.\n`});return true;
  }
  fallbackEpoch(){
    checked(this.e.gn_batch_fallback());checked(this.e.gn_rewind_degree());this.batchPairs=0;this.scheduler.fallbacks++;
    this.emit('stdout',{text:'Bounded batch output/scratch exhausted: using the lower-memory single-pair scheduler and replaying this degree.\n'});
  }
  retryWorkspace(first,reason){
    if(!this.autoMemory||this.workers<=1)return false;
    const before=this.workers,after=Math.max(1,Math.floor(before/2));
    checked(this.e.gn_batch_retry(after,first));this.workers=after;
    this.scheduler.memoryRetries=(this.scheduler.memoryRetries??0)+1;
    this.emit('memory-adaptation',{reason,previousWorkers:before,workers:after,
      scratchBytes:this.scratch,bytesPerLane:Math.floor(this.scratch/after),
      replayFromTask:first,replay:'pending-batch-suffix-only',budgetBytes:this.budget});
    return true;
  }
  checkHilbertClosure(){
    if(this.fkGate?.active()){
      const gateEvent=this.fkGate.tryClose();
      if(gateEvent)this.emit('fk-gate-degree-closure',{...gateEvent,...this.fkGate.metadata()});
      return !!this.e.gn_hilbert_gate_stat(3);
    }
    const event=tryHilbertClosure(this.e,this.hilbertClosure);
    if(event)this.emit('hilbert-degree-closure',{...event,...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata()});
    return !!((this.hilbertClosure||this.fkGate?.enabled)&&this.e.gn_hilbert_gate_stat(3));
  }
  async executeBatch(n){
    let first=0;
    for(;;){
      let start=performance.now();const pending=[];
      for(let lane=1;lane<this.workers&&lane<n-first;lane++)pending.push(this.rpc(this.pool[lane],{command:'batch'}));
      this.setPhase('reducing',false);const local=this.e.gn_batch_reduce(0);
      const remote=await Promise.all(pending);checked(local);remote.forEach(checked);
      this.scheduler.reduceMs+=performance.now()-start;
      const rcs=Array.from({length:n-first},(_,i)=>this.e.gn_batch_status(i+first));
      rcs.filter(rc=>![2,8,11,12].includes(rc)).forEach(checked);
      if(rcs.some(rc=>[2,8,12].includes(rc))){
        if(this.retryWorkspace(first,'active row or pending-output capacity'))continue;
        if(rcs.includes(12))checked(2);this.fallbackEpoch();return;
      }
      this.setPhase('committing',false);start=performance.now();let retry=false;
      for(let i=first;i<n;i++){
        const rc=this.e.gn_batch_commit(i);
        if([2,8,12].includes(rc)){
          if(this.retryWorkspace(i,'ordered commit workspace')){first=i;retry=true;break;}
          if(rc===12)checked(2);this.fallbackEpoch();return;
        }
        checked(rc);
        if((this.hilbertClosure||this.fkGate?.enabled)&&this.checkHilbertClosure())return;
        if(this.directory&&(this.checkpointRequested||performance.now()-(this.lastDurableAt??0)>=this.checkpointInterval)){this.captureSafePoint();await this.persistSafePoint();}
      }
      this.scheduler.commitMs+=performance.now()-start;
      if(!retry)return;
    }
  }
  // MessageChannel yields a real host task in a single worker without a busy
  // spin or an unconditional zero-delay timer after every multicore wave.
  async yieldControl(){
    if(this.workers>1)return; // worker replies already crossed a host-task boundary
    if(typeof MessageChannel==='undefined'){await new Promise(r=>setTimeout(r,0));return;}
    if(!this.yieldChannel){this.yieldChannel=new MessageChannel();this.yieldChannel.port1.onmessage=()=>{const r=this.yieldResolver;this.yieldResolver=null;r?.();};}
    await new Promise(resolve=>{this.yieldResolver=resolve;this.yieldChannel.port2.postMessage(0);});
  }
  cooperativeStats(){
    if(!this.e?.gn_coop_stat)return null;const get=k=>Number(this.e.gn_coop_stat(k));
    return {quantumMs:get(0),epochs:get(1),started:get(2),finished:get(3),committed:get(4),nonprefixCommits:get(5),capacityReplayPairs:get(6),pending:get(7),commitRewrites:get(8),reserveDeferredAttempts:get(12),window:get(13),windowExpansions:get(14),sectorOrderings:get(15),policyFlags:get(16),maxWindow:get(17),parkedCommit:get(18),commitYields:get(19),commitResumes:get(20),preparedCommitSlices:get(21),
      lanes:Array.from({length:Number(this.e.gn_memory_stat(1))},(_,i)=>({activeMicroseconds:get(100+i),maxSliceMicroseconds:get(200+i),yields:get(300+i),resumes:get(400+i),parkedTask:get(500+i)}))};
  }
  async completeCooperativeDegree(){
    for(;;){
      if((this.hilbertClosure||this.fkGate?.enabled)&&this.e.gn_hilbert_gate_stat(3)){this.e.gn_coop_discard();return;}
      if(this.cancelRequested)checked(5);
      const n=this.e.gn_coop_fill(this.lookahead);if(n<0)checked(n);if(!n)return;
      this.scheduler.epochs++;this.captureSafePoint();await this.persistSafePoint();
      const start=performance.now(),pending=[];
      for(let lane=1;lane<this.workers;lane++)pending.push(this.rpc(this.pool[lane],{command:'cooperative'}));
      this.setPhase('reducing',false);const local=this.e.gn_coop_reduce(0),prepared=!local&&this.e.gn_coop_prepare_commit?this.e.gn_coop_prepare_commit():0,remote=await Promise.all(pending);
      checked(local);checked(prepared);remote.forEach(checked);this.scheduler.reduceMs+=performance.now()-start;
      this.setPhase('committing',false);const commitStart=performance.now(),rc=this.e.gn_coop_commit();
      this.scheduler.commitMs+=performance.now()-commitStart;
      if([2,8,12].includes(rc)&&this.autoMemory&&this.workers>1){
        const before=this.workers;this.workers=Math.max(1,Math.floor(before/2));checked(this.e.gn_coop_retry(this.workers));
        this.emit('memory-adaptation',{reason:'cooperative active-row capacity',previousWorkers:before,workers:this.workers,replay:'uncommitted-descriptors-only',budgetBytes:this.budget});
      }else checked(rc);
      if((this.hilbertClosure||this.fkGate?.enabled)&&this.checkHilbertClosure()){this.e.gn_coop_discard();return;}
      this.captureSafePoint();await this.persistSafePoint();this.publishProgress(false);
      await this.yieldControl();
    }
  }
  async completeDegree(){
    if(this.cooperative)return this.completeCooperativeDegree();
    let lastYield=performance.now();
    for(;;){
      if((this.hilbertClosure||this.fkGate?.enabled)&&this.e.gn_hilbert_gate_stat(3))break;
      if(this.cancelRequested)checked(5);
      this.captureSafePoint();await this.persistSafePoint();
      if(performance.now()-lastYield>40){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}
      if(this.batchPairs){
        const limit=this.hilbertClosure&&this.options.hilbertClosureBatching!==false?closureBatchLimit(this.e,this.batchPairs,this.workers):this.batchPairs;
        const n=this.e.gn_batch_fill(limit);if(n<0)checked(n);if(!n)break;
        this.scheduler.epochs++;this.scheduler.dispatchedPairs+=n;
        this.captureSafePoint();await this.persistSafePoint();
        await this.executeBatch(n);

      }else{
        const batch=[];
        for(let lane=0;lane<this.workers;lane++){const rc=this.e.gn_next_pair(lane);if(rc<0)checked(rc);if(!rc)break;batch.push(lane);}
        if(!batch.length)break;
        this.scheduler.epochs++;this.scheduler.dispatchedPairs+=batch.length;
        let start=performance.now();
        const pending=batch.slice(1).map(lane=>this.rpc(this.pool[lane],{command:'reduce'}));
        this.setPhase('reducing',false);const rcs=[this.e.gn_reduce_pair(0),...await Promise.all(pending)];
        this.scheduler.reduceMs+=performance.now()-start;
        if(rcs.includes(2)&&await this.shrinkAndReplay())continue;
        for(let i=0;i<rcs.length;i++)if(rcs[i]===11)rcs[i]=this.e.gn_reduce_pair(batch[i]);
        rcs.forEach(checked);
        this.setPhase('committing',false);let replay=false;start=performance.now();
        for(const lane of batch){const rc=this.e.gn_commit(lane);if(rc===2&&await this.shrinkAndReplay()){replay=true;break;}checked(rc);if((this.hilbertClosure||this.fkGate?.enabled)&&this.checkHilbertClosure())break;}
        this.scheduler.commitMs+=performance.now()-start;if(replay)continue;
      }
      this.publishProgress(false);
    }
  }
  async compute(fixture,target=20,modulus=0){
    if(this.active||this.closed)throw new Error('Engine is busy or closed');
    this.active=true;const start=performance.now();this.sessionStart=start;let timer,progressTimer;
    this.safePoint=null;this.hilbertReference=null;this.checkpointSequence=0;this.checkpointInterval=Number(this.options.checkpointIntervalMs??30000);
    if(!Number.isFinite(this.checkpointInterval)||this.checkpointInterval<0){this.active=false;throw new Error('checkpointIntervalMs must be nonnegative');}
    this.lastDurableAt=start;
    this.progressInterval=Number(this.options.progressIntervalMs??1000);
    if(!Number.isFinite(this.progressInterval)||this.progressInterval<250||this.progressInterval>60000){this.active=false;throw new Error('progressIntervalMs must be 250..60000');}
    this.tracker=new ProgressTracker({target});
    try{
      validateFixture(fixture);
      if(target!==null&&(!Number.isInteger(target)||target<1||target>0xfffffffe))throw new Error('Degree must be a positive 32-bit index, or null for completion without a user degree bound');
      if(!Number.isInteger(modulus)||modulus<0||modulus>2147483647)throw new Error('Invalid coefficient characteristic');
      const identity=await identityOf(fixture,modulus);this.identityHash=identity;
      this.hilbertClosure=await prepareHilbertClosure(this.options.hilbertClosure,identity,modulus);
      this.fkGate=new FkGate(this.options,identity,modulus);
      if(this.options.hilbertGate&&!this.fkGate.enabled)this.emit('warning',{message:'FK Gate is unavailable for this input/order/field; ordinary exact completion retained.'});
      if(!this.options.runKey)this.options.runKey=`alg-${identity}`;
      if(!this.e)await this.open();
      const allCandidates=this.directory&&this.options.resume!==false?await checkpointCandidates(this.directory,identity,this.handle.getSize(),this.hilbertClosure?.key,this.fkGate?.enabled?FK_GATE_PROFILE_ID:null):[];
      const preserveNewerPartial=allCandidates.some(cp=>cp.partial&&target!==null&&target<cp.currentDegree);
      const candidates=allCandidates.filter(cp=>!cp.partial||target===null||target>=cp.currentDegree);
      this.restoreHashBits=candidates[0]?.partial?candidates[0].hashBits:null;
      if(!candidates.length&&this.directory&&this.options.resume!==false&&(this.handle.getSize()>0||this.options.resume===true)){
        const error=new Error('No valid matching checkpoint; cache left unchanged. Use a different runKey or explicitly resume:false to reset it.');error.code='CACHE_INVALID';throw error;
      }
      const kernelTarget=target===null?null:Math.max(target,candidates[0]?.currentDegree??0,candidates[0]?.completedThroughDegree??0);
      await this.resetKernel(fixture,kernelTarget,modulus);
      let restored=0,restoreError=null;
      for(const cp of candidates){
        try{
          if(cp.partial&&this.restoreHashBits!==cp.hashBits){this.restoreHashBits=cp.hashBits;await this.resetKernel(fixture,kernelTarget,modulus);}
          await this.restore(cp,{truncate:!preserveNewerPartial});restored=cp.completedThroughDegree;
          this.priorElapsedMs=cp.cumulativeElapsedMs??0;restoreError=null;break;
        }
        catch(error){restoreError=error;await this.resetKernel(fixture,kernelTarget,modulus);this.emit('warning',{message:`Rejected checkpoint degree ${cp.completedThroughDegree}: ${error.message}`});}
      }
      if(restoreError)throw restoreError;
      replayHilbertCertificate(this.e,fixture,this.hilbertClosure,this.budget);
      if(this.directory&&this.hilbertClosure)await writeJSON(this.directory,'hilbert-evidence.json',this.hilbertClosure.data);
      this.emit('cache',{runKey:this.runKey,resumedFromDegree:restored,resumedPartial:this.lastCheckpoint?.partial?{currentDegree:this.lastCheckpoint.currentDegree,retainedCommittedPairs:this.lastCheckpoint.retainedCommittedPairs,pendingPairs:this.lastCheckpoint.pendingPairs}:null,cacheHit:target!==null&&restored>=target});
      this.tracker.completed=restored;this.tracker.degree=restored;
      if(this.options.progress!==false){
        this.host.setPulse(()=>this.publishProgress(false),this.progressInterval);
        progressTimer=setInterval(()=>this.publishProgress(false),this.progressInterval);
      }
      if(this.options.timeoutMs>0){timer=setTimeout(()=>this.cancel(),this.options.timeoutMs);this.e.gn_deadline(performance.timeOrigin+performance.now()+this.options.timeoutMs);}
      const lastInputDegree=fixture.relations.reduce((n,r)=>Math.max(n,r.degree),0);
      const globallyComplete=()=>Number(this.e.gn_stat(2))>=lastInputDegree&&BigInt(this.e.gn_stat(2))>=this.e.gn_completion_bound();
      let lastYield=performance.now();
      for(let degree=Number(this.e.gn_stat(2))+1;degree<=(target??0xfffffffe);degree++){
        if(target===null&&globallyComplete())break;
        if(this.cancelRequested)checked(5);
        if(performance.now()-lastYield>40){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}
        this.tracker.begin(degree,Number(this.e.gn_stat(2)));this.setPhase('input');
        if(!Number(this.e.gn_stat(3))){
        for(const r of fixture.relations)if(r.degree===degree){
          checked(this.e.gn_input_begin(degree,r.terms.length));
          for(const t of r.terms){
            if(t.word.length<=31){const [lo,hi]=wordCode(t.word);checked(this.e.gn_input_term(lo,hi,BigInt(t.coefficient)));}
            else{
              if(t.word.length>this.e.gn_import_capacity())checked(2);
              new Uint8Array(this.memory.buffer,Number(this.e.gn_import_buffer()),t.word.length).set(t.word);
              checked(this.e.gn_input_bytes(t.word.length,BigInt(t.coefficient)));
            }
          }
          checked(this.e.gn_input_end());
        }
        this.setPhase('indexing');checked(this.e.gn_start_degree(degree));
        }
        this.hilbertReference=beginReference(this.e,identity,this.options.referenceProgress!==false,Math.min(256*MiB,Math.max(0,this.budget-Number(this.e.gn_stat(4)))));
        if(this.hilbertReference)this.emit('hilbert-reference',referenceSnapshot(this.e,this.hilbertReference));
        const gate=beginHilbertClosure(this.e,this.hilbertClosure,this.budget);
        if(gate?.declined)this.emit('warning',{message:'Hilbert closure capacity declined; ordinary exact completion continues.'});
        this.fkGate?.begin();
        if(this.fkGate?.enabled)this.emit('fk-gate-state',this.fkGate.snapshot());
        if(this.hilbertClosure||this.fkGate?.enabled)this.checkHilbertClosure();
        this.captureSafePoint();await this.persistSafePoint();
        this.setPhase('reducing');
        if((this.hilbertClosure||this.fkGate?.enabled)&&this.e.gn_hilbert_gate_stat(3))this.restoredPending=0;
        if(this.restoredPending&&!this.e.gn_hilbert_gate_stat(3)&&!this.cooperative){const n=this.restoredPending;this.restoredPending=0;await this.executeBatch(n);}
        await this.completeDegree();
        if(this.fkGate?.enabled&&this.e.gn_fg_status()===1)checked(10);
        checked(this.e.gn_finish_degree());this.setPhase('checkpoint');await this.checkpoint(identity);
        this.tracker.finish(degree,readProgressCounters(this.e));this.publishProgress(true);
        this.emit('degree',{...stats(this.e),elapsedMs:performance.now()-start,scheduler:{...this.scheduler}});
      }
      if(target===null&&!globallyComplete())checked(9);
      const certified=target??Number(this.e.gn_stat(2));
      const hilbertDegree=this.options.hilbertDegree??certified;
      let hilbert=null;
      if(this.options.hilbert!==false){
        this.setPhase('hilbert');try{
        if(!Number.isInteger(hilbertDegree)||hilbertDegree<0||hilbertDegree>0xfffffffe||hilbertDegree>Number(this.e.gn_stat(2))&&!globallyComplete())throw new Error('Hilbert degree must be completed by the GB calculation, unless a finite complete GB has been proved');

          const available=Math.max(0,this.budget-Number(this.e.gn_stat(4)));
          const extra=Math.min(available,Number(this.options.hilbertBudgetBytes??256*MiB));
          if(!Number.isFinite(extra)||extra<0)throw new Error('Invalid Hilbert workspace budget');
          hilbert=computeHilbert(this.e,hilbertDegree,extra,this.options.hilbertOutputBudgetBytes);
          hilbert.basisCompletionProved=globallyComplete();
          hilbert.certification=globallyComplete()?'complete-basis':'degree-truncated-basis';
        }catch(error){
          if(error.code==='CANCELLED'||this.options.hilbertRequired)throw error;
          hilbert={available:false,error:error.message,certifiedThroughDegree:null};this.emit('warning',{message:`GB completed; Hilbert calculation unavailable: ${error.message}`});
        }
      }
      if(hilbert&&this.fkGate?.enabled){Object.assign(hilbert,this.fkGate.metadata());hilbert.validity='Conditional on the explicitly imported FK Gate dimension profile; proof bundle not replayed here.';}
      if(hilbert&&this.hilbertClosure){Object.assign(hilbert,hilbertMetadata(this.hilbertClosure));if(this.hilbertClosure.assumed)hilbert.validity='Conditional on explicitly assumed external dimensions. No independent replay proof of those dimensions is claimed.';}
      const result={...stats(this.e),...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata(),engine:'fomkyr',version:VERSION,memoryPlan:this.memoryPlan,storage:this.spill?'opfs':'memory',complete:true,unrestrictedBasisComplete:globallyComplete(),reduced:false,target,modulus,order:'degleftlex',runKey:this.runKey,identity,bits:this.bits,shared:this.shared,ioMode:this.ioMode,executionMode:`wasm${this.bits}-${this.shared?'shared':'single'}`,fallbacks:this.fallbacks??[],requestedBudgetBytes:this.requestedBudget,hostMailboxBytes:this.brokerClients.length*(IO_HEADER+IO_CHUNK),linearMemoryBytes:this.memory.buffer.byteLength,resumedFromDegree:restored,cacheHit:target!==null&&restored>=target,hilbert:hilbert?{...hilbert,...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata()}:hilbert,scheduler:{...this.scheduler},cooperative:this.cooperativeStats(),lanePairs:Array.from({length:this.workers},(_,i)=>Number(this.e.gn_lane_stat(i,6))),elapsedMs:performance.now()-start};
      if(this.options.exportText!==false){this.setPhase('export');Object.assign(result,await this.exportText(fixture.variables));}
      result.degreeTimings=[...this.tracker.history];result.progressError=this.progressError??null;
      if(this.directory){
        if(hilbert)await writeJSON(this.directory,'hilbert.json',{...hilbert,...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata()});
        if(hilbert?.coefficients)await this.writeSmallText('hilbert.csv',hilbertCSV(hilbert));
        const {preview,...metadata}=result;await writeJSON(this.directory,'fomkyr-result.json',metadata);
      }
      this.setPhase('done');result.progress=this.lastProgress??null;result.degreeTimings=[...this.tracker.history];result.progressError=this.progressError??null;return result;
    }catch(error){
      // Readers are joined by executeBatch before algebra errors propagate. Persist
      // the last SUCCESSFUL quiescent prefix, never arbitrary mutable error state.
      try{if(this.cooperative){this.e.gn_coop_discard();this.captureSafePoint();}await this.persistSafePoint(true);}catch(checkpointError){error.checkpointError=checkpointError.message;}
      error.native=this.e?{...stats(this.e),...hilbertMetadata(this.hilbertClosure),...this.fkGate?.metadata(),complete:false,cooperative:this.cooperativeStats(),lastCheckpoint:this.lastCheckpoint,runKey:this.runKey}:null;
      if(this.host?.lastIOError)error.message+=`: ${this.host.lastIOError.message}`;throw error;
    }finally{clearTimeout(timer);clearInterval(progressTimer);this.host?.setPulse(null);this.active=false;}
  }
  async writeSmallText(name,text){
    const bytes=enc.encode(text),h=await(await this.directory.getFileHandle(name,{create:true})).createSyncAccessHandle();
    try{h.truncate(0);if(h.write(bytes,{at:0})!==bytes.length)throw new Error('Short text write');h.flush();}finally{h.close();}
  }
  async exportText(variables) {
    const e=this.e;let preview='',previewTruncated=false,used=0,currentDegree=0,textOffset=0;
    const cap=Math.min(Number(this.options.previewBytes??1024*1024),1024*1024);
    const degreeCounts=new Map();
    let handle=null;
    if(this.directory){handle=await (await this.directory.getFileHandle('result.gb',{create:true})).createSyncAccessHandle();handle.truncate(0);}
    // Stream each term. A giant polynomial never becomes one giant JS string.
    let buffer='';
    const flush=()=>{if(handle&&buffer){const b=enc.encode(buffer);let done=0;while(done<b.length){const n=handle.write(b.subarray(done),{at:textOffset+done});if(!n)throw new Error('Short export write');done+=n;}textOffset+=b.length;}buffer='';};
    const emit=(text,allowPreview=true)=>{if(handle){buffer+=text;if(buffer.length>=32768)flush();}if(allowPreview&&!previewTruncated){if(used+text.length>cap){previewTruncated=true;}else{preview+=text;used+=text.length;}}};
    try {
      emit(`% fomkyr; completed through degree ${Number(e.gn_stat(2))}; not a claim of a finite complete GB\n`);
      if(this.hilbertClosure)emit(`% Hilbert evidence ${this.hilbertClosure.key}; ${this.hilbertClosure.assumed?'CONDITIONAL ON EXTERNAL DIMENSIONS':'exact integer-dual witnesses replayed'}\n`);
      if(this.fkGate?.enabled)emit(`% FK Gate ${FK_GATE_PROFILE_ID}; CONDITIONAL ON IMPORTED FK DIMENSIONS; proof not replayed here\n`);
      for(let id=1;id<=Number(e.gn_stat(0));id++) {
        const degree=Number(e.gn_rule_stat(id,2));
        degreeCounts.set(degree,(degreeCounts.get(degree)??0)+1);
        if(degree!==currentDegree){emit(`\n% ${degree}\n`);currentDegree=degree;}
        const off=e.gn_export_rule(id);if(!off)throw new Error('Export row exceeds I/O workspace or is corrupted');
        const before=preview.length;let started=!previewTruncated;
        for(const term of recordTerms(this.memory,off,variables))emit(term);
        emit(',\n');
        if(started&&previewTruncated)preview=preview.slice(0,before); // Never expose half a polynomial.
      }
      const previewByteLength=enc.encode(preview).length;
      if(previewTruncated)preview+='\n% PREVIEW TRUNCATED. Full result.gb is in OPFS; no Done marker here.\n';
      emit('Done\n',!previewTruncated);flush();handle?.flush();
      return {preview,previewTruncated,previewByteLength,basisByDegree:Array.from(degreeCounts,([degree,count])=>({degree,count})).sort((a,b)=>a.degree-b.degree),textBytes:textOffset,fullBasisPath:this.directory?`fomkyr/${this.runKey}/result.gb`:null};
    } finally {handle?.close();}
  }
  async closeStorage(){
    try{this.handle?.close();}catch{}this.handle=null;
    if(this.broker){
      let timer;try{await Promise.race([this.rpc(this.broker,{command:'close'}),new Promise(r=>{timer=setTimeout(r,1000);})]);}catch{}finally{clearTimeout(timer);this.broker.worker.terminate();this.broker=null;}
    }
    for(const client of this.brokerClients??[])try{client.port.close();}catch{}
    this.brokerClients=[];
    try{this.lockHandle?.close();}finally{this.lockHandle=null;await this.releaseRunLock?.();this.releaseRunLock=null;}
  }
  async close(){
    this.cancel();
    await Promise.all(this.pool.filter(Boolean).map(async s=>{
      let timer;
      try{await Promise.race([this.rpc(s,{command:'close'}),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}
      catch{}finally{clearTimeout(timer);for(const p of s.pending.values())clearTimeout(p.timer);s.worker.terminate();}
    }));
    this.pool=[];await this.closeStorage();this.yieldChannel?.port1.close();this.yieldChannel?.port2.close();this.yieldChannel=null;this.closed=true;
  }

}
// Source-level compatibility for the 0.1.0 host API; new files and cache use fomkyr.
export {FomkyrEngine as NativeEngine};
