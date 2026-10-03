/* SPDX-License-Identifier: MIT
 * Normalized schoolbook integer division (base 2^32).
 * This is an original implementation of the classical quotient-estimate,
 * correction, multiply/subtract, and add-back algorithm; no library code copied.
 * Unsigned u64 operations hold every 32x32 product and two-limb dividend.
 */
static Coef limb_divmodc(Arena*z,Coef a,Coef b,int quotient){
 if(!b){z->error=GN_CORRUPT;return 0;}
 if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);return csmall((i64)(quotient?x/y:x%y));}
 int cmp=magcmp(a,b);if(cmp<0)return quotient?0:clonec(z,cabs(a));if(!cmp)return quotient?2:0;
 u32 na=cn(a),nb=cn(b);
 if(nb==1){
  u64 qo=quotient?alloc_a(z,(u64)na*4):0;if(z->error)return 0;
  u32*q=quotient?PTR(u32,qo):NULL;u64 rem=0,div=cl(b,0);
  for(u32 j=na;j--;){u64 v=(rem<<32)|cl(a,j);if(q)q[j]=(u32)(v/div);rem=v%div;}
  return quotient?makec(z,q,na,1):csmall((i64)rem);
 }
 u32 m=na-nb,s=(u32)__builtin_clz(cl(b,nb-1));
 u64 vo=alloc_a(z,(u64)nb*4),uo=alloc_a(z,((u64)na+1)*4),qo=quotient?alloc_a(z,((u64)m+1)*4):0;
 if(z->error)return 0;
 u32*v=PTR(u32,vo),*u=PTR(u32,uo),*q=quotient?PTR(u32,qo):NULL;u64 carry=0;
 for(u32 i=0;i<nb;i++){u64 x=((u64)cl(b,i)<<s)|carry;v[i]=(u32)x;carry=x>>32;}
 carry=0;for(u32 i=0;i<na;i++){u64 x=((u64)cl(a,i)<<s)|carry;u[i]=(u32)x;carry=x>>32;}u[na]=(u32)carry;
 const u64 base=UINT64_C(1)<<32;
 for(u32 jj=m+1;jj--;){
  u32 j=jj;
  if(nb>64&&!(j&63)&&cancelled()){z->error=GN_CANCELLED;return 0;}
  u64 qhat,rhat;
  if(u[j+nb]==v[nb-1]){qhat=base-1;rhat=(u64)u[j+nb-1]+v[nb-1];}
  else{u64 num=((u64)u[j+nb]<<32)|u[j+nb-1];qhat=num/v[nb-1];rhat=num%v[nb-1];}
  while(rhat<base && qhat*v[nb-2]>(rhat<<32)+u[j+nb-2]){--qhat;rhat+=v[nb-1];}
  u64 borrow=0;
  for(u32 i=0;i<nb;i++){
   u64 prod=qhat*v[i]+borrow;u32 low=(u32)prod,old=u[j+i];u[j+i]=old-low;
   borrow=(prod>>32)+(old<low);
  }
  u32 top=u[j+nb];u[j+nb]=top-(u32)borrow;
  if((u64)top<borrow){
   --qhat;u64 add=0;
   for(u32 i=0;i<nb;i++){u64 x=(u64)u[j+i]+v[i]+add;u[j+i]=(u32)x;add=x>>32;}
   u[j+nb]+=(u32)add;
  }
  if(q)q[j]=(u32)qhat;
 }
 if(quotient)return makec(z,q,m+1,1);
 if(s)for(u32 i=0;i<nb;i++)u[i]=(u[i]>>s)|(u[i+1]<<(32-s));
 return makec(z,u,nb,1);
}
