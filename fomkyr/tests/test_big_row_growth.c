/* SPDX-License-Identifier: MIT
 * The same growth properties run natively and in all four Wasm variants.
 * Includes the kernel to exercise private row invariants without a public test API.
 */
#include "../src/kernel.c"
API int test_shared_cache(void){
 if(gn_init(2,4,1,UINT64_C(600)*1048576,UINT64_C(64)*1048576,8,0,1))return __LINE__;
 if(gn_pin_cache(UINT64_C(128)*1048576))return __LINE__;
 if(gn_stat(39)!=UINT64_C(128)*1048576)return __LINE__;
 return 0;
}
#define REQUIRE(x) do { if(!(x))return __LINE__; } while(0)
API int test_big_row_growth(u32 large){
 u32 radix=large>>1;large&=1;
 Lane*l=&S.lanes[0];memset(&S,0,sizeof(S));S.telemetry_enabled=1;S.lane_slots=1;
 S.radix_enabled=radix;S.radix_cache_enabled=1;
 REQUIRE(gn_big_row_limit(127)==GN_INPUT);REQUIRE(gn_big_row_limit(129)==GN_INPUT);
 REQUIRE(gn_big_row_limit(1u<<30)==0);REQUIRE(gn_big_row_limit(0)==0);
 Arena a={16u<<20,16u<<20,(u64)(16u<<20)+(large?(512u<<20):(1u<<20)),0,0};
 BRow r;u32 reserved=brow_budget_capacity(a.end-a.base);
 REQUIRE(reserved>=128);REQUIRE(brow_layout(&r,l,&a,reserved,128,31)==0);memset(r.heads,0,128*8);
 u32 n=large?((1u<<20)+17):600;
 for(u32 i=0;i<n;i++)REQUIRE(brow_add(&r,(Word){i+1,0},(BCoef){2,2})==0);
 REQUIRE(r.used==n&&r.heap_n==n);REQUIRE(r.capacity>=n);REQUIRE(l->big_growths>0);
 REQUIRE(r.nodes[0].w.lo==1&&r.nodes[0].c.n==2);REQUIRE(r.nodes[n-1].w.lo==n);
 REQUIRE(!large||r.capacity==(1u<<21));
 u32 root=bheap_top(&r);REQUIRE(r.nodes[root-1].w.lo==n);
 bheap_remove(&r,root);r.normal[r.normal_n++]=root;
 brow_report(&r);REQUIRE(gn_live_stat(0,14)==0);publish_lane(l,r.heap_n+r.normal_n,0);
 REQUIRE(gn_live_stat(0,14)==r.capacity);REQUIRE(gn_live_stat(0,19)==l->big_growths);
 /* A configured 1M ceiling is real even when a much larger budget is present. */
 REQUIRE(gn_big_row_limit(1u<<20)==0);REQUIRE(brow_budget_capacity(UINT64_C(8)<<30)==(1u<<20));
 REQUIRE(gn_big_row_limit(128)==0);REQUIRE(brow_budget_capacity(512u<<20)==128);
 REQUIRE(gn_big_row_limit(0)==0);
 /* Promotion retains large coefficients, prefix, pivot and free-list. A busy
  * reserve yields without changing the row or losing a partially emitted tail. */
 Arena small={4u<<20,4u<<20,(4u<<20)+20480,0,0};
 REQUIRE(brow_layout(&r,l,&small,128,128,4)==0);memset(r.heads,0,128*8);
 Arena coeff={3u<<20,3u<<20,(3u<<20)+65536,0,0};
 Coef big=mulc(&coeff,csmall(SMALL_MAX),csmall(SMALL_MAX));REQUIRE(big&1);
 for(u32 i=0;i<128;i++){reset_a(&r.temp);REQUIRE(brow_add(&r,(Word){i+1024,0},(BCoef){big,2})==0);}
 r.pivot=bcopy(&r.pool[0],(BCoef){big,2});r.pending_kind=2;r.pending_rule=7;r.pending_tail=19;
 root=bheap_top(&r);bheap_remove(&r,root);r.normal[r.normal_n++]=root;
 S.reserve_base=8u<<20;S.reserve_bytes=1u<<20;S.reserve_growth=1;l->slice_enabled=1;GN_STORE(&S.reserve_lock,1);
 REQUIRE(brow_add(&r,(Word){129,0},(BCoef){big,2})==GN_YIELD);
 REQUIRE(r.used==128&&r.normal_n==1&&r.pending_tail==19);REQUIRE(!l->big_capacity_misses);
 GN_STORE(&S.reserve_lock,0);u64 rewrites=l->reductions;
 REQUIRE(brow_add(&r,(Word){129,0},(BCoef){big,2})==0);
 REQUIRE(l->reserve_owned&&r.capacity==256&&r.heap_n==128&&r.normal_n==1);
 REQUIRE(l->reductions==rewrites&&r.pending_tail==19&&r.pending_rule==7);
 REQUIRE(magcmp(r.pivot.n,big)==0&&magcmp(r.nodes[root-1].c.n,big)==0);
 REQUIRE(brow_collect(&r)==0);REQUIRE(magcmp(r.pivot.n,big)==0);
 REQUIRE(magcmp(r.nodes[root-1].c.n,big)==0);REQUIRE(r.nodes[root-1].pos==0);
 u32 id=bheap_top(&r);bheap_remove(&r,id);brow_remove(&r,id);
 REQUIRE(brow_add(&r,(Word){130,0},(BCoef){big,2})==0);REQUIRE(r.used==129);
 REQUIRE(r.nodes[id-1].w.lo==130&&magcmp(r.nodes[id-1].c.n,big)==0);
 l->reserve_owned=0;GN_UNLOCK(&S.reserve_lock);
 /* Coefficient pressure can promote too, including an existing-node update.
  * Returning an old node pointer after relocation would silently lose it. */
 REQUIRE(brow_layout(&r,l,&small,128,128,4)==0);memset(r.heads,0,128*8);
 REQUIRE(brow_add(&r,(Word){1,0},(BCoef){big,2})==0);
 r.pool[0].end=r.pool[0].pos;r.pool[1].end=r.pool[1].base;
 reset_a(&r.temp);REQUIRE(brow_add(&r,(Word){1,0},(BCoef){big,2})==0);
 REQUIRE(l->reserve_owned&&r.used==1&&r.heap_n==1);
 REQUIRE(magcmp(r.nodes[0].c.n,mulc(&coeff,big,4))==0);
 l->reserve_owned=0;GN_UNLOCK(&S.reserve_lock);
 /* Exhaustion means the explicit ceiling or the real workspace, not 2^20. */
 REQUIRE(gn_big_row_limit(128)==0);S.reserve_base=0;
 REQUIRE(brow_layout(&r,l,&small,128,128,4)==0);memset(r.heads,0,128*8);
 for(u32 i=0;i<128;i++)REQUIRE(brow_add(&r,(Word){i+1,0},(BCoef){2,2})==0);
 REQUIRE(brow_add(&r,(Word){129,0},(BCoef){2,2})==HEAP_MISS);
 REQUIRE(l->big_capacity_misses==1&&r.used==128&&r.heap_n==128);
 /* Exercise a real exact normal form parked halfway through a rule tail.
  * The pivot rewrite must not repeat after the reserve becomes available. */
 REQUIRE(gn_init(16,3,1,64u<<20,32u<<20,8,0,0)==0);
 REQUIRE(gn_tune(0,12,16)==0);REQUIRE(gn_rational_rewrites(0)==0);
 S.completed=2;REQUIRE(gn_input_begin(3,301)==0);REQUIRE(gn_input_term(4095,0,1)==0);
 for(u32 i=1;i<=300;i++)REQUIRE(gn_input_term(i,0,1)==0);
 REQUIRE(gn_input_end()==0&&S.nrules==1);
 l=&S.lanes[0];l->a[0]=(Arena){48u<<20,48u<<20,49u<<20,0,0};
 l->a[1]=(Arena){46u<<20,46u<<20,(46u<<20)+20480,0,0};
 Poly original={alloc_a(&l->a[0],2*sizeof(Term)),2,3,0};
 PTR(Term,original.off)[0]=(Term){{4095,0},2};PTR(Term,original.off)[1]=(Term){{350,0},2};
 S.reserve_base=60u<<20;S.reserve_bytes=1u<<20;S.reserve_growth=1;l->slice_enabled=1;l->slice_end=1e30;
 GN_STORE(&S.reserve_lock,1);
 REQUIRE(big_rational_nf(l,original,0,1)==GN_YIELD);REQUIRE(l->resume_tier==4);
 REQUIRE(saved_BRow[0].row.pending_kind==2&&saved_BRow[0].row.pending_tail>1);
 REQUIRE(l->reductions==1&&PTR(Term,original.off)[0].w.lo==4095);
 u32 tail=saved_BRow[0].row.pending_tail;u64 previous_steps=saved_BRow[0].steps;
 REQUIRE(big_rational_nf(l,original,0,1)==GN_YIELD);
 REQUIRE(saved_BRow[0].row.pending_tail==tail&&saved_BRow[0].steps==previous_steps&&l->reductions==1);
 GN_STORE(&S.reserve_lock,0);
 /* A large rule tail also has a timed safe point. Recreate its exact live
  * prefix through term 255, expire the slice, and verify the same pivot/cursor
  * survives that timed yield before finishing the normal form. */
 BRow*parked=&saved_BRow[0].row;
 Poly tail_rule=load_rule(1,l);REQUIRE(!l->error);
 while(parked->pending_tail<256){u32 j=parked->pending_tail;reset_a(&parked->temp);
  REQUIRE(brow_add(parked,pw(tail_rule,j),(BCoef){csmall(-1),2})==0);parked->pending_tail++;
 }
 l->slice_end=gn_host_clock()-1;previous_steps=saved_BRow[0].steps;
 REQUIRE(big_rational_nf(l,original,0,1)==GN_YIELD);
 REQUIRE(saved_BRow[0].row.pending_tail==256&&saved_BRow[0].steps==previous_steps&&l->reductions==1);
 l->slice_end=1e30;REQUIRE(big_rational_nf(l,original,0,1)==0);
 REQUIRE(l->reductions==1&&l->result.n==301&&!l->reserve_owned&&!GN_LOAD(&S.reserve_lock));
 REQUIRE(pw(l->result,0).lo==350&&pc(l->result,0)==2);
 for(u32 i=1;i<=300;i++)REQUIRE(pw(l->result,i).lo==301-i&&pc(l->result,i)==csmall(-1));
 return 0;
}
#include "deep_rows.inc"
