/* SPDX-License-Identifier: MIT. Test-only cooperative reductions against fixed
 * snapshots. No enumeration, basis commits, file writes or completion claims. */
#include "probe_pair.c"
API int probe_batch_begin(u32 degree,u32 completed,u32 count){
 if(!count||count>BATCH_MAX||!S.batch_enabled||!S.coop_ms)return GN_INPUT;
 u32 pairs[BATCH_MAX][4],snapshot=0;
 memcpy(pairs,PTR(u8,gn_import_buffer()),(size_t)count*16);
 for(u32 i=0;i<count;i++){
  u32 f=pairs[i][0],g=pairs[i][1],k=pairs[i][2],sn=pairs[i][3];
  if(!f||!g||!k||sn>S.nrules||f>sn||g>sn)return GN_INPUT;
  Rule*a=rule(f),*b=rule(g);
  if(k>=a->degree||k>=b->degree||a->degree+b->degree-k!=degree||
   !weq(part(a->lm,a->degree,a->degree-k,k),part(b->lm,b->degree,0,k)))return GN_INPUT;
  snapshot=MAX(snapshot,sn);
 }
 int rc=probe_begin(degree,completed,snapshot);if(rc)return rc;
 S.iter_done=1;S.batch_n=count;S.batch_first=S.batch_committed=0;
 for(u32 i=0;i<count;i++)S.tasks[i]=(BatchTask){pairs[i][0],pairs[i][1],pairs[i][2],pairs[i][3],GN_STATE,0,0};
 coop_order();return 0;
}
API u64 probe_batch_output(u32 i){return i<S.batch_n&&S.tasks[i].rc==0?S.tasks[i].output:0;}
API u32 probe_batch_bytes(u32 i){return i<S.batch_n&&S.tasks[i].rc==0?S.tasks[i].bytes:0;}
