/* SPDX-License-Identifier: MIT
 * Known-exact division from low to high using an inverse modulo 2^32.
 * Remove the divisor's powers of two, then determine only the quotient limbs.
 * Products above the quotient's length are unnecessary under the exactness
 * precondition. General quotient/remainder division still uses limb_divmodc.
 */
static u32 exact_shifted_limb(Coef c,u32 i,u32 words,u32 bits){
 u32 x=cl(c,i+words);return bits?(x>>bits)|(cl(c,i+words+1)<<(32-bits)):x;
}
static Coef limb_exactdiv(Arena*z,Coef a,Coef b){
 u32 na=cn(a),nb=cn(b);
 if(!nb||((a&1)&&(!na||!cl(a,na-1)))||((b&1)&&!cl(b,nb-1))){z->error=GN_CORRUPT;return 0;}
 if(na<nb){z->error=GN_CORRUPT;return 0;}
 u32 words=0;while(!cl(b,words))words++;u32 bits=(u32)__builtin_ctz(cl(b,words));
 for(u32 i=0;i<words;i++)if(cl(a,i)){z->error=GN_CORRUPT;return 0;}
 if(bits&&(cl(a,words)&((UINT32_C(1)<<bits)-1))){z->error=GN_CORRUPT;return 0;}
 u32 n=na-nb+1,divisor_n=MIN(nb-words,n);
 u32 low=exact_shifted_limb(b,0,words,bits),inverse=low;
 /* An odd number squared is 1 modulo 8. Four Newton lifts suffice for 32 bits. */
 for(u32 i=0;i<4;i++)inverse*=2u-low*inverse;
#ifndef FOMKYR_EXACTDIV_ALLOC_SMALL
 /* Equal limb counts bound the known-exact quotient to one limb. Its low
  * modular digit is therefore the entire quotient, which fits the inline
  * coefficient representation. No quotient or temporary arena is needed. */
 if(n==1)return csmall((i64)(u32)((u64)exact_shifted_limb(a,0,words,bits)*inverse));
#endif
 u64 off=alloc_a(z,8+(u64)n*4),uo=alloc_a(z,(u64)n*4),vo=alloc_a(z,(u64)divisor_n*4);if(z->error)return 0;
 u32*q=PTR(u32,off+8),*u=PTR(u32,uo),*v=PTR(u32,vo);
 for(u32 i=0;i<n;i++)u[i]=exact_shifted_limb(a,i,words,bits);
 for(u32 i=0;i<divisor_n;i++)v[i]=exact_shifted_limb(b,i,words,bits);
 for(u32 i=0;i<n;i++){
  if(!(i&255)&&cancelled()){z->error=GN_CANCELLED;return 0;}
  q[i]=(u32)((u64)u[i]*inverse);if(!q[i]||i+1==n)continue;
  u64 borrow=0;u32 end=MIN(divisor_n,n-i);
  for(u32 j=0;j<end;j++){u64 product=(u64)q[i]*v[j]+borrow;u32 low=(u32)product,old=u[i+j];u[i+j]=old-low;borrow=(product>>32)+(old<low);}
  /* A short divisor still borrows into higher dividend limbs. Only a borrow
   * beyond the complete quotient modulus may be discarded. */
  for(u32 j=i+end;borrow&&j<n;j++){u32 old=u[j];u[j]=old-(u32)borrow;borrow=old<borrow;}
 }
 return coefficient_finish(z,off,n,1);
}
static Coef exactdiv(Arena*z,Coef a,Coef b){
 if(z->error)return 0;if(!b){z->error=GN_CORRUPT;return 0;}if(!a)return 0;
#if defined(FOMKYR_ARITH_BASELINE) || defined(FOMKYR_EXACTDIV_BASELINE)
 return exactdiv_base(z,a,b);
#else
 if(S.legacy_big_division)return exactdiv_base(z,a,b);
 if(b==2)return clonec(z,a);if(b==csmall(-1))return cneg(clonec(z,a));
 if(!(a&1)&&!(b&1))return csmall((csign(a)*csign(b))*(i64)(cabs64(a)/cabs64(b)));
 Coef q=limb_exactdiv(z,a,b);if(z->error)return 0;
#ifdef FOMKYR_VALIDATE_EXACTDIV
 u64 end=z->pos;Coef product=mulc(z,q,cabs(b));if(z->error)return 0;
 if(magcmp(product,cabs(a))){z->error=GN_CORRUPT;return 0;}z->pos=end;
#endif
 return csign(a)*csign(b)<0?cneg(q):q;
#endif
}
