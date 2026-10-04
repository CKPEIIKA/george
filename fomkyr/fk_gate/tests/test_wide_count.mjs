// This is a host conversion test, not a mock algebra certificate. Mathematical
// profile verification and real WASM execution are tested separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FkGate} from '../js/fk_gate.js';
const h=4735557180n;
const values=[h+1n,h,1n];
const e={gn_fg_limb:(kind,i)=>Number((values[kind]>>BigInt(32*i))&0xffffffffn),gn_fg_stat:i=>BigInt(i===0||i===14||i===15?17:0)};
const g=new FkGate(e,{buffer:new ArrayBuffer(64)},{enabled:true,sectors:true});g.status=1;
const s=g.snapshot();assert.equal(s.normalUpper,'4735557181');assert.equal(s.certifiedLower,'4735557180');assert.equal(s.deficit,'1');assert.equal(s.certifiedProfileThroughDegree,17);assert.equal(s.deficitIsExact,true);
// Do not accidentally assume totals fit either uint32 or IEEE-754 exact integers.
values[0]=(1n<<100n)+123n;values[1]=(1n<<99n)+7n;values[2]=values[0]-values[1];
const big=g.snapshot();for(const [key,i] of [['normalUpper',0],['certifiedLower',1],['deficit',2]])assert.equal(big[key],values[i].toString());
assert.equal(Number(h&0xffffffffn),440589884);
const r={passed:true,degree17TotalBeyondUint32:h.toString(),uint32TruncationWouldBe:440589884,hostCounter128BitDecimalPreserved:true,allCountersRemainStrings:true};
fs.mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../evidence/wide-counter-tests.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
