/* SPDX-License-Identifier: MIT
 * Lease metadata changes only with all readers joined. Workers acquire/release
 * immutable arena descriptions; row growth replaces one lease, never every lane.
 * Retired arenas remain budgeted and are reused instead of leaking each growth.
 */
#define COMMIT_RESERVE_SLOT (GN_RESERVE_SLOTS+1u)
#define ROW_WAIT_RESERVE 1u
#define ROW_WAIT_GROW 2u
#define ROW_WAIT_OUTPUT 3u
#define ROW_WAIT_BATCH 4u
static u32 reserve_pool_limit(void){return S.reserve_pool_limit?S.reserve_pool_limit:MIN(GN_RESERVE_SLOTS,S.workers+(S.coop_ms?1u:0u));}
static u64 reserve_slot_base(u32 slot){return slot==COMMIT_RESERVE_SLOT?S.commit_reserve_base:slot==1?S.reserve_base:S.reserve_extra_base[slot-2];}
static u64 reserve_slot_bytes(u32 slot){return slot==COMMIT_RESERVE_SLOT?S.commit_reserve_bytes:slot==1?S.reserve_bytes:S.reserve_extra_bytes[slot-2];}
static GN_ATOMIC(u32)*reserve_slot_lock(u32 slot){return slot==COMMIT_RESERVE_SLOT?&S.commit_reserve_lock:slot==1?&S.reserve_lock:&S.reserve_extra_lock[slot-2];}
static void reserve_slot_set(u32 slot,u64 base,u64 bytes){
 if(slot==COMMIT_RESERVE_SLOT){S.commit_reserve_base=base;S.commit_reserve_bytes=bytes;}
 else if(slot==1){S.reserve_base=base;S.reserve_bytes=bytes;}
 else{S.reserve_extra_base[slot-2]=base;S.reserve_extra_bytes[slot-2]=bytes;}
}
static u32 reserve_pool_busy(void){
 u32 n=!!GN_LOAD(&S.reserve_lock)+!!GN_LOAD(&S.commit_reserve_lock);
 for(u32 i=0;i<S.reserve_extra_count;i++)n+=!!GN_LOAD(&S.reserve_extra_lock[i]);return n;
}
static u64 reserve_lease_base(Lane*l){return reserve_slot_base(l->reserve_slot);}
static u64 reserve_lease_bytes(Lane*l){return reserve_slot_bytes(l->reserve_slot);}
static int reserve_acquire(Lane*l){
 if(l->no_reserve||l->reserve_slot)return 0;
 if(l->is_commit&&S.commit_reserve_base){
  if(GN_TRY_LOCK(&S.commit_reserve_lock)){l->reserve_slot=COMMIT_RESERVE_SLOT;return 1;}
  return 0;
 }
 if(!S.reserve_base)return 0;
 u32 count=MIN(1+S.reserve_extra_count,reserve_pool_limit());
 /* Prefer a large idle lease after an arena exchange. */
 for(u32 pass=0;pass<count;pass++){
  u32 best=0;u64 largest=0;
  for(u32 slot=1;slot<=count;slot++)if(!GN_LOAD(reserve_slot_lock(slot))&&reserve_slot_bytes(slot)>largest){best=slot;largest=reserve_slot_bytes(slot);}
  if(!best)break;if(GN_TRY_LOCK(reserve_slot_lock(best))){l->reserve_slot=best;return 1;}
 }
 for(u32 i=0;i<count;i++)if(GN_TRY_LOCK(reserve_slot_lock(i+1))){l->reserve_slot=i+1;return 1;}
 if(!S.reserve_pool_denied&&count<reserve_pool_limit())GN_STORE(&S.reserve_pool_requested,1);
 return 0;
}
static void reserve_release(Lane*l){
 if(l->coefficient_extra_slot){GN_UNLOCK(reserve_slot_lock(l->coefficient_extra_slot));l->coefficient_extra_slot=0;}
 if(l->reserve_slot){GN_UNLOCK(reserve_slot_lock(l->reserve_slot));l->reserve_slot=0;}
}
static void workspace_return(u64 base,u64 bytes){
 if(!base||!bytes)return;
 /* Free byte ranges may come from non-coefficient metadata. Keep every lease
  * compatible with the three-bit coefficient tag, including reused ranges. */
 u64 aligned=A8(base),padding=aligned-base;if(aligned<base||padding>=bytes)return;
 base=aligned;bytes=(bytes-padding)&~UINT64_C(7);if(!bytes)return;
 S.reserve_pool_denied=0;
 /* Coalesce neighbors; every returned range has a single owner. */
 for(u32 i=0;i<S.spare_count;){
  if(S.spare_base[i]+S.spare_bytes[i]==base){base=S.spare_base[i];bytes+=S.spare_bytes[i];}
  else if(base+bytes==S.spare_base[i])bytes+=S.spare_bytes[i];
  else{i++;continue;}
  S.spare_count--;S.spare_base[i]=S.spare_base[S.spare_count];S.spare_bytes[i]=S.spare_bytes[S.spare_count];i=0;
 }
 if(S.spare_count<2*GN_RESERVE_SLOTS){u32 i=S.spare_count++;S.spare_base[i]=base;S.spare_bytes[i]=bytes;}
 /* An untracked free range still counts against S.bump; never overcommit. */
}
static u64 workspace_take(u64*bytes){
 u64 need=(*bytes+65535)&~UINT64_C(65535);u32 best=UINT32_MAX;
 for(u32 i=0;i<S.spare_count;i++)if(S.spare_bytes[i]>=need&&(best==UINT32_MAX||S.spare_bytes[i]<S.spare_bytes[best]))best=i;
 if(best!=UINT32_MAX){
  u64 base=S.spare_base[best],have=S.spare_bytes[best];S.spare_count--;
  S.spare_base[best]=S.spare_base[S.spare_count];S.spare_bytes[best]=S.spare_bytes[S.spare_count];
  workspace_return(base+need,have-need);*bytes=need;return base;
 }
 u64 headroom=MAX(UINT64_C(1048576),S.budget/128),base=A8(S.bump);
 if(base<S.bump||base>S.budget||headroom>S.budget-base||need>S.budget-base-headroom||!gn_host_ensure(base+need))return 0;
 S.bump=base+need;S.allocated_peak=MAX(S.allocated_peak,S.bump);*bytes=need;return base;
}
/* Claim only an arena's missing suffix, with all workers joined. A large row
 * must not require two complete arenas when its neighbor is already free.
 * The caller returns this suffix if its relocation preflight cannot proceed. */
static int workspace_extend(u64 base,u64 oldbytes,u64*bytes){
 if(GN_LOAD(&S.batch_running)||*bytes<=oldbytes||*bytes>UINT64_MAX-65535)return 0;
 u64 need=(*bytes+65535)&~UINT64_C(65535),end=base+oldbytes,extra=need-oldbytes;
 for(u32 i=0;i<S.spare_count;i++)if(S.spare_base[i]==end&&S.spare_bytes[i]>=extra){
  S.spare_base[i]+=extra;S.spare_bytes[i]-=extra;
  if(!S.spare_bytes[i]){S.spare_count--;S.spare_base[i]=S.spare_base[S.spare_count];S.spare_bytes[i]=S.spare_bytes[S.spare_count];}
  *bytes=need;return 1;
 }
 u64 headroom=MAX(UINT64_C(1048576),S.budget/128);
 if(end!=S.bump||S.bump>S.budget||headroom>S.budget-S.bump||extra>S.budget-S.bump-headroom||!gn_host_ensure(S.bump+extra))return 0;
 S.bump+=extra;S.allocated_peak=MAX(S.allocated_peak,S.bump);*bytes=need;return 1;
}
/* Joined-wave admission uses this row's requirement. Failure to admit the
 * initial large reserve does not forbid a smaller, budgeted worker lease. */
static int reserve_acquire_sized(Lane*l,u64 bytes){
 if(l->reserve_slot)return 1;
 if(reserve_acquire(l))return 1;
 if(l->no_reserve||GN_LOAD(&S.batch_running)||!S.reserve_base||
    (l->is_commit&&S.commit_reserve_base)||1+S.reserve_extra_count>=reserve_pool_limit())return 0;
 u64 base=workspace_take(&bytes);if(!base)return 0;
 u32 i=S.reserve_extra_count++;S.reserve_extra_base[i]=base;S.reserve_extra_bytes[i]=bytes;
 GN_STORE(&S.reserve_extra_lock[i],1);l->reserve_slot=i+2;
 S.reserve_pool_admissions++;S.reserve_pool_denied=0;GN_STORE(&S.reserve_pool_requested,0);return 1;
}
static void reserve_pool_admit(void){
 if(!GN_LOAD(&S.reserve_pool_requested)||GN_LOAD(&S.batch_running))return;
 GN_STORE(&S.reserve_pool_requested,0);
 if(!S.reserve_base||S.reserve_pool_denied||1+S.reserve_extra_count>=reserve_pool_limit())return;
 u64 bytes=S.reserve_initial_bytes,base=workspace_take(&bytes);
 if(!base){S.reserve_pool_denied=1;S.reserve_pool_declines++;return;}
 u32 i=S.reserve_extra_count++;S.reserve_extra_base[i]=base;S.reserve_extra_bytes[i]=bytes;
 GN_STORE(&S.reserve_extra_lock[i],0);S.reserve_pool_admissions++;
}
/* Keep the source lease locked until its exact row has been copied successfully.
 * A free larger worker lease may be exchanged with the commit lease, but a
 * worker can never acquire the private commit lease itself. */
static u64 reserve_growth_target(Lane*l,u64*bytes,u32*other){
 *other=0;
 for(u32 slot=1;slot<=1+S.reserve_extra_count;slot++){
  if(slot==l->reserve_slot||reserve_slot_bytes(slot)<*bytes)continue;
  if(GN_TRY_LOCK(reserve_slot_lock(slot))){*other=slot;*bytes=reserve_slot_bytes(slot);return reserve_slot_base(slot);}
 }
 return workspace_take(bytes);
}
static void reserve_growth_cancel(u64 base,u64 bytes,u32 other){if(other)GN_UNLOCK(reserve_slot_lock(other));else workspace_return(base,bytes);}
static void reserve_growth_commit(Lane*l,u64 base,u64 bytes,u32 other){
 u64 old=reserve_lease_base(l),oldbytes=reserve_lease_bytes(l);
 reserve_slot_set(l->reserve_slot,base,bytes);
 if(other){reserve_slot_set(other,old,oldbytes);GN_UNLOCK(reserve_slot_lock(other));}
 else workspace_return(old,oldbytes);
 S.reserve_pool_denied=0;
}
