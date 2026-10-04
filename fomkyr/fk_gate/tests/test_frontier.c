/* SPDX-License-Identifier: MIT */
#include "../src/fk_gate.h"
#include "../profiles/fk6_q.h"
#include "../profiles/fk6_sectors.h"
#include <assert.h>
#include <stdio.h>
static const uint32_t exact[3][11]={
 {973571,0,965573,0,967982,0,961050,0,961008,962336,0},
 {0,2367900,0,2348464,0,2364332,0,2363233,0,0,2359498},
 {5637689,0,5641629,0,5638641,0,5645987,0,5636321,5645545,0}
};
static const uint64_t total[3]={346652740,850296030,2031123484};
int main(void){
 uint32_t tested=0;
 for(uint32_t d=14;d<=16;d++){
  uint64_t sum=0;uint32_t closed=0;
  for(uint32_t g=0;g<360;g++){
   uint32_t c=fkg_group_class[d&1][g],v=fkg_class_per_grade[d][c];
   assert(v==exact[d-14][c]);sum+=v;closed++;tested++;
  }
  assert(closed==360&&sum==total[d-14]&&sum==fkg_fk6_q_lower[d]);
  FkgGate gate;FkgCount deficit;
  assert(fkg_bind(&gate,fkg_identities[0],15,0)==1);
  assert(fkg_begin(&gate,d,d-1,1000,fkg_from_u64(sum+1),1)==FKG_ACTIVE);
  assert(fkg_deficit(&gate,&deficit)==0&&deficit.limb[0]==1);
  assert(fkg_observe(&gate,d,d-1,1001,1,1)==FKG_READY);
  assert(fkg_close(&gate,fkg_from_u64(sum),1)==FKG_CLOSED);
  assert(fkg_bind(&gate,fkg_identities[0],15,0)==1);
  assert(fkg_begin(&gate,d,d-1,1000,fkg_from_u64(sum),1)==FKG_READY);
  assert(fkg_close(&gate,fkg_from_u64(sum),1)==FKG_CLOSED);
  assert(fkg_bind(&gate,fkg_identities[0],15,0)==1);
  assert(fkg_begin(&gate,d,d-1,1000,fkg_from_u64(sum-1),1)==FKG_BAD_COUNT);
 }
 FkgGate gate;assert(fkg_bind(&gate,fkg_identities[0],15,0)==1);
 assert(!fkg_covers(&gate,17));assert(fkg_begin(&gate,17,16,1000,fkg_from_u64(0),1)==FKG_UNAVAILABLE);
 printf("{\"passed\":true,\"componentPredicates\":%u,\"exactGrades14To16\":[360,360,360],\"exactTotals14To16\":[346652740,850296030,2031123484]}\n",tested);
 return 0;
}
