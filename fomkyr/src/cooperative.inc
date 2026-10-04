/* SPDX-License-Identifier: MIT
 * Quiescent cooperative completion. A wave ends at exact whole-rewrite safe
 * points, not at the slowest complete normal form. Suspended rows keep their
 * own arenas, hash tables, word queues, coefficients and original snapshot.
 * Ready rows are committed at a reader-free barrier; their exact NF is checked
 * against the updated basis. Task order may change, never ideal membership.
 * All uncommitted descriptors stay in the existing portable frontier. Live row
 * states are in-memory only and are replayed after process restart.
 */
typedef struct {
 GN_ATOMIC(u32) assigned[GN_MAX_WORKERS];
 u64 epochs,committed,nonprefix_commits,replays,commit_steps; GN_ATOMIC(u64) started,finished;
 GN_ATOMIC(u64) slice_us[GN_MAX_WORKERS],max_slice_us[GN_MAX_WORKERS];
 u64 ready_peak,parked_peak; GN_ATOMIC(u64) reserve_deferrals;
} Cooperative;
static Cooperative C;
API int gn_radix_cache(u32 enabled){if(enabled>1||S.current||S.input_expected)return GN_INPUT;S.radix_cache_enabled=enabled;return 0;}
API int gn_cooperative(u32 quantum_ms,u32 lookahead){
 if(quantum_ms>10000||lookahead<1||lookahead>BATCH_MAX||S.current||S.input_expected||S.nrules||GN_LOAD(&S.batch_running))return GN_STATE;
 memset(&C,0,sizeof(C));S.coop_ms=quantum_ms;S.coop_lookahead=lookahead;
 int rc=layout_workers(S.workers,0);
 if(rc==GN_MEMORY&&quantum_ms){S.coop_ms=0;return layout_workers(S.workers,0);}
 return rc;
}
static void coop_clear_lane(u32 lane){
 Lane*l=&S.lanes[lane];
 if(l->reserve_retry){l->a[l->active^1]=l->reserve_saved;l->reserve_retry=0;GN_UNLOCK(&S.reserve_lock);}
 if(l->reserve_owned){l->reserve_owned=0;GN_UNLOCK(&S.reserve_lock);}
 l->resume_tier=0;l->slice_enabled=0;l->error=0;l->busy=0;C.assigned[lane]=0;
}
API void gn_coop_discard(void){
 if(GN_LOAD(&S.batch_running))return;
 for(u32 i=0;i<S.workers;i++)coop_clear_lane(i);
 for(u32 i=0;i<S.batch_n;i++){S.tasks[i].rc=GN_STATE;S.tasks[i].output=0;S.tasks[i].bytes=0;}
}
static void coop_order(void){
 S.batch_work_n=0;
 for(u32 i=0;i<S.batch_n;i++)if(S.tasks[i].rc==GN_STATE||S.tasks[i].rc==GN_DEFERRED)S.batch_order[S.batch_work_n++]=i;
 /* Stable cost ordering within the bounded ready queue; running tasks are not
  * re-enqueued. The already parked task of each lane receives every next wave. */
 if(S.cost_scheduling&&S.workers>1)for(u32 span=1;span<S.batch_work_n;span*=2){
  for(u32 left=0;left<S.batch_work_n;left+=2*span){u32 mid=MIN(left+span,S.batch_work_n),end=MIN(left+2*span,S.batch_work_n),i=left,j=mid,k=left;
   while(i<mid||j<end){int first=j==end||(i<mid&&batch_weight(S.batch_order[i])>=batch_weight(S.batch_order[j]));S.batch_sort[k++]=first?S.batch_order[i++]:S.batch_order[j++];}}
  memcpy(S.batch_order,S.batch_sort,(size_t)S.batch_work_n*4);
 }
 GN_STORE(&S.batch_next,0);
 C.ready_peak=MAX(C.ready_peak,S.batch_work_n);
}
API int gn_coop_fill(u32 limit){
 if(!S.coop_ms||!S.batch_enabled||!S.current||GN_LOAD(&S.batch_running)||!limit||limit>BATCH_MAX)return -GN_STATE;
 if(cancelled())return -GN_CANCELLED;
 /* An existing persisted legacy prefix may have first/committed offsets. This
  * reader starts with an uncommitted compact descriptor array after restore. */
 if(S.batch_committed)return -GN_STATE;
 limit=MIN(limit,S.coop_lookahead);
 Lane*zero=&S.lanes[0];u32 f=zero->f,g=zero->g,k=zero->k,sn=zero->snapshot,error=zero->error;
 while(S.batch_n<limit){int rc=gn_next_pair(0);if(rc<=0){zero->f=f;zero->g=g;zero->k=k;zero->snapshot=sn;zero->error=error;if(rc<0)return rc;break;}
  S.tasks[S.batch_n++]=(BatchTask){zero->f,zero->g,zero->k,zero->snapshot,GN_STATE,0,0};}
 zero->f=f;zero->g=g;zero->k=k;zero->snapshot=sn;zero->error=error;
 S.batch_first=0;coop_order();if(S.batch_n){S.batch_epochs++;C.epochs++;}
 return (int)S.batch_n;
}
API int gn_coop_reduce(u32 lane){
 if(!S.coop_ms||lane>=S.workers||!S.current)return GN_STATE;
 Lane*l=&S.lanes[lane];double begin=gn_host_clock();l->slice_end=begin+S.coop_ms;l->slice_enabled=1;l->allow_repack=1;
 GN_FETCH_ADD(&S.batch_running,1);
 for(;;){
  if(cancelled())break;
  u32 index;
  if(C.assigned[lane])index=C.assigned[lane]-1;
  else {u32 next=GN_FETCH_ADD(&S.batch_next,1);if(next>=S.batch_work_n)break;index=S.batch_order[next];C.assigned[lane]=index+1;GN_FETCH_ADD(&C.started,1);l->resume_tier=0;l->error=0;
   BatchTask*t=&S.tasks[index];l->f=t->f;l->g=t->g;l->k=t->k;l->snapshot=t->snapshot;}
  BatchTask*t=&S.tasks[index];int rc;
  if(l->resume_tier){l->error=0;l->busy=1;publish_lane(l,0,0);rc=nf(l,t->snapshot);l->error=rc;l->busy=0;publish_lane(l,l->result.n,0);}
  else rc=gn_reduce_pair(lane);
  t->rc=(u32)rc;
  if(rc==GN_YIELD)break;
  if(rc==GN_DEFERRED)GN_FETCH_ADD(&C.reserve_deferrals,1);
  l->resume_tier=0;C.assigned[lane]=0;
  if(!rc&&l->result.n){
   if(S.certifying)t->rc=GN_REJECTED;
   else {u64 bytes=record_bytes(l->result);if(bytes>l->out_size-l->out_used||bytes>UINT32_MAX)t->rc=GN_BATCH_FULL;
    else{t->output=l->out_base+l->out_used;t->bytes=(u32)bytes;t->rc=(u32)write_record(l->result,t->output,bytes);if(!t->rc)l->out_used+=A8(bytes);}}
  }
  if(!t->rc)GN_FETCH_ADD(&C.finished,1);
  if(rc==GN_CANCELLED||gn_host_clock()>=l->slice_end)break;
 }
 l->slice_enabled=0;l->allow_repack=0;l->busy=0;publish_lane(l,0,0);
 double elapsed=(gn_host_clock()-begin)*1000;u64 use=elapsed>0?(u64)elapsed:0;C.slice_us[lane]+=use;C.max_slice_us[lane]=MAX(C.max_slice_us[lane],use);
 GN_FETCH_ADD(&S.batch_running,(u32)-1);return 0;
}
/* Coordinator memory is its own budgeted slice of the ordinary pool. Swapping
 * its descriptor into lane zero reuses existing exact commit/I/O routines and
 * cannot touch a parked worker's arrays. No reader is executing at this point. */
API int gn_coop_commit(void){
 if(!S.coop_ms||GN_LOAD(&S.batch_running)||!S.current)return GN_STATE;
 if(cancelled())return GN_CANCELLED;
 u32 keep[BATCH_MAX],map[BATCH_MAX],count=0;memset(keep,0,sizeof(keep));
 int rc=0,blocked=0;Lane saved=S.lanes[0];S.lanes[0]=coop_coordinator;
 for(u32 i=0;i<S.batch_n;i++){
  u32 st=S.tasks[i].rc;
  if(st==GN_STATE||st==GN_YIELD||st==GN_DEFERRED){keep[i]=1;blocked=1;continue;}
  if(st){rc=(int)st;break;}
  S.lanes[0].error=0;S.lanes[0].slice_enabled=0;S.lanes[0].resume_tier=0;S.lanes[0].allow_repack=1;
  u64 before=S.lanes[0].reductions;rc=batch_commit_impl(i);C.commit_steps+=S.lanes[0].reductions-before;
  S.lanes[0].allow_repack=0;
  if(rc==GN_DEFERRED){keep[i]=1;blocked=1;rc=0;continue;}
  if(rc)break;
  C.committed++;if(blocked)C.nonprefix_commits++;
  S.tasks[i].rc=UINT32_MAX; /* committed; remove even if a later task fails */
 }
 coop_coordinator=S.lanes[0];S.lanes[0]=saved;
 for(u32 i=0;i<S.batch_n;i++){
  map[i]=UINT32_MAX;if(S.tasks[i].rc!=UINT32_MAX){map[i]=count;S.tasks[count++]=S.tasks[i];}
 }
 for(u32 lane=0;lane<S.workers;lane++){
  if(C.assigned[lane]){u32 m=map[C.assigned[lane]-1];if(m==UINT32_MAX)return GN_STATE;C.assigned[lane]=m+1;}
  /* After successful commit all output records are consumed. On errors the
   * caller checkpoints descriptors before re-layout/discarding these buffers. */
  if(!rc){
   Lane*l=&S.lanes[lane];u64 used=0,after=0;
   /* Preserve ready-but-not-yet-committable outputs. Compact in source-address
    * order so a copy never destroys another live record. */
   for(;;){u32 best=UINT32_MAX;u64 offset=UINT64_MAX;
    for(u32 j=0;j<count;j++){BatchTask*t=&S.tasks[j];if(t->bytes&&t->output>=l->out_base+after&&t->output<l->out_base+l->out_size&&t->output<offset){best=j;offset=t->output;}}
    if(best==UINT32_MAX)break;BatchTask*t=&S.tasks[best];after=t->output-l->out_base+A8(t->bytes);
    memmove(PTR(u8,l->out_base+used),PTR(u8,t->output),t->bytes);t->output=l->out_base+used;used+=A8(t->bytes);
   }l->out_used=used;
  }
 }
 S.batch_n=count;S.batch_committed=S.batch_first=0;
 u32 parked=0;for(u32 i=0;i<S.workers;i++)parked+=!!C.assigned[i];C.parked_peak=MAX(C.parked_peak,parked);
 return rc;
}
API int gn_coop_retry(u32 workers){
 if(!S.coop_ms||GN_LOAD(&S.batch_running)||!workers||workers>=S.workers)return GN_STATE;
 C.replays+=S.batch_n;gn_coop_discard();int rc=layout_workers(workers,1);if(rc)return rc;
 S.memory_retries++;S.memory_replayed_pairs+=S.batch_n;coop_order();return 0;
}
API u64 gn_coop_stat(u32 key){
 switch(key){case 0:return S.coop_ms;case 1:return C.epochs;case 2:return GN_LOAD(&C.started);case 3:return GN_LOAD(&C.finished);
 case 4:return C.committed;case 5:return C.nonprefix_commits;case 6:return C.replays;
 case 12:return GN_LOAD(&C.reserve_deferrals);case 7:return S.batch_n;case 8:return C.commit_steps;case 9:return C.ready_peak;case 10:return C.parked_peak;case 11:return (S.scratch_size/(S.workers+1))&~UINT64_C(65535);
 default:break;}
 if(key>=100&&key<100+GN_MAX_WORKERS)return C.slice_us[key-100];
 if(key>=200&&key<200+GN_MAX_WORKERS)return C.max_slice_us[key-200];
 if(key>=300&&key<300+GN_MAX_WORKERS)return S.lanes[key-300].slice_yields;
 if(key>=400&&key<400+GN_MAX_WORKERS)return S.lanes[key-400].slice_resumes;
 if(key>=500&&key<500+GN_MAX_WORKERS)return C.assigned[key-500];
 return 0;
}
