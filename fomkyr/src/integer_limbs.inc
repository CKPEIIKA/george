/* SPDX-License-Identifier: MIT
 * Immutable coefficient arithmetic, writing directly into its final allocation.
 * Schoolbook multiplication starts with mul_1 then accumulates addmul_1 columns;
 * each output limb is initialized before use, without zeroing the full product.
 */
static const u32*coefficient_limbs(Coef c,u32 small[2]){
 if(c&1)return PTR(u32,c_bigoff(c)+8);
 u64 v=cabs64(c);small[0]=(u32)v;small[1]=(u32)(v>>32);return small;
}
static Coef coefficient_finish(Arena*z,u64 off,u32 n,int sign){
 if(z->error)return 0;u32*v=PTR(u32,off+8);while(n&&!v[n-1])n--;
 if(!n){z->pos=off;return 0;}
 if(n<=2){u64 value=v[0]|(n==2?(u64)v[1]<<32:0);
  if(value<=(u64)SMALL_MAX){z->pos=off;return csmall(sign<0?-(i64)value:(i64)value);}
 }
 PTR(u32,off)[0]=n;PTR(u32,off)[1]=0;z->pos=off+A8(8+(u64)n*4);
 return off|1|(sign<0?2:0);
}
static Coef addc(Arena*z,Coef a,Coef b){
#if defined(FOMKYR_ARITH_BASELINE) || defined(FOMKYR_LIMB_BASELINE)
 return addc_base(z,a,b);
#else
 if(z->error)return 0;if(!a)return clonec(z,b);if(!b)return clonec(z,a);
 if(!(a&1)&&!(b&1)){i64 sum=cvalue(a)+cvalue(b);if(sum>=-SMALL_MAX&&sum<=SMALL_MAX)return csmall(sum);}
 int sa=csign(a),sb=csign(b),sign=sa;u32 na=cn(a),nb=cn(b),n=MAX(na,nb),as[2],bs[2];
 const u32*av=coefficient_limbs(a,as),*bv=coefficient_limbs(b,bs);
 if(sa!=sb){
  int cmp=na==nb?0:na>nb?1:-1;
  if(!cmp)for(u32 i=na;i;i--)if(av[i-1]!=bv[i-1]){cmp=av[i-1]>bv[i-1]?1:-1;break;}
  if(!cmp)return 0;
  if(cmp<0){const u32*t=av;av=bv;bv=t;u32 nn=na;na=nb;nb=nn;sign=sb;}
 }
 u64 off=alloc_a(z,8+((u64)n+(sa==sb))*4);if(z->error)return 0;u32*v=PTR(u32,off+8);
 if(sa==sb){u64 carry=0;for(u32 i=0;i<n;i++){u64 s=(u64)(i<na?av[i]:0)+(i<nb?bv[i]:0)+carry;v[i]=(u32)s;carry=s>>32;}v[n++]=(u32)carry;}
 else{u64 borrow=0;for(u32 i=0;i<n;i++){u64 x=av[i],y=(u64)(i<nb?bv[i]:0)+borrow;v[i]=(u32)(x-y);borrow=x<y;}}
 return coefficient_finish(z,off,n,sign);
#endif
}
static Coef mulc(Arena*z,Coef a,Coef b){
#if defined(FOMKYR_ARITH_BASELINE) || defined(FOMKYR_LIMB_BASELINE)
 return mulc_base(z,a,b);
#else
 if(z->error)return 0;if(!a||!b)return 0;
 if(a==2)return clonec(z,b);if(b==2)return clonec(z,a);
 if(a==csmall(-1))return cneg(clonec(z,b));if(b==csmall(-1))return cneg(clonec(z,a));
 if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);if(x<=(u64)SMALL_MAX/y)return csmall((csign(a)*csign(b))*(i64)(x*y));}
 u32 na=cn(a),nb=cn(b),as[2],bs[2];const u32*av=coefficient_limbs(a,as),*bv=coefficient_limbs(b,bs);
 if(na<nb){const u32*t=av;av=bv;bv=t;u32 n=na;na=nb;nb=n;}
 u64 off=alloc_a(z,8+((u64)na+nb)*4);if(z->error)return 0;u32*v=PTR(u32,off+8);u64 carry=0;
 for(u32 i=0;i<na;i++){
  if(na>16384&&!(i&1023)&&cancelled()){z->error=GN_CANCELLED;return 0;}
  u64 x=(u64)av[i]*bv[0]+carry;v[i]=(u32)x;carry=x>>32;
 }v[na]=(u32)carry;
 for(u32 j=1;j<nb;j++){
  if((u64)na*nb>16384&&!(j&15)&&cancelled()){z->error=GN_CANCELLED;return 0;}
  carry=0;for(u32 i=0;i<na;i++){u64 x=(u64)av[i]*bv[j]+v[i+j]+carry;v[i+j]=(u32)x;carry=x>>32;}v[na+j]=(u32)carry;
 }
 return coefficient_finish(z,off,na+nb,csign(a)*csign(b));
#endif
}
