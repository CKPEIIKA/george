/* SPDX-License-Identifier: MIT. Completed rows must relinquish result arenas. */
#include "../src/kernel.c"
#define REQUIRE(x) do{if(!(x))return __LINE__;}while(0)
API int test_completed_output_retirement(void){
 REQUIRE(gn_init(2,4,1,256u<<20,64u<<20,8,0,0)==0);
 REQUIRE(gn_batch_mode(1)==0&&gn_cooperative(10000,1)==0&&gn_coop_helper_mode(0)==0);
 S.completed=2;
 REQUIRE(gn_input_begin(3,2)==0&&gn_input_term(0x111,0,1)==0&&gn_input_term(0,0,1)==0&&gn_input_end()==0);
 S.completed=3;REQUIRE(gn_start_degree(4)==0);
 Lane*l=&S.lanes[0];Arena original[2]={l->a[0],l->a[1]};
 l->active=0;l->memory_wait=ROW_WAIT_OUTPUT;l->memory_need=1u<<20;
 REQUIRE(brow_service_wait(l)==1);u64 old=l->output_extra_base;
 S.batch_n=S.batch_work_n=1;S.batch_order[0]=0;GN_STORE(&S.batch_next,0);
 S.tasks[0]=(BatchTask){1,1,2,1,GN_STATE,0,0};
 REQUIRE(gn_coop_reduce(0)==0&&S.tasks[0].rc==0&&S.tasks[0].bytes>0);
 REQUIRE(l->output_extra_retired&&l->a[0].base==original[0].base);
 REQUIRE(validate_record(S.tasks[0].output,S.tasks[0].bytes)==0);
 coop_collect_lane(l);REQUIRE(!l->output_extra_base);
 l->active=1;l->memory_wait=ROW_WAIT_OUTPUT;l->memory_need=2u<<20;
 REQUIRE(brow_service_wait(l)==1&&l->output_extra_index==1);
 u64 bytes=1u<<20,reused=workspace_take(&bytes);REQUIRE(reused==old);
 PTR(u64,reused)[0]=UINT64_C(0x123456789abcdef0);
 u64 own=alloc_a(&l->a[0],8);REQUIRE(own&&own!=reused);
 PTR(u64,own)[0]=UINT64_C(0xfedcba9876543210);
 REQUIRE(PTR(u64,reused)[0]==UINT64_C(0x123456789abcdef0));
 coop_release_lane(l);coop_collect_lane(l);
 REQUIRE(l->a[0].base==original[0].base&&l->a[1].base==original[1].base);
 /* The coordinator can accept several rows at one barrier. Its completed
  * row must likewise detach the preceding extended arena before the next. */
 Lane*commit=&coop_coordinator;Arena commit_original=commit->a[1];
 commit->active=1;commit->memory_wait=ROW_WAIT_OUTPUT;commit->memory_need=1u<<20;
 REQUIRE(brow_service_wait(commit)==1);
 S.degree_seen=S.degree_scheduled=1;
 REQUIRE(gn_coop_commit()==0&&S.nrules==2&&S.batch_n==0);
 REQUIRE(coop_coordinator.output_extra_retired&&coop_coordinator.a[1].base==commit_original.base);
 coop_collect_lane(&coop_coordinator);REQUIRE(!coop_coordinator.output_extra_base);
 return 0;
}
