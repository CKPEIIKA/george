#include "../src/fk_gate.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static const char*id="17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf";
int main(void){FkgGate g;FkgCount d;
 assert(fkg_bind(&g,id,15,0)==1);assert(fkg_covers(&g,13));assert(fkg_covers(&g,16));assert(!fkg_covers(&g,17));assert(fkg_profile_degree()==16&&fkg_exact_total_degree()==16);
 assert(fkg_begin(&g,5,4,123,fkg_from_u64(16615),1)==1);
 assert(fkg_observe(&g,5,4,127,1,1)==1);assert(fkg_deficit(&g,&d)==0&&d.limb[0]==6);
 assert(fkg_observe(&g,5,4,133,1,0)==FKG_NONQUIESCENT);
 assert(fkg_observe(&g,5,4,133,1,1)==FKG_READY);
 assert(fkg_close(&g,fkg_from_u64(16605),0)==FKG_NONQUIESCENT);
 assert(fkg_close(&g,fkg_from_u64(16605),1)==FKG_CLOSED);
 assert(fkg_observe(&g,5,4,133,1,1)==FKG_BAD_STATE);
 assert(fkg_begin(&g,6,5,133,fkg_from_u64(64432),1)==FKG_READY);
 assert(fkg_close(&g,fkg_from_u64(64433),1)==FKG_BAD_COUNT);
 assert(fkg_bind(&g,id,15,2)==0);assert(fkg_begin(&g,5,4,1,fkg_from_u64(1),1)==0);
 assert(fkg_bind(&g,id,14,0)==0);
 char wrong[65];strcpy(wrong,id);wrong[12]='f';assert(fkg_bind(&g,wrong,15,0)==0);
 fkg_bind(&g,id,15,0);assert(fkg_begin(&g,13,11,1,fkg_from_u64(52632322),1)==FKG_BAD_STATE);
 fkg_bind(&g,id,15,0);assert(fkg_begin(&g,5,4,123,fkg_from_u64(16604),1)==FKG_BAD_COUNT);
 fkg_bind(&g,id,15,0);fkg_begin(&g,5,4,123,fkg_from_u64(16606),1);assert(fkg_observe(&g,6,4,124,1,1)==FKG_BAD_EVENT);
 fkg_bind(&g,id,15,0);fkg_begin(&g,5,4,123,fkg_from_u64(16606),1);assert(fkg_observe(&g,5,4,122,1,1)==FKG_BAD_EVENT);
 fkg_bind(&g,id,15,0);fkg_begin(&g,5,4,123,fkg_from_u64(16606),1);assert(fkg_observe(&g,5,4,124,0,1)==FKG_BAD_EVENT);
 fkg_bind(&g,id,15,0);fkg_begin(&g,5,4,123,fkg_from_u64(16606),1);assert(fkg_observe(&g,5,4,125,1,1)==FKG_BAD_COUNT);
 FkgCount x={{0,0,1,0}};assert(!fkg_subtract(&x,1));assert(x.limb[0]==UINT32_MAX&&x.limb[1]==UINT32_MAX&&x.limb[2]==0);
 x=(FkgCount){{0,0,0,1}};assert(!fkg_subtract(&x,UINT64_MAX));assert(x.limb[0]==1&&x.limb[1]==0&&x.limb[2]==UINT32_MAX&&x.limb[3]==0);
 x=fkg_from_u64(0);assert(fkg_subtract(&x,1)==FKG_BAD_COUNT);
 printf("{\"passed\":true,\"testGroups\":7,\"stateBytes\":%zu}\n",sizeof(g));return 0;}
