/* SPDX-License-Identifier: MIT
 * Exact monomial fixture; seeded dimensions exercise scheduling only.
 * No imported FK dimension is asserted for this synthetic presentation.
 */
#include "../src/kernel.c"
#define REQUIRE(x) do{if(!(x))return __LINE__;}while(0)
static int seed(u32 workers,u32 cooperative,u32 mask){
 REQUIRE(gn_init(15,5,workers,256u<<20,64u<<20,10,0,0)==0);
 REQUIRE(gn_optimize(4,0)==0&&gn_tune(0,0,16)==0&&gn_local_rewrites(0,0,1)==0);
 REQUIRE(gn_pair_plan_config(4,2,32u<<20)==0&&gn_batch_mode(1)==0&&gn_gm_config(mask)==0);
 if(cooperative)REQUIRE(gn_cooperative(1,128)==0);
 S.completed=2;
 for(u32 a=0;a<15;a++)for(u32 b=0;b<15;b++)if(a!=b){
  REQUIRE(gn_input_begin(3,1)==0&&gn_input_term((a<<8)|(b<<4)|a,0,1)==0&&gn_input_end()==0);
 }
 S.completed=4;REQUIRE(gn_start_degree(5)==0&&P.count>512);
 S.fg_sector_ready=1;S.fgate.degree=5;S.fgate.status=FKG_ACTIVE;
 for(u32 g=0;g<360;g++)S.fg_sector_upper[g]=(u64)fkg_class_per_grade[5][fkg_group_class[1][g]]+10;
 PlanPair*t=PTR(PlanPair,P.base);u32 first=fg_pair_group(t[0].f,t[0].g,t[0].k),chosen=UINT32_MAX;
 for(u32 i=1;i<P.count;i++){u32 g=fg_pair_group(t[i].f,t[i].g,t[i].k);if(g!=first){chosen=g;break;}}
 REQUIRE(chosen<360);S.fg_sector_upper[chosen]=fkg_class_per_grade[5][fkg_group_class[1][chosen]]+1;
 REQUIRE(fg_plan_replan()==0);return 0;
}
static PlanPair remaining[4000];static u32 remaining_n;
static int capture_remaining(void){
 remaining_n=0;PlanPair*t=PTR(PlanPair,P.base);
 for(u32 i=P.cursor;i<P.count;i++)remaining[remaining_n++]=t[i];
 for(u32 i=S.batch_committed;i<S.batch_n;i++)remaining[remaining_n++]=(PlanPair){S.tasks[i].f,S.tasks[i].g,S.tasks[i].k,0,0};
 REQUIRE(remaining_n<4000);return 0;
}
static int same_remaining(void){
 REQUIRE(P.count==remaining_n);
 PlanPair*t=PTR(PlanPair,P.base);
 for(u32 i=0;i<P.count;i++){
  u32 matches=0;for(u32 j=0;j<remaining_n;j++)matches+=t[i].f==remaining[j].f&&t[i].g==remaining[j].g&&t[i].k==remaining[j].k;
  REQUIRE(matches==1);
  for(u32 j=0;j<i;j++)REQUIRE(t[i].ordinal!=t[j].ordinal);
 }
 return 0;
}
static u8 frame[20000];
API int test_sector_frontier(u32 mask){
 REQUIRE(seed(3,0,mask)==0);
 for(u32 wave=0;wave<5;wave++){
  if(S.batch_n==S.batch_committed){int n=gn_batch_fill(wave==1?512:32);REQUIRE(n>=0);}
  REQUIRE(gn_batch_reduce(0)==0);
  u32 available=S.batch_n-S.batch_committed,commit=MIN(available,5u);
  for(u32 i=0;i<commit;i++)REQUIRE(gn_batch_commit(S.batch_committed)==0);
  REQUIRE(capture_remaining()==0);u64 seen=S.degree_seen,committed=S.degree_committed;u32 pending=gn_frontier_pending();
  u64 off=gn_frontier_export();u32 bytes=gn_frontier_size();REQUIRE(off&&bytes<sizeof(frame));
  REQUIRE(fr64(PTR(u8,off)+8)==7&&fr64(PTR(u8,off)+37*8)==pending);
  REQUIRE(fr64(PTR(u8,off)+39*8)==seen-pending);memcpy(frame,PTR(u8,off),bytes);
  /* Restore in the same immutable record prefix; arenas and cursor addresses
   * are rebuilt. Compare descriptor sets, not just their cardinalities. */
  S.current=0;memcpy(PTR(u8,gn_import_buffer()),frame,bytes);REQUIRE(gn_frontier_restore(bytes)==0);
  REQUIRE(S.degree_seen==seen&&S.degree_committed==committed&&gn_frontier_pending()==pending);
  REQUIRE(same_remaining()==0&&fg_plan_replan()==0);
 }
 /* A checksummed change to the finished bitmap's padding is rejected. */
 u64 off=gn_frontier_export();u32 bytes=gn_frontier_size();memcpy(frame,PTR(u8,off),bytes);
 frame[39*8]^=1;fw64(frame+24,frontier_hash(frame,bytes));S.current=0;memcpy(PTR(u8,gn_import_buffer()),frame,bytes);REQUIRE(gn_frontier_restore(bytes)==GN_CORRUPT);
 return 0;
}
API int test_sector_flow(void){
 REQUIRE(seed(6,1,0)==0);u32 waves=0,max_selected=0;
 while(1){
  int n=gn_coop_fill(128);REQUIRE(n>=0);if(!n)break;REQUIRE(++waves<10000);
  if(C.finisher_order&&P.cursor<P.count){u32 selected=0;for(u32 j=0;j<S.batch_work_n;j++)selected+=!!C.finisher_tag[S.batch_order[j]];REQUIRE(selected<=2);max_selected=MAX(max_selected,selected);}
  for(u32 lane=0;lane<S.workers;lane++)REQUIRE(gn_coop_reduce(lane)==0);
  REQUIRE(gn_coop_commit()==0);
  if(!(waves%3)){REQUIRE(capture_remaining()==0);u64 off=gn_frontier_export();u32 bytes=gn_frontier_size();REQUIRE(off&&bytes<sizeof(frame));memcpy(frame,PTR(u8,off),bytes);gn_coop_discard();S.current=0;memcpy(PTR(u8,gn_import_buffer()),frame,bytes);REQUIRE(gn_frontier_restore(bytes)==0&&same_remaining()==0);REQUIRE(fg_plan_replan()==0);}
 }
 REQUIRE(max_selected>0&&C.finisher_selected>0&&C.finisher_held>0);
 REQUIRE(S.degree_seen==S.degree_total&&S.degree_scheduled==S.degree_committed&&S.nrules==210);
 REQUIRE(gn_finish_degree()==0&&S.completed==5);return 0;
}
API int test_sector_max_pending(void){
 REQUIRE(seed(4,0,0)==0);
 /* Reproduce a legacy raw checkpoint's 512 requeued anchors, then issue a
  * different promoted set of 512 pending rows. Every raw identity remains. */
 P.active=0;P.requested=0;
 REQUIRE(gn_batch_fill(512)==512);P.requested=4;
 REQUIRE(gn_pair_plan_adopt()==1&&P.anchor_n==512&&fg_plan_replan()==0);
 REQUIRE(gn_batch_fill(512)==512&&gn_frontier_pending()==512);
 REQUIRE(capture_remaining()==0);
 u64 off=gn_frontier_export();u32 bytes=gn_frontier_size();REQUIRE(off&&bytes<sizeof(frame));
 REQUIRE(fr64(PTR(u8,off)+8)==7&&fr64(PTR(u8,off)+39*8)==0);memcpy(frame,PTR(u8,off),bytes);
 S.current=0;memcpy(PTR(u8,gn_import_buffer()),frame,bytes);
 REQUIRE(gn_frontier_restore(bytes)==0&&gn_frontier_pending()==512&&same_remaining()==0);
 return 0;
}
API int test_sector_cooldown(void){
 REQUIRE(seed(6,0,0)==0);u32 target=P.gate_target;REQUIRE(target<360);
 for(u32 i=0;i<32;i++){S.degree_committed++;fg_note_pair_commit(1,1,1,S.nrules);}
 /* Directly seed a completed streak for the actual target grade. */
 PlanPair*t=PTR(PlanPair,P.base);u32 found=UINT32_MAX;
 for(u32 i=P.cursor;i<P.count;i++)if(fg_pair_group(t[i].f,t[i].g,t[i].k)==target){found=i;break;}
 REQUIRE(found!=UINT32_MAX);P.gate_streak[target]=31;S.degree_committed++;
 fg_note_pair_commit(t[found].f,t[found].g,t[found].k,S.nrules);
 REQUIRE(P.gate_cool_until[target]>S.degree_committed&&P.gate_cooldowns>0&&P.gate_target!=target);
 S.degree_committed+=256;REQUIRE(fg_plan_replan()==0&&P.gate_target==target);
 return 0;
}
API int test_sector_gap_range(void){
 REQUIRE(seed(6,0,0)==0);u32 target=P.gate_target;REQUIRE(target<360);
 u64 lower=fkg_class_per_grade[5][fkg_group_class[1][target]];
 for(u32 gap=1;gap<=5;gap++){
  S.fg_sector_upper[target]=lower+gap;
  REQUIRE(fg_plan_replan()==0&&P.gate_target==target&&P.gate_gap[target]==gap);
 }
 S.fg_sector_upper[target]=lower+6;
 REQUIRE(fg_plan_replan()==0&&P.gate_target==UINT32_MAX);
 S.fg_sector_upper[target]=lower;
 REQUIRE(fg_plan_replan()==0&&P.gate_target==UINT32_MAX);
 return 0;
}
