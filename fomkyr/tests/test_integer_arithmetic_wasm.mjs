// Independent BigInt checks in every production Wasm memory/execution variant.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createMemory,hostFor,setStack} from '../web/runtime.js';
import {oldNodeMemory64Shim} from './node-host.mjs';
oldNodeMemory64Shim();
let state=71213n;const random=bits=>{let x=0n;for(let i=0;i<bits;i+=32){state=(1664525n*state+1013904223n)&0xffffffffn;x=(x<<32n)|state;}return x&((1n<<BigInt(bits))-1n);};
const limbs=x=>{x=x<0n?-x:x;const out=[];do{out.push(Number(x&0xffffffffn));x>>=32n;}while(x);return out;};
const cases=[];
for(const bits of [1,31,32,33,61,62,63,64,65,95,96,128,256,512,1024,2048,4096])for(let i=0;i<20;i++){
 let b=random(bits)||1n,q=random([1,31,32,33,64,65,127,256][i%8]);
 if(i%4===0)b<<=BigInt([1,31,32,33,63,64,127][i%7]);
 if(i%7===0)b=1n<<BigInt(bits);
 for(const [sa,sb]of [[1n,1n],[-1n,1n],[1n,-1n],[-1n,-1n]])cases.push([5,sa*b*q,sb*b,sa*sb*q]);
 const a=random(bits);cases.push([0,a,b,a+b],[0,a,-b,a-b],[1,a,b,a*b],[1,-a,b,-a*b],[1,a,a,a*a]);
}
const reports=[];
for(const bits of [32,64])for(const shared of [true,false]){
 const budget=64*1048576,memory=createMemory(bits,budget,shared),module=await WebAssembly.compile(fs.readFileSync(new URL(`../dist/fomkyr${bits}${shared?'':'-single'}.wasm`,import.meta.url)));
 const e=(await WebAssembly.instantiate(module,hostFor(memory,bits,budget).imports)).exports;
 assert.equal(e.gn_init(1,1,1,BigInt(budget),BigInt(32*1048576),8,0,0),0);setStack(e,0,bits);const offset=Number(e.gn_import_buffer());
 const run=(op,a,b)=>{const x=limbs(a),y=limbs(b);new Uint32Array(memory.buffer,offset,x.length+y.length).set([...x,...y]);const rc=e.gn_test_big(op,x.length,y.length,a<0n?-1:1,b<0n?-1:1);if(rc)return {rc};const view=new DataView(memory.buffer),n=view.getUint32(offset,true);let got=0n;for(let i=n;i--;)got=(got<<32n)|BigInt(view.getUint32(offset+8+4*i,true));if(view.getUint32(offset+4,true))got=-got;return {rc,got};};
 for(const [op,a,b,expected] of cases){const {rc,got}=run(op,a,b);assert.equal(rc,0);assert.equal(got,expected);}
 for(const a of [0n,1n,-1n,1n<<128n])assert.equal(run(5,a,0n).rc,-6);
 assert.equal(e.gn_test_big(0,0xffffffff,1,1,1),-3);assert.equal(e.gn_test_big(0,1,1,-0x80000000,1),-3);
 reports.push({bits,shared,cases:cases.length,invalidCases:6,passed:true});
}
console.log(JSON.stringify({passed:true,cases:reports}));
