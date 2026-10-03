#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Launched by the C executable with an inherited POSIX lock. Same core/host API
// as the browser; Node supplies POSIX file I/O, NOT an unrestricted WASM memory.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {setup} from './node-host.mjs';
import {FomkyrEngine} from '../web/engine.js';
import {HARD_BYTES} from '../web/runtime.js';
import {identityOf,checkpointCandidates} from '../web/storage.js';
import {parseNativeJob} from '../web/job-adapter.js';
import {prepareHilbertClosure} from '../web/hilbert-closure.js';
const MiB=1048576;
const opt={input:null,degree:20,workers:Math.min(4,os.availableParallelism()),workdir:'fomkyr-job',memory:'auto',checkpointSeconds:30,timeLimit:0,batchPairs:128,field:0,quiet:false};
const flags=new Map([['--fresh','fresh'],['--quiet','quiet'],['-q','quiet'],['--hilbert','hilbert'],['--export','export'],['--no-radix','noRadix'],['--wasm-limit','wasmLimit'],['--status','status'],['--dry-run','dryRun'],['--dump-fixture','dumpFixture'],['--hilbert-fixed-batch','hilbertFixedBatch']]);
const values=new Map([['--input','input'],['-i','input'],['--degree','degree'],['-d','degree'],['--workers','workers'],['-j','workers'],['--workdir','workdir'],['--resume','workdir'],['--memory','memory'],['--checkpoint-seconds','checkpointSeconds'],['--time-limit','timeLimit'],['--batch-pairs','batchPairs'],['--field','field'],['--hilbert-certificate','hilbertCertificate'],['--assume-hilbert','assumeHilbert']]);
for(let i=2;i<process.argv.length;i++){
 let a=process.argv[i],v;if(/^-[idj].+/.test(a)){v=a.slice(2);a=a.slice(0,2);}const equals=a.indexOf('=');if(equals>=0){v=a.slice(equals+1);a=a.slice(0,equals);}
 if(a==='--version'){console.log('0.6.6 (WASM)');process.exit(0);}
 if(a==='--help'||a==='-h'){console.log('Use fomkyr --help; --wasm selects this bounded WASM runtime, not native execution.');process.exit(0);}
 if(flags.has(a)){opt[flags.get(a)]=true;continue;}
 if(values.has(a)){if(a==='--resume')opt.resumeRequested=true;if(a==='--field')opt.fieldSet=true;v??=process.argv[++i];if(v==null)throw Error(`Missing ${a} value`);opt[values.get(a)]=v;continue;}
 if(!a.startsWith('-')&&!opt.input){opt.input=a;continue;}throw Error(`Unknown option ${a}`);
}
function bytes(s){const m=/^(\d+)([KMGT]?)(?:i?B)?$/i.exec(String(s));if(!m)throw Error('Invalid memory size');const n=Number(m[1])*1024**(m[2]?('KMGT'.indexOf(m[2].toUpperCase())+1):0);if(!Number.isSafeInteger(n))throw Error('Unsafe memory size');return n;}
function headroom(){let n=os.freemem();try{const limit=fs.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),used=Number(fs.readFileSync('/sys/fs/cgroup/memory.current','utf8'));if(limit!=='max')n=Math.min(n,Math.max(0,Number(limit)-used));}catch{}return n;}
const budget=Math.floor(Math.min(opt.memory==='auto'?headroom()*.8:bytes(opt.memory),HARD_BYTES)/65536)*65536;
for(const key of ['degree','workers','checkpointSeconds','timeLimit','batchPairs','field']){opt[key]=Number(opt[key]);if(!Number.isFinite(opt[key])||opt[key]<0)throw Error(`Invalid ${key}`);}
const root=path.resolve(opt.workdir);let savedJob;try{savedJob=JSON.parse(fs.readFileSync(path.join(root,'job.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}if(savedJob&&(opt.resumeRequested||!opt.input)&&!opt.fieldSet)opt.field=Number(savedJob.modulus);const input=opt.input??path.join(root,'fixture.json');const source=fs.readFileSync(input==='-'?0:input,'utf8');
let fixture;
if(source.trimStart().startsWith('{'))fixture=JSON.parse(source);
else fixture=parseNativeJob({task:'gb',memoryMiB:Math.max(128,budget/MiB),fomkyrOptions:{inputBudgetBytes:64*MiB},script:`(NONCOMMIFY)\n(DEGLEFTLEXIFY)\n(SETMODULUS ${opt.field})\n(SETMAXDEG ${opt.degree||'NIL'})\n(SIMPLE "input.bg" "result.gb")`,files:{'input.bg':'(ALGFORMINPUT)\n'+source}}).fixture;
if(opt.dumpFixture){console.log(JSON.stringify(fixture));process.exit(0);}
const id=await identityOf(fixture,opt.field),key=`alg-${id}`;if(opt.resumeRequested&&savedJob?.identity&&savedJob.identity!==id)throw Error('Resume input/field differs from saved job; use a separate workdir.');
if(opt.dryRun){console.log(JSON.stringify({engine:'wasm',budgetBytes:budget,wasmLimit:true,workers:opt.workers,identity:id}));process.exit(0);}
if(!opt.status){const fd=Number(process.env.FOMKYR_LOCK_FD);if(!Number.isInteger(fd)||fd<3)throw Error('Launch through fomkyr --wasm so the native coordinator can hold the POSIX job lock.');fs.fstatSync(fd);}
if(opt.hilbertCertificate&&opt.assumeHilbert)throw Error('Choose one Hilbert authority');
const closure=opt.hilbertCertificate?{certificate:JSON.parse(fs.readFileSync(opt.hilbertCertificate,'utf8'))}:opt.assumeHilbert?{assume:JSON.parse(fs.readFileSync(opt.assumeHilbert,'utf8'))}:null;
setup(root);
if(opt.status){try{const r=await navigator.storage.getDirectory(),d=await(await r.getDirectoryHandle('fomkyr')).getDirectoryHandle(key);const f=await(await d.getFileHandle('basis.gnb')).getFile();const auth=await prepareHilbertClosure(closure,id,opt.field);const cp=await checkpointCandidates(d,id,f.size,auth?.key);console.log(JSON.stringify(cp[0]??{checkpoint:null}));process.exit(cp.length?0:66);}catch(error){console.log(JSON.stringify({checkpoint:null,error:error.message,code:error.code??'ERROR'}));process.exit(66);}}
fs.mkdirSync(root,{recursive:true});
function atomicJSON(name,value){const tmp=path.join(root,`.${name}.${process.pid}.tmp`),dest=path.join(root,name);const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,dest);const dir=fs.openSync(root,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
atomicJSON('fixture.json',fixture);atomicJSON('job.json',{schema:1,version:'0.6.6',identity:id,modulus:opt.field,input:'fixture.json'});

const e=new FomkyrEngine({hilbertClosure:closure,hilbertClosureBatching:!opt.hilbertFixedBatch,workers:opt.workers,budgetBytes:budget,memoryPolicy:'auto',runKey:key,
 resume:opt.fresh?false:undefined,hilbert:!!opt.hilbert,exportText:!!opt.export,progress:!opt.quiet,
 progressIntervalMs:5000,checkpointIntervalMs:opt.checkpointSeconds*1000,timeoutMs:opt.timeLimit*1000,
 batchPairs:opt.batchPairs,radixHeap:!opt.noRadix,
 onEvent:m=>{if(!opt.quiet&&['checkpoint','degree','progress','memory-adaptation','warning','cache','hilbert-degree-closure'].includes(m.type))console.error(JSON.stringify(m));}});
let signal=0;for(const [s,n] of [['SIGINT',2],['SIGTERM',15]])process.on(s,()=>{signal=n;e.cancel();});process.on('SIGUSR1',()=>e.requestCheckpoint());
let code=0;try{const r=await e.compute(fixture,opt.degree||null,opt.field);console.log(JSON.stringify(r));}
catch(error){code=error.code==='CANCELLED'?(signal?128+signal:124):70;console.log(JSON.stringify({engine:'fomkyr-wasm',complete:false,code:error.code??'ERROR',message:error.message,...error.native}));}
finally{await e.close();}
process.exitCode=code;
