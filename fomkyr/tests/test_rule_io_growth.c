/* SPDX-License-Identifier: MIT. Frozen large reducers must fit every primary. */
#include "../src/kernel.c"
#define REQUIRE(x) do{if(!(x))return __LINE__;}while(0)
API int test_rule_io_growth(void){
 REQUIRE(gn_init(16,6,4,256u<<20,64u<<20,8,0,1)==0);
 REQUIRE(gn_batch_mode(1)==0&&gn_cooperative(10000,4)==0);
 REQUIRE(gn_pair_plan_config(3,3,1u<<20)==0);
 Lane*l=&S.lanes[0];u64 initial_io=l->io_size;u32 n=100000;
 Poly p={alloc_a(&l->a[0],(u64)n*sizeof(Term)),n,5,0};REQUIRE(p.off&&!l->a[0].error);
 PTR(Term,p.off)[0]=(Term){{0xfffff,0},csmall(7)};
 for(u32 i=1;i<n;i++)PTR(Term,p.off)[i]=(Term){{n-i,0},csmall(-2)};
 u32 limbs[4]={7,9,3,1};PTR(Term,p.off)[n-1].c=makec(&l->a[0],limbs,4,1);REQUIRE(!l->a[0].error);
 u64 bytes=record_bytes(p);REQUIRE(bytes>initial_io);
 REQUIRE(append_rule(p,0,0)==0&&S.largest_rule_bytes==bytes);
 REQUIRE(l->io_size>=bytes&&l->io_extra_base&&validate_record(l->io_base,(u32)bytes)==0);
 /* Reproduce restore's old 4 -> 2 -> 4 layout change. The final fixed I/O
  * slice is smaller than the already accepted record. */
 REQUIRE(gn_workers(2)==0&&gn_workers(4)==0&&S.lanes[0].io_size<bytes);
 S.completed=5;REQUIRE(gn_start_degree(6)==0);
 REQUIRE(P.count==1&&!(S.bump&7)&&!(P.base&7));
 REQUIRE(gn_coop_fill(4)>0);
 REQUIRE(coop_coordinator.io_size>=bytes);
 for(u32 i=0;i<4;i++){
  l=&S.lanes[i];REQUIRE(l->io_size>=bytes&&l->io_extra_base);
  Poly g=load_rule(1,l);REQUIRE(!l->error&&g.n==n&&g.degree==5);
  REQUIRE(pw(g,0).lo==0xfffff&&pc(g,0)==csmall(7));
  Coef tail=pc(g,n-1);REQUIRE(!(l->io_base&7)&&pw(g,n-1).lo==1&&cn(tail)==4);
  for(u32 j=0;j<4;j++)REQUIRE(cl(tail,j)==limbs[j]);
  REQUIRE(validate_record(g.origin,(u32)bytes)==0);
 }
 l=&S.lanes[0];u64 base=l->io_base,capacity=l->io_size,allocated=S.bump;
 GN_STORE(&S.batch_running,1);
 REQUIRE(ensure_rule_io(l,capacity+1)==GN_SCRATCH&&l->io_base==base&&S.bump==allocated);
 REQUIRE(gn_workers(2)==GN_STATE);
 GN_STORE(&S.batch_running,0);
 REQUIRE(ensure_rule_io(&coop_helpers[0],bytes)==GN_SCRATCH);
 /* A real budget failure leaves the old readable lease intact. */
 S.bump=S.budget;
 REQUIRE(ensure_rule_io(l,capacity*4)==GN_MEMORY&&l->io_base==base&&l->io_size==capacity);
 S.bump=allocated;
 REQUIRE(ensure_rule_io(l,capacity+1)==0&&l->io_base!=base);
 u64 reuse=capacity;REQUIRE(workspace_take(&reuse)==base);
 memset(PTR(u8,base),0xa5,(size_t)reuse);
 Poly g=load_rule(1,l);REQUIRE(!l->error&&g.n==n&&pw(g,0).lo==0xfffff&&cn(pc(g,n-1))==4);
 for(u32 j=0;j<4;j++)REQUIRE(cl(pc(g,n-1),j)==limbs[j]);
 REQUIRE(validate_record(g.origin,(u32)bytes)==0&&S.bump<=S.budget);
 /* Fresh jobs in the same instance must not return the old coordinator's
  * lease into the new allocator, where that address may already be occupied. */
 REQUIRE(coop_coordinator.io_extra_base);
 REQUIRE(gn_init(16,6,4,256u<<20,64u<<20,8,0,1)==0);
 REQUIRE(gn_batch_mode(1)==0&&gn_cooperative(10000,4)==0);
 REQUIRE(!S.spare_count&&!coop_coordinator.io_extra_base);
 /* Central allocations also defend against a non-coefficient metadata user
  * leaving an odd byte count at the bump frontier or in a returned range. */
 S.bump+=4;u64 persistent=alloc_p(13);REQUIRE(persistent&&!(persistent&7)&&!(S.bump&7));S.bump+=4;
 u64 amount=65536,leased=workspace_take(&amount);REQUIRE(leased&&!(leased&7)&&!(S.bump&7));
 u64 freebase=S.bump+4;workspace_return(freebase,131072);amount=32768;
 u64 aligned=workspace_take(&amount);REQUIRE(aligned&&!(aligned&7)&&aligned>=freebase&&aligned+amount<=freebase+131072);
 return 0;
}
