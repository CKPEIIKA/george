/* SPDX-License-Identifier: MIT
 * Original implementation, not a translation of Bergman or Singular.
 * No malloc, GC, C++ runtime, MEMFS, unbounded pair queue, or floating point algebra.
 */
#include "kernel.h"
#define PAGE_N 1024u
#define CACHE_N 16u
#define RED_CACHE_N 256u
#define SMALL_MAX INT64_C(4611686018427387903)
#define MAGIC UINT32_C(0x31424e47)
#define STACK_BYTES (128u*1024u)
#define A8(x) (((x)+7u)&~UINT64_C(7))
#define MIN(a,b) ((a)<(b)?(a):(b))
#define MAX(a,b) ((a)>(b)?(a):(b))
typedef struct {u64 lo,hi;} Word;
typedef u64 Coef; /* even: signed 63-bit immediate; odd: offset|1|signbit(2) */
typedef struct {Word w; Coef c;} Term;
typedef struct {u64 base,pos,end,peak;u32 error;} Arena;
typedef struct {u64 off;u32 n,degree;u64 origin;} Poly;
typedef struct {Word lm;u64 location;u32 bytes,n,degree,next;} Rule;
typedef struct {u32 rule,next;u32 length,pad;} Prefix;
typedef struct {u32 magic,bytes,n,degree;u64 checksum,reserved;} Record;
typedef struct {u32 id,bytes;u64 offset;} Cache;
typedef struct {Word w;u32 version,degree,id,pos;} RedCache;
typedef struct {
  Arena a[2]; u64 io_base,io_size,cache_base,cache_slot;
  Cache cache[CACHE_N]; RedCache red[RED_CACHE_N];
  Poly result;u32 f,g,k,snapshot,error,active;
  u64 reductions,pruned,reads,read_bytes,pairs,peak;
} Lane;
typedef struct {
  u32 abi,generators,target,workers,modulus,spill,error,completed,current;
  u32 nrules,nprefix,hash_mask,table_capacity,degree_snapshot;
  u32 iter_f,iter_k,iter_node,iter_ready,iter_done,input_degree,input_expected,input_used;
  _Atomic(u32) cancel;
  u64 base,bump,budget,scratch_base,scratch_size,stack_base,lm_heads,prefix_heads,rule_pages,prefix_pages;
  u64 disk_end,terms,pair_count,zero_pairs,commit_zero,allocated_peak;
  Lane lanes[GN_MAX_WORKERS];
} State;
static State S;
#ifndef __wasm__
static u8 *native_base;
void gn_bind(void *base){native_base=(u8*)base;}
#define PTR(t,o) ((t*)(native_base+(o)))
#else
#define PTR(t,o) ((t*)(uintptr_t)(o))
extern unsigned char __heap_base;
#endif
void *memcpy(void *dst,const void *src,size_t n){u8*d=dst;const u8*s=src;for(size_t i=0;i<n;i++)d[i]=s[i];return dst;}
void *memset(void *dst,int c,size_t n){u8*d=dst;for(size_t i=0;i<n;i++)d[i]=(u8)c;return dst;}
void *memmove(void *dst,const void *src,size_t n){u8*d=dst;const u8*s=src;if(d<s){for(size_t i=0;i<n;i++)d[i]=s[i];}else{while(n){--n;d[n]=s[n];}}return dst;}
static u32 cancelled(void){return __c11_atomic_load(&S.cancel,__ATOMIC_RELAXED);}
static u64 alloc_a(Arena*a,u64 bytes){bytes=A8(bytes);if(a->error||bytes>a->end-a->pos){a->error=GN_SCRATCH;return 0;}u64 p=a->pos;a->pos+=bytes;if(a->pos-a->base>a->peak)a->peak=a->pos-a->base;return p;}
static void reset_a(Arena*a){a->pos=a->base;a->error=0;}
static u64 alloc_p(u64 bytes){bytes=A8(bytes);if(S.error||S.bump>S.budget||bytes>S.budget-S.bump){S.error=GN_MEMORY;return 0;}u64 p=S.bump;if(!gn_host_ensure(p+bytes)){S.error=GN_MEMORY;return 0;}S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return p;}
static Word shl(Word w,u32 b){if(!b)return w;if(b>=64)return(Word){0,w.lo<<(b-64)};return(Word){w.lo<<b,(w.hi<<b)|(w.lo>>(64-b))};}
static Word shr(Word w,u32 b){if(!b)return w;if(b>=64)return(Word){w.hi>>(b-64),0};return(Word){(w.lo>>b)|(w.hi<<(64-b)),w.hi>>b};}
static Word maskw(Word w,u32 n){u32 b=4*n;if(!b)return(Word){0,0};if(b<64)return(Word){w.lo&((UINT64_C(1)<<b)-1),0};if(b==64)return(Word){w.lo,0};return(Word){w.lo,w.hi&((UINT64_C(1)<<(b-64))-1)};}
static Word part(Word w,u32 n,u32 pos,u32 len){return maskw(shr(w,4*(n-pos-len)),len);}
static Word cat(Word a,Word b,u32 nb){Word w=shl(a,4*nb);return(Word){w.lo|b.lo,w.hi|b.hi};}
static Word context(Word l,Word w,u32 nw,Word r,u32 nr){return cat(cat(l,w,nw),r,nr);}
static int weq(Word a,Word b){return a.lo==b.lo&&a.hi==b.hi;}
static int wcmp(Word a,Word b){return a.hi!=b.hi?(a.hi>b.hi?1:-1):a.lo!=b.lo?(a.lo>b.lo?1:-1):0;}
static u64 mix(u64 x){x^=x>>30;x*=UINT64_C(0xbf58476d1ce4e5b9);x^=x>>27;x*=UINT64_C(0x94d049bb133111eb);return x^(x>>31);}
static u32 hash(Word w,u32 n){return(u32)mix(w.lo^mix(w.hi+((u64)n<<32)))&S.hash_mask;}
static Rule *rule(u32 id){u64 page=PTR(u64,S.rule_pages)[(id-1)/PAGE_N];return PTR(Rule,page)+((id-1)%PAGE_N);}
static Prefix *prefix(u32 id){u64 page=PTR(u64,S.prefix_pages)[(id-1)/PAGE_N];return PTR(Prefix,page)+((id-1)%PAGE_N);}
static u64 c_bigoff(Coef c){return c&~UINT64_C(7);}
static int csign(Coef c){return c&1?(c&2?-1:1):((i64)c<0?-1:c?1:0);}
static Coef csmall(i64 x){return ((u64)x)<<1;}
static i64 cvalue(Coef c){return ((i64)c)>>1;}
static u64 cabs64(Coef c){i64 v=cvalue(c);return v<0?(u64)(-v):(u64)v;}
static Coef cneg(Coef c){return c&1?c^2:csmall(-cvalue(c));}
static Coef cabs(Coef c){return csign(c)<0?cneg(c):c;}
static u32 cn(Coef c){if(c&1)return*PTR(u32,c_bigoff(c));u64 v=cabs64(c);return v>>32?2:v?1:0;}
static u32 cl(Coef c,u32 i){if(c&1)return i<cn(c)?PTR(u32,c_bigoff(c)+8)[i]:0;u64 v=cabs64(c);return i<2?(u32)(v>>(32*i)):0;}
static Coef resolved(Coef c,u64 origin){return c&1?(c_bigoff(c)+origin)|(c&7):c;}
static Coef pc(Poly p,u32 i){return resolved(PTR(Term,p.off)[i].c,p.origin);}
static Coef makec(Arena*a,const u32*v,u32 n,int sign){while(n&&!v[n-1])--n;if(!n)return 0;if(n<=2){u64 z=v[0]|(n==2?(u64)v[1]<<32:0);if(z<=(u64)SMALL_MAX)return csmall(sign<0?-(i64)z:(i64)z);}u64 off=alloc_a(a,8+(u64)n*4);if(!off)return 0;PTR(u32,off)[0]=n;PTR(u32,off)[1]=0;memcpy(PTR(u32,off+8),v,(size_t)n*4);return off|1|(sign<0?2:0);}
static Coef clonec(Arena*a,Coef c){if(!(c&1))return c;return makec(a,PTR(u32,c_bigoff(c)+8),cn(c),csign(c));}
static int magcmp(Coef a,Coef b){u32 na=cn(a),nb=cn(b);if(na!=nb)return na>nb?1:-1;for(u32 i=na;i;i--){u32 x=cl(a,i-1),y=cl(b,i-1);if(x!=y)return x>y?1:-1;}return 0;}
static Coef addc(Arena*z,Coef a,Coef b){
 if(!a)return clonec(z,b);if(!b)return clonec(z,a);
 if(!(a&1)&&!(b&1)){i64 x=cvalue(a)+cvalue(b);if(x>=-SMALL_MAX&&x<=SMALL_MAX)return csmall(x);}
 int sa=csign(a),sb=csign(b),sg=sa;u32 n=MAX(cn(a),cn(b));u64 off=alloc_a(z,4*(u64)(n+1));if(!off)return 0;u32*v=PTR(u32,off);
 if(sa==sb){u64 carry=0;for(u32 i=0;i<n;i++){u64 q=(u64)cl(a,i)+cl(b,i)+carry;v[i]=(u32)q;carry=q>>32;}v[n++]=(u32)carry;}
 else{int cmp=magcmp(a,b);if(!cmp)return 0;if(cmp<0){Coef q=a;a=b;b=q;sg=sb;}u64 borrow=0;for(u32 i=0;i<n;i++){u64 x=cl(a,i),y=(u64)cl(b,i)+borrow;v[i]=(u32)(x-y);borrow=x<y;} }
 return makec(z,v,n,sg);
}
static Coef mulc(Arena*z,Coef a,Coef b){
 if(!a||!b)return 0;if(a==csmall(1))return clonec(z,b);if(b==csmall(1))return clonec(z,a);
 if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);if(x<=(u64)SMALL_MAX/y)return csmall((csign(a)*csign(b))*(i64)(x*y));}
 u32 na=cn(a),nb=cn(b);u64 off=alloc_a(z,4*(u64)(na+nb));if(!off)return 0;u32*v=PTR(u32,off);memset(v,0,4*(size_t)(na+nb));
 for(u32 i=0;i<na;i++){u64 carry=0;for(u32 j=0;j<nb;j++){u64 q=(u64)cl(a,i)*cl(b,j)+v[i+j]+carry;v[i+j]=(u32)q;carry=q>>32;}v[i+nb]=(u32)carry;}
 return makec(z,v,na+nb,csign(a)*csign(b));
}
static Coef divmodc(Arena*z,Coef a,Coef b,int quotient){
 if(!b){z->error=GN_CORRUPT;return 0;}if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);return csmall((i64)(quotient?x/y:x%y));}
 if(magcmp(a,b)<0)return quotient?0:clonec(z,cabs(a));
 u32 na=cn(a),nb=cn(b);u64 ro=alloc_a(z,4*(u64)(nb+1)),qo=quotient?alloc_a(z,4*(u64)na):0;if(!ro||(quotient&&!qo))return 0;
 u32*r=PTR(u32,ro),*q=quotient?PTR(u32,qo):0;memset(r,0,4*(size_t)(nb+1));if(q)memset(q,0,4*(size_t)na);
 for(u64 bit=(u64)na*32;bit;){--bit;u32 carry=(cl(a,(u32)(bit/32))>>(bit%32))&1;
  for(u32 j=0;j<=nb;j++){u32 next=r[j]>>31;r[j]=(r[j]<<1)|carry;carry=next;}
  int cmp=r[nb]?1:0;if(!cmp){for(u32 j=nb;j;j--){u32 v=cl(b,j-1);if(r[j-1]!=v){cmp=r[j-1]>v?1:-1;break;}}}
  if(cmp>=0){u64 borrow=0;for(u32 j=0;j<nb;j++){u64 x=r[j],y=(u64)cl(b,j)+borrow;r[j]=(u32)(x-y);borrow=x<y;}r[nb]-=(u32)borrow;if(q)q[bit/32]|=(u32)1<<(bit%32);}
 }
 return quotient?makec(z,q,na,1):makec(z,r,nb+1,1);
}
static Coef gcdc(Arena*z,Coef a,Coef b){a=cabs(a);b=cabs(b);if(a==2||b==2)return 2;if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);while(y){u64 r=x%y;x=y;y=r;}return csmall((i64)x);}while(b&&!z->error){Coef r=divmodc(z,a,b,0);a=b;b=r;}return clonec(z,a);}
static Coef exactdiv(Arena*z,Coef a,Coef b){if(!a)return 0;if(b==2)return clonec(z,a);Coef q=divmodc(z,a,b,1);return csign(a)*csign(b)<0?cneg(q):q;}
static u32 fpow(u32 a,u32 b){u64 r=1;while(b){if(b&1)r=r*a%S.modulus;a=(u32)((u64)a*a%S.modulus);b>>=1;}return(u32)r;}
static Coef addf(Arena*a,Coef x,Coef y){return S.modulus?csmall((cvalue(x)+cvalue(y))%S.modulus):addc(a,x,y);}
static Coef mulf(Arena*a,Coef x,Coef y){return S.modulus?csmall((i64)((u64)cvalue(x)*(u64)cvalue(y)%S.modulus)):mulc(a,x,y);}
static Coef negf(Coef c){return S.modulus?(c?csmall(S.modulus-cvalue(c)):0):cneg(c);}
static int normalise(Poly*p,Arena*a){if(!p->n)return 0;Term*t=PTR(Term,p->off);Coef lead=pc(*p,0);
 if(S.modulus){u32 inv=fpow((u32)cvalue(lead),S.modulus-2);for(u32 i=0;i<p->n;i++)t[i].c=csmall((i64)((u64)cvalue(pc(*p,i))*inv%S.modulus));p->origin=0;return 0;}
 Coef g=cabs(lead);for(u32 i=1;i<p->n&&g!=2&&!a->error;i++)g=gcdc(a,g,pc(*p,i));int sign=csign(lead);
 if(g!=2||p->origin){for(u32 i=0;i<p->n;i++){Coef c=exactdiv(a,pc(*p,i),g);t[i].c=sign<0?cneg(c):c;}}
 else if(sign<0){for(u32 i=0;i<p->n;i++)t[i].c=cneg(t[i].c);}p->origin=0;return a->error;
}
static u64 checksum(u64 off,u32 n){const u8*p=PTR(u8,off);u64 h=UINT64_C(1469598103934665603);for(u32 i=0;i<n;i++){h^=p[i];h*=UINT64_C(1099511628211);}return h;}
static u64 record_bytes(Poly p){u64 n=sizeof(Record)+(u64)p.n*sizeof(Term);for(u32 i=0;i<p.n;i++){Coef c=pc(p,i);if(c&1)n+=A8(8+(u64)cn(c)*4);}return A8(n);}
static int write_record(Poly p,u64 off,u64 cap){u64 size=record_bytes(p);if(size>cap||size>UINT32_MAX)return GN_SCRATCH;Record*h=PTR(Record,off);h->magic=MAGIC;h->bytes=(u32)size;h->n=p.n;h->degree=p.degree;h->reserved=0;u64 cursor=off+sizeof(Record)+(u64)p.n*sizeof(Term);Term*out=PTR(Term,off+sizeof(Record)),*in=PTR(Term,p.off);
 for(u32 i=0;i<p.n;i++){out[i].w=in[i].w;Coef c=pc(p,i);if(c&1){u64 bytes=8+(u64)cn(c)*4;memcpy(PTR(u8,cursor),PTR(u8,c_bigoff(c)),(size_t)bytes);memset(PTR(u8,cursor+bytes),0,(size_t)(A8(bytes)-bytes));out[i].c=(cursor-off)|(c&7);cursor+=A8(bytes);}else out[i].c=c;}
 if(cursor<off+size)memset(PTR(u8,cursor),0,(size_t)(off+size-cursor));h->checksum=checksum(off+sizeof(Record),(u32)(size-sizeof(Record)));return 0;}
static int validate_record(u64 off,u32 bytes){if(bytes<sizeof(Record))return GN_CORRUPT;Record*h=PTR(Record,off);if(h->magic!=MAGIC||h->bytes!=bytes||!h->n||h->degree<1||h->degree>S.target||sizeof(Record)+(u64)h->n*sizeof(Term)>bytes)return GN_CORRUPT;
 if(h->checksum!=checksum(off+sizeof(Record),bytes-sizeof(Record)))return GN_CORRUPT;Term*t=PTR(Term,off+sizeof(Record));for(u32 i=0;i<h->n;i++){if(i&&wcmp(t[i-1].w,t[i].w)<=0)return GN_CORRUPT;if(!weq(maskw(t[i].w,h->degree),t[i].w))return GN_CORRUPT;Coef c=t[i].c;if(c&1){u64 b=c_bigoff(c);if(b<sizeof(Record)+(u64)h->n*sizeof(Term)||b>bytes-8)return GN_CORRUPT;u32 n=*PTR(u32,off+b);if(!n||8+(u64)n*4>bytes-b)return GN_CORRUPT;}else if(!c)return GN_CORRUPT;}return 0;}
static Poly load_rule(u32 id,Lane*l){Rule*r=rule(id);u64 off=r->location;if(S.spill){Cache*c=&l->cache[id%CACHE_N];if(c->id==id)off=c->offset;else{off=r->bytes<=l->cache_slot?l->cache_base+(id%CACHE_N)*l->cache_slot:l->io_base;if(r->bytes>l->io_size){l->error=GN_SCRATCH;return(Poly){0};}if(!gn_host_read(r->location,off,r->bytes)){l->error=GN_IO;return(Poly){0};}l->reads++;l->read_bytes+=r->bytes;if(validate_record(off,r->bytes)){l->error=GN_CORRUPT;return(Poly){0};}if(r->bytes<=l->cache_slot){c->id=id;c->bytes=r->bytes;c->offset=off;}}}return(Poly){off+sizeof(Record),r->n,r->degree,off};}
static u32 exact_rule(Word w,u32 degree,u32 snapshot){u32 id=PTR(u32,S.lm_heads)[hash(w,degree)];while(id){Rule*r=rule(id);if(id<=snapshot&&r->degree==degree&&weq(r->lm,w))return id;id=r->next;}return 0;}
static u32 divisor(Word w,u32 degree,u32 snapshot,u32*pos,Lane*l){RedCache*c=&l->red[(u32)mix(w.lo^w.hi)%RED_CACHE_N];if(c->version==snapshot+1&&c->degree==degree&&weq(c->w,w)){*pos=c->pos;return c->id;}
 u32 rid=0,rpos=0;for(u32 len=1;len<=degree&&!rid;len++){for(u32 p=0;p+len<=degree;p++){u32 id=exact_rule(part(w,degree,p,len),len,snapshot);if(id){rid=id;rpos=p;break;}}}
 *c=(RedCache){w,snapshot+1,degree,rid,rpos};*pos=rpos;return rid;
}
static Poly copy_poly(Poly p,Arena*a,Word left,Word right,u32 nr,u32 degree){u64 off=alloc_a(a,(u64)p.n*sizeof(Term));if(!off)return(Poly){0};Term*t=PTR(Term,off),*src=PTR(Term,p.off);for(u32 i=0;i<p.n;i++){t[i].w=context(left,src[i].w,p.degree,right,nr);t[i].c=clonec(a,pc(p,i));}return(Poly){off,p.n,degree,0};}
/* Merge two sorted rows; multiplicative left-lex order preserves each input order. */
static Poly combine(Poly p,Coef sp,Poly g,Coef sg,Word left,Word right,u32 nr,Arena*a){
 u64 total=(u64)p.n+g.n;if(total>UINT32_MAX){a->error=GN_SCRATCH;return(Poly){0};}u64 off=alloc_a(a,total*sizeof(Term));if(!off)return(Poly){0};Term*out=PTR(Term,off),*pt=PTR(Term,p.off),*gt=PTR(Term,g.off);u32 i=0,j=0,k=0;
 while(i<p.n||j<g.n){Word gw={0};if(j<g.n)gw=context(left,gt[j].w,g.degree,right,nr);int cmp=i==p.n?-1:j==g.n?1:wcmp(pt[i].w,gw);Word w;Coef c;
  if(cmp>0){w=pt[i].w;c=mulf(a,sp,pc(p,i++));}
  else if(cmp<0){w=gw;c=mulf(a,sg,pc(g,j++));}
  else{w=gw;c=addf(a,mulf(a,sp,pc(p,i++)),mulf(a,sg,pc(g,j++)));}
  if(a->error)return(Poly){0};if(c)out[k++]=(Term){w,c};
 }
 Poly r={off,k,p.degree,0};normalise(&r,a);return r;
}
#include "heap_nf.inc"
static int nf(Lane*l,u32 snapshot){u32 active=l->active;Poly p=l->result;u64 steps=0;u32 scan=0,heap_tried=0;
 for(;;){if(!heap_tried&&p.n>=16){heap_tried=1;int hr=heap_nf(l,p,active,snapshot);if(hr>=0)return hr;}if(l->a[active].error)return l->a[active].error;if((steps&255)==0&&cancelled())return GN_CANCELLED;Term*t=PTR(Term,p.off);u32 idx=scan,pos=0,id=0;
  for(;idx<p.n;idx++){id=divisor(t[idx].w,p.degree,snapshot,&pos,l);if(id)break;}
  if(!id){int rc=normalise(&p,&l->a[active]);l->result=p;l->active=active;return rc;}
  l->reductions++;steps++;scan=idx;Rule*rr=rule(id);
  if(rr->n==1){memmove(t+idx,t+idx+1,(size_t)(p.n-idx-1)*sizeof(Term));p.n--;l->pruned++;continue;}
  Poly g=load_rule(id,l);if(l->error)return l->error;Arena*a=&l->a[active^1];reset_a(a);Coef c=pc(p,idx),lc=pc(g,0),sp,sg;
  if(lc==2){sp=2;sg=negf(c);}
  else if(S.modulus){sp=2;sg=negf(csmall((i64)((u64)cvalue(c)*fpow((u32)cvalue(lc),S.modulus-2)%S.modulus)));}
  else{Coef z=gcdc(a,c,lc);sp=exactdiv(a,lc,z);sg=cneg(exactdiv(a,c,z));}
  if(a->error)return a->error;Word w=t[idx].w;u32 nr=p.degree-pos-g.degree;Word left=part(w,p.degree,0,pos),right=part(w,p.degree,pos+g.degree,nr);
  Poly q=combine(p,sp,g,sg,left,right,nr,a);if(a->error)return a->error;p=q;active^=1;
 }
}
static int reserve_slots(u32 nmore){u32 rpage=S.nrules/PAGE_N,pfirst=S.nprefix/PAGE_N,plast=(S.nprefix+nmore-1)/PAGE_N;
 if(rpage>=S.table_capacity||(nmore&&plast>=S.table_capacity))return GN_MEMORY;
 u64*rp=PTR(u64,S.rule_pages),*pp=PTR(u64,S.prefix_pages);if(!rp[rpage]){u64 o=alloc_p(PAGE_N*sizeof(Rule));if(!o)return S.error;rp[rpage]=o;}
 if(nmore)for(u32 i=pfirst;i<=plast;i++)if(!pp[i]){u64 o=alloc_p(PAGE_N*sizeof(Prefix));if(!o)return S.error;pp[i]=o;}return 0;
}
static int append_rule(Poly p,u64 existing_disk,int restoring){
 if(!p.n){S.commit_zero++;return 0;}Term*t=PTR(Term,p.off);if(S.nrules&&p.degree<rule(S.nrules)->degree)return GN_STATE;
 if(exact_rule(t[0].w,p.degree,S.nrules))return GN_STATE;
 int rc=reserve_slots(p.degree-1);if(rc)return rc;u64 size=record_bytes(p),location=0;Lane*l=&S.lanes[0];
 if(S.spill){location=restoring?existing_disk:S.disk_end;if(!restoring){rc=write_record(p,l->io_base,l->io_size);if(rc)return rc;if(!gn_host_write(location,l->io_base,(u32)size))return GN_IO;}S.disk_end=MAX(S.disk_end,location+size);}
 else{location=alloc_p(size);if(!location)return S.error;rc=write_record(p,location,size);if(rc)return rc;}
 u32 id=++S.nrules,b=hash(t[0].w,p.degree);Rule*r=rule(id);*r=(Rule){t[0].w,location,(u32)size,p.n,p.degree,PTR(u32,S.lm_heads)[b]};PTR(u32,S.lm_heads)[b]=id;
 for(u32 len=1;len<p.degree;len++){u32 h=hash(part(r->lm,p.degree,0,len),len),pid=++S.nprefix;Prefix*q=prefix(pid);*q=(Prefix){id,PTR(u32,S.prefix_heads)[h],len,0};PTR(u32,S.prefix_heads)[h]=pid;}
 S.terms+=p.n;return 0;
}
API u32 gn_abi(void){return GN_ABI;}
API u64 gn_heap_base(void){
#ifdef __wasm__
 return A8((u64)(uintptr_t)&__heap_base);
#else
 return 65536;
#endif
}
API int gn_workers(u32 workers){if(!workers||workers>GN_MAX_WORKERS)return GN_INPUT;u64 bytes=(S.scratch_size/workers)&~UINT64_C(65535);if(bytes<1024*1024)return GN_MEMORY;S.workers=workers;
 for(u32 i=0;i<workers;i++){Lane*l=&S.lanes[i];memset(l,0,sizeof(*l));u64 begin=S.scratch_base+bytes*i,work=(bytes*3/8)&~UINT64_C(7);l->a[0]=(Arena){begin,begin,begin+work,0,0};begin+=work;l->a[1]=(Arena){begin,begin,begin+work,0,0};begin+=work;l->io_base=begin;l->io_size=(bytes/8)&~UINT64_C(7);l->cache_base=begin+l->io_size;l->cache_slot=((bytes-2*work-l->io_size)/CACHE_N)&~UINT64_C(7);}
 return 0;
}
API int gn_init(u32 generators,u32 degree,u32 workers,u64 budget,u64 scratch_pool,u32 hash_bits,u32 modulus,u32 spill){
 if(!generators||generators>16||!degree||degree>GN_MAX_DEGREE||budget>GN_HARD_BYTES||scratch_pool>budget||scratch_pool<1024*1024||hash_bits<8||hash_bits>26||modulus==1||modulus>2147483647u)return GN_INPUT;
 if(modulus){for(u32 d=2;(u64)d*d<=modulus;d++)if(modulus%d==0)return GN_INPUT;}
 memset(&S,0,sizeof(S));S.abi=GN_ABI;S.generators=generators;S.target=degree;S.budget=budget;S.modulus=modulus;S.spill=!!spill;S.base=gn_heap_base();S.bump=S.base;S.stack_base=alloc_p((u64)GN_MAX_WORKERS*STACK_BYTES);if(!S.stack_base)return S.error;
 S.scratch_base=alloc_p(scratch_pool);if(!S.scratch_base)return S.error;S.scratch_size=scratch_pool;int rc=gn_workers(workers);if(rc)return rc;
 S.hash_mask=((u32)1<<hash_bits)-1;u64 hb=((u64)S.hash_mask+1)*4;S.lm_heads=alloc_p(hb);S.prefix_heads=alloc_p(hb);if(S.error)return S.error;memset(PTR(u8,S.lm_heads),0,(size_t)hb);memset(PTR(u8,S.prefix_heads),0,(size_t)hb);
 S.table_capacity=(u32)MIN((budget/(PAGE_N*sizeof(Prefix))+2),(u64)UINT32_MAX);u64 tb=(u64)S.table_capacity*8;S.rule_pages=alloc_p(tb);S.prefix_pages=alloc_p(tb);if(S.error)return S.error;memset(PTR(u8,S.rule_pages),0,(size_t)tb);memset(PTR(u8,S.prefix_pages),0,(size_t)tb);return 0;
}
API u64 gn_stack_top(u32 lane){return lane<GN_MAX_WORKERS?S.stack_base+(u64)(lane+1)*STACK_BYTES:0;}
API u64 gn_cancel_ptr(void){
#ifdef __wasm__
 return(u64)(uintptr_t)&S.cancel;
#else
 return 0;
#endif
}
API void gn_cancel(u32 value){__c11_atomic_store(&S.cancel,value,__ATOMIC_RELAXED);}
API u64 gn_stat(u32 key){switch(key){case 0:return S.nrules;case 1:return S.terms;case 2:return S.completed;case 3:return S.current;case 4:return S.bump;case 5:return S.budget;case 6:return S.disk_end;case 7:return S.pair_count;case 8:return S.zero_pairs;case 9:return S.commit_zero;case 10:return S.workers;case 11:return S.nprefix;case 12:return S.allocated_peak;case 13:return S.error;case 14:return S.target;case 15:return S.generators;case 16:return S.modulus;default:return 0;}}
API u64 gn_lane_stat(u32 lane,u32 key){if(lane>=S.workers)return 0;Lane*l=&S.lanes[lane];switch(key){case 0:return l->reductions;case 1:return l->pruned;case 2:return l->reads;case 3:return l->read_bytes;case 4:return MAX(l->a[0].peak,l->a[1].peak);case 5:return l->error;case 6:return l->pairs;default:return 0;}}
API u32 gn_result_count(u32 lane){return lane<S.workers?S.lanes[lane].result.n:0;}
API int gn_input_begin(u32 degree,u32 terms){if(S.current||degree!=S.completed+1||degree<1||degree>S.target||!terms||S.input_expected)return GN_STATE;Lane*l=&S.lanes[0];reset_a(&l->a[0]);reset_a(&l->a[1]);l->error=0;l->active=0;u64 off=alloc_a(&l->a[0],(u64)terms*sizeof(Term));if(!off)return GN_SCRATCH;l->result=(Poly){off,terms,degree,0};S.input_degree=degree;S.input_expected=terms;S.input_used=0;return 0;}
API int gn_input_term(u64 lo,u64 hi,i64 coefficient){if(!S.input_expected||S.input_used>=S.input_expected||coefficient>SMALL_MAX||coefficient< -SMALL_MAX||!coefficient)return GN_INPUT;Word w={lo,hi};if(!weq(maskw(w,S.input_degree),w))return GN_INPUT;for(u32 i=0;i<S.input_degree;i++)if(part(w,S.input_degree,i,1).lo>=S.generators)return GN_INPUT;Lane*l=&S.lanes[0];Coef c;if(S.modulus){i64 z=coefficient%(i64)S.modulus;if(z<0)z+=S.modulus;c=csmall(z);}else c=csmall(coefficient);PTR(Term,l->result.off)[S.input_used++]=(Term){w,c};return 0;}
API int gn_input_end(void){if(S.input_used!=S.input_expected||!S.input_expected)return GN_STATE;S.input_expected=0;Lane*l=&S.lanes[0];Term*t=PTR(Term,l->result.off);u32 n=l->result.n;/* Inputs are small; insertion sort avoids library allocation. */
 for(u32 i=1;i<n;i++){Term x=t[i];u32 j=i;while(j&&wcmp(t[j-1].w,x.w)<0){t[j]=t[j-1];--j;}t[j]=x;}
 u32 k=0;for(u32 i=0;i<n;i++){if(k&&weq(t[k-1].w,t[i].w)){t[k-1].c=addf(&l->a[0],t[k-1].c,t[i].c);if(!t[k-1].c)--k;}else if(t[i].c)t[k++]=t[i];}l->result.n=k;if(l->a[0].error)return l->a[0].error;int rc=normalise(&l->result,&l->a[0]);if(!rc)rc=nf(l,S.nrules);if(!rc)rc=append_rule(l->result,0,0);return rc;}
API int gn_start_degree(u32 degree){if(S.current||degree!=S.completed+1||degree>S.target)return GN_STATE;S.current=degree;S.degree_snapshot=S.nrules;S.iter_f=1;S.iter_k=1;S.iter_node=0;S.iter_ready=0;S.iter_done=0;return 0;}
API int gn_rewind_degree(void){if(!S.current)return GN_STATE;S.iter_f=1;S.iter_k=1;S.iter_node=0;S.iter_ready=0;S.iter_done=0;return 0;}
API int gn_next_pair(u32 lane){if(lane>=S.workers||!S.current)return -GN_STATE;Lane*l=&S.lanes[lane];if(S.iter_done)return 0;u64 polls=0;
 while(S.iter_f<=S.degree_snapshot){if((++polls&1023)==0&&cancelled())return -GN_CANCELLED;Rule*f=rule(S.iter_f);if(f->degree>=S.current||S.iter_k>=f->degree){S.iter_f++;S.iter_k=1;S.iter_ready=0;continue;}
  u32 k=S.iter_k,glen=S.current-f->degree+k;Word suffix=part(f->lm,f->degree,f->degree-k,k);
  if(glen<=k||glen>=S.current){S.iter_k++;S.iter_ready=0;continue;}
  if(!S.iter_ready){S.iter_node=PTR(u32,S.prefix_heads)[hash(suffix,k)];S.iter_ready=1;}
  while(S.iter_node){if((++polls&1023)==0&&cancelled())return -GN_CANCELLED;Prefix*q=prefix(S.iter_node);S.iter_node=q->next;u32 id=q->rule;if(id>S.degree_snapshot||q->length!=k)continue;Rule*g=rule(id);if(g->degree!=glen||!weq(part(g->lm,g->degree,0,k),suffix))continue;
   if(f->n==1&&g->n==1){S.zero_pairs++;continue;}
   l->f=S.iter_f;l->g=id;l->k=k;l->snapshot=S.nrules;l->error=0;S.pair_count++;return 1;
  }
  S.iter_k++;S.iter_ready=0;
 }
 S.iter_done=1;return 0;
}
API int gn_reduce_pair(u32 lane){if(lane>=S.workers)return GN_INPUT;Lane*l=&S.lanes[lane];l->error=0;reset_a(&l->a[0]);reset_a(&l->a[1]);l->active=0;l->result=(Poly){0};l->pairs++;
 Rule*f=rule(l->f),*g=rule(l->g);u32 nr=g->degree-l->k;Word suffix=part(g->lm,g->degree,l->k,nr),left=part(f->lm,f->degree,0,f->degree-l->k);Poly fp=load_rule(l->f,l);if(l->error)return l->error;
 Poly p=copy_poly(fp,&l->a[0],(Word){0,0},suffix,nr,S.current);if(l->a[0].error)return l->a[0].error;Poly gp=load_rule(l->g,l);if(l->error)return l->error;Coef a=pc(gp,0),b=pc(p,0);Arena*ar=&l->a[1];Coef z=S.modulus?2:gcdc(ar,a,b);Coef sp=S.modulus?a:exactdiv(ar,a,z),sg=negf(S.modulus?b:exactdiv(ar,b,z));if(ar->error)return ar->error;
 l->result=combine(p,sp,gp,sg,left,(Word){0,0},0,ar);l->active=1;if(ar->error)return ar->error;int rc=nf(l,l->snapshot);l->error=rc;return rc;
}
API int gn_commit(u32 lane){if(lane>=S.workers)return GN_INPUT;Lane*l=&S.lanes[lane];if(l->error)return l->error;int rc=nf(l,S.nrules);if(!rc){/* The coordinator I/O buffer must not overwrite a row in lane 0. */rc=append_rule(l->result,0,0);}l->error=rc;return rc;}
API int gn_finish_degree(void){if(!S.current||!S.iter_done)return GN_STATE;S.completed=S.current;S.current=0;return 0;}
API u64 gn_rule_stat(u32 id,u32 key){if(!id||id>S.nrules)return 0;Rule*r=rule(id);switch(key){case 0:return r->lm.lo;case 1:return r->lm.hi;case 2:return r->degree;case 3:return r->n;case 4:return r->bytes;case 5:return r->location;default:return 0;}}
API u64 gn_export_rule(u32 id){if(!id||id>S.nrules)return 0;Lane*l=&S.lanes[0];l->error=0;Rule*r=rule(id);if(S.spill){if(r->bytes>l->io_size||!gn_host_read(r->location,l->io_base,r->bytes)){l->error=r->bytes>l->io_size?GN_SCRATCH:GN_IO;return 0;}if(validate_record(l->io_base,r->bytes)){l->error=GN_CORRUPT;return 0;}return l->io_base;}
 Poly p={r->location+sizeof(Record),r->n,r->degree,r->location};if(write_record(p,l->io_base,l->io_size)){l->error=GN_SCRATCH;return 0;}return l->io_base;}
API u32 gn_export_size(void){return PTR(Record,S.lanes[0].io_base)->bytes;}
API u64 gn_import_buffer(void){return S.lanes[0].io_base;}
API u32 gn_import_capacity(void){return(u32)MIN(S.lanes[0].io_size,UINT32_MAX);}
API int gn_restore_rule(u32 bytes,u64 file_offset){Lane*l=&S.lanes[0];if(bytes>l->io_size)return GN_SCRATCH;int rc=validate_record(l->io_base,bytes);if(rc)return rc;Record*h=PTR(Record,l->io_base);Poly p={l->io_base+sizeof(Record),h->n,h->degree,l->io_base};return append_rule(p,file_offset,1);}
API int gn_restored_through(u32 degree){if(S.current||degree>S.target||(S.nrules&&rule(S.nrules)->degree>degree))return GN_STATE;S.completed=degree;return 0;}
API i64 gn_test_small(u32 operation,i64 a,i64 b){Lane*l=&S.lanes[0];reset_a(&l->a[0]);Coef x=csmall(a),y=csmall(b),z=0;if(operation==0)z=addc(&l->a[0],x,y);else if(operation==1)z=mulc(&l->a[0],x,y);else if(operation==2)z=gcdc(&l->a[0],x,y);else if(operation==3)z=exactdiv(&l->a[0],mulc(&l->a[0],x,y),x);return z&1?INT64_MIN:cvalue(z);}
