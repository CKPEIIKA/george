/* SPDX-License-Identifier: MIT. Fraction roots and malformed magnitude checks. */
#include "../src/kernel.c"
#define REQUIRE(x) do{if(!(x))return __LINE__;}while(0)
API int test_division_invalid_magnitude(void){
 REQUIRE(gn_init(2,2,1,64u<<20,32u<<20,8,0,0)==0);
 Lane*l=&S.lanes[0];Arena*a=&l->a[0];u64 bad=alloc_a(a,16);REQUIRE(bad);PTR(u32,bad)[0]=0;PTR(u32,bad)[1]=0;PTR(u32,bad)[2]=0;PTR(u32,bad)[3]=0;
 for(u32 quotient=0;quotient<2;quotient++){
  reset_a(&l->a[1]);REQUIRE(limb_divmodc(&l->a[1],csmall(17),bad|1,quotient)==0);REQUIRE(l->a[1].error==GN_CORRUPT);
 }
 PTR(u32,bad)[0]=2;PTR(u32,bad)[2]=9;PTR(u32,bad)[3]=0;
 reset_a(&l->a[1]);REQUIRE(limb_divmodc(&l->a[1],csmall(17),bad|1,1)==0&&l->a[1].error==GN_CORRUPT);
 PTR(u32,bad)[0]=0;reset_a(&l->a[1]);REQUIRE(limb_divmodc(&l->a[1],bad|1,csmall(7),1)==0&&l->a[1].error==GN_CORRUPT);
 BRow row={0};row.lane=l;row.temp.error=GN_CORRUPT;
 REQUIRE(brow_add(&row,(Word){1,0},(BCoef){2,2})==GN_CORRUPT&&row.used==0);
 return 0;
}
API int test_fraction_workspace(void){
 REQUIRE(gn_init(2,2,1,64u<<20,32u<<20,8,0,0)==0);
 Arena*a=&S.lanes[0].a[0];u32 limbs[45];for(u32 i=0;i<45;i++)limbs[i]=0xa5a5a5a5u+i;limbs[44]=0x40000000u;
 Coef factor=makec(a,limbs,45,1);REQUIRE(factor&1);
 Coef n=mulc(a,factor,csmall(17)),d=mulc(a,factor,csmall(19));BCoef r=bmake(a,n,d);
 REQUIRE(!a->error&&r.n==csmall(17)&&r.d==csmall(19));REQUIRE(cn(factor)==45&&cl(factor,44)==limbs[44]);
 for(u32 i=0;i<256;i++){
  u64 mark=a->pos;BCoef x=bmake(a,n,d),y=bmake(a,d,n),product=bmul(a,x,y);
  REQUIRE(!a->error&&product.n==2&&product.d==2);REQUIRE(cn(factor)==45&&cl(factor,44)==limbs[44]);a->pos=mark;
 }
 return 0;
}
