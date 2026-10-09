// SPDX-License-Identifier: MIT
// Explicit consumer of the USER-SUPPLIED FK Gate 0.3 profile. Proof package is
// not replayed by this runtime. A hash identifies an authority, not a proof.
import {checked} from './runtime.js';
export const FK_GATE_PROFILE_ID='a59b8f4d976066f4fd8619dcdaa194454f5c6c8aaad9f1df924b0fb5d5b99cd1';
export const FK_GATE_UPSTREAM_PROFILE_ID='5660d53b16742ee43ce3c8fde48cc29df2812a0d8372197998adebadc841db24';
export const FK_GATE_LEGACY_PROFILE_IDS=["76147ad7ff9d662a6cf568f4590e131095de157d5d6d09342b74993c2e08f76f", "a8d7ec405a7aa566c995b075d45de463dc83940db86891545ee6ea26da665314"];
// Prior authorities have identical dimensions through degree 16. Explicit
// acceptance of the current profile remains required when resuming those jobs.
const compatibleProfiles=[FK_GATE_PROFILE_ID,FK_GATE_UPSTREAM_PROFILE_ID,...FK_GATE_LEGACY_PROFILE_IDS];
export const sameFkGateProfile=(a,b)=>a===b||compatibleProfiles.includes(a)&&compatibleProfiles.includes(b);
export const FK_GATE_INPUT_ID='17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf';
export function fkGateApplicable(options,identity,modulus){return options.hilbertGate===true&&modulus===0&&identity===FK_GATE_INPUT_ID;}
export class FkGate {
 constructor(options,identity,modulus){
  this.enabled=fkGateApplicable(options,identity,modulus);this.identity=identity;
  this.sectors=options.hilbertSectors!==false;this.budget=options.gateBudgetBytes??128*1048576;
  if(!Number.isSafeInteger(this.budget)||this.budget<0)throw Error('gateBudgetBytes must be a nonnegative safe integer');
  this.e=null;this.events=[];this.counterError=null;
 }
 bind(e,memory){
  this.e=e;if(!this.enabled)return;
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
 metadata(){if(!this.enabled)return {};const snapshot=this.snapshot();return {fkGateProfileId:FK_GATE_PROFILE_ID,fkGateProfileVersion:'0.3.1',certifiedProfileThroughDegree:snapshot.certifiedProfileThroughDegree,completeDimensionThroughDegree:snapshot.completeDimensionThroughDegree,conditionalOnImportedFkDimensions:true,fkGateProofReplayedHere:false,fkGate:snapshot};}
}
