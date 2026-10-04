/* SPDX-License-Identifier: MIT. Exact parity against the retained general
 * word algorithms, including packed/byte-word boundaries and overflow paths. */
#include "../src/kernel.c"
#include <stdio.h>
#include <stdlib.h>
int gn_host_ensure(u64 end){(void)end;return 0;}
int gn_host_read(u64 off,u64 dst,u32 n){(void)off;(void)dst;(void)n;return 0;}
int gn_host_write(u64 off,u64 src,u32 n){(void)off;(void)src;(void)n;return 0;}
double gn_host_clock(void){return 0;}
static int eager_zero_reference(Word w,u32 degree,Lane*l){
 if(!S.pruning||!S.eager_pruning||!S.square_mask||degree<2)return 0;
 if(!wlong(w)&&S.square_mask==((1u<<S.generators)-1)){
  Word q=shr(w,4),mask=maskw((Word){UINT64_MAX,UINT64_MAX},degree-1);
  u64 x=(w.lo^q.lo)|~mask.lo;
  int zero=!!((x-UINT64_C(0x1111111111111111))&~x&UINT64_C(0x8888888888888888));
  if(!zero&&degree>17){x=(w.hi^q.hi)|~mask.hi;zero=!!((x-UINT64_C(0x1111111111111111))&~x&UINT64_C(0x8888888888888888));}
  if(zero){l->pruned++;l->insertion_prunes++;return 1;}
 }
 u32 pending=0;
 for(u32 j=0;j<degree;j++){
  u32 c=letter(w,degree,j),bit=1u<<c;
  if(pending&bit){l->pruned++;l->insertion_prunes++;l->commuting_prunes++;return 1;}
  pending=(pending&S.commute_mask[c])|(bit&S.square_mask);
 }
 return 0;
}

static void quadratic_precondition_reference(Word*w,u32 degree,i64*c,Lane*l){
 if(!S.quadratic_rewrite||degree<2||wlong(*w))return;
 u32 at=0;
 while(at+1<degree){
  u32 a=letter(*w,degree,at),b=letter(*w,degree,at+1);i64 q=S.swap_factor[(a<<4)|b];
  if(!q){at++;continue;}
  i64 next;
  if(S.modulus){i64 v=(*c)%(i64)S.modulus;if(v<0)v+=S.modulus;next=(i64)((u64)v*(u64)q%S.modulus);}
  else{u64 x=*c<0?(u64)(-*c):(u64)*c,y=q<0?(u64)(-q):(u64)q;
   if(y&&x>(u64)SMALL_MAX/y)return;next=(*c)*q;
  }
  Word mask=shl((Word){a^b,0},4*(degree-at-1)),other=shl((Word){a^b,0},4*(degree-at-2));
  w->lo^=mask.lo^other.lo;w->hi^=mask.hi^other.hi;*c=next;l->quadratic_swaps++;
  if(at)at--;
 }
}

static u32 rng_state=UINT32_C(0x5041434b);
static u32 random_u32(void){rng_state^=rng_state<<13;rng_state^=rng_state>>17;rng_state^=rng_state<<5;return rng_state;}
int main(void){
 u8 bytes[4096]={0};gn_bind(bytes);Lane a={0},b={0};u32 checks=0;
 const u32 fields[]={0,2,3,101,2147483647};
 const i64 coefficients[]={1,-1,2,-2,3,SMALL_MAX,-SMALL_MAX,SMALL_MAX/2,-SMALL_MAX/2};
 for(u32 degree=0;degree<=40;degree++)for(u32 trial=0;trial<2500;trial++){
  S.generators=1+random_u32()%16;S.modulus=fields[trial%5];
  S.pruning=trial%11!=0;S.eager_pruning=trial%13!=0;S.quadratic_rewrite=trial%17!=0;
  S.square_mask=trial%2?((1u<<S.generators)-1):random_u32()&((1u<<S.generators)-1);
  for(u32 i=0;i<16;i++)S.commute_mask[i]=random_u32()&((1u<<S.generators)-1);
  for(u32 i=0;i<256;i++)S.swap_factor[i]=0;
  for(u32 i=0;i<S.generators;i++)for(u32 j=0;j<i;j++){
   i64 q=coefficients[random_u32()%(sizeof(coefficients)/sizeof(*coefficients))];
   S.swap_factor[(i<<4)|j]=S.modulus?(i64)(1+random_u32()%(S.modulus-1)):q;
  }
  Word w={0,0};
  for(u32 i=0;i<degree;i++){u8 c=(u8)(random_u32()%S.generators);bytes[64+i]=c;if(degree<=31){w=shl(w,4);w.lo|=c;}}
  if(degree>31)w=(Word){64,WORD_LONG|degree};
  a.pruned=a.insertion_prunes=a.commuting_prunes=a.quadratic_swaps=0;b=a;
  int x=eager_zero(w,degree,&a),y=eager_zero_reference(w,degree,&b);
  if(x!=y||a.pruned!=b.pruned||a.insertion_prunes!=b.insertion_prunes||a.commuting_prunes!=b.commuting_prunes){fprintf(stderr,"Pruning mismatch at degree %u trial %u\n",degree,trial);return 1;}
  i64 ca=coefficients[trial%(sizeof(coefficients)/sizeof(*coefficients))],cb=ca;Word wa=w,wb=w;
  quadratic_precondition(&wa,degree,&ca,&a);quadratic_precondition_reference(&wb,degree,&cb,&b);
  if(wa.lo!=wb.lo||wa.hi!=wb.hi||ca!=cb||a.quadratic_swaps!=b.quadratic_swaps){fprintf(stderr,"Quadratic mismatch at degree %u trial %u\n",degree,trial);return 1;}
  checks++;
 }
 printf("Packed-word parity: %u cases, degrees 0..40, five fields and signed coefficient boundaries.\n",checks);return 0;
}
