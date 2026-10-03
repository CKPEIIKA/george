/* SPDX-License-Identifier: MIT
 * Conditional Hilbert-driven closure. The HOST must authorize a lower bound
 * from a replayed certificate or an explicitly accepted external assumption.
 * This kernel verifies the upper bound and equality; it never infers a lower
 * bound from a modular relation rank or from its own incomplete leading ideal.
 * Calls are coordinator-only, after all readers and reserve leases have ended.
 */
static int gate_upper(u64 budget,u64 *out){
 int rc=gn_hilbert_upper(S.current,budget);if(rc){gn_hilbert_release();return rc;}
 for(u32 i=2;i<gn_hilbert_limbs();i++)if(gn_hilbert_limb(S.current,i)){gn_hilbert_release();return GN_LIMIT;}
 *out=(u64)gn_hilbert_limb(S.current,0)|((u64)gn_hilbert_limb(S.current,1)<<32);
 gn_hilbert_release();return 0;
}
API int gn_hilbert_gate_begin(u64 lower,u64 budget){
 if(!S.current||S.current!=S.completed+1||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock))return GN_STATE;
 S.gate_active=0;S.gate_closed=0;u64 upper;int rc=gate_upper(budget,&upper);if(rc)return rc;
 if(upper<lower)return GN_REJECTED;
 S.gate_degree=S.current;S.gate_upper=upper;S.gate_rules=S.nrules;S.gate_lower=lower;S.gate_budget=budget;
 if(!S.degree_total_known){
  S.degree_total=0;
  for(u32 id=1;id<=S.degree_snapshot;id++){
   if((id&1023)==0&&cancelled())return GN_CANCELLED;
   Rule*f=rule(id);if(f->degree>=S.current)continue;
   for(u32 k=1;k<f->degree;k++){u32 glen=S.current-f->degree+k;if(glen<=k||glen>=S.current)continue;
    u32 count=prefix_count(part(f->lm,f->degree,f->degree-k,k),k,glen,S.degree_snapshot);
    if(UINT64_MAX-S.degree_total<count)return GN_LIMIT;S.degree_total+=count;}
  }S.degree_total_known=1;
 }
 S.gate_active=1;return 0;
}
API u64 gn_hilbert_gate_stat(u32 key){
 u64 delta=S.nrules>=S.gate_rules?S.nrules-S.gate_rules:0;
 switch(key){case 0:return S.gate_active;case 1:return S.gate_upper>=delta?S.gate_upper-delta:0;
 case 2:return S.gate_lower;case 3:return S.gate_closed;case 4:return S.gate_closed_count;
 case 5:return S.gate_skipped;case 6:return S.gate_degree;case 7:return S.gate_checks;case 8:return S.gate_unvisited;case 9:return S.gate_pending;default:return 0;}
}
API int gn_hilbert_gate_try(void){
 if(S.gate_closed)return 1;
 if(!S.gate_active)return 0;
 if(!S.current||S.gate_degree!=S.current||S.current!=S.completed+1||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock)||S.nrules<S.gate_rules)return -GN_STATE;
 u64 delta=S.nrules-S.gate_rules;if(delta>S.gate_upper)return -GN_REJECTED;
 u64 predicted=S.gate_upper-delta;if(predicted<S.gate_lower)return -GN_REJECTED;if(predicted>S.gate_lower)return 0;
 /* Never close on the incremental counter alone. Recount all forbidden words. */
 u64 actual;S.gate_checks++;int rc=gate_upper(S.gate_budget,&actual);if(rc)return -rc;
 if(actual!=predicted||actual!=S.gate_lower)return -GN_REJECTED;
 u64 done=S.degree_committed+S.degree_monomial+S.degree_chain;
 if(S.degree_total_known&&done>S.degree_total)return -GN_STATE;
 S.gate_skipped=S.degree_total_known?S.degree_total-done:0;
 S.gate_unvisited=S.degree_total_known?S.degree_total-S.degree_seen:0;S.gate_pending=S.degree_scheduled-S.degree_committed;
 S.gate_closed=1;S.gate_closed_count++;S.iter_done=1;
 /* Undispatched and uncommitted pairs are bypassed by the dimension theorem.
  * Do NOT falsify the counters as if they had been individually reduced. */
 S.batch_n=S.batch_first=S.batch_committed=S.batch_work_n=0;
 GN_STORE(&S.batch_next,0);return 1;
}
