/* SPDX-License-Identifier: MIT
 * Port of FK Gate 0.3 to joined cooperative waves. Imported dimensions are an
 * EXPLICIT external authority, not a proof replayed by this kernel. Every worker
 * sees immutable counters; only the coordinator modifies them between waves.
 * Product grades refer to actual permutations, NOT just conjugacy classes.
 */
#include "../fk_gate/src/fk_gate.c"
static int fg_quiet(void){
 if(S.input_expected||GN_LOAD(&S.batch_running))return 0;
 for(u32 i=0;i<S.lane_slots;i++)if(S.lanes[i].busy)return 0;
 return 1;
}
#include "../fk_gate/adapters/sector_counter.inc"
static int fg_plan_replan(void);
/* In-place completion of a new current-degree leader removes exactly ONE
 * normal word. Verify the premises, including product homogeneity, before write. */
static int fg_append_check(Poly p,int restoring){
 if(restoring||!S.fgate.presentation_ok||S.fgate.status<FKG_ACTIVE||S.fgate.status>FKG_READY)return 0;
 if(!S.current||p.degree!=S.current||S.fgate.degree!=S.current||S.completed+1!=S.current||GN_LOAD(&S.batch_running)||S.nrules!=S.fgate.observed_rules)return GN_STATE;
 u32 pos=0;if(divisor(pw(p,0),p.degree,S.nrules,&pos,&S.lanes[0]))return GN_REJECTED;
 u32 group=fg_word_group(pw(p,0),p.degree);
 for(u32 i=1;i<p.n;i++)if(fg_word_group(pw(p,i),p.degree)!=group)return GN_REJECTED;
 if(S.fg_sector_ready && S.fg_sector_upper[group]<=fkg_class_per_grade[p.degree][fkg_group_class[p.degree&1][group]])return GN_REJECTED;
 if(fkg_compare(S.fgate.upper,S.fgate.lower)<=0)return GN_REJECTED;
 return 0;
}
static int fg_append_done(Poly p,int restoring){
 if(restoring||!S.fgate.presentation_ok||S.fgate.status<FKG_ACTIVE||S.fgate.status>FKG_READY)return 0;
 u32 closed_now=0;
 if(S.fg_sector_ready){u32 g=fg_word_group(pw(p,0),p.degree),lower=fkg_class_per_grade[S.current][fkg_group_class[S.current&1][g]];S.fg_sector_upper[g]--;closed_now=S.fg_sector_upper[g]==lower;}
 int rc=fkg_observe(&S.fgate,S.current,S.completed,S.nrules,1,1);if(rc<0)return GN_REJECTED;
 if(closed_now&&P.mode==4&&!GN_LOAD(&S.batch_running)){int pr=fg_plan_replan();if(pr)return pr;}
 return 0;
}
static int fg_upper(u64 budget,FkgCount*out){
 int rc=gn_hilbert_upper(S.current,budget);if(rc){gn_hilbert_release();return rc;}
 *out=fkg_from_u64(0);int overflow=0;
 for(u32 i=0;i<gn_hilbert_limbs();i++){u32 v=gn_hilbert_limb(S.current,i);if(i<4)out->limb[i]=v;else overflow|=!!v;}
 gn_hilbert_release();return overflow?GN_LIMIT:0;
}
API int gn_fg_bind(u32 length){
 if(!fg_quiet()||S.current||S.nrules||length!=64)return -GN_STATE;
 S.fg_sector_ready=S.fg_sector_enabled=0;
 return fkg_bind(&S.fgate,PTR(char,S.lanes[0].io_base),S.generators,S.modulus);
}
API int gn_fg_sector_mode(u32 enabled){if(!fg_quiet()||S.current||enabled>1)return -GN_STATE;S.fg_sector_enabled=enabled;return 0;}
API int gn_fg_begin(u64 budget){
 S.fg_sector_ready=0;
 if(!fg_quiet()||!S.current||S.certifying||reserve_pool_busy())return -GN_STATE;
 if(!fkg_covers(&S.fgate,S.current)){S.fgate.status=FKG_UNAVAILABLE;return 0;}
 FkgCount upper;double start=gn_host_clock();int rc=fg_upper(budget,&upper);
 S.fg_count_ms+=gn_host_clock()-start;S.fg_recounts++;
 if(rc){S.fgate.status=FKG_UNAVAILABLE;return -rc;}
 int st=fkg_begin(&S.fgate,S.current,S.completed,S.nrules,upper,1);if(st<0)return -GN_REJECTED;
 if(S.fg_sector_enabled){
  start=gn_host_clock();rc=fg_sector_count(S.current,budget,S.fg_sector_upper);S.fg_sector_ms+=gn_host_clock()-start;
  if(rc){S.fg_sector_error=rc;if(rc!=GN_MEMORY&&rc!=GN_LIMIT&&rc!=GN_SCRATCH)return -rc;}
  else{u64 total=0;for(u32 g=0;g<360;g++){u64 v=S.fg_sector_upper[g];if(UINT64_MAX-total<v)return -GN_LIMIT;total+=v;if(v<fkg_class_per_grade[S.current][fkg_group_class[S.current&1][g]])return -GN_REJECTED;}
   if(fkg_compare(upper,fkg_from_u64(total)))return -GN_REJECTED;
   S.fg_sector_ready=1;
  }
 }
 if(S.fg_sector_ready){int pr=fg_plan_replan();if(pr)return -pr;}
 return st;
}
API int gn_fg_poll(void){
 if(!fg_quiet()||!S.current||S.certifying)return -GN_STATE;
 S.fg_poll_calls++;
 if(!S.fgate.presentation_ok||S.fgate.status==FKG_UNAVAILABLE)return 0;
 if(S.fgate.status<0||S.fgate.observed_rules!=S.nrules||S.fgate.degree!=S.current)return -GN_REJECTED;
 return S.fgate.status;
}
API int gn_fg_close(u64 budget){
 if(!fg_quiet()||S.certifying||!S.current)return -GN_STATE;
 if(S.fgate.status!=FKG_READY)return S.fgate.status<0?-GN_REJECTED:S.fgate.status;
 /* Wait for all scheduled tasks to take the proof-zero path and be committed.
  * No live heap or reserve is freed behind a worker's back. */
 if(S.batch_n!=S.batch_committed||reserve_pool_busy())return FKG_READY;
 FkgCount upper;double start=gn_host_clock();int rc=fg_upper(budget,&upper);S.fg_count_ms+=gn_host_clock()-start;S.fg_recounts++;
 if(rc){if(rc==GN_MEMORY||rc==GN_LIMIT||rc==GN_SCRATCH)S.fgate.status=FKG_UNAVAILABLE;return -rc;}
 if(fkg_close(&S.fgate,upper,1)!=FKG_CLOSED)return -GN_REJECTED;
 u64 done=S.degree_committed+S.degree_monomial+S.degree_chain;if(S.degree_total_known&&done>S.degree_total)return -GN_STATE;
 S.fg_closed++;S.gate_degree=S.current;S.gate_closed=1;S.gate_active=1;
 S.gate_upper=S.gate_lower=fkg_fk6_q_lower[S.current];S.gate_rules=S.nrules;S.gate_budget=budget;
 S.gate_skipped=S.degree_total_known?S.degree_total-done:0;S.gate_closed_count++;
 S.gate_unvisited=S.degree_total_known?S.degree_total-S.degree_seen:0;S.gate_pending=0;
 S.fg_skipped+=S.gate_skipped;S.iter_done=1;
 return FKG_CLOSED;
}
API int gn_fg_status(void){return S.fgate.status;}
API u32 gn_fg_limb(u32 item,u32 limb){
 if(limb>=4)return 0;FkgCount v;
 if(item==0)v=S.fgate.upper;else if(item==1)v=S.fgate.lower;else if(item==2){if(fkg_deficit(&S.fgate,&v))return 0;}else return 0;
 return v.limb[limb];
}
API u64 gn_fg_stat(u32 item){switch(item){
 case 0:return S.fgate.degree;case 1:return S.fg_closed;case 2:return S.fg_poll_calls;case 3:return S.fg_recounts;
 case 4:return S.fg_skipped;case 5:return(u64)(S.fg_count_ms*1000);case 6:return S.fgate.accepted_leaders;
 case 7:return sizeof(FkgGate);case 8:return GN_LOAD(&S.fg_sector_skipped);case 9:return(u64)(S.fg_sector_ms*1000);
 case 10:return S.fg_sector_peak;case 11:return S.fg_sector_error;case 12:return S.fg_sector_nodes;
 case 13:return S.fg_sector_enabled;case 14:return FKG_PROFILE_DEGREE;case 15:return FKG_EXACT_TOTAL_DEGREE;
 case 16:return S.fg_sector_ready;case 17:return GN_LOAD(&S.fg_parked_skipped);case 18:return GN_LOAD(&S.fg_commit_skipped);
 case 19:return S.fgate.presentation_ok;case 20:{u64 n=0;if(S.fg_sector_ready)for(u32 g=0;g<360;g++)n+=S.fg_sector_upper[g]==fkg_class_per_grade[S.fgate.degree][fkg_group_class[S.fgate.degree&1][g]];return n;}
 default:return 0;}}
API u64 gn_fg_class(u32 cls,u32 lower){if(cls>=11||S.fgate.degree>FKG_PROFILE_DEGREE)return 0;if(lower)return fkg_class_dimension[S.fgate.degree][cls];u64 sum=0;for(u32 g=0;g<360;g++)if(fkg_group_class[S.fgate.degree&1][g]==cls)sum+=S.fg_sector_upper[g];return sum;}
API u64 gn_fg_group(u32 g,u32 lower){if(g>=360||S.fgate.degree>FKG_PROFILE_DEGREE)return 0;return lower?fkg_class_per_grade[S.fgate.degree][fkg_group_class[S.fgate.degree&1][g]]:S.fg_sector_upper[g];}
static u32 fg_pair_group(u32 f,u32 r,u32 k){
 Rule*a=rule(f),*b=rule(r);u32 g=0,pos=0;
 for(u32 j=0;j<a->degree;j++,pos++)g=fkg_group_step[pos&1][g][letter(a->lm,a->degree,j)];
 for(u32 j=k;j<b->degree;j++,pos++)g=fkg_group_step[pos&1][g][letter(b->lm,b->degree,j)];
 return g;
}

/* Re-rank only the UNSEEN suffix of a gateword plan after the imported sector
 * counter has been rebuilt for this exact basis prefix. Already-dispensed task
 * descriptors retain their durable meaning. Ranking is scheduling only: no pair
 * is discarded here and no lower bound is invented.
 */
static int fg_plan_replan(void){
 if(!P.active||P.mode!=4||!S.fg_sector_ready||S.fgate.degree!=S.current||P.cursor>P.count)return 0;
 if(P.gate_degree!=S.current){P.gate_degree=S.current;memset(P.gate_streak,0,sizeof(P.gate_streak));memset(P.gate_attempts,0,sizeof(P.gate_attempts));memset(P.gate_successes,0,sizeof(P.gate_successes));memset(P.gate_cool_until,0,sizeof(P.gate_cool_until));P.gate_cooldowns=0;}
 PlanPair*t=PTR(PlanPair,P.base);
 for(u32 g=0;g<360;g++){P.gate_pending[g]=P.gate_cost[g]=P.gate_qmass[g]=0;P.gate_rank[g]=359;
  u64 lower=fkg_class_per_grade[S.current][fkg_group_class[S.current&1][g]],upper=S.fg_sector_upper[g];P.gate_gap[g]=upper>=lower?upper-lower:UINT64_MAX;
 }
 for(u32 i=P.cursor;i<P.count;i++){
  if(!(i&4095)&&cancelled())return GN_CANCELLED;
  u32 g=fg_pair_group(t[i].f,t[i].g,t[i].k);t[i].group=g;
  if((S.pruning&&rule(t[i].f)->n==1&&rule(t[i].g)->n==1)||(S.chain_enabled&&matcher_interior(rule(t[i].f),rule(t[i].g),t[i].k))){t[i].group=UINT32_MAX;continue;}
  P.gate_pending[g]++;u64 cost=(u64)rule(t[i].f)->n+rule(t[i].g)->n;
  P.gate_cost[g]=UINT64_MAX-P.gate_cost[g]<cost?UINT64_MAX:P.gate_cost[g]+cost;
 }
 for(u32 i=S.batch_committed;i<S.batch_n;i++){
  BatchTask*task=&S.tasks[i];if(!task->rc||task->rc==UINT32_MAX)continue;
  if((S.pruning&&rule(task->f)->n==1&&rule(task->g)->n==1)||(S.chain_enabled&&matcher_interior(rule(task->f),rule(task->g),task->k)))continue;
  u32 g=fg_pair_group(task->f,task->g,task->k);P.gate_pending[g]++;
  u64 cost=(u64)rule(task->f)->n+rule(task->g)->n;P.gate_cost[g]=UINT64_MAX-P.gate_cost[g]<cost?UINT64_MAX:P.gate_cost[g]+cost;
 }
 u32 target=UINT32_MAX;u64 best=0,best_gap=UINT64_MAX,best_avg=UINT64_MAX;
 for(u32 g=0;g<360;g++){
  if(!P.gate_pending[g]||!P.gate_gap[g]||P.gate_gap[g]>5||P.gate_cool_until[g]>S.degree_committed)continue;
  u64 avg=P.gate_cost[g]/P.gate_pending[g];if(!avg)avg=1;
  u64 score=(P.gate_pending[g]*UINT64_C(65536))/(avg*P.gate_gap[g]);
  if(target==UINT32_MAX||score>best||(score==best&&P.gate_gap[g]<best_gap)||(score==best&&P.gate_gap[g]==best_gap&&avg<best_avg)){
   target=g;best=score;best_gap=P.gate_gap[g];best_avg=avg;
  }
 }
 int rc=plan_sort(t+P.cursor,P.count-P.cursor,3);if(rc<0)return -rc;
 /* A small front burst feeds at most two dedicated lanes. Other lanes retain
  * ordinary work. Frontier 7 preserves identities across every such promotion. */
 P.gate_target=target;P.gate_stride=8;P.gate_injected=0;
 if(target!=UINT32_MAX)for(u32 q=0;q<8&&P.cursor+q<P.count;q++){
  u32 at=P.cursor+q,pick=UINT32_MAX;u64 smallest=UINT64_MAX;
  for(u32 pass=0;pass<2&&pick==UINT32_MAX;pass++)for(u32 i=at;i<P.count;i++){
   if(t[i].group!=target)continue;
   if(!pass&&q){u32 duplicate=0;for(u32 j=P.cursor;j<at;j++)duplicate|=t[j].f==t[i].f;if(duplicate)continue;}
   u64 cost=(u64)rule(t[i].f)->n+rule(t[i].g)->n;if(cost<smallest){smallest=cost;pick=i;}
  }
  if(pick==UINT32_MAX)break;PlanPair chosen=t[pick];memmove(t+at+1,t+at,(u64)(pick-at)*sizeof(*t));t[at]=chosen;P.gate_injected++;
 }
 P.gate_ready=1;P.gate_replans++;P.gate_last_refresh=S.degree_committed;return 0;
}
static void fg_note_pair_commit(u32 f,u32 g,u32 k,u32 rules_before){
 if(P.mode!=4||!S.fg_sector_ready||S.fgate.degree!=S.current)return;
 u32 sector=fg_pair_group(f,g,k);P.gate_attempts[sector]++;
 if(S.nrules>rules_before){P.gate_successes[sector]++;P.gate_streak[sector]=0;}
 else if(P.gate_target==sector&&P.gate_gap[sector])P.gate_streak[sector]++;
 if(P.gate_target==sector&&P.gate_streak[sector]>=32){
  P.gate_cool_until[sector]=S.degree_committed+256;P.gate_streak[sector]=0;P.gate_cooldowns++;(void)fg_plan_replan();
 }else if((P.gate_target==sector&&!(P.gate_attempts[sector]&7))||S.degree_committed-P.gate_last_refresh>=128)(void)fg_plan_replan();
}
static int fg_sector_ids(u32 f,u32 r,u32 k){
 if(!S.fg_sector_ready||S.fgate.degree!=S.current||S.certifying||S.fgate.status<FKG_ACTIVE||S.fgate.status>FKG_READY)return 0;
 if(rule(f)->degree+rule(r)->degree-k!=S.current)return 0;
 u32 g=fg_pair_group(f,r,k);
 return S.fg_sector_upper[g]==fkg_class_per_grade[S.current][fkg_group_class[S.current&1][g]];
}
