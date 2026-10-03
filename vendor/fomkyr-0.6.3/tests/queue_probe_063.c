/* Test-only exports. This module is not distributed as the production engine. */
#include "../src/kernel.c"
API int probe_pair(u32 f,u32 g,u32 overlap){
 if(!S.current||!f||!g||f>S.nrules||g>S.nrules||!overlap)return GN_INPUT;
 Rule*a=rule(f),*b=rule(g);
 if(overlap>=a->degree||overlap>=b->degree||a->degree+b->degree-overlap!=S.current||!weq(part(a->lm,a->degree,a->degree-overlap,overlap),part(b->lm,b->degree,0,overlap)))return GN_INPUT;
 Lane*l=&S.lanes[0];l->f=f;l->g=g;l->k=overlap;l->snapshot=S.nrules;l->error=0;
 return gn_reduce_pair(0);
}
API u32 probe_terms(void){return S.lanes[0].result.n;}
API u64 probe_result(void){Lane*l=&S.lanes[0];if(!l->result.n)return 0;int rc=write_record(l->result,l->io_base,l->io_size);l->error=rc;return rc?0:l->io_base;}
