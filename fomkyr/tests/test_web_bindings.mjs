// SPDX-License-Identifier: MIT
// Verify the deployed consumer mappings against the canonical C table.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const header=readFileSync(new URL('fk_gate/profiles/generator-edges.h',root),'utf8');
const table=header.match(/fkg_generator_edges\[15\]\[2\]\s*=\s*\{(.*?)\};/s);
assert.ok(table,'Canonical generator edge table missing');
const edges=[...table[1].matchAll(/\{\s*(\d+)\s*,\s*(\d+)\s*\}/g)].map(m=>[Number(m[1]),Number(m[2])]);
assert.equal(edges.length,15);
assert.equal(new Set(edges.map(e=>e.join(','))).size,15);
for(const [a,b] of edges)assert.ok(a>=1&&a<b&&b<=6);
const directories=[new URL('web/',root)];
const deployed=new URL('../web/engine/fomkyr/',root);
if(existsSync(deployed))directories.push(deployed);

const fixture=JSON.parse(readFileSync(new URL('fixtures/fk6.json',root)));
const smallFixture=JSON.parse(readFileSync(new URL('fixtures/exterior.json',root)));
const blob=value=>new Blob([JSON.stringify(value)]);
for(const directory of directories){
  const {FkGate,FK_GATE_INPUT_ID}=await import(new URL('fk-gate.js',directory));
  // Exercise mapping, including all 15 columns and reordered/subset input.
  for(const selected of [edges,edges.toReversed(),edges.filter((_,i)=>i%3===0)]){
    const calls=[];
    const dimensions=Array(360).fill('0');
    const gate=new FkGate({sectorGate:true},'test',0,{assumed:true,key:'test',data:{
      groupOrder:'S6-lex-parity-v1',generatorEdges:selected,
      entries:[{degree:1,dimension:'0',sectorDimensions:dimensions}],
    }},selected.length);
    gate.bind({gn_fg_external_bind:()=>0,
      gn_fg_external_edge:(i,column)=>{calls.push([i,column]);return 0;},
      gn_fg_external_lower:()=>0,gn_fg_external_seal:()=>0,gn_fg_sector_mode:()=>0});
    assert.deepEqual(calls,selected.map((e,i)=>[i,edges.findIndex(v=>v[0]===e[0]&&v[1]===e[1])]),directory.href);
  }
  const {identityOf,sha256}=await import(new URL('storage.js',directory));
  const {verificationEntries}=await import(new URL('verification-bundle.js',directory));
  assert.equal(await identityOf(fixture,0),FK_GATE_INPUT_ID);
  async function manifest(input,policy,recount){
    const identity=await identityOf(input,0),degree=2;
    const cp={identity,completedThroughDegree:degree,basisSize:0,diskBytes:0};
    const checkpoint={schema:2,payload:cp,sha256:await sha256(JSON.stringify(cp))};
    const result={complete:true,storage:'opfs',runKey:'test',modulus:0,identity,
      completedThroughDegree:degree,basisSize:0,diskBytes:0,hilbert:{coefficients:['1','0',String(recount)]}};
    if(policy)result.hilbertEvidenceId=await sha256(JSON.stringify(policy));
    const files={'checkpoint-0.json':blob(checkpoint),'basis.gnb':new Blob([]),'hilbert-evidence.json':blob(policy)};
    const entries=await verificationEntries({fixture:input,result,
      openFile:async name=>{assert.ok(files[name],name);return files[name];},
      fetchAsset:async name=>new Blob([readFileSync(new URL('verification/'+name,directory))])});
    return JSON.parse(await entries[0].blob.text());
  }
  const policy={entries:[{degree:1,dimension:'9'},{degree:2,dimension:'12345678901234567890'}]};
  assert.equal((await manifest(smallFixture,policy,'12345678901234567890')).finalScalarRecount.expected,'12345678901234567890');
  assert.equal((await manifest(smallFixture,{entries:[]},'20')).finalScalarRecount.expected,null);
  assert.equal((await manifest(smallFixture,null,'20')).finalScalarRecount.expected,null);
  const profile=JSON.parse(readFileSync(new URL('verification/fk6-exact-through20.json',directory)));
  const expected=String(profile.dimensions[2]);
  assert.equal((await manifest(fixture,null,expected)).finalScalarRecount.expected,expected);
  assert.equal((await manifest(fixture,{entries:[{degree:1,dimension:'15'}]},expected)).finalScalarRecount.expected,expected);
  await assert.rejects(manifest(smallFixture,policy,'20'),/Final Hilbert count disagrees/);
}
console.log(`PASS: canonical C edge mapping and verification policy branches (${directories.length} web bundles)`);
