/* SPDX-License-Identifier: MIT
 * Binary machine-word GCD and a conservative Lehmer reduction for larger
 * magnitudes. The leading-window matrix is only a proposal: its exact full
 * integer image must be nonnegative and strictly smaller before acceptance.
 * A unimodular integer matrix preserves the GCD independently of whether its
 * estimated quotients agree with every full-precision Euclidean quotient.
 * Otherwise one ordinary Euclidean step is taken. Inputs remain immutable.
 */
static u64 integer_gcd64(u64 a,u64 b){
 if(!a)return b;if(!b)return a;if(a==1||b==1)return 1;
 u32 shift=(u32)__builtin_ctzll(a|b);a>>=__builtin_ctzll(a);
 do{b>>=__builtin_ctzll(b);if(a>b){u64 t=a;a=b;b=t;}b-=a;}while(b);
 return a<<shift;
}
static Coef gcd_machine(Arena*z,Coef a,Coef b){
 u64 x=(u64)cl(a,0)|((u64)cl(a,1)<<32),y=(u64)cl(b,0)|((u64)cl(b,1)<<32);
 u64 g=integer_gcd64(x,y);u32 limbs[2]={(u32)g,(u32)(g>>32)};
 return makec(z,limbs,2,1);
}
/* Signed entries are bounded to one 30-bit magnitude. With the input window
 * shifted down to 62 bits, every signed addition and q*entry fits in i64. */
static u32 gcd_lehmer_matrix(Coef a,Coef b,i64 matrix[4]){
 u32 n=cn(a);if(n<3||cn(b)!=n)return 0;
 i64 x=(i64)(((u64)cl(a,n-1)<<32|cl(a,n-2))>>2);
 i64 y=(i64)(((u64)cl(b,n-1)<<32|cl(b,n-2))>>2);
 i64 A=1,B=0,C=0,D=1;u32 steps=0;
 const i64 bound=INT64_C(1)<<30;
 while(y&&steps<64){
  if(y+C<=0||y+D<=0||x+A<0||x+B<0)break;
  i64 q=(x+A)/(y+C);if(q!=(x+B)/(y+D)||q<=0||q>bound)break;
  i64 nextC=A-q*C,nextD=B-q*D;
  if(nextC<=-bound||nextC>=bound||nextD<=-bound||nextD>=bound)break;
  i64 t=x-q*y;if(t<0)break;
  A=C;B=D;C=nextC;D=nextD;x=y;y=t;steps++;
 }
 if(steps<2||!B)return 0;
 matrix[0]=A;matrix[1]=B;matrix[2]=C;matrix[3]=D;return steps;
}
/* Apply both small-coefficient linear forms in one pass. Each signed sum fits
 * in i64 because the matrix entries have magnitude <2^30. Subtracting its low
 * digit before division gives the exact floor carry, including negative sums.
 * No temporary four products/two differences or duplicated limb copies. */
static int gcd_apply_matrix(Arena*z,Coef a,Coef b,const i64 m[4],Coef*pa,Coef*pb){
 u32 n=MAX(cn(a),cn(b)),as[2],bs[2];
 const u32*av=coefficient_limbs(a,as),*bv=coefficient_limbs(b,bs);
 u64 ao=alloc_a(z,8+((u64)n+1)*4),bo=alloc_a(z,8+((u64)n+1)*4);if(z->error)return 0;
 u32*x=PTR(u32,ao+8),*y=PTR(u32,bo+8);i64 ac=0,bc=0;
 /* The estimator admits a batch only for equally sized operands. */
 for(u32 i=0;i<n;i++){
  if(n>16384&&!(i&1023)&&cancelled()){z->error=GN_CANCELLED;return 0;}
  i64 va=av[i],vb=bv[i],sa=m[0]*va+m[1]*vb+ac,sb=m[2]*va+m[3]*vb+bc;
  x[i]=(u32)sa;y[i]=(u32)sb;
  ac=(sa-(i64)x[i])/INT64_C(4294967296);bc=(sb-(i64)y[i])/INT64_C(4294967296);
 }
 if(ac<0||bc<0)return 0;x[n]=(u32)ac;y[n]=(u32)bc;
 *pa=coefficient_finish(z,ao,n+1,1);*pb=coefficient_finish(z,bo,n+1,1);return !z->error;
}
static Coef gcdc(Arena*z,Coef a,Coef b){
#ifdef FOMKYR_GCD_EUCLID
 return gcdc_euclid(z,a,b);
#else
 if(z->error)return 0;u64 mark=z->pos;a=cabs(a);b=cabs(b);
 if(a==2||b==2)return 2;
 if(!a)return clonec(z,b);if(!b)return clonec(z,a);
 if(S.legacy_big_division)return gcdc_euclid(z,a,b);
 if(cn(a)<=2&&cn(b)<=2)return gcd_machine(z,a,b);
 u32 n=MAX(cn(a),cn(b));u64 bytes=A8(8+(u64)n*4);
 u64 slot[2]={alloc_a(z,bytes),alloc_a(z,bytes)};if(z->error)return 0;
 a=gcd_slot(slot[0],a);b=gcd_slot(slot[1],b);u64 work=z->pos;u32 turn=0,rounds=0;
 while(b&&!z->error){
  if((++rounds&63)==0&&cancelled()){z->error=GN_CANCELLED;return 0;}
  if(cn(a)<=2&&cn(b)<=2){z->pos=work;a=gcd_machine(z,a,b);break;}
  if(magcmp(a,b)<0){Coef t=a;a=b;b=t;turn^=1;}
  i64 m[4];
  if(gcd_lehmer_matrix(a,b,m)){
   z->pos=work;
#if defined(FOMKYR_ARITH_BASELINE) || defined(FOMKYR_MATRIX_BASELINE)
   Coef aa=mulc(z,a,csmall(m[0])),bb=mulc(z,b,csmall(m[1]));
   Coef nextA=addc(z,aa,bb);
   aa=mulc(z,a,csmall(m[2]));bb=mulc(z,b,csmall(m[3]));
   Coef nextB=addc(z,aa,bb);if(z->error)return 0;
   int applied=1;
#else
   Coef nextA=0,nextB=0;int applied=gcd_apply_matrix(z,a,b,m,&nextA,&nextB);if(z->error)return 0;
#endif
   if(applied&&csign(nextA)>0&&csign(nextB)>=0&&magcmp(nextA,a)<0&&(!nextB||magcmp(nextB,a)<0)){
    a=gcd_slot(slot[0],nextA);b=gcd_slot(slot[1],nextB);turn=0;continue;
   }
  }
  z->pos=work;Coef rem=divmodc(z,a,b,0);if(z->error)return 0;
  rem=gcd_slot(slot[turn],rem);a=b;b=rem;turn^=1;
 }
 z->pos=work;return compactc(z,mark,clonec(z,a));
#endif
}
