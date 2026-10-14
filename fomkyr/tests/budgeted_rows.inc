/* Joined-wave row growth must reuse structural slack and admit small leases
 * when a second initial-sized reserve would exceed the engine budget. */
API int test_adjacent_row_growth(u32 mode){
 memset(&S,0,sizeof(S));memset(&C,0,sizeof(C));S.budget=32u<<20;S.bump=30u<<20;S.workers=S.lane_slots=1;
 S.radix_enabled=mode&1;S.reserve_base=16u<<20;S.reserve_bytes=1u<<20;S.reserve_growth=1;S.reserve_pool_limit=1;
 GN_STORE(&S.reserve_lock,1);Lane*l=&S.lanes[0];l->resume_slot=0;l->reserve_owned=1;l->reserve_slot=1;l->slice_enabled=1;l->reductions=17;
 Arena arena={16u<<20,16u<<20,17u<<20,0,0},input={4u<<20,4u<<20,5u<<20,0,0};BRow r;
 REQUIRE(!brow_layout(&r,l,&arena,16384,16384,4));memset(r.heads,0,16384*8);
 u32 limbs[4]={123,456,789,1};Coef big=makec(&input,limbs,4,1);REQUIRE(!input.error);
 for(u32 i=0;i<16384;i++){reset_a(&r.temp);REQUIRE(!brow_add(&r,(Word){i*2+2,0},(BCoef){i%64?2:big,i%64?2:csmall(7)}));}
 u32 root=bheap_top(&r);bheap_remove(&r,root);r.normal[r.normal_n++]=root;
 r.pivot=bcoef_copy(&r.pool[0],(BCoef){big,csmall(11)});r.pending_kind=2;r.pending_rule=7;r.pending_tail=91;r.pivot_scaled=1;
 saved_BRow[0]=(BRowResume){r,123};l->resume_tier=4;l->memory_wait=ROW_WAIT_GROW;l->memory_detail=2;
 l->row_layout_attempted=1;l->memory_need=brow_required_workspace(&r,l);
 u64 need=l->memory_need,oldbytes=S.reserve_bytes,bump=S.bump;BNode*nodes=r.nodes;
 REQUIRE(need>oldbytes&&need<(3u<<20));
 workspace_return(S.reserve_base+oldbytes,need-oldbytes);
 /* The old arena cannot stage its own initialized indices. Growing only the
  * adjacent suffix succeeds where a second complete arena cannot fit. */
 if(mode&2){
  S.bump=S.budget-65536;BRow before=saved_BRow[0].row;
  REQUIRE(!brow_service_wait(l)&&l->memory_wait&&S.reserve_bytes==oldbytes);
  for(u32 j=0;j<sizeof(before);j++)REQUIRE(((u8*)&before)[j]==((u8*)&saved_BRow[0].row)[j]);
  REQUIRE(l->reductions==17&&saved_BRow[0].steps==123);
  REQUIRE(S.spare_count==1&&S.spare_base[0]==S.reserve_base+oldbytes&&S.spare_bytes[0]==need-oldbytes);
  S.bump=bump;
 }
 REQUIRE(brow_service_wait(l)==1&&!l->memory_wait&&S.bump>bump&&S.bump<=S.budget);
 BRow*x=&saved_BRow[0].row;REQUIRE(x->nodes==nodes&&S.reserve_bytes==need&&x->workspace_bytes==need&&x->reserved==32768);
 REQUIRE(x->capacity==16384&&x->normal_n==1&&x->normal[0]==root&&x->heap_n==16383);
 REQUIRE(x->pending_kind==2&&x->pending_rule==7&&x->pending_tail==91&&x->pivot_scaled==1&&saved_BRow[0].steps==123&&l->reductions==17);
 REQUIRE(magcmp(x->pivot.n,big)==0&&x->pivot.d==csmall(11));
 for(u32 i=0;i<S.spare_count;i++)memset(PTR(u8,S.spare_base[i]),0xcc,(size_t)S.spare_bytes[i]);
 for(u32 i=0;i<x->used;i++){REQUIRE(x->nodes[i].w.lo==i*2+2);REQUIRE(i%64?x->nodes[i].c.n==2:magcmp(x->nodes[i].c.n,big)==0);REQUIRE(x->nodes[i].c.d==(i%64?2:csmall(7)));}
 REQUIRE(x->nodes[bheap_top(x)-1].w.lo==32766);
 reset_a(&x->temp);REQUIRE(!brow_add(x,(Word){1,0},(BCoef){big,csmall(13)})&&x->capacity==32768);
 REQUIRE(!brow_collect(x)&&magcmp(x->pivot.n,big)==0);
 l->memory_detail=1;REQUIRE(brow_target_capacity(x,l)==32768);
 l->memory_detail=3;REQUIRE(brow_target_capacity(x,l)==32768);
 l->memory_detail=2;REQUIRE(brow_target_capacity(x,l)==65536);
 coop_release_lane(l);coop_collect_lane(l);REQUIRE(!reserve_pool_busy());return 0;
}
API int test_parked_helper_admission(void){
 REQUIRE(!gn_init(2,4,1,64u<<20,16u<<20,8,0,0));S.completed=1;
 REQUIRE(!gn_input_begin(2,1)&&!gn_input_term(0,0,1)&&!gn_input_end()&&S.nrules==1);
 memset(&C,0,sizeof(C));memset(coop_helpers,0,sizeof(coop_helpers));memset(&coop_coordinator,0,sizeof(coop_coordinator));
 S.budget=16u<<20;S.bump=S.budget-65536;S.workers=S.lane_slots=1;S.helper_base=8u<<20;S.helper_bytes=1u<<20;
 S.batch_n=2;S.iter_done=1;C.helpers_enabled=1;C.assigned[0]=1;
 S.lanes[0].memory_wait=ROW_WAIT_OUTPUT;S.lanes[0].memory_need=1u<<20;
 S.tasks[0]=(BatchTask){1,1,1,1,GN_ROW_WAIT,0,0};S.tasks[1]=(BatchTask){1,1,1,1,GN_STATE,0,0};
 REQUIRE(gn_coop_resource_status()==GN_ROW_WAIT);
 coop_helpers[0].io_size=UINT64_MAX;REQUIRE(gn_coop_resource_status()==0);
 S.tasks[1].rc=COOP_HELPER_DEFERRED;REQUIRE(gn_coop_resource_status()==GN_ROW_WAIT);
 C.helper_assigned[0]=2;coop_helpers[0].memory_wait=ROW_WAIT_OUTPUT;coop_helpers[0].memory_need=1u<<20;
 S.tasks[1].rc=GN_STATE;REQUIRE(gn_coop_resource_status()==GN_ROW_WAIT);
 return 0;
}
API int test_budgeted_row_layout(u32 radix){
 memset(&S,0,sizeof(S));S.budget=64u<<20;S.bump=60u<<20;S.workers=S.lane_slots=1;
 S.radix_enabled=radix;S.reserve_base=16u<<20;S.reserve_bytes=12u<<20;S.reserve_growth=1;S.reserve_pool_limit=1;
 GN_STORE(&S.reserve_lock,1);Lane*l=&S.lanes[0];l->resume_slot=0;l->reserve_owned=1;l->reserve_slot=1;l->slice_enabled=1;l->reductions=7;
 Arena arena={16u<<20,16u<<20,28u<<20,0,0};BRow r;
 REQUIRE(!brow_layout(&r,l,&arena,131072,128,4));memset(r.heads,0,128*8);
 Arena input={4u<<20,4u<<20,8u<<20,0,0};u32 limbs[4096]={0};limbs[4095]=1;
 Coef big=makec(&input,limbs,4096,1);REQUIRE(!input.error);u32 n=0;int rc=0;
 for(;n<128;n++){reset_a(&r.temp);rc=brow_add(&r,(Word){n+10001,0},(BCoef){big,2});if(rc)break;}
 REQUIRE(rc==HEAP_MISS&&l->memory_detail==1&&n>0);
 u32 top=bheap_top(&r);bheap_remove(&r,top);r.normal[r.normal_n++]=top;
 r.pivot=r.nodes[0].c;r.pending_kind=2;r.pending_rule=7;r.pending_tail=19;
 saved_BRow[0]=(BRowResume){r,23};l->resume_tier=4;l->memory_wait=ROW_WAIT_GROW;l->memory_need=24u<<20;
 u64 bump=S.bump;BNode*nodes=r.nodes;Word expected=r.nodes[bheap_top(&r)-1].w;
 REQUIRE(brow_service_wait(l)==1);BRow*after=&saved_BRow[0].row;
 REQUIRE(S.bump==bump&&after->nodes==nodes&&after->workspace_bytes==(12u<<20));
 REQUIRE(after->reserved==1024&&after->capacity==128&&l->row_relayouts==1&&!l->memory_wait);
 REQUIRE(after->pending_kind==2&&after->pending_tail==19&&after->pending_rule==7&&saved_BRow[0].steps==23&&l->reductions==7);
 REQUIRE(after->normal_n==1&&after->normal[0]==top&&weq(after->nodes[bheap_top(after)-1].w,expected));
 REQUIRE(magcmp(after->pivot.n,big)==0);
 for(u32 i=0;i<after->used;i++)REQUIRE(magcmp(after->nodes[i].c.n,big)==0);
 reset_a(&after->temp);REQUIRE(!brow_add(after,(Word){n+1,0},(BCoef){big,2}));
 /* Grow the table after shrinking structural reserve. Root staging to the
  * higher semispace protects coefficients while arrays expand in place. */
 for(u32 i=n+1;i<1024;i++)REQUIRE(!brow_add(after,(Word){i+1,0},(BCoef){2,2}));
 REQUIRE(after->used==1024&&after->capacity==1024);
 REQUIRE(brow_add(after,(Word){1025,0},(BCoef){2,2})==HEAP_MISS&&l->memory_detail==2);
 l->memory_wait=ROW_WAIT_GROW;l->memory_need=24u<<20;l->row_layout_attempted=0;
 REQUIRE(brow_service_wait(l)==1&&S.bump==bump&&after->reserved==2048&&l->row_relayouts==2);
 REQUIRE(after->pending_tail==19&&saved_BRow[0].steps==23&&l->reductions==7&&after->normal[0]==top);
 for(u32 i=0;i<=n;i++)REQUIRE(magcmp(after->nodes[i].c.n,big)==0);
 REQUIRE(!brow_add(after,(Word){1025,0},(BCoef){2,2})&&after->capacity==2048);
 REQUIRE(!brow_collect(after)&&magcmp(after->pivot.n,big)==0);
 coop_release_lane(l);coop_collect_lane(l);REQUIRE(!reserve_pool_busy());return 0;
}
API int test_small_row_admission(u32 mode){
 memset(&S,0,sizeof(S));S.budget=(mode&2)?(30u<<20):(32u<<20);S.bump=28u<<20;
 S.workers=S.lane_slots=1;S.radix_enabled=mode&1;S.reserve_base=16u<<20;S.reserve_bytes=S.reserve_initial_bytes=12u<<20;
 S.reserve_growth=1;S.reserve_pool_limit=2;S.reserve_pool_denied=1;GN_STORE(&S.reserve_lock,1);
 Lane*l=&S.lanes[0];l->resume_slot=0;l->slice_enabled=1;l->reductions=9;
 Arena arena={8u<<20,8u<<20,10u<<20,0,0};BRow r;
 REQUIRE(!brow_layout(&r,l,&arena,16384,16384,4));memset(r.heads,0,16384*8);
 for(u32 i=0;i<16384;i++)REQUIRE(!brow_add(&r,(Word){i+1,0},(BCoef){2,2}));
 REQUIRE(brow_add(&r,(Word){16385,0},(BCoef){2,2})==HEAP_MISS&&l->memory_detail==2);
 r.pending_kind=2;r.pending_rule=7;r.pending_tail=23;saved_BRow[0]=(BRowResume){r,31};l->resume_tier=4;l->memory_wait=ROW_WAIT_RESERVE;l->memory_need=4u<<20;
 u64 bump=S.bump;int rc=brow_service_wait(l);
 if(mode&2){
  REQUIRE(!rc&&S.bump==bump&&!S.reserve_extra_count&&!l->reserve_slot&&l->memory_wait);
  REQUIRE(saved_BRow[0].row.pending_tail==23&&saved_BRow[0].steps==31&&l->reductions==9);
  S.budget=32u<<20;rc=brow_service_wait(l);
 }
 REQUIRE(rc==1&&l->reserve_slot==2&&l->reserve_owned&&S.reserve_extra_count==1&&S.reserve_pool_admissions==1);
 REQUIRE(S.reserve_extra_bytes[0]<(3u<<20)&&S.bump<=S.budget&&S.bump>bump);
 REQUIRE(GN_LOAD(&S.reserve_lock)==1&&GN_LOAD(&S.reserve_extra_lock[0])==1);
 BRow*after=&saved_BRow[0].row;REQUIRE(after->reserved==32768&&after->used==16384&&after->heap_n==16384);
 REQUIRE(after->pending_tail==23&&saved_BRow[0].steps==31&&l->reductions==9);
 for(u32 i=0;i<after->used;i++)REQUIRE(after->nodes[i].w.lo==i+1&&after->nodes[i].c.n==2);
 REQUIRE(!brow_add(after,(Word){16385,0},(BCoef){2,2})&&after->capacity==32768);
 coop_release_lane(l);coop_collect_lane(l);REQUIRE(!GN_LOAD(&S.reserve_extra_lock[0])&&GN_LOAD(&S.reserve_lock)==1);return 0;
}
/* Complete a genuine suspended normal form after in-place coefficient growth.
 * Every tail coefficient has 4096 limbs; its exact expected result is explicit. */
API int test_inplace_normal_form(u32 radix){
 REQUIRE(!gn_init(16,3,1,96u<<20,32u<<20,8,0,0));
 REQUIRE(!gn_tune(0,12,16)&&!gn_radix_queue(radix)&&!gn_rational_rewrites(0));
 S.completed=2;REQUIRE(!gn_input_begin(3,251)&&!gn_input_term(4095,0,2));
 for(u32 i=1;i<=250;i++)REQUIRE(!gn_input_term(i,0,2));
 REQUIRE(!gn_input_end()&&S.nrules==1);
 Lane*l=&S.lanes[0];l->a[0]=(Arena){48u<<20,48u<<20,56u<<20,0,0};l->a[1]=(Arena){16u<<20,16u<<20,28u<<20,0,0};
 Arena input={88u<<20,88u<<20,92u<<20,0,0};u32 limbs[4096]={0};limbs[4095]=1;
 Coef big=makec(&input,limbs,4096,1);REQUIRE(!input.error);
 Poly original={alloc_a(&l->a[0],2*sizeof(Term)),2,3,0};
 PTR(Term,original.off)[0]=(Term){{4095,0},big};PTR(Term,original.off)[1]=(Term){{350,0},csmall(19)};
 S.reserve_base=72u<<20;S.reserve_bytes=12u<<20;S.bump=92u<<20;S.reserve_growth=1;S.reserve_pool_limit=1;
 GN_STORE(&S.reserve_lock,1);l->slice_enabled=1;l->slice_end=1e30;
 REQUIRE(big_rational_nf(l,original,0,1)==GN_ROW_WAIT&&l->memory_detail==1&&l->resume_tier==4);
 u32 tail=saved_BRow[0].row.pending_tail;u64 steps=saved_BRow[0].steps,bump=S.bump;
 REQUIRE(tail>1&&tail<251&&l->reductions==1);
 REQUIRE(brow_service_wait(l)==1&&l->row_relayouts==1&&S.bump==bump);
 REQUIRE(saved_BRow[0].row.pending_tail==tail&&saved_BRow[0].steps==steps&&l->reductions==1);
 REQUIRE(big_rational_nf(l,original,0,1)==0&&l->reductions==1&&l->result.n==251);
 REQUIRE(pw(l->result,0).lo==350&&pc(l->result,0)==csmall(19));
 for(u32 i=1;i<=250;i++)REQUIRE(pw(l->result,i).lo==251-i&&csign(pc(l->result,i))==-1&&magcmp(pc(l->result,i),big)==0);
 REQUIRE(S.bump==bump&&GN_LOAD(&S.reserve_lock)==1&&!l->reserve_slot);
 coop_release_lane(l);coop_collect_lane(l);return 0;
}
/* Two retained rows share a fixed budget. Return the large row's unused tail
 * and grow the parked row from it, without allocating or replaying either row. */
API int test_trimmed_row_loan(u32 radix){
 memset(&S,0,sizeof(S));memset(&C,0,sizeof(C));S.budget=62u<<20;S.bump=60u<<20;S.workers=S.lane_slots=2;
 S.radix_enabled=radix;S.reserve_growth=1;S.reserve_pool_limit=2;
 S.reserve_base=16u<<20;S.reserve_bytes=12u<<20;S.reserve_extra_count=1;S.reserve_extra_base[0]=32u<<20;S.reserve_extra_bytes[0]=2u<<20;
 GN_STORE(&S.reserve_lock,1);GN_STORE(&S.reserve_extra_lock[0],1);
 Lane*a=&S.lanes[0],*b=&S.lanes[1];a->reserve_owned=b->reserve_owned=1;a->reserve_slot=1;b->reserve_slot=2;a->resume_slot=0;b->resume_slot=1;
 a->slice_enabled=b->slice_enabled=1;a->reductions=7;b->reductions=11;
 Arena source={4u<<20,4u<<20,8u<<20,0,0};u32 limbs[4096]={0};limbs[4095]=1;Coef big=makec(&source,limbs,4096,1);REQUIRE(!source.error);
 Arena aa={16u<<20,16u<<20,28u<<20,0,0},bb={32u<<20,32u<<20,34u<<20,0,0};BRow ra,rb;
 REQUIRE(!brow_layout(&ra,a,&aa,131072,128,4)&&!brow_layout(&rb,b,&bb,16384,16384,4));
 memset(ra.heads,0,128*8);memset(rb.heads,0,16384*8);
 for(u32 i=0;i<16;i++)REQUIRE(!brow_add(&ra,(Word){i+10001,0},(BCoef){big,csmall(7)}));
 u32 top=bheap_top(&ra);bheap_remove(&ra,top);ra.normal[ra.normal_n++]=top;ra.pivot=ra.nodes[0].c;ra.pending_kind=2;ra.pending_rule=7;ra.pending_tail=19;
 for(u32 i=0;i<16384;i++)REQUIRE(!brow_add(&rb,(Word){i+1,0},(BCoef){2,2}));
 REQUIRE(brow_add(&rb,(Word){16385,0},(BCoef){2,2})==HEAP_MISS&&b->memory_detail==2);
 rb.pending_kind=2;rb.pending_rule=9;rb.pending_tail=23;saved_BRow[0]=(BRowResume){ra,29};saved_BRow[1]=(BRowResume){rb,31};
 a->resume_tier=b->resume_tier=4;b->memory_wait=ROW_WAIT_GROW;b->memory_need=4u<<20;
 REQUIRE(brow_service_wait(b)==0&&b->memory_wait&&S.bump==(60u<<20));
 C.assigned[0]=1;C.assigned[1]=2;S.batch_n=2;
 REQUIRE(!coop_service_memory()&&!b->memory_wait&&S.bump==(60u<<20));
 BRow*x=&saved_BRow[0].row,*y=&saved_BRow[1].row;
 REQUIRE(x->workspace_bytes<(12u<<20)&&S.reserve_bytes==x->workspace_bytes);
 REQUIRE(x->reserved==128&&x->capacity==128&&a->row_relayouts==1&&y->reserved==32768&&y->capacity==16384);
 REQUIRE(S.reserve_extra_base[0]>=S.reserve_base+S.reserve_bytes&&S.reserve_extra_base[0]+S.reserve_extra_bytes[0]<=(28u<<20));
 REQUIRE(x->pending_tail==19&&y->pending_tail==23&&saved_BRow[0].steps==29&&saved_BRow[1].steps==31&&a->reductions==7&&b->reductions==11);
 /* Poison all returned bytes: no coefficient, pivot or queue may refer there. */
 for(u32 i=0;i<S.spare_count;i++)memset(PTR(u8,S.spare_base[i]),0xcc,(size_t)S.spare_bytes[i]);
 REQUIRE(x->normal[0]==top&&x->normal_n==1&&magcmp(x->pivot.n,big)==0&&x->pivot.d==csmall(7));
 for(u32 i=0;i<x->used;i++)REQUIRE(magcmp(x->nodes[i].c.n,big)==0&&x->nodes[i].c.d==csmall(7));
 REQUIRE(!brow_collect(x)&&!brow_add(y,(Word){16385,0},(BCoef){2,2})&&y->capacity==32768);
 coop_release_lane(a);coop_release_lane(b);REQUIRE(!reserve_pool_busy());return 0;
}
/* Finish an actual exact NF after shrinking its reserve and poisoning the
 * released suffix. A fraction with a large numerator must survive relocation. */
API int test_trimmed_normal_form(u32 radix){
 REQUIRE(!gn_init(16,3,1,96u<<20,32u<<20,8,0,0));
 REQUIRE(!gn_tune(0,12,16)&&!gn_radix_queue(radix)&&!gn_rational_rewrites(0));
 S.completed=2;REQUIRE(!gn_input_begin(3,301)&&!gn_input_term(4095,0,7));
 for(u32 i=1;i<=300;i++)REQUIRE(!gn_input_term(i,0,2));REQUIRE(!gn_input_end());
 Lane*l=&S.lanes[0];l->a[0]=(Arena){48u<<20,48u<<20,56u<<20,0,0};l->a[1]=(Arena){46u<<20,46u<<20,(46u<<20)+20480,0,0};
 Arena source={88u<<20,88u<<20,92u<<20,0,0};u32 limbs[4]={0,0,0,1};Coef big=makec(&source,limbs,4,1);
 Poly original={alloc_a(&l->a[0],2*sizeof(Term)),2,3,0};PTR(Term,original.off)[0]=(Term){{4095,0},big};PTR(Term,original.off)[1]=(Term){{350,0},csmall(19)};
 S.reserve_base=60u<<20;S.reserve_bytes=12u<<20;S.bump=92u<<20;S.reserve_growth=1;S.reserve_pool_limit=1;GN_STORE(&S.reserve_lock,1);l->slice_enabled=1;l->slice_end=1e30;
 REQUIRE(big_rational_nf(l,original,0,1)==GN_ROW_WAIT&&l->reductions==1);GN_STORE(&S.reserve_lock,0);REQUIRE(brow_service_wait(l)==1&&l->reserve_slot==1);
 u32 tail=saved_BRow[l->resume_slot].row.pending_tail;u64 steps=saved_BRow[l->resume_slot].steps,bump=S.bump;
 REQUIRE(brow_trim_workspace(l,4u<<20)==1&&S.reserve_bytes<(8u<<20)&&S.bump==bump);
 REQUIRE(saved_BRow[l->resume_slot].row.pending_tail==tail&&saved_BRow[l->resume_slot].steps==steps&&l->reductions==1);
 for(u32 i=0;i<S.spare_count;i++)memset(PTR(u8,S.spare_base[i]),0xcc,(size_t)S.spare_bytes[i]);
 int rc=big_rational_nf(l,original,0,1);
 for(u32 retries=0;rc==GN_ROW_WAIT&&retries<4;retries++){
  REQUIRE(l->reductions==1&&brow_service_wait(l)==1);rc=big_rational_nf(l,original,0,1);
 }
 REQUIRE(rc==0&&l->reductions==1&&l->result.n==301);
 REQUIRE(pw(l->result,0).lo==350&&pc(l->result,0)==csmall(133));
 Coef twice=mulc(&source,big,4);for(u32 i=1;i<=300;i++)REQUIRE(pw(l->result,i).lo==301-i&&csign(pc(l->result,i))==-1&&magcmp(pc(l->result,i),twice)==0);
 REQUIRE(S.bump==bump&&!reserve_pool_busy());coop_release_lane(l);coop_collect_lane(l);return 0;
}
