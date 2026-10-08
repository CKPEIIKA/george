/* SPDX-License-Identifier: MIT
 * Optional exact, immutable cache of fully reduced COMPLETED-degree reducers.
 * Birth records, LMs, IDs, rule arities and checkpoint hashes stay untouched.
 * Each NF pins a publication generation: a suspended tail iterator cannot see
 * a changed representation after another wave publishes a cached reducer.
 * Only the coordinator builds/publishes; workers enqueue bounded requests.
 */
API int gn_tail_cache_config(u64 bytes){
 if(S.current||S.input_expected||S.nrules||GN_LOAD(&S.batch_running)||T.base)return GN_STATE;
 T.requested_bytes=bytes;if(!bytes)return 0;
 if(bytes<UINT64_C(16777216)||bytes>S.budget)return GN_INPUT;
 bytes&=~UINT64_C(65535);
 /* The last ordinary lane is reserved for preparation. No worker setting is
  * reduced to admit an optional cache. Allocation failure keeps exact fallback. */
 if(S.workers>=GN_MAX_WORKERS||S.lane_slots>=GN_MAX_WORKERS||bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes)){T.declined++;return 0;}
 T.base=S.bump;T.capacity=(bytes/2)&~UINT64_C(65535);T.workspace=T.base+T.capacity;T.workspace_bytes=bytes-T.capacity;
 S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return 0;
}
API u64 gn_tail_cache_stat(u32 key){switch(key){
 case 0:return T.requested_bytes;case 1:return !!T.base;case 2:return T.capacity;case 3:return T.used;case 4:return T.workspace_bytes;
 case 5:return GN_LOAD(&T.hits);case 6:return GN_LOAD(&T.misses);case 7:return GN_LOAD(&T.queued);case 8:return T.attempts;
 case 9:return T.built;case 10:return T.declined;case 11:return T.saved_terms;case 12:return T.saved_bytes;case 13:return T.build_us;
 case 14:return T.generation;case 15:return T.floor;default:return 0;}}
static int tail_cache_prepare(void){
 if(!T.base||S.certifying||GN_LOAD(&S.batch_running)||S.input_expected||S.workers>=GN_MAX_WORKERS||S.lane_slots>=GN_MAX_WORKERS)return 0;
 while(T.floor<S.nrules&&rule(T.floor+1)->degree<=S.completed)T.floor++;
 if(!T.floor||T.capacity-T.used<sizeof(Record)+2*sizeof(Term))return 0;
 u32 id=0;
 for(u32 n=0;n<TAIL_REQUESTS;n++){
  u32 slot=T.cursor++&(TAIL_REQUESTS-1),candidate=GN_LOAD(&T.requests[slot]);GN_STORE(&T.requests[slot],0);
  if(candidate&&candidate<=T.floor&&!rule(candidate)->tail_cache&&!rule(candidate)->tail_tried){id=candidate;break;}
 }
 if(!id)return 0;
 Rule*r=rule(id);r->tail_tried=1;T.attempts++;
 Lane*l=&S.lanes[GN_MAX_WORKERS-1];memset(l,0,sizeof(*l));layout_one(l,T.workspace,T.workspace_bytes);
 l->resume_slot=GN_MAX_WORKERS-1;l->no_reserve=1;l->tail_generation=T.generation;l->tail_snapshot=T.floor;
 if(r->bytes>l->io_size||r->n>65536){T.declined++;return 0;}
 T.building=1;double start=gn_host_clock();int rc=0;
 reset_a(&l->a[0]);reset_a(&l->a[1]);Poly original=load_rule(id,l);
 if(l->error){rc=l->error;goto done;}
 u32 pos=0;
 if(divisor(r->lm,r->degree,T.floor,&pos,l)!=id){T.declined++;goto done;}
 /* A fully normal tail needs no derived record. */
 u32 j=1;
 for(;j<original.n;j++){
  if(!(j&255)&&cancelled()){rc=GN_CANCELLED;goto done;}
  if(divisor(pw(original,j),original.degree,T.floor,&pos,l))break;
 }
 if(j==original.n)goto done;
 l->result=copy_poly(original,&l->a[0],(Word){0,0},(Word){0,0},0,original.degree);l->active=0;
 if(l->a[0].error){T.declined++;goto done;}
 l->skip_rule=id;l->slice_enabled=1;l->slice_end=gn_host_clock()+20.0;
 rc=nf(l,T.floor);l->skip_rule=0;
 /* Unfinished or over-budget normalization is never published. Its workspace
  * belongs only to this builder; discarding it cannot damage a parked task. */
 if(rc==GN_YIELD||rc==GN_SCRATCH||rc==GN_REPACK||rc==GN_DEFERRED||rc==GN_BATCH_FULL||rc==GN_LIMIT||rc==GN_MEMORY){T.declined++;rc=0;goto done;}
 if(rc)goto done;
 if(!l->result.n||!weq(pw(l->result,0),r->lm)){T.declined++;goto done;}
 u64 bytes=record_bytes(l->result);
 if(l->result.n>r->n||bytes>r->bytes||bytes>T.capacity-T.used){T.declined++;goto done;}
 u64 at=T.base+T.used;rc=write_record(l->result,at,T.capacity-T.used);if(rc)goto done;
 rc=validate_record(at,(u32)bytes);if(rc)goto done;
 r->tail_cache=at;r->tail_snapshot=T.floor;r->tail_generation=++T.generation;T.used+=A8(bytes);T.built++;
 T.saved_terms+=(u64)r->n-l->result.n;T.saved_bytes+=r->bytes-bytes;
done:
 l->skip_rule=0;l->resume_tier=0;l->slice_enabled=0;l->error=0;l->busy=0;T.building=0;
 T.build_us+=(u64)((gn_host_clock()-start)*1000);return rc;
}
