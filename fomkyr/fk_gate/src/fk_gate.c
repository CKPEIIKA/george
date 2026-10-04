/* SPDX-License-Identifier: MIT */
#include "fk_gate.h"
#include "../profiles/fk6_q.h"
FkgCount fkg_from_u64(uint64_t v){FkgCount x={{(uint32_t)v,(uint32_t)(v>>32),0,0}};return x;}
int fkg_compare(FkgCount a,FkgCount b){for(unsigned k=4;k--;){if(a.limb[k]!=b.limb[k])return a.limb[k]>b.limb[k]?1:-1;}return 0;}
int fkg_subtract(FkgCount*x,uint64_t n){
 FkgCount b=fkg_from_u64(n);if(fkg_compare(*x,b)<0)return FKG_BAD_COUNT;
 uint64_t borrow=0;for(unsigned k=0;k<4;k++){uint64_t a=x->limb[k],v=(uint64_t)b.limb[k]+borrow;x->limb[k]=(uint32_t)(a-v);borrow=a<v;}return 0;
}
void fkg_reset(FkgGate*g){*g=(FkgGate){0};g->abi=FKG_ABI;}
const char*fkg_certificate_sha256(void){return FKG_CERTIFICATE_SHA256;}
int fkg_bind(FkgGate*g,const char id[64],uint32_t n,uint32_t p){
 fkg_reset(g);g->field=p;if(!id||p||n!=15)return FKG_UNAVAILABLE;
 for(unsigned j=0;j<sizeof(fkg_identities)/sizeof(fkg_identities[0]);j++){
  unsigned different=0;for(unsigned k=0;k<64;k++)different|=(unsigned char)id[k]^(unsigned char)fkg_identities[j][k];
  if(!different){g->presentation_ok=1;g->bound=FKG_PROFILE_DEGREE;return FKG_ACTIVE;}
 }return FKG_UNAVAILABLE;
}
int fkg_covers(const FkgGate*g,uint32_t d){return g&&g->abi==FKG_ABI&&g->presentation_ok&&!g->field&&d&&d<=g->bound;}
int fkg_begin(FkgGate*g,uint32_t d,uint32_t completed,uint64_t rules,FkgCount upper,int quiet){
 if(!quiet)return FKG_NONQUIESCENT;
 g->status=FKG_UNAVAILABLE;g->degree=d;if(!fkg_covers(g,d))return FKG_UNAVAILABLE;
 if(completed!=d-1)return g->status=FKG_BAD_STATE;
 g->previous_complete=completed;g->initial_rules=g->observed_rules=rules;g->accepted_leaders=0;
 g->initial_upper=g->upper=upper;g->lower=fkg_from_u64(fkg_fk6_q_lower[d]);
 int cmp=fkg_compare(upper,g->lower);return g->status=cmp<0?FKG_BAD_COUNT:cmp?FKG_ACTIVE:FKG_READY;
}
int fkg_observe(FkgGate*g,uint32_t d,uint32_t completed,uint64_t rules,int valid,int quiet){
 if(!quiet)return FKG_NONQUIESCENT;if(!g||g->abi!=FKG_ABI)return FKG_BAD_STATE;
 if(g->status==FKG_UNAVAILABLE)return FKG_UNAVAILABLE;
 if(g->status<0)return (int32_t)g->status;
 if(g->status!=FKG_ACTIVE&&g->status!=FKG_READY)return FKG_BAD_STATE;
 if(d!=g->degree||completed!=g->previous_complete||rules<g->observed_rules||!valid)return g->status=FKG_BAD_EVENT;
 uint64_t add=rules-g->observed_rules;
 if(fkg_subtract(&g->upper,add))return g->status=FKG_BAD_COUNT;
 g->observed_rules=rules;g->accepted_leaders+=add;
 int cmp=fkg_compare(g->upper,g->lower);return g->status=cmp<0?FKG_BAD_COUNT:cmp?FKG_ACTIVE:FKG_READY;
}
int fkg_close(FkgGate*g,FkgCount actual,int quiet){
 if(!quiet)return FKG_NONQUIESCENT;
 if(!g||g->status!=FKG_READY)return FKG_BAD_STATE;
 if(fkg_compare(actual,g->upper)||fkg_compare(actual,g->lower))return g->status=FKG_BAD_COUNT;
 return g->status=FKG_CLOSED;
}
int fkg_deficit(const FkgGate*g,FkgCount*out){
 if(!g||!out||g->status<FKG_ACTIVE||g->status>FKG_CLOSED)return FKG_BAD_STATE;
 *out=g->upper;return fkg_subtract(out,(uint64_t)g->lower.limb[0]|((uint64_t)g->lower.limb[1]<<32));
}

uint32_t fkg_profile_degree(void){return FKG_PROFILE_DEGREE;}
uint32_t fkg_exact_total_degree(void){return FKG_EXACT_TOTAL_DEGREE;}
