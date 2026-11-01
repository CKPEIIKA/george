// SPDX-License-Identifier: MIT
// Independent lower-bound authorization, not a fit to this run's normal words.
import {sha256} from './storage.js';
import {checked} from './runtime.js';
const U64=(1n<<64n)-1n,I64=(1n<<63n)-1n;
const fail=m=>{const e=new Error(m);e.code='HILBERT_EVIDENCE';throw e;};
function integer(v,signed=false){if(typeof v==='number'&&!Number.isSafeInteger(v))fail('Large Hilbert integers must be decimal strings');let n;try{if(!/^-?(0|[1-9][0-9]*)$/.test(String(v)))fail('Noncanonical integer in Hilbert evidence');n=BigInt(v);}catch{fail('Invalid Hilbert integer');}if(n<(signed?-I64-1n:0n)||n>(signed?I64:U64))fail('Hilbert witness/bound exceeds the supported integer replay format');return n;}
function index(v){if(!Number.isInteger(v)||v<0||v>0xfffffffe)fail('Invalid Hilbert degree/column index');return v;}
export async function prepareHilbertClosure(option,identity,modulus){
 if(option===undefined||option===null||option===false)return null;
 if(typeof option!=='object'||!!option.certificate===!!option.assume)fail('Choose a replayable certificate OR explicitly assumed dimensions');
 const assumed=!!option.assume;let data;try{data=JSON.parse(JSON.stringify(assumed?option.assume:option.certificate));}catch{fail("Hilbert evidence must be JSON data");}
 if(!data||data.schema!==1||data.kind!==(assumed?'external-dimensions':'integer-duals'))fail('Unsupported Hilbert evidence schema/kind');
 if(data.identity!==identity||data.modulus!==modulus)fail('Hilbert evidence input/order/field mismatch');
 if(!Array.isArray(data.entries)||data.entries.length>1024)fail('Invalid Hilbert entries');
 let previous=0;for(const e of data.entries){const d=index(e.degree);if(!d||d<=previous)fail('Hilbert degrees must be strictly increasing');previous=d;integer(e.dimension);}
 const text=JSON.stringify(data);if(new TextEncoder().encode(text).length>64*1048576)fail('Hilbert evidence exceeds 64 MiB');
 return {data,assumed,key:await sha256(text),entries:new Map(data.entries.map(e=>[e.degree,e])),events:[],verified:false};
}
export function replayHilbertCertificate(e,fixture,policy,budget){
 if(!policy)return;if(policy.assumed){policy.verified=false;return;}
 for(const entry of policy.data.entries){
  const d=entry.degree,dim=integer(entry.dimension);if(dim>0xffffffffn)fail('Dual witness dimension too large');
  if(!Array.isArray(entry.pivots)||!Array.isArray(entry.vectors)||entry.pivots.length!==Number(dim)||entry.vectors.length!==Number(dim))fail('Invalid dual vector count');
  const rels=fixture.relations.filter(r=>r.degree<=d),terms=rels.reduce((n,r)=>n+r.terms.length,0);
  try{
   checked(e.gn_lb_begin(d,Number(dim),rels.length,terms,BigInt(Math.floor(Math.min(64*1048576,budget-Number(e.gn_stat(4)))))));
   entry.pivots.forEach((p,i)=>checked(e.gn_lb_pivot(i,index(p))));
   for(const r of rels){checked(e.gn_lb_relation(r.degree,r.terms.length));for(const t of r.terms){let w=0;for(const letter of t.word)w=w*fixture.variables.length+letter;checked(e.gn_lb_term(index(w),integer(t.coefficient,true)));}}
   entry.vectors.forEach((v,i)=>{
    if(!Array.isArray(v))fail('Invalid sparse dual');checked(e.gn_lb_vector(i));
    for(const pair of v){if(!Array.isArray(pair)||pair.length!==2)fail('Invalid dual term');checked(e.gn_lb_entry(index(pair[0]),integer(pair[1],true)));}
    checked(e.gn_lb_check());
   });checked(e.gn_lb_finish());
  }finally{e.gn_lb_release();}
 }
 policy.verified=true;
}
export function hilbertMetadata(policy){return policy?{hilbertEvidenceId:policy.key,hilbertEvidenceMode:policy.assumed?'external-assumption':'replayed-integer-duals',conditionalOnExternalDimensions:policy.assumed,hilbertClosureEvents:[...policy.events]}:{};}
export function beginHilbertClosure(e,policy,budget){
 if(!policy)return null;const entry=policy.entries.get(Number(e.gn_stat(3)));if(!entry)return null;
 const rc=e.gn_hilbert_gate_begin(BigInt(entry.dimension),BigInt(Math.max(0,Math.floor(Math.min(256*1048576,budget-Number(e.gn_stat(4)))))));
 if(rc===1||rc===9)return {declined:true,code:rc};checked(rc);return {declined:false};
}
export function tryHilbertClosure(e,policy){
 if(!policy||!e.gn_hilbert_gate_stat(0)||e.gn_hilbert_gate_stat(3))return null;
 const rc=e.gn_hilbert_gate_try();if(rc<0)checked(-rc);if(!rc)return null;
 const event={degree:Number(e.gn_stat(3)),dimension:e.gn_hilbert_gate_stat(2).toString(),basisSize:Number(e.gn_stat(0)),individuallyCommittedPairs:Number(e.gn_progress_stat(2)),overlapsBypassed:Number(e.gn_hilbert_gate_stat(5)),notYetEnumerated:Number(e.gn_hilbert_gate_stat(8)),scheduledNotCommitted:Number(e.gn_hilbert_gate_stat(9))};
 policy.events.push(event);return event;
}

export function hilbertGap(e,policy){
 if(!policy||!e.gn_hilbert_gate_stat(0))return null;
 const upper=e.gn_hilbert_gate_stat(1),lower=e.gn_hilbert_gate_stat(2);
 return {degree:Number(e.gn_hilbert_gate_stat(6)),upper:upper.toString(),lower:lower.toString(),gap:(upper-lower).toString(),authority:policy.assumed?'external-assumption':'replayed-integer-duals',notAnETA:true,interpretation:'upper bound on the leading-word deficit; exact only when the supplied lower bound is the exact dimension'};
}

export function closureBatchLimit(e,limit,workers){
 if(!e.gn_hilbert_gate_stat(0))return limit;
 const upper=e.gn_hilbert_gate_stat(1),lower=e.gn_hilbert_gate_stat(2);
 if(upper<lower||upper-lower>BigInt(limit))return limit;
 return Math.min(limit,Math.max(workers,2*Number(upper-lower)));
}
