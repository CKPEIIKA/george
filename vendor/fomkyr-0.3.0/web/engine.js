// SPDX-License-Identifier: MIT
import {HARD_BYTES,createMemory,hostFor,stats,checked,wordCode,recordTerms} from './runtime.js';
import {STORE,VERSION,identityOf,acquireRunLock,checkpointCandidates,writeJSON} from './storage.js';
import {loadKernel} from './module-cache.js';
import {computeHilbert,hilbertCSV} from './hilbert.js';
import {browserCapabilities,sharedMemoryAvailable,probeUnsafeAccess} from './capabilities.js';
import {BrokerHandle,makeMailbox,IO_CHUNK,IO_HEADER} from './io-broker.js';
const MiB=1048576,enc=new TextEncoder();
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
        if(this.e.gn_abi()!==3)throw new Error('Kernel/host ABI mismatch');
        break;
      }catch(error){
        if(bits!==64||o.strictCapabilities||o.wasmURL)throw error;
        this.warn(`memory64 could not be initialized (${error.message}); falling back to WASM32 with its lower memory budget.`);bits=32;
      }
    }
    this.requestedBudget=requested;
    const defaultWorkers=Math.min(Math.max(1,(navigator.hardwareConcurrency||2)-1),4);
    this.workers=this.shared?Math.min(32,Math.max(1,Math.floor(o.workers||defaultWorkers))):1;
    if(!Number.isFinite(this.workers))throw new Error('Invalid worker count');
    this.scratch=Math.floor(Number(o.scratchBytes??Math.min(this.budget/3,512*MiB))/65536)*65536;
    if(!Number.isFinite(this.scratch)||this.scratch<this.workers*MiB||this.scratch>=this.budget)throw new Error('scratchBytes must provide >=1 MiB per lane and fit in the kernel budget');
    this.batchPairs=o.batchPairs===0?0:Math.min(512,Math.max(1,Math.floor(o.batchPairs??this.workers*8)));
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
          for(const name of ['checkpoint-0.json','checkpoint-1.json'])try{await this.directory.removeEntry(name);}catch(e){if(e.name!=='NotFoundError')throw e;}
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
  cancel(){this.cancelRequested=true;if(this.cancelView&&this.shared)Atomics.store(this.cancelView,0,1);else this.e?.gn_cancel(1);}
  async resetKernel(fixture,target,modulus){
    checked(this.e.gn_init(fixture.variables.length,target??0,this.workers,BigInt(this.budget),BigInt(this.scratch),this.options.hashBits??18,modulus,this.spill?1:0));
    checked(this.e.gn_tune((this.options.monomialPruning!==false?1:0)|(this.options.heapReduction!==false?2:0),this.options.cachePercent??12,this.options.heapThreshold??16));
    if(this.batchPairs)checked(this.e.gn_batch_mode(1));
    this.cancelView=new Int32Array(this.memory.buffer,Number(this.e.gn_cancel_ptr()),1);
    this.emit('control',this.shared?{memory:this.memory,cancelOffset:Number(this.e.gn_cancel_ptr()),runKey:this.runKey,shared:true}:{runKey:this.runKey,shared:false,cancellation:'worker-message'});
    await Promise.all(this.pool.filter(Boolean).map(s=>this.rpc(s,{command:'stack'})));
  }
  async restore(cp){
    const header=new Uint8Array(32),dv=new DataView(header.buffer);let off=0;
    for(let i=0;i<cp.basisSize;i++){
      if(off+32>cp.diskBytes||this.handle.read(header,{at:off})!==32)throw new Error('Truncated record header');
      const size=dv.getUint32(4,true),ptr=this.e.gn_import_buffer();
      if(size<56||size>this.e.gn_import_capacity()||off+size>cp.diskBytes)throw new Error('Bad or oversized checkpoint row; increase scratch for a valid large row');
      if(!this.host.imports.host.read(BigInt(off),ptr,size))throw new Error('Checkpoint read failed');
      checked(this.e.gn_restore_rule(size,BigInt(off)));off+=size;
    }
    if(off!==cp.diskBytes)throw new Error('Checkpoint byte count mismatch');
    checked(this.e.gn_restored_through(cp.completedThroughDegree));this.lastCheckpoint=cp;
    // Only the uncommitted suffix is discarded. A lower requested target never
    // rewinds a newer valid checkpoint or destroys previously completed degrees.
    this.handle.truncate(off);
  }
  async checkpoint(identity){
    if(!this.directory)return;
    const cp={abi:3,version:VERSION,identity,...stats(this.e),runKey:this.runKey,updatedAt:new Date().toISOString()};
    this.handle.flush();
    await writeJSON(this.directory,`checkpoint-${cp.completedThroughDegree%2}.json`,cp,{checkpoint:true});this.lastCheckpoint=cp;
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
  async completeDegree(){
    let lastProgress=0,lastYield=performance.now();
    for(;;){
      if(this.cancelRequested)checked(5);
      if(performance.now()-lastYield>40){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}
      if(this.batchPairs){
        const n=this.e.gn_batch_fill(this.batchPairs);if(n<0)checked(n);if(!n)break;
        this.scheduler.epochs++;this.scheduler.dispatchedPairs+=n;
        let start=performance.now();
        const pending=[];
        for(let lane=1;lane<this.workers&&lane<n;lane++)pending.push(this.rpc(this.pool[lane],{command:'batch'}));
        checked(this.e.gn_batch_reduce(0));(await Promise.all(pending)).forEach(checked);
        this.scheduler.reduceMs+=performance.now()-start;
        const rcs=Array.from({length:n},(_,i)=>this.e.gn_batch_status(i));
        rcs.filter(rc=>rc!==2&&rc!==8).forEach(checked);
        if(rcs.includes(2)||rcs.includes(8)){this.fallbackEpoch();continue;}
        start=performance.now();let replay=false;
        for(let i=0;i<n;i++){
          const rc=this.e.gn_batch_commit(i);
          if(rc===2){this.fallbackEpoch();replay=true;break;}checked(rc);
        }
        this.scheduler.commitMs+=performance.now()-start;if(replay)continue;
      }else{
        const batch=[];
        for(let lane=0;lane<this.workers;lane++){const rc=this.e.gn_next_pair(lane);if(rc<0)checked(rc);if(!rc)break;batch.push(lane);}
        if(!batch.length)break;
        this.scheduler.epochs++;this.scheduler.dispatchedPairs+=batch.length;
        let start=performance.now();
        const pending=batch.slice(1).map(lane=>this.rpc(this.pool[lane],{command:'reduce'}));
        const rcs=[this.e.gn_reduce_pair(0),...await Promise.all(pending)];
        this.scheduler.reduceMs+=performance.now()-start;
        if(rcs.includes(2)&&await this.shrinkAndReplay())continue;rcs.forEach(checked);
        let replay=false;start=performance.now();
        for(const lane of batch){const rc=this.e.gn_commit(lane);if(rc===2&&await this.shrinkAndReplay()){replay=true;break;}checked(rc);}
        this.scheduler.commitMs+=performance.now()-start;if(replay)continue;
      }
      if(performance.now()-lastProgress>1000){this.emit('progress',{...stats(this.e),scheduler:{...this.scheduler}});lastProgress=performance.now();}
    }
  }
  async compute(fixture,target=20,modulus=0){
    if(this.active||this.closed)throw new Error('Engine is busy or closed');
    this.active=true;const start=performance.now();let timer;
    try{
      validateFixture(fixture);
      if(target!==null&&(!Number.isInteger(target)||target<1||target>0xfffffffe))throw new Error('Degree must be a positive 32-bit index, or null for completion without a user degree bound');
      if(!Number.isInteger(modulus)||modulus<0||modulus>2147483647)throw new Error('Invalid coefficient characteristic');
      const identity=await identityOf(fixture,modulus);this.identityHash=identity;
      if(!this.options.runKey)this.options.runKey=`alg-${identity}`;
      if(!this.e)await this.open();
      const candidates=this.directory&&this.options.resume!==false?await checkpointCandidates(this.directory,identity,this.handle.getSize()):[];
      if(!candidates.length&&this.directory&&this.options.resume!==false&&(this.handle.getSize()>0||this.options.resume===true)){
        const error=new Error('No valid matching checkpoint; cache left unchanged. Use a different runKey or explicitly resume:false to reset it.');error.code='CACHE_INVALID';throw error;
      }
      const kernelTarget=target===null?null:Math.max(target,candidates[0]?.completedThroughDegree??0);
      await this.resetKernel(fixture,kernelTarget,modulus);
      let restored=0,restoreError=null;
      for(const cp of candidates){
        try{await this.restore(cp);restored=cp.completedThroughDegree;restoreError=null;break;}
        catch(error){restoreError=error;await this.resetKernel(fixture,kernelTarget,modulus);this.emit('warning',{message:`Rejected checkpoint degree ${cp.completedThroughDegree}: ${error.message}`});}
      }
      if(restoreError)throw restoreError;
      this.emit('cache',{runKey:this.runKey,resumedFromDegree:restored,cacheHit:target!==null&&restored>=target});
      if(this.options.timeoutMs>0){timer=setTimeout(()=>this.cancel(),this.options.timeoutMs);this.e.gn_deadline(performance.timeOrigin+performance.now()+this.options.timeoutMs);}
      const lastInputDegree=fixture.relations.reduce((n,r)=>Math.max(n,r.degree),0);
      const globallyComplete=()=>Number(this.e.gn_stat(2))>=lastInputDegree&&BigInt(this.e.gn_stat(2))>=this.e.gn_completion_bound();
      let lastYield=performance.now();
      for(let degree=Number(this.e.gn_stat(2))+1;degree<=(target??0xfffffffe);degree++){
        if(target===null&&globallyComplete())break;
        if(this.cancelRequested)checked(5);
        if(performance.now()-lastYield>40){await new Promise(r=>setTimeout(r,0));lastYield=performance.now();}
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
        checked(this.e.gn_start_degree(degree));await this.completeDegree();
        checked(this.e.gn_finish_degree());await this.checkpoint(identity);
        this.emit('degree',{...stats(this.e),elapsedMs:performance.now()-start,scheduler:{...this.scheduler}});
      }
      if(target===null&&!globallyComplete())checked(9);
      const certified=target??Number(this.e.gn_stat(2));
      const hilbertDegree=this.options.hilbertDegree??certified;
      let hilbert=null;
      if(this.options.hilbert!==false){
        try{
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
      const result={...stats(this.e),engine:'fomkyr',version:VERSION,storage:this.spill?'opfs':'memory',complete:true,unrestrictedBasisComplete:globallyComplete(),reduced:false,target,modulus,order:'degleftlex',runKey:this.runKey,identity,bits:this.bits,shared:this.shared,ioMode:this.ioMode,executionMode:`wasm${this.bits}-${this.shared?'shared':'single'}`,fallbacks:this.fallbacks??[],requestedBudgetBytes:this.requestedBudget,hostMailboxBytes:this.brokerClients.length*(IO_HEADER+IO_CHUNK),linearMemoryBytes:this.memory.buffer.byteLength,resumedFromDegree:restored,cacheHit:target!==null&&restored>=target,hilbert,scheduler:{...this.scheduler},lanePairs:Array.from({length:this.workers},(_,i)=>Number(this.e.gn_lane_stat(i,6))),elapsedMs:performance.now()-start};
      if(this.options.exportText!==false)Object.assign(result,await this.exportText(fixture.variables));
      if(this.directory){
        if(hilbert)await writeJSON(this.directory,'hilbert.json',hilbert);
        if(hilbert?.coefficients)await this.writeSmallText('hilbert.csv',hilbertCSV(hilbert));
        const {preview,...metadata}=result;await writeJSON(this.directory,'fomkyr-result.json',metadata);
      }
      return result;
    }catch(error){
      error.native=this.e?{...stats(this.e),complete:false,lastCheckpoint:this.lastCheckpoint,runKey:this.runKey}:null;
      if(this.host?.lastIOError)error.message+=`: ${this.host.lastIOError.message}`;throw error;
    }finally{clearTimeout(timer);this.active=false;}
  }
  async writeSmallText(name,text){
    const bytes=enc.encode(text),h=await(await this.directory.getFileHandle(name,{create:true})).createSyncAccessHandle();
    try{h.truncate(0);if(h.write(bytes,{at:0})!==bytes.length)throw new Error('Short text write');h.flush();}finally{h.close();}
  }
  async exportText(variables) {
    const e=this.e;let preview='',previewTruncated=false,used=0,currentDegree=0,textOffset=0;
    const cap=Math.min(Number(this.options.previewBytes??256*1024),1024*1024);
    let handle=null;
    if(this.directory){handle=await (await this.directory.getFileHandle('result.gb',{create:true})).createSyncAccessHandle();handle.truncate(0);}
    // Stream each term. A giant polynomial never becomes one giant JS string.
    let buffer='';
    const flush=()=>{if(handle&&buffer){const b=enc.encode(buffer);let done=0;while(done<b.length){const n=handle.write(b.subarray(done),{at:textOffset+done});if(!n)throw new Error('Short export write');done+=n;}textOffset+=b.length;}buffer='';};
    const emit=(text,allowPreview=true)=>{if(handle){buffer+=text;if(buffer.length>=32768)flush();}if(allowPreview&&!previewTruncated){if(used+text.length>cap){previewTruncated=true;}else{preview+=text;used+=text.length;}}};
    try {
      emit(`% fomkyr; completed through degree ${Number(e.gn_stat(2))}; not a claim of a finite complete GB\n`);
      for(let id=1;id<=Number(e.gn_stat(0));id++) {
        const degree=Number(e.gn_rule_stat(id,2));
        if(degree!==currentDegree){emit(`\n% ${degree}\n`);currentDegree=degree;}
        const off=e.gn_export_rule(id);if(!off)throw new Error('Export row exceeds I/O workspace or is corrupted');
        const before=preview.length;let started=!previewTruncated;
        for(const term of recordTerms(this.memory,off,variables))emit(term);
        emit(',\n');
        if(started&&previewTruncated)preview=preview.slice(0,before); // Never expose half a polynomial.
      }
      if(previewTruncated)preview+='\n% PREVIEW TRUNCATED. Full result.gb is in OPFS; no Done marker here.\n';
      emit('Done\n',!previewTruncated);flush();handle?.flush();
      return {preview,previewTruncated,textBytes:textOffset,fullBasisPath:this.directory?`fomkyr/${this.runKey}/result.gb`:null};
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
    this.pool=[];await this.closeStorage();this.closed=true;
  }

}
// Source-level compatibility for the 0.1.0 host API; new files and cache use fomkyr.
export {FomkyrEngine as NativeEngine};
