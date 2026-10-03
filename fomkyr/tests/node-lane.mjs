import {parentPort,workerData} from 'node:worker_threads';
import {FileHandle,oldNodeMemory64Shim} from './node-host.mjs';
oldNodeMemory64Shim();globalThis.self=globalThis;globalThis.postMessage=(m,transfer=[])=>parentPort.postMessage(m,transfer);
await import(workerData.url);
parentPort.on('message',m=>{if(m.file)m.file=new FileHandle(m.file.path);globalThis.onmessage({data:m});});
