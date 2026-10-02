// SPDX-License-Identifier: MIT
import {HARD_BYTES,createMemory,hostFor,stats,checked,wordCode,recordTerms} from './runtime.js';
const MiB=1048576;
const enc=new TextEncoder();
export class NativeEngine {
  constructor(options={}) {this.options=options;this.pool=[];this.active=false;this.closed=false;this.log='';this.lastCheckpoint=null;}
  async open() {
    if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer==='undefined') {
      const e=new Error('George Native needs cross-origin isolation (COOP/COEP) for shared WASM memory. Serve with tools/serve.py or configure isolation on the deployed site.');e.code='ISOLATION_REQUIRED';throw e;
    }
    const o=this.options;
    this.budget=Math.floor(Math.min(Number(o.budgetBytes??512*MiB),HARD_BYTES)/65536)*65536;
    if(!Number.isFinite(this.budget)||this.budget<16*MiB)throw new Error('budgetBytes must be finite and >=16 MiB');
    this.bits=o.bits??(this.budget>4_294_901_760?64:32);
    this.budget=Math.min(this.budget,this.bits===32?4_294_901_760:HARD_BYTES);
    this.workers=Math.min(32,Math.max(1,Math.floor(o.workers??Math.min(navigator.hardwareConcurrency||2,4))));
    this.scratch=Math.floor(Number(o.scratchBytes??Math.min(this.budget/3,512*MiB))/65536)*65536;
    if(!Number.isFinite(this.scratch)||this.scratch<this.workers*MiB)throw new Error('scratchBytes must provide at least 1 MiB per lane');
    this.spill=o.spill!==false;this.runKey=String(o.runKey??`run-${crypto.randomUUID()}`);
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(this.runKey))throw new Error('Invalid runKey');
    if(this.spill) {
      const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('george-native',{create:true});
      this.directory=await dir.getDirectoryHandle(this.runKey,{create:true});
      // An ordinary exclusive handle prevents two coordinators/tabs using one run.
      this.lockHandle=await (await this.directory.getFileHandle('coordinator.lock',{create:true})).createSyncAccessHandle();
      this.file=await this.directory.getFileHandle('basis.gnb',{create:true});
      this.handle=await this.file.createSyncAccessHandle({mode:'readwrite-unsafe'});
      if(!o.resume) {
        this.handle.truncate(0);
        for(const name of ['checkpoint-0.json','checkpoint-1.json']) {
          try {await this.directory.removeEntry(name);} catch(error) {
            if(error.name!=='NotFoundError')throw error;
          }
        }
      }
      const estimate=await navigator.storage.estimate();
      const remaining=Math.max(0,(estimate.quota??Infinity)-(estimate.usage??0));
      this.diskLimit=Math.min(Number(o.diskLimitBytes??Infinity),this.handle.getSize()+Math.floor(remaining*.85));
    }
    this.memory=createMemory(this.bits,this.budget);
    this.emit('memory', {bytes: this.memory.buffer.byteLength});
    const url=new URL(`george${this.bits}.wasm`,import.meta.url);
    const response=await fetch(o.wasmURL??url);
    if(!response.ok)throw new Error(`Cannot load WASM: HTTP ${response.status}`);
    this.module=await WebAssembly.compile(await response.arrayBuffer());
    this.host=hostFor(this.memory,this.bits,this.budget,this.handle,this.diskLimit,true,
      bytes=>this.emit('memory', {bytes}));
    this.e=(await WebAssembly.instantiate(this.module,this.host.imports)).exports;
    if(this.e.gn_abi()!==1)throw new Error('Kernel/host ABI mismatch');
    // All instances must be instantiated BEFORE gn_init: data initialization is shared.
    for(let lane=0;lane<this.workers;lane++) {
      const worker=new Worker(new URL('lane.js',import.meta.url),{type:'module'});
      const slot={worker,pending:new Map(),serial:0,lane};this.pool.push(slot);
      worker.onmessage=({data:m})=>{const p=slot.pending.get(m.id);if(!p)return;slot.pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);};
      worker.onerror=(event)=>{for(const p of slot.pending.values())p.reject(new Error(event.message));slot.pending.clear();};
      await this.rpc(slot,{command:'init',module:this.module,memory:this.memory,lane,bits:this.bits,budget:this.budget,file:this.file,diskLimit:this.diskLimit});
    }
    return this;
  }
  rpc(slot,message) {return new Promise((resolve,reject)=>{const id=++slot.serial;slot.pending.set(id,{resolve,reject});slot.worker.postMessage({...message,id});});}
  async identity(fixture,modulus) {
    const x=JSON.stringify({abi:1,order:'degleftlex',variables:fixture.variables,relations:fixture.relations,modulus});
    const hash=await crypto.subtle.digest('SHA-256',enc.encode(x));
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  emit(type,payload={}) {this.options.onEvent?.({type,...payload});}
  cancel() {if(this.cancelView)Atomics.store(this.cancelView,0,1);}
  async restore(identity) {
    if(!this.options.resume)return;
    if(!this.directory)throw new Error('Resume requires OPFS spill mode');
    // Two immutable-ish checkpoint slots: a torn new write cannot destroy both.
    const candidates=[];
    for(const name of ['checkpoint-0.json','checkpoint-1.json']) {
      try {const file=await this.directory.getFileHandle(name);const text=await (await file.getFile()).text();const cp=JSON.parse(text);if(cp.identity===identity&&Number.isInteger(cp.completedThroughDegree)&&cp.completedThroughDegree>=0&&cp.completedThroughDegree<=Number(this.e.gn_stat(14))&&Number.isSafeInteger(cp.diskBytes)&&cp.diskBytes>=0&&cp.diskBytes<=this.handle.getSize())candidates.push(cp);}catch{}
    }
    candidates.sort((a,b)=>b.completedThroughDegree-a.completedThroughDegree);
    const cp=candidates[0];
    if(!cp)throw new Error('No matching checkpoint. Input, order, coefficient field and ABI must match.');
    if(cp.completedThroughDegree>Number(this.e.gn_stat(14)))throw new Error('Checkpoint exceeds requested degree');
    if(cp.diskBytes>this.handle.getSize())throw new Error('Truncated checkpoint basis file');
    const header=new Uint8Array(32), dv=new DataView(header.buffer);let off=0;
    for(let i=0;i<cp.basisSize;i++) {
      if(this.handle.read(header,{at:off})!==32)throw new Error('Truncated record header');
      const size=dv.getUint32(4,true), ptr=this.e.gn_import_buffer();
      if(size<32||size>this.e.gn_import_capacity()||off+size>cp.diskBytes)throw new Error('Bad/oversized checkpoint row; increase per-lane scratch for a valid large row.');
      if(!this.host.imports.host.read(BigInt(off),ptr,size))throw new Error('Checkpoint read failed');
      checked(this.e.gn_restore_rule(size,BigInt(off)));off+=size;
    }
    if(off!==cp.diskBytes)throw new Error('Checkpoint byte count mismatch');
    checked(this.e.gn_restored_through(cp.completedThroughDegree));this.lastCheckpoint=cp;
    this.handle.truncate(off); // Discard an unfinished suffix from a previous run.
  }
  async checkpoint(identity) {
    if(!this.directory)return;
    const cp={abi:1,identity,...stats(this.e),runKey:this.runKey};
    this.handle.flush();
    const file=await this.directory.getFileHandle(`checkpoint-${cp.completedThroughDegree%2}.json`,{create:true});
    const h=await file.createSyncAccessHandle();
    try {const b=enc.encode(JSON.stringify(cp));h.truncate(0);if(h.write(b,{at:0})!==b.length)throw new Error('Checkpoint short write');h.flush();} finally {h.close();}
    this.lastCheckpoint=cp;
  }
  async shrinkAndReplay() {
    if(this.workers<=1)return false;
    this.workers=Math.max(1,Math.floor(this.workers/2));
    checked(this.e.gn_workers(this.workers));checked(this.e.gn_rewind_degree());
    // gn_workers changes arenas, NOT the dedicated WASM call stacks.
    this.emit('stdout',{text:`Scratch pressure: reducing to ${this.workers} lanes and replaying degree ${Number(this.e.gn_stat(3))}.\n`});
    return true;
  }
  async compute(fixture,target=20,modulus=0) {
    if(this.active||this.closed)throw new Error('Engine is busy or closed');
    this.active=true;const start=performance.now();let timer;
    try {
      if(!this.e)await this.open();
      if(!Array.isArray(fixture.variables)||!Array.isArray(fixture.relations))throw new Error('Invalid fixture');
      if(!Number.isInteger(target)||target<1||target>20)throw new Error('Supported degree range: 1..20');
      if(!Number.isInteger(modulus)||modulus<0||modulus>2147483647)throw new Error('Invalid coefficient characteristic');
      checked(this.e.gn_init(fixture.variables.length,target,this.workers,BigInt(this.budget),BigInt(this.scratch),this.options.hashBits??18,modulus,this.spill?1:0));
      this.cancelView=new Int32Array(this.memory.buffer,Number(this.e.gn_cancel_ptr()),1);
      this.emit('control',{memory:this.memory,cancelOffset:Number(this.e.gn_cancel_ptr()),runKey:this.runKey});
      await Promise.all(this.pool.map(s=>this.rpc(s,{command:'stack'})));
      if(this.options.timeoutMs>0)timer=setTimeout(()=>this.cancel(),this.options.timeoutMs);
      const identity=await this.identity(fixture,modulus);this.identityHash=identity;
      await this.restore(identity);
      let lastProgress=0;
      for(let degree=Number(this.e.gn_stat(2))+1;degree<=target;degree++) {
        for(const r of fixture.relations)if(r.degree===degree) {
          checked(this.e.gn_input_begin(degree,r.terms.length));
          for(const t of r.terms) {
            const [lo,hi]=wordCode(t.word), c=BigInt(t.coefficient);
            if(c>4611686018427387903n||c< -4611686018427387903n)throw new Error('Input integer exceeds the signed 63-bit input ABI. Internal arithmetic is arbitrary precision.');
            checked(this.e.gn_input_term(lo,hi,c));
          }
          checked(this.e.gn_input_end());
        }
        checked(this.e.gn_start_degree(degree));
        for(;;) {
          const batch=[];
          for(let lane=0;lane<this.workers;lane++) {const rc=this.e.gn_next_pair(lane);if(rc<0)checked(rc);if(!rc)break;batch.push(lane);}
          if(!batch.length)break;
          const rcs=await Promise.all(batch.map(lane=>this.rpc(this.pool[lane],{command:'reduce'})));
          if(rcs.includes(2)&&await this.shrinkAndReplay())continue;
          rcs.forEach(checked);
          let replay=false;
          for(const lane of batch) {
            const rc=this.e.gn_commit(lane);
            if(rc===2&&await this.shrinkAndReplay()){replay=true;break;}
            checked(rc);
          }
          if(replay)continue;
          if(performance.now()-lastProgress>1000){this.emit('progress',{...stats(this.e),elapsedMs:performance.now()-start});lastProgress=performance.now();}
        }
        checked(this.e.gn_finish_degree());await this.checkpoint(identity);
        this.emit('degree',{...stats(this.e),elapsedMs:performance.now()-start});
      }
      const result={...stats(this.e),complete:true,reduced:false,target,modulus,order:'degleftlex',runKey:this.runKey,identity,bits:this.bits,elapsedMs:performance.now()-start};
      if(this.options.exportText!==false)Object.assign(result,await this.exportText(fixture.variables));
      return result;
    } catch(error) {
      error.native=this.e?{...stats(this.e),complete:false,lastCheckpoint:this.lastCheckpoint,runKey:this.runKey}:null;
      if(this.host?.lastIOError)error.message+=`: ${this.host.lastIOError.message}`;
      throw error;
    } finally {clearTimeout(timer);this.active=false;}
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
      emit(`% George Native; completed through degree ${Number(e.gn_stat(2))}; not a claim of a finite complete GB\n`);
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
      return {preview,previewTruncated,textBytes:textOffset,fullBasisPath:this.directory?`george-native/${this.runKey}/result.gb`:null};
    } finally {handle?.close();}
  }
  async close() {
    this.cancel();
    await Promise.all(this.pool.map(async s=>{
      let timer;
      try {await Promise.race([this.rpc(s,{command:'close'}),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}
      catch {} finally {clearTimeout(timer);s.worker.terminate();}
    }));
    this.pool=[];this.handle?.close();this.handle=null;this.lockHandle?.close();this.lockHandle=null;this.closed=true;
  }
}
