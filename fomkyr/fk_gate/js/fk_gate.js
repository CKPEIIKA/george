// SPDX-License-Identifier: MIT
// Small host wrapper. Module constants are trusted only after the offline
// certificate import/replay. No arbitrary runtime JSON can set a dimension.
const enc=new TextEncoder();
const word=(e,kind)=>{let n=0n;for(let i=3;i>=0;i--)n=(n<<32n)|BigInt(e.gn_fg_limb(kind,i)>>>0);return n.toString();};
export class FkGate {
 constructor(e,memory,{enabled=false,sectors=false,budgetBytes=64*1048576}={}){
  if(!Number.isSafeInteger(budgetBytes)||budgetBytes<0)throw Error("Invalid gate counter budget");this.sectors=sectors;this.e=e;this.memory=memory;this.enabled=enabled;this.budget=BigInt(budgetBytes);this.events=[];
  this.status=0;this.error=null;
 }
 bind(identity){
  if(!this.enabled)return 0;if(!/^[0-9a-f]{64}$/.test(identity))throw Error('Bad presentation identity');
  if(!this.e.gn_fg_bind)throw Error('FK Gate kernel adapter is not installed');
  new Uint8Array(this.memory.buffer,Number(this.e.gn_import_buffer()),64).set(enc.encode(identity));
  this.status=this.e.gn_fg_bind(64);if(this.status>0&&this.e.gn_fg_sector_mode(+this.sectors)<0)throw Error("FK Gate unsafe sector initialization");if(this.status<0)throw Error('FK Gate bind refused an unsafe state');return this.status;
 }
 failure(rc){
  // Failure of the optional counter must not make a resource-limited job fail.
  // Cancellation, proof inconsistency, corruption and bad state remain errors.
  if([-1,-2,-9].includes(rc)){this.error=`optional-counter-${-rc}`;this.status=0;return 0;}
  const ex=Object.assign(new Error(`FK Gate rejected state (${rc})`),{code:rc===-5?'CANCELLED':'HILBERT_GATE_REJECTED'});throw ex;
 }
 begin(){
  if(!this.enabled)return 0;const rc=this.e.gn_fg_begin(this.budget);this.status=rc<0?this.failure(rc):rc;
  this.events.push({type:'begin',...this.snapshot()});return this.status;
 }
 pollAndClose(){
  if(!this.enabled||this.status===0)return false;
  let rc=this.e.gn_fg_poll();if(rc<0)return !!this.failure(rc);this.status=rc;
  if(rc!==2)return false;
  rc=this.e.gn_fg_close(this.budget);if(rc<0)return !!this.failure(rc);
  this.status=rc;this.events.push({type:'closed',...this.snapshot()});return rc===3;
 }
 snapshot(){
  const e=this.e;if(!this.enabled)return{enabled:false};const usable=this.status>=1&&this.status<=3;return{
   enabled:true,status:this.status,degree:usable?Number(e.gn_fg_stat(0)):(Number(e.gn_stat(3))||Number(e.gn_stat(2))),normalUpper:usable?word(e,0):null,certifiedLower:usable?word(e,1):null,deficit:usable?word(e,2):null,
   closedDegrees:Number(e.gn_fg_stat(1)),polls:Number(e.gn_fg_stat(2)),fullCounts:Number(e.gn_fg_stat(3)),
   unvisitedOverlapsProvedRedundant:e.gn_fg_stat(4).toString(),countMicroseconds:e.gn_fg_stat(5).toString(),
   sectorSkips:e.gn_fg_stat(8).toString(),sectorCountMicroseconds:e.gn_fg_stat(9).toString(),sectorWorkspaceBytes:e.gn_fg_stat(10).toString(),sectorCounterError:Number(e.gn_fg_stat(11)),sectors:this.sectors,
   counterError:this.error,fullJobPercentage:null,certifiedProfileThroughDegree:Number(e.gn_fg_stat(14)),completeDimensionThroughDegree:Number(e.gn_fg_stat(15)),profileBoundKind:"exact-dimension",deficitIsExact:usable&&Number(e.gn_fg_stat(0))<=Number(e.gn_fg_stat(15))
  };
 }
}
