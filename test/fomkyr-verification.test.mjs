import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {SHA256,blobSHA256} from '../fomkyr/web/sha256-stream.js';
import {verificationEntries,verificationAvailable} from '../fomkyr/web/verification-bundle.js';
import {identityOf,sha256} from '../fomkyr/web/storage.js';
import {zipChunks} from '../web/src/zip-download.js';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
test('streaming SHA-256 matches independent vectors across block boundaries',async()=>{
  for(const n of [0,1,3,55,56,63,64,65,127,128,129,4097,1000000]){
    const bytes=n===3?Buffer.from('abc'):Buffer.alloc(n);for(let i=0;n!==3&&i<n;i++)bytes[i]=(i*17+31)&255;
    for(const chunk of [1,13,64,257,65536]){
      const h=new SHA256();for(let i=0;i<n;i+=chunk)h.update(bytes.subarray(i,i+chunk));assert.equal(h.hex(),digest(bytes));assert.throws(()=>h.update(bytes));
    }
    assert.equal(await blobSHA256(new Blob([bytes])),digest(bytes));
  }
  assert.equal(new SHA256().update(Buffer.alloc(1000000,97)).hex(),'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});
function record(terms){
  const b=Buffer.alloc(32+terms.length*24);b.writeUInt32LE(0x31424e47);b.writeUInt32LE(b.length,4);b.writeUInt32LE(terms.length,8);b.writeUInt32LE(terms[0].word.length,12);
  terms.forEach((t,i)=>{let word=0n;for(const a of t.word)word=(word<<4n)|BigInt(a);b.writeBigUInt64LE(word,32+i*24);b.writeBigUInt64LE(BigInt.asUintN(64,BigInt(t.coefficient)*2n),48+i*24);});
  let h=1469598103934665603n;for(const x of b.subarray(32))h=BigInt.asUintN(64,(h^BigInt(x))*1099511628211n);b.writeBigUInt64LE(h,16);return b;
}
const term=(word,coefficient='1')=>({word,coefficient});
const fixture={variables:['x','y'],relations:[{degree:2,terms:[term([0,0])]},{degree:2,terms:[term([1,1])]},{degree:2,terms:[term([1,0]),term([0,1])]}]};
async function bundle(modulus=0,rows=fixture.relations.map(r=>r.terms),overrides={},presentation=fixture){
  const identity=await identityOf(presentation,modulus),basis=Buffer.concat(rows.map(record));
  const cp={identity,partial:false,completedThroughDegree:4,basisSize:rows.length,diskBytes:basis.length};
  const files={'basis.gnb':new Blob([basis]),'checkpoint-0.json':new Blob([JSON.stringify({schema:2,payload:cp,sha256:await sha256(JSON.stringify(cp))})]),'result.gb':new Blob(['x^2,y^2,y*x+x*y'])};
  const result={version:'0.7.0',complete:true,storage:'opfs',completedThroughDegree:4,basisSize:rows.length,diskBytes:basis.length,identity,runKey:'test',modulus,order:'degleftlex',fullBasisPath:'test/result.gb',hilbert:{coefficients:['1','2','1','0','0']},...overrides};
  const entries=await verificationEntries({fixture:presentation,result,openFile:async n=>files[n],fetchAsset:async n=>new Blob([fs.readFileSync('fomkyr/web/verification/'+n)])});
  const pieces=[];for await(const b of zipChunks(entries))pieces.push(b);return {zip:Buffer.concat(pieces),entries,result,files};
}
function checked(zip,args=[]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-verify-'));
  try{const file=path.join(dir,'computation.zip');fs.writeFileSync(file,zip);const r=spawnSync('python3',['fomkyr/tools/verify-computation.py',file,...args],{encoding:'utf8',timeout:120000});assert.ifError(r.error);return {code:r.status,report:JSON.parse(r.stdout)};}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('verification exports complete records and independently certifies Q and prime fields',async()=>{
  for(const modulus of [0,2,101]){
    const b=await bundle(modulus),m=JSON.parse(await b.entries[0].blob.text());
    assert.equal(m.verification.independentGroebnerCertificate,false);assert.equal(m.verification.profileProofReplayedHere,false);
    assert.equal(m.files['basis.gnb'].bytes,b.result.diskBytes);assert.equal(m.gateProfileId,null);
    const r=checked(b.zip);assert.equal(r.code,0,r.report.error);assert.equal(r.report.independentGroebnerCertificate,true);assert.deepEqual(r.report.hilbert,['1','2','1','0','0']);
    const integrity=checked(b.zip,['--integrity-only']);assert.equal(integrity.report.independentGroebnerCertificate,false);
  }
});
test('an exact GB of the wrong ideal cannot receive a certificate',async()=>{
  const b=await bundle(0,[[term([0])],[term([1])]]),r=checked(b.zip);assert.equal(r.code,1);assert.match(r.report.error,/original defining ideal/);assert.equal(r.report.independentGroebnerCertificate,false);
});
test('an unfinished bounded basis with a nonzero critical composition is rejected',async()=>{
  const terms=[[term([1,1]),term([1,0],'-1')],[term([0,1])]];
  const presentation={variables:['x','y'],relations:terms.map(t=>({degree:2,terms:t}))};
  const b=await bundle(0,terms,{},presentation),r=checked(b.zip);assert.equal(r.code,1);assert.match(r.report.error,/critical composition/);assert.equal(r.report.independentGroebnerCertificate,false);
});
test('incomplete term/time allowances never certify the computation',async()=>{
  const {zip}=await bundle();for(const args of [['--time-limit','0.000001'],['--max-terms','1']]){const r=checked(zip,args);assert.equal(r.code,2);assert.equal(r.report.mathematicalStatus,'incomplete');assert.equal(r.report.independentGroebnerCertificate,false);}
});
test('checkpoint changes and incomplete results cannot be exported',async()=>{
  assert.equal(verificationAvailable({complete:false}),false);
  await assert.rejects(()=>bundle(0,undefined,{diskBytes:1}),/saved computation changed/);
  await assert.rejects(()=>bundle(0,undefined,{complete:false}),/completed result/);
});
