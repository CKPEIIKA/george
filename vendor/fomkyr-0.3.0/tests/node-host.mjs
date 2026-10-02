// Test-only adapter. OPFS is EMULATED with Node fs, not a browser conformance test.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {Worker as Thread, parentPort} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
export class SyncHandle {
  constructor(p){this.fd=fs.openSync(p,'a+');fs.closeSync(this.fd);this.fd=fs.openSync(p,'r+');}
  read(buffer,{at=0}={}){return fs.readSync(this.fd,buffer,0,buffer.length,at);}
  write(buffer,{at=0}={}){return fs.writeSync(this.fd,buffer,0,buffer.length,at);}
  getSize(){return fs.fstatSync(this.fd).size;}truncate(n){fs.ftruncateSync(this.fd,n);}
  flush(){fs.fsyncSync(this.fd);}close(){fs.closeSync(this.fd);}
}
export class FileHandle {
  constructor(p){this.path=p;this.kind="file";}
  async createSyncAccessHandle(){return new SyncHandle(this.path);}
  async getFile(){const p=this.path;return {size:fs.statSync(p).size,text:async()=>fs.readFileSync(p,'utf8')};}
}
class Directory {
  constructor(p){this.path=p;this.kind="directory";fs.mkdirSync(p,{recursive:true});}
  async *entries(){for(const e of fs.readdirSync(this.path,{withFileTypes:true}))yield [e.name,e.isDirectory()?new Directory(path.join(this.path,e.name)):new FileHandle(path.join(this.path,e.name))];}
  async getDirectoryHandle(n,{create=false}={}){const p=path.join(this.path,n);if(!create&&!fs.existsSync(p))throw Error('Not found');return new Directory(p);}
  async removeEntry(n,{recursive=false}={}){try{if(recursive)fs.rmSync(path.join(this.path,n),{recursive:true});else fs.unlinkSync(path.join(this.path,n));}catch(e){if(e.code==='ENOENT'){e.name='NotFoundError';}throw e;}}
  async getFileHandle(n,{create=false}={}){const p=path.join(this.path,n);if(create&&!fs.existsSync(p))fs.writeFileSync(p,'');if(!fs.existsSync(p))throw Error('Not found');return new FileHandle(p);}
}
export function oldNodeMemory64Shim(){
  // Node 22/V8 uses the pre-standard `index: i64`, Number-page API.
  const Memory=WebAssembly.Memory;
  try {new Memory({address:'i64',initial:1n,maximum:2n,shared:true});return;}
  catch{}
  WebAssembly.Memory=class extends Memory {
    constructor(d){super(d.address==='i64'?{...d,index:'i64',initial:Number(d.initial),maximum:Number(d.maximum)}:d);}
    grow(delta){return super.grow(Number(delta));}
  };
}
export function setup(root){
  oldNodeMemory64Shim();globalThis.crossOriginIsolated=true;const locks=new Set();
  Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:4,locks:{request:async(key,o,fn)=>{if(locks.has(key))return fn(null);locks.add(key);try{return await fn({name:key});}finally{locks.delete(key);}}},storage:{getDirectory:async()=>new Directory(root),estimate:async()=>({usage:0,quota:2**40})}},configurable:true});
  const fetchOriginal=globalThis.fetch;
  globalThis.fetch=async(url,...args)=>String(url).startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):fetchOriginal(url,...args);
  globalThis.Worker=class {
    constructor(url){this.thread=new Thread(new URL('./node-lane.mjs',import.meta.url),{workerData:{url:String(url)}});this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.({message:error.message}));}
    postMessage(m,transfer=[]){this.thread.postMessage(m,transfer);}terminate(){return this.thread.terminate();}
  };
}
