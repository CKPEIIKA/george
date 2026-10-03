// SPDX-License-Identifier: MIT
// Portable OPFS: one worker owns the exclusive file handle. Compute lanes use
// bounded shared mailboxes; they do not need readwrite-unsafe OPFS support.
export const IO_CHUNK=65536, IO_HEADER=64;
export function makeMailbox(){return new SharedArrayBuffer(IO_HEADER+IO_CHUNK);}
export class BrokerHandle {
  constructor({buffer,port},timeoutMs=30000){this.control=new Int32Array(buffer,0,16);this.view=new DataView(buffer);this.bytes=new Uint8Array(buffer,IO_HEADER);this.port=port;this.timeoutMs=timeoutMs;this.failed=false;}
  request(op,position=0,size=0,input=null){
    if(this.failed)throw new Error('OPFS broker is no longer usable');
    if(!Number.isSafeInteger(position)||position<0||size<0||size>IO_CHUNK)throw new Error('Invalid OPFS broker request');
    const c=this.control;c[1]=op;c[2]=size;c[3]=0;c[6]=0;this.view.setBigUint64(16,BigInt(position),true);
    if(input)this.bytes.set(input);Atomics.store(c,0,1);this.port.postMessage(0);
    const deadline=Date.now()+this.timeoutMs;
    while(Atomics.load(c,0)===1){
      const left=deadline-Date.now();if(left<=0){this.failed=true;throw new Error('OPFS broker timed out; previous checkpoint retained');}
      Atomics.wait(c,0,1,Math.min(1000,left));
    }
    if(Atomics.load(c,0)<0){this.failed=true;const e=new Error(c[6]===1?'OPFS storage quota exhausted':'OPFS broker I/O failure');e.name=c[6]===1?'QuotaExceededError':'IOError';throw e;}
    return op===3?Number(this.view.getBigUint64(32,true)):c[3];
  }
  read(out,{at=0}={}){let done=0;while(done<out.length){const n=this.request(1,at+done,Math.min(IO_CHUNK,out.length-done));if(!n)break;out.set(this.bytes.subarray(0,n),done);done+=n;}return done;}
  write(input,{at=0}={}){let done=0;while(done<input.length){const n=Math.min(IO_CHUNK,input.length-done),w=this.request(2,at+done,n,input.subarray(done,done+n));if(!w)break;done+=w;}return done;}
  getSize(){return this.request(3);}truncate(size){this.request(4,size);}flush(){this.request(5);}close(){this.port.close();}
}
