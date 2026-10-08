/* SPDX-License-Identifier: MIT
 * Kernel-private properties: a cached tail must never change a parked cursor.
 * Synthetic exact rewrites keep this check independent of a large FK run.
 */
#include "../src/kernel.c"
#define REQUIRE(x) do { if(!(x))return __LINE__; } while(0)

API int test_tail_cache_generation(u32 radix){
 REQUIRE(gn_init(16,4,1,256u<<20,32u<<20,8,0,0)==0);
 REQUIRE(gn_tail_cache_config(64u<<20)==0);
 REQUIRE(gn_tail_cache_stat(1)==1&&gn_tail_cache_stat(2)==32u<<20);
 REQUIRE(gn_tune(0,0,2)==0&&gn_optimize(0,0)==0);
 REQUIRE(gn_rational_rewrites(0)==0&&gn_radix_queue(radix)==0);
 REQUIRE(gn_row_reserve(1u<<20)==0);
 S.completed=2;
 REQUIRE(gn_input_begin(3,301)==0&&gn_input_term(4095,0,1)==0);
 for(u32 i=1;i<=300;i++)REQUIRE(gn_input_term(i,0,1)==0);
 REQUIRE(gn_input_end()==0&&S.nrules==1);
 REQUIRE(gn_input_begin(3,1)==0&&gn_input_term(299,0,1)==0&&gn_input_end()==0);
 S.completed=3;
 Lane*l=&S.lanes[0];l->a[1].end=l->a[1].base+20480;
 reset_a(&l->a[0]);Poly original={alloc_a(&l->a[0],2*sizeof(Term)),2,3,0};
 PTR(Term,original.off)[0]=(Term){{4095,0},2};
 PTR(Term,original.off)[1]=(Term){{350,0},2};
 l->result=original;l->active=0;l->tail_generation=0;l->tail_snapshot=2;
 l->slice_enabled=1;l->slice_end=1e30;GN_STORE(&S.reserve_lock,1);
 REQUIRE(big_rational_nf(l,original,0,2)==GN_YIELD&&l->resume_tier==4);
 u32 cursor=saved_BRow[0].row.pending_tail;
 REQUIRE(cursor>1&&cursor<300);
 GN_STORE(&T.requests[1],1);
 REQUIRE(gn_tail_cache_prepare()==0&&T.built==1&&T.generation==1);
 REQUIRE(rule(1)->n==301&&rule(1)->tail_generation==1);
 /* Old readers retain the raw 301-term tail, new readers see 300 terms. */
 REQUIRE(load_rule(1,l).n==301&&l->tail_generation==0);
 REQUIRE(saved_BRow[0].row.pending_tail==cursor&&l->resume_tier==4);
 Lane*reader=&S.lanes[1];*reader=*l;reader->tail_generation=1;
 REQUIRE(load_rule(1,reader).n==300&&GN_LOAD(&T.hits)>0);
 GN_STORE(&S.reserve_lock,0);
 REQUIRE(nf(l,2)==0&&l->tail_generation==0);
 REQUIRE(!l->resume_tier&&!l->reserve_owned&&l->result.n==300);
 REQUIRE(pw(l->result,0).lo==350&&pc(l->result,0)==2);
 u32 j=1;
 for(u32 i=300;i;i--){if(i==299)continue;
  REQUIRE(pw(l->result,j).lo==i&&pc(l->result,j)==csmall(-1));j++;
 }
 REQUIRE(j==l->result.n&&T.used<=T.capacity);
 return 0;
}

API int test_tail_cache_budget(void){
 REQUIRE(gn_init(3,4,1,64u<<20,16u<<20,8,0,0)==0);
 REQUIRE(gn_tail_cache_stat(0)==0&&gn_tail_cache_stat(1)==0);
 REQUIRE(gn_tail_cache_config(1)==GN_INPUT);
 REQUIRE(gn_tail_cache_config(128u<<20)==GN_INPUT);
 /* Optional refusal does not consume memory or poison the ordinary solver. */
 u64 bump=S.bump;
 REQUIRE(gn_tail_cache_config(64u<<20)==0&&!T.base&&!S.error&&S.bump==bump);
 REQUIRE(T.declined==1&&gn_tail_cache_prepare()==0);
 REQUIRE(gn_input_begin(1,1)==0&&gn_input_term(2,0,1)==0&&gn_input_end()==0);
 REQUIRE(gn_tail_cache_config(16u<<20)==GN_STATE);
 return 0;
}

API int test_pair_replay_fallback(void){
 REQUIRE(gn_init(6,6,1,64u<<20,16u<<20,8,0,0)==0);
 REQUIRE(gn_optimize(0,0)==0&&gn_tune(0,0,16)==0);
 S.completed=3;
 const u64 tips[]={0x0123,0x2345,0x1234};
 for(u32 i=0;i<3;i++){
  REQUIRE(gn_input_begin(4,1)==0&&gn_input_term(tips[i],0,1)==0&&gn_input_end()==0);
 }
 S.completed=5;S.current=6;S.degree_snapshot=3;
 REQUIRE(!S.matcher_nodes);
 REQUIRE(matcher_interior(rule(1),rule(2),2));
 REQUIRE(GN_LOAD(&S.chain_fallback_queries)==1);
 S.chain_enabled=0;S.gm_mask=7;
 REQUIRE(gm_pair(1,2,2)!=0&&GN_LOAD(&S.gm_unavailable)==1);
 Lane*l=&S.lanes[0];l->f=1;l->g=2;l->k=2;l->snapshot=3;
 S.degree_seen=11;S.degree_scheduled=8;S.degree_committed=2;S.degree_chain=3;
 REQUIRE(reduce_pair_impl(0)==0&&!l->result.n&&GN_LOAD(&S.gm_pending)==1);
 REQUIRE(S.degree_seen==11&&S.degree_scheduled==8&&S.degree_committed==2&&S.degree_chain==3);
 return 0;
}
