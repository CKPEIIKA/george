/* SPDX-License-Identifier: MIT
 * Exact homogeneous delta-only commit. No new algebraic criterion or F4 step.
 * The worker's COMPLETED normal form r is irreducible by G_s. Every newly
 * appended degree-d rule has tails normal by a basis containing G_s. A d-letter
 * leader can divide a d-letter word only by equality. Thus delta reduction
 * preserves G_s-normality and agrees with a full NF under the same order.
 * Parked WORKER rows are never rebased. A parked COMMIT preserves its floor.
 */
static void commit_elapsed(u32 key,double start){double us=(gn_host_clock()-start)*1000.0;if(us>0)GN_FETCH_ADD(&S.commit_metrics[key],(u64)us);}
static int delta_eligible(Lane*l,u32 snapshot){
 return l->normal_valid&&!l->skip_rule&&S.current&&l->result.degree==S.current&&
 l->normal_degree==S.current&&S.completed+1==S.current&&
 l->normal_snapshot>=S.degree_snapshot&&l->normal_snapshot<=snapshot&&
 (l->normal_snapshot==snapshot||
  (rule(l->normal_snapshot+1)->degree==S.current&&rule(snapshot)->degree==S.current));
}
static int delta_has_match(Lane*l,u32 snapshot){
 /* The new-rule set is usually much smaller than a million-term output.
  * Search each new leading word in the sorted row, without walking every term. */
 Poly p=l->result;
 for(u32 id=l->normal_snapshot+1;id<=snapshot;id++){
  if(!(id&255)&&cancelled())return -GN_CANCELLED;
  Word w=rule(id)->lm;u32 a=0,b=p.n;
  while(a<b){u32 m=a+(b-a)/2;int cmp=wcmp(pw(p,m),w);l->delta_probes++;
   if(!cmp)return 1;if(cmp>0)a=m+1;else b=m;
  }
 }
 return 0;
}
static int commit_nf(Lane*l,u32 snapshot){
 double start=gn_host_clock();u64 q=l->delta_queries,h=l->delta_hits,p=l->delta_probes,steps=l->reductions;
 GN_FETCH_ADD(&S.commit_metrics[1],1);int rc=0;
 if(cancelled()){rc=GN_CANCELLED;goto done;}
 if(!l->resume_tier){
  l->delta_floor=0;
  if(S.delta_commit&&delta_eligible(l,snapshot)){
   GN_FETCH_ADD(&S.commit_metrics[2],1);
   if(l->normal_snapshot==snapshot){GN_FETCH_ADD(&S.commit_metrics[3],1);goto done;}
   if(!l->result.n){GN_FETCH_ADD(&S.commit_metrics[4],1);goto done;}
   int hit=delta_has_match(l,snapshot);if(hit<0){rc=-hit;goto done;}
   if(!hit){GN_FETCH_ADD(&S.commit_metrics[4],1);goto done;}
   l->delta_floor=l->normal_snapshot+1;
  }else{
   GN_FETCH_ADD(&S.commit_metrics[5],1);
   if(S.delta_commit)GN_FETCH_ADD(&S.commit_metrics[15],1);
  }
 }
 rc=nf(l,snapshot);
done:
 GN_FETCH_ADD(&S.commit_metrics[6],l->delta_queries-q);GN_FETCH_ADD(&S.commit_metrics[7],l->delta_hits-h);
 GN_FETCH_ADD(&S.commit_metrics[8],l->delta_probes-p);GN_FETCH_ADD(&S.commit_metrics[9],l->reductions-steps);
 if(rc==GN_YIELD)GN_FETCH_ADD(&S.commit_metrics[14],1);
 else{l->delta_floor=0;if(!rc){l->normal_valid=1;l->normal_snapshot=snapshot;l->normal_degree=l->result.degree;}}
 commit_elapsed(10,start);return rc;
}
