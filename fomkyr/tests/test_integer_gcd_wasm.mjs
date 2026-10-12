// Exact arithmetic in the actual shared/single Wasm32/Wasm64 modules.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createMemory,hostFor,setStack} from '../web/runtime.js';
import {oldNodeMemory64Shim} from './node-host.mjs';

oldNodeMemory64Shim();
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
let seed=71012n;
function random(bits){let x=0n;for(let i=0;i<bits;i+=32){seed=(1664525n*seed+1013904223n)&0xffffffffn;x=(x<<32n)|seed;}return x&((1n<<BigInt(bits))-1n);}
const cases=[];
for(const bits of [1,31,32,61,62,63,64,65,95,96,97,127,128,256,512,1024,2048,4096]){
 for(let i=0;i<20;i++){
  let a=random(bits),b=random(bits);
  if(i%4===0){a*=315n;b*=315n;}
  if(i%7===0)b=a+1n;
  cases.push([a,b],[-a,b],[a,-b],[a,a],[a,0n],[0n,b]);
 }
}
let a=0n,b=1n;
for(let i=1;i<=8000;i++){[a,b]=[b,a+b];if(i%500===0)cases.push([a,b]);}
function limbs(x){x=x<0n?-x:x;const v=[];do{v.push(Number(x&0xffffffffn));x>>=32n;}while(x);return v;}
const reports=[];
for(const bits of [32,64])for(const shared of [true,false]){
 const budget=64*1048576,memory=createMemory(bits,budget,shared);
 const module=await WebAssembly.compile(fs.readFileSync(new URL(`../dist/fomkyr${bits}${shared?'':'-single'}.wasm`,import.meta.url)));
 const e=(await WebAssembly.instantiate(module,hostFor(memory,bits,budget).imports)).exports;
 assert.equal(e.gn_init(1,1,1,BigInt(budget),BigInt(32*1048576),8,0,0),0);setStack(e,0,bits);
 const offset=Number(e.gn_import_buffer());
 for(const [a,b] of cases){
  const x=limbs(a),y=limbs(b);new Uint32Array(memory.buffer,offset,x.length+y.length).set([...x,...y]);
  assert.equal(e.gn_test_big(4,x.length,y.length,a<0n?-1:1,b<0n?-1:1),0);
  const view=new DataView(memory.buffer),n=view.getUint32(offset,true);assert.equal(view.getUint32(offset+4,true),0);
  let got=0n;for(let i=n;i--;)got=(got<<32n)|BigInt(view.getUint32(offset+8+4*i,true));
  assert.equal(got,gcd(a,b));
 }
 reports.push({bits,shared,cases:cases.length,passed:true});
}
console.log(JSON.stringify({passed:true,cases:reports}));
