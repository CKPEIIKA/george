// SPDX-License-Identifier: MIT
// Explicit consumer of the USER-SUPPLIED FK Gate 0.3 profile. Proof package is
// not replayed by this runtime. A hash identifies an authority, not a proof.
import {checked} from './runtime.js';
export const FK_GATE_PROFILE_ID='912695feee89836a27d1c2c6b3c9c1e38eb23ed283b9fb6b72736c49d9942ee3';
export const FK_GATE_UPSTREAM_PROFILE_ID='5660d53b16742ee43ce3c8fde48cc29df2812a0d8372197998adebadc841db24';
export const FK_GATE_LEGACY_PROFILE_IDS=["76147ad7ff9d662a6cf568f4590e131095de157d5d6d09342b74993c2e08f76f", "a8d7ec405a7aa566c995b075d45de463dc83940db86891545ee6ea26da665314", "a59b8f4d976066f4fd8619dcdaa194454f5c6c8aaad9f1df924b0fb5d5b99cd1"];
// Prior authorities have identical dimensions through degree 16. Explicit
// acceptance of the current profile remains required when resuming those jobs.
const compatibleProfiles=[FK_GATE_PROFILE_ID,FK_GATE_UPSTREAM_PROFILE_ID,...FK_GATE_LEGACY_PROFILE_IDS];
export const sameFkGateProfile=(a,b)=>a===b||compatibleProfiles.includes(a)&&compatibleProfiles.includes(b);
export const FK_GATE_INPUT_ID='17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf';
export function fkGateApplicable(options,identity,modulus){return options.hilbertGate===true&&modulus===0&&identity===FK_GATE_INPUT_ID;}
export class FkGate {
 constructor(options,identity,modulus,policy=null,generators=15){
  this.external=options.sectorGate===true;
  this.profileId=this.external?policy?.key:FK_GATE_PROFILE_ID;
  this.enabled=this.external||fkGateApplicable(options,identity,modulus);this.identity=identity;
  if(this.external){
   if(options.hilbertGate||modulus!==0||!policy?.assumed)throw Error('sectorGate requires explicitly assumed characteristic-zero dimensions and a separate profile');
   const d=policy.data;
   if(d.groupOrder!=='S6-lex-parity-v1'||!Array.isArray(d.generatorEdges)||d.generatorEdges.length!==generators||generators>15||!d.entries.length||d.entries.length>30)throw Error('Invalid external permutation-grade policy');
   this.edges=d.generatorEdges;this.entries=d.entries;
   const seen=new Set();for(const edge of this.edges){
    if(!Array.isArray(edge)||edge.length!==2||!edge.every(Number.isInteger)||edge[0]<1||edge[0]>=edge[1]||edge[1]>6||seen.has(edge.join(',')))throw Error('Label every generator by a distinct S6 edge');
    seen.add(edge.join(','));
   }
   let previous=0;for(const entry of this.entries){
    if(entry.degree!==++previous||!Array.isArray(entry.sectorDimensions)||entry.sectorDimensions.length!==360)throw Error('External sector policy requires consecutive degrees and 360 individual grades');
    let total=0n;for(const v of entry.sectorDimensions){
     if(typeof v==='number'&&!Number.isSafeInteger(v)||!/^(0|[1-9][0-9]*)$/.test(String(v)))throw Error('Large sector dimensions must use canonical decimal strings');
     const n=BigInt(v);if(n>(1n<<64n)-1n)throw Error('Sector dimension exceeds uint64');total+=n;
    }
    if(total!==BigInt(entry.dimension)||total>(1n<<64n)-1n)throw Error('External sector sum disagrees with the degree dimension');
   }
  }
  this.sectors=this.external||options.hilbertSectors!==false;this.budget=options.gateBudgetBytes??128*1048576;
  if(!Number.isSafeInteger(this.budget)||this.budget<0)throw Error('gateBudgetBytes must be a nonnegative safe integer');
  this.e=null;this.events=[];this.counterError=null;
 }
 bind(e,memory){
  this.e=e;if(!this.enabled)return;
  if(this.external){
   if(!e.gn_fg_external_bind)throw Error('Deploy matching external-sector JS and WASM');
   const edges=[[2,3],[2,4],[4,5],[1,5],[1,6],[3,6],[2,6],[3,5],[1,4],[3,4],[1,3],[1,2],[2,5],[5,6],[4,6]];
   checked(e.gn_fg_external_bind(this.entries.length));
   this.edges.forEach((edge,i)=>checked(e.gn_fg_external_edge(i,edges.findIndex(v=>v[0]===edge[0]&&v[1]===edge[1]))));
   for(const entry of this.entries)entry.sectorDimensions.forEach((v,g)=>checked(e.gn_fg_external_lower(entry.degree,g,BigInt(v))));
   checked(e.gn_fg_external_seal());const rc=e.gn_fg_sector_mode(1);if(rc<0)checked(-rc);return;
  }
  if(!e.gn_fg_bind)throw Error('The selected WASM module lacks the FK Gate integration');
  new Uint8Array(memory.buffer,Number(e.gn_import_buffer()),64).set(new TextEncoder().encode(this.identity));
  let rc=e.gn_fg_bind(64);if(rc<0)checked(-rc);if(!rc)throw Error('FK Gate identity rejected by kernel');
  rc=e.gn_fg_sector_mode(+this.sectors);if(rc<0)checked(-rc);
 }
 failure(rc){
  if([1,2,9].includes(-rc)){this.counterError=-rc;return false;}
  checked(-rc);return false;
 }
 begin(){if(!this.enabled)return;const rc=this.e.gn_fg_begin(BigInt(this.budget));if(rc<0)this.failure(rc);return this.snapshot();}
 tryClose(){
  if(!this.enabled||this.e.gn_fg_status()===0)return null;
  if(this.e.gn_fg_status()===3)return null;
  let rc=this.e.gn_fg_poll();if(rc<0){this.failure(rc);return null;}
  if(rc!==2)return null;rc=this.e.gn_fg_close(BigInt(this.budget));
  if(rc<0){this.failure(rc);return null;}if(rc!==3)return null;
  const event={degree:Number(this.e.gn_stat(3)),...this.snapshot()};this.events.push(event);return event;
 }
 active(){return this.enabled&&this.e?.gn_fg_status()>0;}
 count(item){let v=0n;for(let i=3;i>=0;i--)v=(v<<32n)|BigInt(this.e.gn_fg_limb(item,i)>>>0);return v.toString();}
 snapshot(){
  if(!this.enabled||!this.e)return {enabled:false};const e=this.e,g=k=>Number(e.gn_fg_stat(k)),available=e.gn_fg_status()>0;
  return {enabled:true,countAvailable:available,status:e.gn_fg_status(),degree:g(0),sectors:this.sectors,sectorSkips:g(8),suspendedSkips:g(17),commitSkips:g(18),closedDegrees:g(1),unvisitedSkipped:g(4),countMicroseconds:g(5),sectorCountMicroseconds:g(9),counterWorkspaceBytes:g(10),counterError:g(11)||this.counterError,closedSectors:g(20),sectorReady:!!g(16),upper:available?this.count(0):null,lower:available?this.count(1):null,deficit:available?this.count(2):null,profileThroughDegree:g(14),certifiedProfileThroughDegree:g(14),completeDimensionThroughDegree:g(15),deficitIsNotETA:true};
 }
 metadata(){if(!this.enabled)return {};const snapshot=this.snapshot();return {fkGateProfileId:this.profileId,fkGateProfileVersion:'0.7.5',externalSectorPolicy:this.external,certifiedProfileThroughDegree:snapshot.certifiedProfileThroughDegree,completeDimensionThroughDegree:snapshot.completeDimensionThroughDegree,conditionalOnImportedFkDimensions:true,fkGateProofReplayedHere:false,fkGate:snapshot};}
}
