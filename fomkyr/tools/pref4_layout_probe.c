/* TEST/INSPECTION ONLY. Invokes the real arena layout without reducing a row.
 * A virtual mapping is not an assertion that all those pages fit physical RAM. */
#include <stdio.h>
#include <inttypes.h>
#include "../src/kernel.c"
int host_init(u64,const char*);
int main(void){
 if(!host_init(UINT64_C(4)<<30,NULL))return 1;
 S.radix_enabled=1;S.big_row_max_terms=0;
 printf("{\"method\":\"real production layout functions; virtual reservation only\",\"physical32GBTrial\":false,\"BNodeBytes\":%zu,\"layouts\":[",sizeof(BNode));
 const u64 sizes[]={UINT64_C(2)<<30,UINT64_C(5)<<29,UINT64_C(3)<<30,UINT64_C(7)<<29};
 for(unsigned i=0;i<4;i++){
  Arena a={65536,65536,65536+sizes[i],0,0};BRow row;u32 cap=brow_budget_capacity(sizes[i]);int rc=brow_layout(&row,&S.lanes[0],&a,cap,128,16);if(rc)return rc;
  printf("%s{\"workspaceBytes\":%"PRIu64",\"reservedSlots\":%u,\"structuralBytes\":%"PRIu64",\"poolBytesEach\":%"PRIu64",\"arithmeticTempBytes\":%"PRIu64"}",i?",":"",sizes[i],cap,a.pos-a.base,row.pool[0].end-row.pool[0].base,row.temp.end-row.temp.base);
 }
 puts("]}");return 0;
}
