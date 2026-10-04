/* SPDX-License-Identifier: MIT
 * Kernel-private scheduling properties and packed words at the 64-bit boundary.
 * Counter seeding below exercises policy decisions, not a mathematical profile.
 */
API int test_deep_rows(u32 radix){
 REQUIRE(radix<=1);
 REQUIRE(gn_init(16,17,4,600u<<20,64u<<20,8,0,0)==0);
 REQUIRE(gn_batch_mode(1)==0);REQUIRE(gn_cooperative(1,2)==0);
 REQUIRE(gn_coop_policy(4,512)==GN_INPUT);
 REQUIRE(gn_coop_policy(3,1)==GN_INPUT);
 REQUIRE(gn_coop_policy(3,513)==GN_INPUT);
 REQUIRE(gn_coop_policy(3,8)==0);
 REQUIRE(gn_tune(2,0,16)==0);REQUIRE(gn_optimize(0,0)==0);
 S.completed=14;
 /* Four exact monomial descriptors suffice to reproduce a full small window
  * with one retained row and another lane out of ready work. */
 for(u32 v=1;v<=4;v++){
  Word w={0,0};for(u32 j=0;j<15;j++)w=shortcat(w,(Word){v,0},1);
  REQUIRE(gn_input_begin(15,1)==0);REQUIRE(gn_input_term(w.lo,w.hi,1)==0);REQUIRE(gn_input_end()==0);
 }
 S.completed=15;REQUIRE(gn_start_degree(16)==0);
 REQUIRE(gn_coop_fill(2)==2);BatchTask first=S.tasks[0];
 S.tasks[0].rc=GN_YIELD;C.assigned[0]=1;GN_STORE(&C.exhausted[1],1);
 u64 arena=S.lanes[0].a[1].base;PTR(u64,arena)[0]=UINT64_C(0x0123456789abcdef);
 REQUIRE(gn_coop_fill(2)==4);REQUIRE(gn_coop_stat(13)==6&&gn_coop_stat(14)==1);
 REQUIRE(S.tasks[0].f==first.f&&S.tasks[0].g==first.g&&S.tasks[0].snapshot==first.snapshot);
 REQUIRE(C.assigned[0]==1&&PTR(u64,arena)[0]==UINT64_C(0x0123456789abcdef));
 REQUIRE(gn_frontier_export()!=0&&gn_frontier_size()==40*8+4*16);
 REQUIRE(gn_coop_policy(0,8)==GN_STATE);
 /* A caller's smaller near-equality window remains a strict restriction. */
 C.window=2;C.window_expansions=0;REQUIRE(gn_coop_fill(1)==4);
 REQUIRE(!C.window_expansions&&C.window==2);
 C.policy=0;REQUIRE(gn_coop_fill(2)==4);REQUIRE(!C.window_expansions);
 /* Priority compares full 64-bit gaps, then cost. No float conversions. */
 C.sector_order=1;C.work_gap[0]=UINT64_C(4735557180);C.work_gap[1]=61;
 C.work_cost[0]=10;C.work_cost[1]=100;REQUIRE(!coop_before(0,1)&&coop_before(1,0));
 C.work_gap[0]=61;REQUIRE(coop_before(0,1)&&!coop_before(1,0));
 C.sector_order=0;REQUIRE(!coop_before(0,1)&&coop_before(1,0));
 gn_coop_discard();
 for(u32 degree=16;degree<=17;degree++){
  Lane*l=&S.lanes[0];S.radix_enabled=radix;S.radix_cache_enabled=1;S.eager_pruning=0;
  Arena a={96u<<20,96u<<20,100u<<20,0,0};BRow r;
  REQUIRE(brow_layout(&r,l,&a,128,128,degree)==0);memset(r.heads,0,128*8);
  /* Colliding head, middle and tail cancellations reuse the existing links. */
  Word keys[8];u32 n=0;
  for(u64 i=1;n<8;i++){
   Word w={UINT64_MAX-i,degree==17?3:0};
   if(!rrow_hash(w,r.mask))keys[n++]=w;
  }
  for(u32 i=0;i<8;i++)REQUIRE(brow_add(&r,keys[i],(BCoef){2,2})==0);
  for(u32 j=0;j<3;j++){
   u32 i=j==0?7:j==1?3:0;
   REQUIRE(brow_add(&r,keys[i],(BCoef){csmall(-1),2})==0);
   REQUIRE(r.heap_n==7);REQUIRE(brow_add(&r,keys[i],(BCoef){4,2})==0);
   REQUIRE(r.heap_n==8&&r.used==8);
  }
  Word prev=maskw((Word){UINT64_MAX,UINT64_MAX},degree);u32 count=0;
  while(r.heap_n){u32 id=bheap_top(&r);REQUIRE(id&&wcmp(prev,r.nodes[id-1].w)>=0);
   prev=r.nodes[id-1].w;bheap_remove(&r,id);brow_remove(&r,id);count++;
  }
  REQUIRE(count==8&&!r.heads[0]);
 }
 return 0;
}

/* Two identical ready rows test commit NF continuation alongside worker zero.
 * These records deliberately require long reduction; descriptors are synthetic.
 * The expected remainder follows independently from ba=ab and word populations.
 */
API int test_commit_slices(void){
 REQUIRE(gn_init(2,17,2,600u<<20,64u<<20,8,0,0)==0);
 REQUIRE(gn_batch_mode(1)==0&&gn_cooperative(1,2)==0);
 REQUIRE(gn_tune(0,0,16)==0&&gn_optimize(0,0)==0);
 S.completed=1;REQUIRE(gn_input_begin(2,2)==0);
 REQUIRE(gn_input_term(16,0,1)==0&&gn_input_term(1,0,-1)==0&&gn_input_end()==0);
 S.completed=16;REQUIRE(gn_start_degree(17)==0);
 Lane*l=&S.lanes[0];reset_a(&l->a[0]);
 u32 n=4096,histogram[18]={0};Poly original={alloc_a(&l->a[0],(u64)n*sizeof(Term)),n,17,0};
 REQUIRE(!l->a[0].error);
 for(u32 i=0;i<n;i++){
  u32 bits=(1u<<17)-1-i,pop=0;Word w={0,0};
  for(u32 j=17;j;j--){u32 v=(bits>>(j-1))&1;pop+=v;w=shortcat(w,(Word){v,0},1);}
  histogram[pop]++;PTR(Term,original.off)[i]=(Term){w,2};
 }
 u64 output=S.lanes[1].out_base,bytes=record_bytes(original);
 REQUIRE(bytes<=S.lanes[1].out_size&&write_record(original,output,bytes)==0);
 S.lanes[1].out_used=A8(bytes);l->result=original;l->active=0;l->snapshot=1;
 l->slice_enabled=1;l->slice_end=gn_host_clock()-1;
 REQUIRE(nf(l,1)==GN_YIELD&&l->resume_tier==3);
 l->slice_enabled=0;S.batch_n=2;S.batch_work_n=0;GN_STORE(&S.batch_next,0);
 S.tasks[0]=(BatchTask){1,1,1,1,0,(u32)bytes,output};
 S.tasks[1]=(BatchTask){1,1,1,1,GN_YIELD,0,0};C.assigned[0]=2;
 S.degree_seen=S.degree_scheduled=2;
 REQUIRE(gn_coop_commit()==0);REQUIRE(C.commit_task&&C.commit_yields&&coop_coordinator.resume_slot==GN_MAX_WORKERS);
 REQUIRE(S.lanes[0].resume_slot==0&&nresume[0].p.off==original.off&&S.nrules==1);
 u32 waves=0;
 while(S.batch_n){
  REQUIRE(++waves<10000);REQUIRE(gn_coop_reduce(0)==0);
  if(C.commit_task){u32 rules=S.nrules;u64 off=nresume[0].p.off;
   GN_STORE(&S.batch_running,1);REQUIRE(gn_coop_prepare_commit()==0);GN_STORE(&S.batch_running,0);
   REQUIRE(S.nrules==rules&&nresume[0].p.off==off);
  }
  REQUIRE(gn_coop_commit()==0);
 }
 REQUIRE(C.commit_yields>0&&C.commit_resumes>0&&C.committed==2&&C.prepared_slices>0);
 REQUIRE(S.nrules==2&&S.degree_committed==2&&!GN_LOAD(&S.reserve_lock));
 u64 off=gn_export_rule(2);REQUIRE(off!=0);Record*r=PTR(Record,off);
 Poly result={off+sizeof(Record),r->n,r->degree,off};u32 count=0;
 for(u32 i=0;i<result.n;i++){
  u32 pop=0;Word w=pw(result,i);
  for(u32 j=0;j<17;j++){u32 v=letter(w,17,j);REQUIRE(v<=1);pop+=v;}
  Word expected={0,0};for(u32 j=0;j<17;j++)expected=shortcat(expected,(Word){j>=17-pop,0},1);
  REQUIRE(weq(w,expected)&&pc(result,i)==csmall(histogram[pop]));count+=histogram[pop];
 }
 REQUIRE(count==n);return 0;
}

API int test_output_wait(void){
 REQUIRE(gn_init(16,17,2,600u<<20,64u<<20,8,0,0)==0);
 REQUIRE(gn_batch_mode(1)==0&&gn_cooperative(1,2)==0);
 S.completed=16;REQUIRE(gn_start_degree(17)==0);
 Lane*l=&S.lanes[0];reset_a(&l->a[0]);
 l->result=(Poly){alloc_a(&l->a[0],8*sizeof(Term)),8,17,0};
 for(u32 i=0;i<8;i++)PTR(Term,l->result.off)[i]=(Term){{8-i,0},2};
 u64 bytes=record_bytes(l->result),original=l->result.off;
 REQUIRE(bytes<l->out_size);l->out_used=l->out_size-A8(bytes)+8;
 S.batch_n=1;S.batch_work_n=0;S.tasks[0]=(BatchTask){0,0,0,0,COOP_OUTPUT_WAIT,0,0};C.assigned[0]=1;
 for(u32 i=0;i<2;i++){
  REQUIRE(gn_coop_reduce(0)==0&&S.tasks[0].rc==COOP_OUTPUT_WAIT&&C.assigned[0]==1);
  REQUIRE(l->result.off==original&&l->result.n==8&&!l->reductions&&!C.finished);
 }
 l->out_used=0;REQUIRE(gn_coop_reduce(0)==0&&S.tasks[0].rc==0&&!C.assigned[0]);
 REQUIRE(C.finished==1&&S.tasks[0].bytes==bytes&&!l->reductions);
 REQUIRE(S.tasks[0].output==l->out_base&&l->result.off==original);
 return 0;
}
