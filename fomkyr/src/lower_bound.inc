/* SPDX-License-Identifier: MIT
 * Replayable lower bound: independent integer functionals on the quotient.
 * Unlike ranks of original relations modulo p, these give the RIGHT direction.
 * The certificate has a diagonal nonzero minor on its designated pivots. Each
 * functional annihilates every two-sided original relation context in degree d.
 * Signed-128 overflow rejects the certificate; it never changes arithmetic.
 */
/* Explicit two-limb signed arithmetic avoids compiler-rt dependencies in WASM. */
typedef struct {u64 lo,hi;} LB128;
static LB128 lb_product(i64 x,i64 y){
 u64 a=x<0?0-(u64)x:(u64)x,b=y<0?0-(u64)y:(u64)y;
 u64 w0=(u64)(u32)a*(u32)b,t=(a>>32)*(u32)b+(w0>>32),w1=(u32)t,w2=t>>32;
 w1+=(u64)(u32)a*(b>>32);LB128 z={(w1<<32)|(u32)w0,(a>>32)*(b>>32)+w2+(w1>>32)};
 if((x<0)!=(y<0)){z.lo=~z.lo+1;z.hi=~z.hi+(z.lo==0);}return z;
}
static int lb_add(LB128 *sum,LB128 z){
 u64 lo=sum->lo+z.lo,hi=sum->hi+z.hi+(lo<sum->lo);
 if(((sum->hi^z.hi)>>63)==0&&((sum->hi^hi)>>63))return 0;
 *sum=(LB128){lo,hi};return 1;
}
typedef struct {u32 degree,n,start,pad;} LBRel;
typedef struct {u32 word,pad;i64 c;} LBTerm;
static struct {u64 base,end,vec,piv,rel,term;u32 degree,dim,cols,nr,nt,ri,ti,want,pivot_n,vi,active,vector_open;u64 powers[33];} LB;
API void gn_lb_release(void){if(LB.end&&S.bump==LB.end)S.bump=LB.base;memset(&LB,0,sizeof(LB));}
API int gn_lb_begin(u32 degree,u32 dimension,u32 relations,u32 terms,u64 budget){
 if(S.input_expected||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock)||LB.active||degree>32)return GN_STATE;
 u64 powers[33];powers[0]=1;for(u32 i=1;i<=degree;i++){if(powers[i-1]>UINT32_MAX/S.generators)return GN_LIMIT;powers[i]=powers[i-1]*S.generators;}
 if(dimension>powers[degree]||!relations||!terms)return GN_INPUT;
 u64 need=A8(powers[degree]*8)+A8((u64)dimension*4)+(u64)relations*sizeof(LBRel)+(u64)terms*sizeof(LBTerm);
 if(need>budget||need>S.budget-S.bump)return GN_MEMORY;
 u64 old=S.bump;u32 err=S.error;u64 pos=alloc_p(need);if(!pos){S.error=err;return GN_MEMORY;}
 memset(&LB,0,sizeof(LB));LB.base=old;LB.end=S.bump;LB.degree=degree;LB.dim=dimension;LB.cols=(u32)powers[degree];LB.nr=relations;LB.nt=terms;
 LB.vec=pos;pos+=A8(powers[degree]*8);LB.piv=pos;pos+=A8((u64)dimension*4);LB.rel=pos;pos+=(u64)relations*sizeof(LBRel);LB.term=pos;
 memcpy(LB.powers,powers,(degree+1)*sizeof(u64));LB.active=1;return 0;
}
API int gn_lb_pivot(u32 index,u32 col){if(!LB.active||index!=LB.pivot_n||index>=LB.dim||col>=LB.cols||(index&&col<=PTR(u32,LB.piv)[index-1]))return GN_INPUT;PTR(u32,LB.piv)[index]=col;LB.pivot_n++;return 0;}
API int gn_lb_relation(u32 degree,u32 terms){if(!LB.active||LB.vector_open||LB.ri>=LB.nr||LB.want||!degree||degree>LB.degree||!terms||terms>LB.nt-LB.ti)return GN_INPUT;PTR(LBRel,LB.rel)[LB.ri++]=(LBRel){degree,terms,LB.ti,0};LB.want=terms;return 0;}
API int gn_lb_term(u32 word,i64 coeff){if(!LB.active||!LB.want||word>=LB.powers[PTR(LBRel,LB.rel)[LB.ri-1].degree])return GN_INPUT;PTR(LBTerm,LB.term)[LB.ti++]=(LBTerm){word,0,coeff};LB.want--;return 0;}
API int gn_lb_vector(u32 index){if(!LB.active||LB.want||LB.ri!=LB.nr||LB.ti!=LB.nt||LB.pivot_n!=LB.dim||LB.vector_open||index!=LB.vi||index>=LB.dim)return GN_STATE;memset(PTR(i64,LB.vec),0,(size_t)LB.cols*8);LB.vector_open=1;return 0;}
API int gn_lb_entry(u32 col,i64 value){if(!LB.vector_open||col>=LB.cols||!value||PTR(i64,LB.vec)[col])return GN_INPUT;PTR(i64,LB.vec)[col]=value;return 0;}
API int gn_lb_check(void){
 if(!LB.vector_open)return GN_STATE;i64*v=PTR(i64,LB.vec);u32*piv=PTR(u32,LB.piv);
 for(u32 k=0;k<LB.dim;k++){i64 a=v[piv[k]];if(S.modulus)a%=(i64)S.modulus;if(k==LB.vi?!a:a!=0)return GN_REJECTED;}
 u64 polls=0;
 for(u32 i=0;i<LB.nr;i++){LBRel*r=&PTR(LBRel,LB.rel)[i];LBTerm*t=&PTR(LBTerm,LB.term)[r->start];u32 rest=LB.degree-r->degree;
  for(u32 left=0;left<=rest;left++){u64 rightN=LB.powers[rest-left];
   for(u64 a=0;a<LB.powers[left];a++)for(u64 b=0;b<rightN;b++){
    if((++polls&2047)==0&&cancelled())return GN_CANCELLED;
    LB128 sum={0,0};u64 residue=0;
    for(u32 j=0;j<r->n;j++){u64 col=(a*LB.powers[r->degree]+t[j].word)*rightN+b;
     if(S.modulus){i64 x=t[j].c%(i64)S.modulus,y=v[col]%(i64)S.modulus;if(x<0)x+=S.modulus;if(y<0)y+=S.modulus;residue=(residue+(u64)x*(u64)y)%S.modulus;}
     else if(!lb_add(&sum,lb_product(t[j].c,v[col])))return GN_LIMIT;}
    if(sum.lo||sum.hi||residue)return GN_REJECTED;
   }
  }
 }
 LB.vector_open=0;LB.vi++;return 0;
}
API int gn_lb_finish(void){int rc=(!LB.active||LB.want||LB.ri!=LB.nr||LB.ti!=LB.nt||LB.pivot_n!=LB.dim||LB.vector_open||LB.vi!=LB.dim)?GN_REJECTED:0;gn_lb_release();return rc;}
