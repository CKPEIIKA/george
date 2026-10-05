/* Test-only access: production APIs do not accept unverified normality claims.
 * Construct a row normal against the empty snapshot, add one same-degree rule,
 * and force input/heap/commit slicing. An independent closed-form answer checks
 * that resuming preserves the delta floor and does not lose terms. */
#ifndef PREF4_KERNEL_INCLUDED
#include "../src/kernel.c"
#endif
#define CHECK(x) do{if(!(x))return __LINE__;}while(0)
API int pref4_delta_state(u32 mode,u32 cancel_test){
 CHECK(gn_init(2,17,1,128u<<20,64u<<20,8,0,0)==0);
 CHECK(gn_delta_commit(mode)==0);CHECK(gn_tune(2,0,16)==0);CHECK(gn_optimize(0,0)==0);CHECK(gn_radix_queue(1)==0);
 S.completed=16;CHECK(gn_input_begin(17,2)==0);
 CHECK(gn_input_term(0,1,1)==0);CHECK(gn_input_term(0,0,-1)==0);CHECK(gn_input_end()==0);
 CHECK(S.nrules==1);S.current=17;S.degree_snapshot=0;
 Lane*l=&S.lanes[0];reset_a(&l->a[0]);reset_a(&l->a[1]);
 const u32 N=65536;l->result=(Poly){alloc_a(&l->a[0],(u64)N*sizeof(Term)),N,17,0};CHECK(!l->a[0].error);
 for(u32 i=0;i<N;i++){
  Word w={0,1};u32 b=N-1-i;for(u32 j=0;j<16;j++)w.lo|=(u64)((b>>j)&1)<<(4*j);
  PTR(Term,l->result.off)[i]=(Term){w,2};
 }
 l->active=0;l->normal_valid=1;l->normal_snapshot=0;l->normal_degree=17;l->snapshot=0;l->resume_slot=0;
 l->slice_enabled=1;l->slice_end=gn_host_clock()-1;
 CHECK(commit_nf(l,1)==GN_YIELD);CHECK(l->resume_tier);CHECK(l->delta_floor==(mode?1:0));
 if(cancel_test){gn_cancel(1);CHECK(commit_nf(l,1)==GN_CANCELLED);CHECK(!l->delta_floor);gn_cancel(0);return 0;}
 u32 rounds=0;for(;;){l->slice_end=gn_host_clock()+0.3;int rc=commit_nf(l,1);if(!rc)break;CHECK(rc==GN_YIELD);CHECK(++rounds<10000);CHECK(l->delta_floor==(mode?1:0));}
 CHECK(!l->delta_floor&&l->normal_valid&&l->normal_snapshot==1);CHECK(l->result.n==N);
 for(u32 i=0;i<N-1;i++){Word w=pw(l->result,i);CHECK(w.hi==1&&w.lo&&pc(l->result,i)==2);}
 CHECK(pw(l->result,N-1).hi==0&&pw(l->result,N-1).lo==0&&pc(l->result,N-1)==2);
 CHECK(gn_commit_stat(9)==1);CHECK(gn_commit_stat(14)>0);
 u64 before=gn_commit_stat(3);l->slice_enabled=0;CHECK(commit_nf(l,1)==0);
 if(mode)CHECK(gn_commit_stat(3)==before+1);
 /* Missing proof provenance must use full checking, not the optimistic path. */
 l->normal_valid=0;before=gn_commit_stat(5);CHECK(commit_nf(l,1)==0);CHECK(gn_commit_stat(5)==before+1);if(mode)CHECK(gn_commit_stat(15)>0);
 return 0;
}
