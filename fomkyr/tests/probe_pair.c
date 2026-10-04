/* SPDX-License-Identifier: MIT. Test-only reduction against a frozen record
 * prefix. No overlap enumeration, basis commits or completion claims. */
#include "queue_probe_063.c"
API int probe_begin(u32 degree,u32 completed,u32 snapshot){
 if(!degree||degree>S.target||completed>=degree||!snapshot||snapshot>S.nrules)return GN_INPUT;
 S.completed=completed;S.current=degree;S.degree_snapshot=snapshot;
 int rc=matcher_build();if(!rc)rc=local_build();return rc;
}
API int probe_reduce(u32 f,u32 g,u32 overlap,u32 snapshot){
 if(!snapshot||snapshot>S.nrules||f>snapshot||g>snapshot)return GN_INPUT;
 /* probe_pair validates the leading-word overlap. Retain its validation with
  * an explicitly selected immutable snapshot for the actual reduction. */
 if(!S.current||!f||!g||!overlap)return GN_INPUT;
 Rule*a=rule(f),*b=rule(g);
 if(overlap>=a->degree||overlap>=b->degree||a->degree+b->degree-overlap!=S.current
  ||!weq(part(a->lm,a->degree,a->degree-overlap,overlap),part(b->lm,b->degree,0,overlap)))return GN_INPUT;
 Lane*l=&S.lanes[0];l->f=f;l->g=g;l->k=overlap;l->snapshot=snapshot;l->error=0;
 return gn_reduce_pair(0);
}
