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
 GN_ATOMIC(u32) helper_assigned[GN_MAX_WORKERS];
 GN_ATOMIC(u64) helper_started,helper_finished,helper_deferred;
 u32 helpers_enabled;
 u64 epochs,committed,nonprefix_commits,replays,commit_steps; GN_ATOMIC(u64) started,finished;
 GN_ATOMIC(u64) slice_us[GN_MAX_WORKERS],max_slice_us[GN_MAX_WORKERS];
 GN_ATOMIC(u32) exhausted[GN_MAX_WORKERS];
 u64 ready_peak,parked_peak; GN_ATOMIC(u64) reserve_deferrals;
 u32 policy,max_window,window,window_degree;u64 window_expansions,sector_orderings;
 u64 work_gap[BATCH_MAX],work_cost[BATCH_MAX];u32 sector_order;
 u32 commit_task,commit_snapshot;u64 commit_yields,commit_resumes;
 u32 commit_ready,commit_error;u64 prepared_slices;
} Cooperative;
static Cooperative C;
/* A completed NF retained in its lane while earlier output records await commit.
 * This is internal state; durable frontiers still store ordinary descriptors. */
#define COOP_OUTPUT_WAIT UINT32_C(0xfffffffe)
#define COOP_HELPER_DEFERRED UINT32_C(0xfffffffd)
API int gn_radix_cache(u32 enabled){if(enabled>1||S.current||S.input_expected)return GN_INPUT;S.radix_cache_enabled=enabled;return 0;}
API int gn_cooperative(u32 quantum_ms,u32 lookahead){
 if(quantum_ms>10000||lookahead<1||lookahead>BATCH_MAX||S.current||S.input_expected||S.nrules||GN_LOAD(&S.batch_running))return GN_STATE;
 memset(&C,0,sizeof(C));C.policy=3;C.max_window=BATCH_MAX;C.helpers_enabled=1;S.coop_ms=quantum_ms;S.coop_lookahead=lookahead;
 int rc=layout_workers(S.workers,0);
 if(rc==GN_MEMORY&&quantum_ms){S.coop_ms=0;return layout_workers(S.workers,0);}
 return rc;
}
API int gn_coop_policy(u32 flags,u32 max_window){
 if(flags>3||!max_window||max_window>BATCH_MAX||((flags&1)&&max_window<S.coop_lookahead))return GN_INPUT;
 if(S.current||S.input_expected||S.nrules||GN_LOAD(&S.batch_running))return GN_STATE;
 C.policy=flags;C.max_window=MAX(max_window,S.coop_lookahead);return 0;
}
API int gn_coop_helper_mode(u32 enabled){
 if(enabled>1||S.current||S.input_expected||S.nrules||GN_LOAD(&S.batch_running))return GN_STATE;
 C.helpers_enabled=enabled;return 0;
}
static void coop_release_lane(Lane*l){
 if(l->reserve_retry){l->a[l->active^1]=l->reserve_saved;l->reserve_retry=0;GN_UNLOCK(&S.reserve_lock);}
 if(l->reserve_owned){l->reserve_owned=0;GN_UNLOCK(&S.reserve_lock);}
 l->resume_tier=0;l->slice_enabled=0;l->error=0;l->busy=0;l->reserve_waiting=0;
}
static void coop_clear_lane(u32 lane){
 coop_release_lane(&S.lanes[lane]);GN_STORE(&C.assigned[lane],0);
 coop_release_lane(&coop_helpers[lane]);GN_STORE(&C.helper_assigned[lane],0);
}
API void gn_coop_discard(void){
 if(GN_LOAD(&S.batch_running))return;
 for(u32 i=0;i<S.workers;i++)coop_clear_lane(i);
 if(C.commit_task){Lane saved=S.lanes[0];S.lanes[0]=coop_coordinator;coop_clear_lane(0);coop_coordinator=S.lanes[0];S.lanes[0]=saved;C.commit_task=0;}
 C.commit_ready=C.commit_error=0;
 for(u32 i=0;i<S.batch_n;i++){S.tasks[i].rc=GN_STATE;S.tasks[i].output=0;S.tasks[i].bytes=0;}
}
static int coop_before(u32 a,u32 b){
 if(C.sector_order){
  /* A small remaining component deficit makes a cheap new leader especially
   * useful: closure can retire other exact rows in that same component. */
  if(C.work_gap[a]!=C.work_gap[b])return C.work_gap[a]<C.work_gap[b];
  return C.work_cost[a]<=C.work_cost[b];
 }
 return C.work_cost[a]>=C.work_cost[b];
}
static void coop_order(void){
 S.batch_work_n=0;
 for(u32 i=0;i<S.batch_n;i++)if(S.tasks[i].rc==GN_STATE||S.tasks[i].rc==GN_DEFERRED||S.tasks[i].rc==COOP_HELPER_DEFERRED)S.batch_order[S.batch_work_n++]=i;
 C.sector_order=!!(C.policy&2)&&S.fg_sector_ready&&S.fgate.degree==S.current&&
  !S.certifying&&S.fgate.status>=FKG_ACTIVE&&S.fgate.status<=FKG_READY;
 for(u32 j=0;j<S.batch_work_n;j++){
  u32 i=S.batch_order[j];C.work_cost[i]=batch_weight(i);
  if(C.sector_order){BatchTask*t=&S.tasks[i];u32 group=fg_pair_group(t->f,t->g,t->k);
   u64 lower=fkg_class_per_grade[S.current][fkg_group_class[S.current&1][group]];
   C.work_gap[i]=S.fg_sector_upper[group]>=lower?S.fg_sector_upper[group]-lower:UINT64_MAX;
  }
 }
 /* Short rows already finish within a wave. Component closure ordering targets
  * substantial input records; ordinary rows retain the established cost order. */
 if(C.sector_order){u64 largest=0;for(u32 j=0;j<S.batch_work_n;j++)largest=MAX(largest,C.work_cost[S.batch_order[j]]);if(largest<65536)C.sector_order=0;}
 /* Stable cost ordering within the bounded ready queue; running tasks are not
  * re-enqueued. The already parked task of each lane receives every next wave. */
 if(S.cost_scheduling&&S.workers>1)for(u32 span=1;span<S.batch_work_n;span*=2){
  for(u32 left=0;left<S.batch_work_n;left+=2*span){u32 mid=MIN(left+span,S.batch_work_n),end=MIN(left+2*span,S.batch_work_n),i=left,j=mid,k=left;
   while(i<mid||j<end){int first=j==end||(i<mid&&coop_before(S.batch_order[i],S.batch_order[j]));S.batch_sort[k++]=first?S.batch_order[i++]:S.batch_order[j++];}}
  memcpy(S.batch_order,S.batch_sort,(size_t)S.batch_work_n*4);
 }
 GN_STORE(&S.batch_next,0);
 C.ready_peak=MAX(C.ready_peak,S.batch_work_n);
 if(C.sector_order&&S.batch_work_n)C.sector_orderings++;
}
API int gn_coop_fill(u32 limit){
 if(!S.coop_ms||!S.batch_enabled||!S.current||GN_LOAD(&S.batch_running)||!limit||limit>BATCH_MAX)return -GN_STATE;
 if(cancelled())return -GN_CANCELLED;
 /* An existing persisted legacy prefix may have first/committed offsets. This
  * reader starts with an uncommitted compact descriptor array after restore. */
 if(S.batch_committed)return -GN_STATE;
 limit=MIN(limit,S.coop_lookahead);
 if(C.window_degree!=S.current){C.window=limit;C.window_degree=S.current;}
 if((C.policy&1)&&limit==S.coop_lookahead&&S.workers>1){
  u32 idle=0,parked=!!C.commit_task;
  for(u32 i=0;i<S.workers;i++){idle+=!!GN_LOAD(&C.exhausted[i]);parked+=!!GN_LOAD(&C.assigned[i])+!!GN_LOAD(&C.helper_assigned[i]);}
  /* Expand only when retained work occupies the current window and a lane
   * exhausted ready descriptors early. Ordinary fast waves keep the base size.
   * No running snapshot changes, and the portable 512-descriptor cap remains. */
  if(idle&&parked&&S.batch_n>=C.window&&!S.iter_done&&C.window<C.max_window){
   C.window=MIN(C.max_window,MAX(C.window+S.workers,C.window*2));C.window_expansions++;
  }
  limit=C.window;
 }
 Lane*zero=&S.lanes[0];u32 f=zero->f,g=zero->g,k=zero->k,sn=zero->snapshot,error=zero->error;
 while(S.batch_n<limit){int rc=gn_next_pair(0);if(rc<=0){zero->f=f;zero->g=g;zero->k=k;zero->snapshot=sn;zero->error=error;if(rc<0)return rc;break;}
  S.tasks[S.batch_n++]=(BatchTask){zero->f,zero->g,zero->k,zero->snapshot,GN_STATE,0,0};}
 zero->f=f;zero->g=g;zero->k=k;zero->snapshot=sn;zero->error=error;
 S.batch_first=0;coop_order();if(S.batch_n){S.batch_epochs++;C.epochs++;}
 return (int)S.batch_n;
}
/* Counters follow the execution lane; row state follows its own arena and
 * resume slot. Keep current-row capacity diagnostics attached to that row. */
static void coop_copy_counters(Lane*to,Lane*from){
 u64 capacity=to->big_capacity,reserved=to->big_reserved,live=to->big_coefficient_live,pool=to->big_coefficient_bytes;
 memcpy((u8*)to+offsetof(Lane,reductions),(u8*)from+offsetof(Lane,reductions),offsetof(Lane,reserve_owned)-offsetof(Lane,reductions));
 memcpy((u8*)to+offsetof(Lane,rational_table_growths),(u8*)from+offsetof(Lane,rational_table_growths),offsetof(Lane,publications)-offsetof(Lane,rational_table_growths));
 to->big_capacity=capacity;to->big_reserved=reserved;to->big_coefficient_live=live;to->big_coefficient_bytes=pool;
 GN_STORE(&to->slice_yields,GN_LOAD(&from->slice_yields));GN_STORE(&to->slice_resumes,GN_LOAD(&from->slice_resumes));to->publications=from->publications;
}
static void coop_execute(u32 lane,GN_ATOMIC(u32)*assigned,int helper,double begin){
 Lane*l=&S.lanes[lane];l->slice_enabled=1;l->allow_repack=!helper;l->reserve_waiting=0;
 for(;;){
  if(cancelled())break;
  u32 index;
  if(GN_LOAD(assigned))index=GN_LOAD(assigned)-1;
  else {u32 next=GN_FETCH_ADD(&S.batch_next,1);if(next>=S.batch_work_n){if(gn_host_clock()-begin<S.coop_ms/2.0)GN_STORE(&C.exhausted[lane],1);break;}index=S.batch_order[next];
   /* A helper never repeatedly restarts a row that exceeded its budget.
    * The ordinary lanes can still claim that pending descriptor later. */
   if(helper&&(S.tasks[index].rc==COOP_HELPER_DEFERRED||batch_weight(index)>l->io_size)){
    if(S.tasks[index].rc!=COOP_HELPER_DEFERRED){S.tasks[index].rc=COOP_HELPER_DEFERRED;GN_FETCH_ADD(&C.helper_deferred,1);}continue;
   }
   GN_STORE(assigned,index+1);GN_FETCH_ADD(&C.started,1);if(helper)GN_FETCH_ADD(&C.helper_started,1);l->resume_tier=0;l->error=0;
   BatchTask*t=&S.tasks[index];l->f=t->f;l->g=t->g;l->k=t->k;l->snapshot=t->snapshot;}
  BatchTask*t=&S.tasks[index];int rc;
  if(t->rc==COOP_OUTPUT_WAIT){
   if(fg_sector_pair(l)){l->result=(Poly){0};GN_FETCH_ADD(&S.fg_parked_skipped,1);}rc=0;
  }
  else if(l->resume_tier&&fg_sector_pair(l)){
   coop_release_lane(l);l->result=(Poly){0};l->active=0;GN_FETCH_ADD(&S.fg_parked_skipped,1);rc=0;
  }
  else if(l->resume_tier){l->error=0;l->busy=1;publish_lane(l,0,0);rc=nf(l,t->snapshot);l->error=rc;l->busy=0;publish_lane(l,l->result.n,0);}
  else rc=gn_reduce_pair(lane);
  t->rc=(u32)rc;
  if(rc==GN_YIELD)break;
  if(rc==GN_DEFERRED)GN_FETCH_ADD(&C.reserve_deferrals,1);
  l->resume_tier=0;GN_STORE(assigned,0);
  if(!rc&&l->result.n){
   if(S.certifying)t->rc=GN_REJECTED;
   else {u64 bytes=record_bytes(l->result);if(bytes>l->out_size||bytes>UINT32_MAX)t->rc=GN_BATCH_FULL;
    else if(bytes>l->out_size-l->out_used){t->rc=COOP_OUTPUT_WAIT;GN_STORE(assigned,index+1);break;}
    else{t->output=l->out_base+l->out_used;t->bytes=(u32)bytes;t->rc=(u32)write_record(l->result,t->output,bytes);if(!t->rc)l->out_used+=A8(bytes);}}
  }
  if(helper&&(t->rc==GN_SCRATCH||t->rc==GN_BATCH_FULL||t->rc==GN_REPACK||t->rc==GN_DEFERRED)){
   t->rc=COOP_HELPER_DEFERRED;t->output=0;t->bytes=0;GN_FETCH_ADD(&C.helper_deferred,1);
  }
  if(!t->rc){GN_FETCH_ADD(&C.finished,1);if(helper)GN_FETCH_ADD(&C.helper_finished,1);}
  if(rc==GN_CANCELLED||gn_host_clock()>=l->slice_end)break;
 }
 l->slice_enabled=0;l->allow_repack=0;l->busy=0;publish_lane(l,0,0);
}
API int gn_coop_reduce(u32 lane){
 if(!S.coop_ms||lane>=S.workers||!S.current)return GN_STATE;
 Lane*l=&S.lanes[lane];double begin=gn_host_clock(),end=begin+S.coop_ms;
 int pending=!!GN_LOAD(&C.helper_assigned[lane]);
 l->slice_end=pending?begin+S.coop_ms/2.0:end;GN_STORE(&C.exhausted[lane],0);
 GN_FETCH_ADD(&S.batch_running,1);coop_execute(lane,&C.assigned[lane],0,begin);
 int waiting=l->reserve_waiting||(GN_LOAD(&C.assigned[lane])&&S.tasks[GN_LOAD(&C.assigned[lane])-1].rc==COOP_OUTPUT_WAIT);
 if(C.helpers_enabled&&coop_helpers[lane].io_size&&(waiting||pending)&&!cancelled()&&gn_host_clock()<end){
  Lane primary=*l;coop_copy_counters(&coop_helpers[lane],l);*l=coop_helpers[lane];l->slice_end=end;
  coop_execute(lane,&C.helper_assigned[lane],1,begin);
  coop_copy_counters(&primary,l);coop_helpers[lane]=*l;*l=primary;publish_lane(l,0,0);
 }
 double elapsed=(gn_host_clock()-begin)*1000;u64 use=elapsed>0?(u64)elapsed:0;C.slice_us[lane]+=use;C.max_slice_us[lane]=MAX(C.max_slice_us[lane],use);
 GN_FETCH_ADD(&S.batch_running,(u32)-1);return 0;
}
API int gn_coop_prepare_commit(void){
 if(!S.coop_ms||!S.current||GN_LOAD(&S.live[0].busy))return GN_STATE;
 if(!C.commit_task||C.commit_ready||C.commit_error)return 0;
 Lane saved=S.lanes[0];S.lanes[0]=coop_coordinator;Lane*l=&S.lanes[0];
 l->error=0;l->slice_enabled=1;l->slice_end=gn_host_clock()+S.coop_ms;l->allow_repack=1;
 l->busy=2;publish_lane(l,l->result.n,0);
 u64 before=l->reductions;int rc=C.commit_snapshot!=S.nrules?GN_STATE:nf(l,C.commit_snapshot);
 C.commit_steps+=l->reductions-before;C.commit_resumes++;C.prepared_slices++;
 if(rc==GN_YIELD)C.commit_yields++;
 else if(!rc)C.commit_ready=1;
 else if(rc!=GN_DEFERRED)C.commit_error=(u32)rc;
 l->busy=0;l->slice_enabled=0;l->allow_repack=0;publish_lane(l,0,0);
 coop_coordinator=*l;S.lanes[0]=saved;return 0;
}
/* Coordinator memory is its own budgeted slice of the ordinary pool. Swapping
 * its descriptor into lane zero reuses existing exact commit/I/O routines and
 * cannot touch a parked worker's arrays. No reader is executing at this point. */
API int gn_coop_commit(void){
 if(!S.coop_ms||GN_LOAD(&S.batch_running)||!S.current)return GN_STATE;
 if(cancelled())return GN_CANCELLED;
 u32 keep[BATCH_MAX],map[BATCH_MAX],count=0;memset(keep,0,sizeof(keep));
 int rc=0,blocked=0;Lane saved=S.lanes[0];S.lanes[0]=coop_coordinator;
 double slice_end=gn_host_clock()+S.coop_ms;
 for(u32 i=0;i<S.batch_n;i++){
  /* The parked commit retains the exact updated-basis snapshot. Finish it
   * before appending any other rule; worker waves remain read-only meanwhile. */
  if(C.commit_task&&C.commit_task!=i+1)continue;
  u32 st=S.tasks[i].rc;
  if(st==GN_STATE||st==GN_YIELD||st==GN_DEFERRED||st==COOP_OUTPUT_WAIT||st==COOP_HELPER_DEFERRED){keep[i]=1;blocked=1;continue;}
  if(st){rc=(int)st;break;}
  Lane*l=&S.lanes[0];l->error=0;l->slice_enabled=1;l->slice_end=slice_end;l->allow_repack=1;
  u64 before=l->reductions;
  if(C.commit_task){
   if(C.commit_snapshot!=S.nrules){rc=GN_STATE;break;}
   if(C.commit_error)rc=(int)C.commit_error;
   else if(C.commit_ready){
    rc=S.certifying?(l->result.n?GN_REJECTED:0):append_rule(l->result,0,0);
    if(!rc)S.degree_committed++;
   }else{C.commit_resumes++;rc=gn_commit(0);}
  }else{
   l->resume_tier=0;l->f=S.tasks[i].f;l->g=S.tasks[i].g;l->k=S.tasks[i].k;
   rc=batch_commit_impl(i);
  }
  C.commit_steps+=l->reductions-before;l->allow_repack=0;l->slice_enabled=0;
  if(rc==GN_YIELD){C.commit_task=i+1;C.commit_snapshot=S.nrules;C.commit_yields++;rc=0;break;}
  if(rc==GN_DEFERRED){keep[i]=1;blocked=1;rc=0;continue;}
  if(rc)break;
  C.commit_task=C.commit_ready=C.commit_error=0;
  C.committed++;if(blocked)C.nonprefix_commits++;
  S.tasks[i].rc=UINT32_MAX; /* committed; remove even if a later task fails */
 }
 coop_coordinator=S.lanes[0];S.lanes[0]=saved;
 for(u32 i=0;i<S.batch_n;i++){
  map[i]=UINT32_MAX;if(S.tasks[i].rc!=UINT32_MAX){map[i]=count;S.tasks[count++]=S.tasks[i];}
 }
 if(C.commit_task){u32 m=map[C.commit_task-1];if(m==UINT32_MAX)return GN_STATE;C.commit_task=m+1;}
 for(u32 lane=0;lane<S.workers;lane++){
  if(C.assigned[lane]){u32 m=map[C.assigned[lane]-1];if(m==UINT32_MAX)return GN_STATE;C.assigned[lane]=m+1;}
  if(C.helper_assigned[lane]){u32 m=map[C.helper_assigned[lane]-1];if(m==UINT32_MAX)return GN_STATE;C.helper_assigned[lane]=m+1;}
  /* After successful commit all output records are consumed. On errors the
   * caller checkpoints descriptors before re-layout/discarding these buffers. */
  if(!rc){
   for(u32 helper=0;helper<2;helper++){
   Lane*l=helper?&coop_helpers[lane]:&S.lanes[lane];u64 used=0,after=0;
   /* Preserve ready-but-not-yet-committable outputs. Compact in source-address
    * order so a copy never destroys another live record. */
   for(;;){u32 best=UINT32_MAX;u64 offset=UINT64_MAX;
    for(u32 j=0;j<count;j++){BatchTask*t=&S.tasks[j];if(t->bytes&&t->output>=l->out_base+after&&t->output<l->out_base+l->out_size&&t->output<offset){best=j;offset=t->output;}}
    if(best==UINT32_MAX)break;BatchTask*t=&S.tasks[best];after=t->output-l->out_base+A8(t->bytes);
    memmove(PTR(u8,l->out_base+used),PTR(u8,t->output),t->bytes);t->output=l->out_base+used;used+=A8(t->bytes);
   }l->out_used=used;
   }
  }
 }
 S.batch_n=count;S.batch_committed=S.batch_first=0;
 u32 parked=0;for(u32 i=0;i<S.workers;i++)parked+=!!C.assigned[i]+!!C.helper_assigned[i];C.parked_peak=MAX(C.parked_peak,parked);
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
 case 13:return C.window;case 14:return C.window_expansions;case 15:return C.sector_orderings;case 16:return C.policy;case 17:return C.max_window;
 case 18:return C.commit_task;case 19:return C.commit_yields;case 20:return C.commit_resumes;
 case 21:return C.prepared_slices;
 case 22:return GN_LOAD(&C.helper_started);case 23:return GN_LOAD(&C.helper_finished);case 24:return GN_LOAD(&C.helper_deferred);
 case 25:return S.helper_bytes;case 26:return C.helpers_enabled;
 default:break;}
 if(key>=100&&key<100+GN_MAX_WORKERS)return C.slice_us[key-100];
 if(key>=200&&key<200+GN_MAX_WORKERS)return C.max_slice_us[key-200];
 if(key>=300&&key<300+GN_MAX_WORKERS)return S.lanes[key-300].slice_yields;
 if(key>=400&&key<400+GN_MAX_WORKERS)return S.lanes[key-400].slice_resumes;
 if(key>=500&&key<500+GN_MAX_WORKERS)return C.assigned[key-500];
 if(key>=600&&key<600+GN_MAX_WORKERS)return C.helper_assigned[key-600];
 return 0;
}
