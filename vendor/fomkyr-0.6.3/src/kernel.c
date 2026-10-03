/* SPDX-License-Identifier: MIT
 * Original implementation, not a translation of Bergman or Singular.
 * No malloc, GC, C++ runtime, MEMFS, unbounded pair queue, or floating point algebra.
 */
#include "kernel.h"
#define PAGE_N 1024u
#ifdef GN_SINGLE
#define GN_ATOMIC(T) T
#define GN_LOAD(p) (*(p))
#define GN_STORE(p,v) (*(p)=(v))
#define GN_FETCH_ADD(p,v) ((*(p))+=(v),(*(p))-(v))
#define GN_TRY_LOCK(p) ((*(p))?0:((*(p))=1,1))
#define GN_UNLOCK(p) ((*(p))=0)
#else
#define GN_ATOMIC(T) _Atomic(T)
#define GN_LOAD(p) __c11_atomic_load(p,__ATOMIC_RELAXED)
#define GN_STORE(p,v) __c11_atomic_store(p,v,__ATOMIC_RELAXED)
#define GN_FETCH_ADD(p,v) __c11_atomic_fetch_add(p,v,__ATOMIC_RELAXED)
static int try_lock(_Atomic(u32)*p){u32 expected=0;return __c11_atomic_compare_exchange_strong(p,&expected,1,__ATOMIC_ACQUIRE,__ATOMIC_RELAXED);}
#define GN_TRY_LOCK(p) try_lock(p)
#define GN_UNLOCK(p) __c11_atomic_store(p,0,__ATOMIC_RELEASE)
#endif
#define WORD_LONG (UINT64_C(1)<<63)
#define BATCH_MAX 512u
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
typedef struct {Word lm;u64 location;u32 bytes,n,degree,next;u64 pinned;} Rule;
typedef struct {u32 rule,next;u32 length,pad;} Prefix;
typedef struct {u32 magic,bytes,n,degree;u64 checksum,reserved;} Record;
typedef struct {u32 id,bytes;u64 offset;} Cache;
typedef struct {Word w;u32 version,degree,id,pos;} RedCache;
typedef struct {
  Arena a[2]; u64 io_base,io_size,cache_base,cache_slot;
  u64 out_base,out_size,out_used;
  u64 cache_data,cache_capacity,cache_used,cache_hits;
  u32 cache_epoch,cache_mask; RedCache red[RED_CACHE_N];
  Poly result;u32 f,g,k,snapshot,error,active;
  u64 reductions,pruned,reads,read_bytes,pairs,peak;
  u64 hash_probes,matcher_queries,matcher_characters,redcache_hits,heap_attempts,heap_successes,heap_fallbacks;
  u64 insertion_prunes,commuting_prunes,quadratic_swaps;
  u64 reserve_attempts,reserve_successes,reserve_busy,reserve_misses,reserve_peak,reserve_promotions;u32 reserve_owned;
  u32 rational_maxed;u64 rational_table_growths;u64 big_attempts,big_successes,big_fallbacks,big_steps,big_compactions,big_pool_misses,big_capacity_misses,big_arena_misses;
  u64 rational_attempts,rational_successes,rational_fallbacks,integer_steps,rational_steps,local_hits,pinned_hits;u64 rational_local_hits,rational_space_misses,rational_coefficient_misses,rational_arithmetic_misses,rational_table_retries;u32 publications,busy,skip_rule,reduction_tier;
} Lane;
typedef struct {u32 f,g,k,snapshot,rc,bytes;u64 output;} BatchTask;
/* Published at sparse safe points, never read another lane's mutable row. */
typedef struct __attribute__((aligned(64))) {
 GN_ATOMIC(u64) reductions,pruned,reads,pairs,terms,hash_probes,matcher_queries;
 GN_ATOMIC(u32) busy,sequence;
 GN_ATOMIC(u64) tier,exact_fallbacks,left_rule,right_rule,overlap;
} LiveLane;

typedef struct {
  u64 reserve_base,reserve_bytes;u32 reserve_growth,radix_enabled;GN_ATOMIC(u32) reserve_lock;
  GN_ATOMIC(u32) batch_next;
  u32 batch_n,batch_enabled,hilbert_degree,hilbert_nodes;
  u64 batch_epochs,batch_spills,hilbert_bytes;
  u64 hilbert_offset,hilbert_end,hilbert_base;
  u32 hilbert_limbs,pruning,heap_enabled,cache_percent,heap_threshold,rational_enabled,rational_rewrites;
  u32 legacy_big_division,big_rational_enabled,growing_rational;
  double deadline;
  BatchTask tasks[BATCH_MAX];
  u32 batch_order[BATCH_MAX],batch_sort[BATCH_MAX],cost_scheduling;
  u64 word_cache_base,word_cache_bytes;u32 word_cache_entries,word_cache_lanes;
  u32 abi,generators,target,workers,modulus,spill,error,completed,current,certifying;
  u64 pin_base,pin_capacity,pin_used;
  u64 local_base,local_capacity,local_used;u32 local_degree,local_built,local_limit,local_snapshot,local_entries,local_declined;
  u32 nrules,nprefix,hash_mask,table_capacity,degree_snapshot;
  u32 iter_f,iter_k,iter_node,iter_ready,iter_done,input_degree,input_expected,input_used;
  GN_ATOMIC(u32) cancel;
  u64 base,bump,budget,scratch_base,scratch_size,stack_base,lm_heads,prefix_heads,rule_pages,prefix_pages;
  u64 disk_end,terms,pair_count,zero_pairs,commit_zero,allocated_peak;
  u32 matcher_enabled,chain_enabled,telemetry_enabled,matcher_snapshot;
  u32 eager_pruning,quadratic_rewrite,square_mask,commute_mask[16];i64 swap_factor[256];
  u32 matcher_capacity,matcher_nodes,matcher_min,matcher_builds,matcher_fallbacks;
  u64 matcher_base,matcher_limit,matcher_allocated,chain_skipped;
  u64 degree_total,degree_seen,degree_scheduled,degree_committed,degree_monomial,degree_chain;
  u32 degree_total_known,degree_replays;
  LiveLane live[GN_MAX_WORKERS];
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
static void publish_lane(Lane*l,u64 terms,u32 force){
 if(!S.telemetry_enabled)return;
 u32 lane=(u32)(l-S.lanes);LiveLane*v=&S.live[lane];
 GN_STORE(&v->reductions,l->reductions);GN_STORE(&v->pruned,l->pruned);
 GN_STORE(&v->reads,l->reads);GN_STORE(&v->pairs,l->pairs);
 GN_STORE(&v->terms,terms);GN_STORE(&v->hash_probes,l->hash_probes);
 GN_STORE(&v->matcher_queries,l->matcher_queries);GN_STORE(&v->busy,l->busy);
 GN_STORE(&v->tier,l->reduction_tier);GN_STORE(&v->exact_fallbacks,l->rational_fallbacks);
 GN_STORE(&v->left_rule,l->f);GN_STORE(&v->right_rule,l->g);GN_STORE(&v->overlap,l->k);
 GN_FETCH_ADD(&v->sequence,1);
 /* The existing clock import can notify the UI while this Wasm call is still
  * running. Only the coordinator invokes its reporting callback. No new ABI
  * import, no row serialization, and no clock call per arithmetic operation. */
 l->publications++;
 if(lane==0 && (force || !(l->publications&7u))) (void)gn_host_clock();
}
static u32 cancelled(void){
 if(GN_LOAD(&S.cancel))return 1;
 if(S.deadline>0 && gn_host_clock()>=S.deadline){GN_STORE(&S.cancel,1);return 1;}
 return 0;
}
static u64 alloc_a(Arena*a,u64 bytes){bytes=A8(bytes);if(a->error)return 0;if(bytes>a->end-a->pos){a->error=GN_SCRATCH;return 0;}u64 p=a->pos;a->pos+=bytes;if(a->pos-a->base>a->peak)a->peak=a->pos-a->base;return p;}
static void reset_a(Arena*a){a->pos=a->base;a->error=0;}
static u64 alloc_p(u64 bytes){bytes=A8(bytes);if(S.error||S.bump>S.budget||bytes>S.budget-S.bump){S.error=GN_MEMORY;return 0;}u64 p=S.bump;if(!gn_host_ensure(p+bytes)){S.error=GN_MEMORY;return 0;}S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return p;}
/* <=31 letters: original two-register nibble path. Longer words: bounded
 * byte strings in the same arenas, addressed by offsets (also on memory64).
 * Slices are borrowed; every polynomial/record boundary makes an owned copy. */
static int wlong(Word w){return !!(w.hi&WORD_LONG);}
static Word wresolved(Word w,u64 origin){if(wlong(w))w.lo+=origin;return w;}
static Word pw(Poly p,u32 i){return wresolved(PTR(Term,p.off)[i].w,p.origin);}
static Word shl(Word w,u32 b){if(!b)return w;if(b>=128)return(Word){0,0};if(b>=64)return(Word){0,w.lo<<(b-64)};return(Word){w.lo<<b,(w.hi<<b)|(w.lo>>(64-b))};}
static Word shr(Word w,u32 b){if(!b)return w;if(b>=128)return(Word){0,0};if(b>=64)return(Word){w.hi>>(b-64),0};return(Word){(w.lo>>b)|(w.hi<<(64-b)),w.hi>>b};}
static Word maskw(Word w,u32 n){u32 b=4*n;if(!b)return(Word){0,0};if(b>=128)return w;if(b<64)return(Word){w.lo&((UINT64_C(1)<<b)-1),0};if(b==64)return(Word){w.lo,0};return(Word){w.lo,w.hi&((UINT64_C(1)<<(b-64))-1)};}
static u8 letter(Word w,u32 n,u32 pos){return wlong(w)?PTR(u8,w.lo)[pos]:(u8)(shr(w,4*(n-pos-1)).lo&15);}
static Word part(Word w,u32 n,u32 pos,u32 len){
 if(!len)return(Word){0,0};
 if(!wlong(w))return maskw(shr(w,4*(n-pos-len)),len);
 if(len>GN_INLINE_DEGREE)return(Word){w.lo+pos,WORD_LONG|len};
 Word r={0,0};for(u32 i=0;i<len;i++){r=shl(r,4);r.lo|=PTR(u8,w.lo)[pos+i];}return r;
}
static Word shortcat(Word a,Word b,u32 nb){Word w=shl(a,4*nb);return(Word){w.lo|b.lo,w.hi|b.hi};}
static Word clonew(Arena*a,Word w,u32 n){if(!wlong(w))return w;u64 off=alloc_a(a,n);if(!off)return(Word){0,0};memcpy(PTR(u8,off),PTR(u8,w.lo),n);return(Word){off,WORD_LONG|n};}
static Word context(Word l,Word w,u32 nw,Word r,u32 nr,u32 degree,Arena*a){
 if(degree<=GN_INLINE_DEGREE)return shortcat(shortcat(l,w,nw),r,nr);
 u32 nl=degree-nw-nr;u64 off=alloc_a(a,degree);if(!off)return(Word){0,0};u8*out=PTR(u8,off);
 for(u32 i=0;i<nl;i++)out[i]=letter(l,nl,i);
 for(u32 i=0;i<nw;i++)out[nl+i]=letter(w,nw,i);
 for(u32 i=0;i<nr;i++)out[nl+nw+i]=letter(r,nr,i);
 return(Word){off,WORD_LONG|degree};
}
static int weq(Word a,Word b){
 if(!wlong(a)&&!wlong(b))return a.lo==b.lo&&a.hi==b.hi;
 if(a.hi!=b.hi)return 0;if(a.lo==b.lo)return 1;
 u32 n=(u32)a.hi;for(u32 i=0;i<n;i++)if(PTR(u8,a.lo)[i]!=PTR(u8,b.lo)[i])return 0;return 1;
}
static int wcmp(Word a,Word b){
 if(!wlong(a)&&!wlong(b))return a.hi!=b.hi?(a.hi>b.hi?1:-1):a.lo!=b.lo?(a.lo>b.lo?1:-1):0;
 if(!wlong(a)||!wlong(b))return wlong(a)?1:-1;
 u32 na=(u32)a.hi,nb=(u32)b.hi;
 if(na!=nb)return na>nb?1:-1;
 for(u32 i=0;i<na;i++){u8 x=PTR(u8,a.lo)[i],y=PTR(u8,b.lo)[i];if(x!=y)return x>y?1:-1;}return 0;
}
static u64 mix(u64 x){x^=x>>30;x*=UINT64_C(0xbf58476d1ce4e5b9);x^=x>>27;x*=UINT64_C(0x94d049bb133111eb);return x^(x>>31);}
static u32 hash(Word w,u32 n){
 if(!wlong(w))return(u32)mix(w.lo^mix(w.hi+((u64)n<<32)))&S.hash_mask;
 u64 h=UINT64_C(1469598103934665603);for(u32 i=0;i<n;i++){h^=PTR(u8,w.lo)[i];h*=UINT64_C(1099511628211);}return(u32)mix(h^n)&S.hash_mask;
}
static u32 prefix_hash(Word w,u32 length,u32 full_degree){
 return (hash(w,length)^(u32)mix((u64)full_degree+UINT64_C(0x9e3779b97f4a7c15)))&S.hash_mask;
}
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
 if(z->error)return 0;
 if(!a)return clonec(z,b);if(!b)return clonec(z,a);
 if(!(a&1)&&!(b&1)){i64 x=cvalue(a)+cvalue(b);if(x>=-SMALL_MAX&&x<=SMALL_MAX)return csmall(x);}
 int sa=csign(a),sb=csign(b),sg=sa;u32 n=MAX(cn(a),cn(b));u64 off=alloc_a(z,4*(u64)(n+1));if(!off)return 0;u32*v=PTR(u32,off);
 if(sa==sb){u64 carry=0;for(u32 i=0;i<n;i++){u64 q=(u64)cl(a,i)+cl(b,i)+carry;v[i]=(u32)q;carry=q>>32;}v[n++]=(u32)carry;}
 else{int cmp=magcmp(a,b);if(!cmp)return 0;if(cmp<0){Coef q=a;a=b;b=q;sg=sb;}u64 borrow=0;for(u32 i=0;i<n;i++){u64 x=cl(a,i),y=(u64)cl(b,i)+borrow;v[i]=(u32)(x-y);borrow=x<y;} }
 return makec(z,v,n,sg);
}
static Coef mulc(Arena*z,Coef a,Coef b){
 if(z->error)return 0;
 if(!a||!b)return 0;if(a==csmall(1))return clonec(z,b);if(b==csmall(1))return clonec(z,a);
 if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);if(x<=(u64)SMALL_MAX/y)return csmall((csign(a)*csign(b))*(i64)(x*y));}
 u32 na=cn(a),nb=cn(b);u64 off=alloc_a(z,4*(u64)(na+nb));if(!off)return 0;u32*v=PTR(u32,off);memset(v,0,4*(size_t)(na+nb));
 for(u32 i=0;i<na;i++){if((u64)na*nb>16384&&!(i&15)&&cancelled()){z->error=GN_CANCELLED;return 0;}u64 carry=0;for(u32 j=0;j<nb;j++){u64 q=(u64)cl(a,i)*cl(b,j)+v[i+j]+carry;v[i+j]=(u32)q;carry=q>>32;}v[i+nb]=(u32)carry;}
 return makec(z,v,na+nb,csign(a)*csign(b));
}
static Coef legacy_divmodc(Arena*z,Coef a,Coef b,int quotient){
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
/* Release 0.6.2: normalized base-2^32 long division. All estimates and
 * corrections are integer operations. The original bitwise divider remains
 * available for differential testing and optional conservative execution. */
static Coef compactc(Arena*z,u64 mark,Coef c){
 if(z->error)return 0;
 if(!(c&1)){z->pos=mark;return c;}
 u64 off=c_bigoff(c),bytes=A8(8+(u64)cn(c)*4);
 if(off<mark)return c; /* a borrowed operand; normally callers clone it */
 memmove(PTR(u8,mark),PTR(u8,off),(size_t)bytes);z->pos=mark+bytes;
 return mark|(c&7);
}
#include "limb_division.inc"
static Coef divmodc(Arena*z,Coef a,Coef b,int quotient){
 if(z->error)return 0;
 if(S.legacy_big_division)return legacy_divmodc(z,a,b,quotient);
 u64 mark=z->pos;Coef c=limb_divmodc(z,a,b,quotient);return compactc(z,mark,c);
}
/* Euclidean remainders occupy two reusable slots. The previous implementation
 * retained every remainder in a bump arena, a quadratic-space scratch failure
 * on long exact coefficients despite a tiny live polynomial. */
static Coef gcd_slot(u64 off,Coef c){
 if(!(c&1))return c;u64 bytes=8+(u64)cn(c)*4;
 memmove(PTR(u8,off),PTR(u8,c_bigoff(c)),(size_t)bytes);return off|1;
}
static Coef gcdc(Arena*z,Coef a,Coef b){
 if(z->error)return 0;u64 mark=z->pos;a=cabs(a);b=cabs(b);
 if(a==2||b==2)return 2;
 if(!a)return clonec(z,b);if(!b)return clonec(z,a);
 if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);while(y){u64 r=x%y;x=y;y=r;}return csmall((i64)x);}
 u32 n=MAX(cn(a),cn(b));u64 bytes=A8(8+(u64)n*4);
 u64 slot[2]={alloc_a(z,bytes),alloc_a(z,bytes)};if(z->error)return 0;
 a=gcd_slot(slot[0],a);b=gcd_slot(slot[1],b);u64 work=z->pos;u32 turn=0,rounds=0;
 while(b&&!z->error){
  if((++rounds&127)==0&&cancelled()){z->error=GN_CANCELLED;return 0;}
  if(!(a&1)&&!(b&1)){u64 x=cabs64(a),y=cabs64(b);while(y){u64 r=x%y;x=y;y=r;}a=csmall((i64)x);break;}
  z->pos=work;Coef r=divmodc(z,a,b,0);if(z->error)return 0;
  r=gcd_slot(slot[turn],r);a=b;b=r;turn^=1;
 }
 z->pos=work;return compactc(z,mark,clonec(z,a));
}
static Coef exactdiv(Arena*z,Coef a,Coef b){if(z->error)return 0;if(!a)return 0;if(b==2)return clonec(z,a);Coef q=divmodc(z,a,b,1);return csign(a)*csign(b)<0?cneg(q):q;}
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
static u64 record_bytes(Poly p){u64 n=sizeof(Record)+(u64)p.n*sizeof(Term);for(u32 i=0;i<p.n;i++){Coef c=pc(p,i);if(c&1)n+=A8(8+(u64)cn(c)*4);if(p.degree>GN_INLINE_DEGREE)n+=A8(p.degree);}return A8(n);}
static int write_record(Poly p,u64 off,u64 cap){u64 size=record_bytes(p);if(size>cap||size>UINT32_MAX)return GN_SCRATCH;Record*h=PTR(Record,off);h->magic=MAGIC;h->bytes=(u32)size;h->n=p.n;h->degree=p.degree;h->reserved=0;u64 cursor=off+sizeof(Record)+(u64)p.n*sizeof(Term);Term*out=PTR(Term,off+sizeof(Record));
 for(u32 i=0;i<p.n;i++){Word w=pw(p,i);out[i].w=w;
  if(wlong(w)){memcpy(PTR(u8,cursor),PTR(u8,w.lo),p.degree);memset(PTR(u8,cursor+p.degree),0,(size_t)(A8(p.degree)-p.degree));out[i].w.lo=cursor-off;cursor+=A8(p.degree);}Coef c=pc(p,i);if(c&1){u64 bytes=8+(u64)cn(c)*4;memcpy(PTR(u8,cursor),PTR(u8,c_bigoff(c)),(size_t)bytes);memset(PTR(u8,cursor+bytes),0,(size_t)(A8(bytes)-bytes));out[i].c=(cursor-off)|(c&7);cursor+=A8(bytes);}else out[i].c=c;}
 if(cursor<off+size)memset(PTR(u8,cursor),0,(size_t)(off+size-cursor));h->checksum=checksum(off+sizeof(Record),(u32)(size-sizeof(Record)));return 0;}
static int validate_record(u64 off,u32 bytes){
 if(bytes<sizeof(Record))return GN_CORRUPT;Record*h=PTR(Record,off);
 u64 floor=sizeof(Record)+(u64)h->n*sizeof(Term);
 if(h->magic!=MAGIC||h->bytes!=bytes||!h->n||h->degree<1||h->degree>S.target||floor>bytes)return GN_CORRUPT;
 if(h->checksum!=checksum(off+sizeof(Record),bytes-sizeof(Record)))return GN_CORRUPT;
 Term*t=PTR(Term,off+sizeof(Record));Word prev={0};
 for(u32 i=0;i<h->n;i++){
  Word w=t[i].w;
  if(h->degree>GN_INLINE_DEGREE){
   if(!wlong(w)||w.hi!=(WORD_LONG|h->degree)||w.lo<floor||w.lo>bytes||h->degree>bytes-w.lo)return GN_CORRUPT;
   w.lo+=off;
  }else if(wlong(w)||!weq(maskw(w,h->degree),w))return GN_CORRUPT;
  if(i&&wcmp(prev,w)<=0)return GN_CORRUPT;prev=w;
  for(u32 j=0;j<h->degree;j++)if(letter(w,h->degree,j)>=S.generators)return GN_CORRUPT;
  Coef c=t[i].c;if(c&1){u64 b=c_bigoff(c);if(b<floor||b>bytes-8)return GN_CORRUPT;u32 n=*PTR(u32,off+b);if(!n||8+(u64)n*4>bytes-b)return GN_CORRUPT;}else if(!c)return GN_CORRUPT;
 }return 0;
}
/* Variable-size immutable reducer cache. A generation-tagged ring uses the
 * byte budget for actual records, not sixteen equally oversized fixed slots.
 * No borrowed record pointer survives the next load_rule on the same lane. */
static Poly load_rule(u32 id,Lane*l){
 Rule*r=rule(id);u64 off=r->location;
 if(r->pinned){l->pinned_hits++;return(Poly){r->pinned+sizeof(Record),r->n,r->degree,r->pinned};}
 if(S.spill){
  Cache*c=PTR(Cache,l->cache_base)+(id&l->cache_mask);
  if(S.cache_percent&&c->id==id&&c->bytes==l->cache_epoch){off=c->offset;l->cache_hits++;}
  else{
   if(r->bytes>l->io_size){l->error=GN_SCRATCH;return(Poly){0};}
   int keep=S.cache_percent&&r->bytes<=l->cache_capacity;
   if(keep){
    if(r->bytes>l->cache_capacity-l->cache_used){
     l->cache_used=0;l->cache_epoch++;
     if(!l->cache_epoch){memset(PTR(u8,l->cache_base),0,((u64)l->cache_mask+1)*sizeof(Cache));l->cache_epoch=1;}
    }
    off=l->cache_data+l->cache_used;
   }else off=l->io_base;
   if(!gn_host_read(r->location,off,r->bytes)){l->error=GN_IO;return(Poly){0};}
   l->reads++;l->read_bytes+=r->bytes;
   if(validate_record(off,r->bytes)){l->error=GN_CORRUPT;return(Poly){0};}
   if(keep){c->id=id;c->bytes=l->cache_epoch;c->offset=off;l->cache_used+=A8(r->bytes);}
  }
 }
 return(Poly){off+sizeof(Record),r->n,r->degree,off};
}
static u32 exact_rule(Word w,u32 degree,u32 snapshot){u32 id=PTR(u32,S.lm_heads)[hash(w,degree)];while(id){Rule*r=rule(id);if(id<=snapshot&&r->degree==degree&&weq(r->lm,w))return id;id=r->next;}return 0;}
#include "matcher.inc"
static u32 divisor(Word w,u32 degree,u32 snapshot,u32*pos,Lane*l){
 /* Canonical export protects only its own leading word. Before enabling this,
  * canonical export checks that no other leading word divides it. All tails
  * are smaller, hence cannot contain that protected leading word. */
 if(l->skip_rule&&degree==rule(l->skip_rule)->degree&&weq(w,rule(l->skip_rule)->lm)){*pos=0;return 0;}
 RedCache*c=NULL;
 if(!wlong(w)){
  u32 index=(u32)mix(w.lo^w.hi),lane=(u32)(l-S.lanes);
  if(S.word_cache_base&&lane<S.word_cache_lanes)c=&PTR(RedCache,S.word_cache_base)[(u64)lane*S.word_cache_entries+(index&(S.word_cache_entries-1))];
  else c=&l->red[index&(RED_CACHE_N-1)];
  if(c->degree==degree&&weq(c->w,w)&&((c->id&&c->id<=snapshot)||c->version==snapshot+1)){
   *pos=c->pos;l->redcache_hits++;return c->id;
  }
 }
 u32 rid=0,rpos=0,first=1,maxlen=MIN(degree,snapshot?rule(snapshot)->degree:0);
 if(S.matcher_enabled&&S.matcher_nodes&&snapshot>=S.matcher_snapshot){
  l->matcher_queries++;rid=matcher_find(w,degree,&rpos,l);
  if(snapshot==S.matcher_snapshot)first=maxlen+1;
  else first=rule(S.matcher_snapshot+1)->degree;
  if(rid)maxlen=MIN(maxlen,rule(rid)->degree);
 }
 /* Newly appended rules are not in the immutable automaton. Search them using
  * the exact hash index; in a homogeneous degree epoch they have full degree.
  * A matcher built for a later snapshot is NEVER used for an earlier snapshot. */
 for(u32 len=first;len<=maxlen;len++){
  u32 stop=(rid&&rule(rid)->degree==len)?rpos:degree-len;
  for(u32 at=0;at<=stop;at++){
   l->hash_probes++;u32 id=exact_rule(part(w,degree,at,len),len,snapshot);
   if(id){rid=id;rpos=at;goto found;}
  }
 }
found:
 if(c)*c=(RedCache){w,snapshot+1,degree,rid,rpos};*pos=rpos;return rid;
}
static u32 prefix_count(Word w,u32 length,u32 full_degree,u32 snapshot){
 u32 node=PTR(u32,S.prefix_heads)[prefix_hash(w,length,full_degree)];
 while(node){Prefix*q=prefix(node);Rule*r=rule(q->rule);
  if(q->rule<=snapshot&&q->length==length&&r->degree==full_degree&&weq(part(r->lm,r->degree,0,length),w))return q->pad;
  node=q->next;
 }
 return 0;
}
static Poly copy_poly(Poly p,Arena*a,Word left,Word right,u32 nr,u32 degree){u64 off=alloc_a(a,(u64)p.n*sizeof(Term));if(!off)return(Poly){0};Term*t=PTR(Term,off);for(u32 i=0;i<p.n;i++){t[i].w=context(left,pw(p,i),p.degree,right,nr,degree,a);t[i].c=clonec(a,pc(p,i));}return(Poly){off,p.n,degree,0};}
/* Merge two sorted rows; multiplicative left-lex order preserves each input order. */
static Poly combine(Poly p,Coef sp,Poly g,Coef sg,Word left,Word right,u32 nr,Arena*a){
 u64 total=(u64)p.n+g.n;if(total>UINT32_MAX){a->error=GN_SCRATCH;return(Poly){0};}u64 off=alloc_a(a,total*sizeof(Term));if(!off)return(Poly){0};Term*out=PTR(Term,off),*pt=PTR(Term,p.off);u32 i=0,j=0,k=0;
 while(i<p.n||j<g.n){Word gw={0};if(j<g.n)gw=context(left,pw(g,j),g.degree,right,nr,p.degree,a);int cmp=i==p.n?-1:j==g.n?1:wcmp(pt[i].w,gw);Word w;Coef c;
  if(cmp>0){w=clonew(a,pw(p,i),p.degree);c=mulf(a,sp,pc(p,i++));}
  else if(cmp<0){w=gw;c=mulf(a,sg,pc(g,j++));}
  else{w=gw;c=addf(a,mulf(a,sp,pc(p,i++)),mulf(a,sg,pc(g,j++)));}
  if(a->error)return(Poly){0};if(c)out[k++]=(Term){w,c};
 }
 Poly r={off,k,p.degree,0};normalise(&r,a);return r;
}
/* These sufficient zero tests use only proved quadratic relations in the
 * current field: x_i^2=0 and x_i*x_j=q*x_j*x_i with q != 0. They do NOT
 * assume that all generators commute or that a matrix representation is
 * faithful. Skipping a term here is exact ideal membership, not a heuristic. */
static int eager_zero(Word w,u32 degree,Lane*l){
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
/* Apply only oriented, actually known monic quadratic binomials, before
 * entering the sparse heap. Each swap strictly decreases degleftlex. A local
 * coefficient overflow simply stops preconditioning; the exact reducer still
 * receives an equivalent row and may use arbitrary precision afterwards. */
static void quadratic_precondition(Word*w,u32 degree,i64*c,Lane*l){
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
#include "local_rewrites.inc"
#include "radix_queue.inc"
#include "heap_nf.inc"
#include "rational_heap_nf.inc"
#include "big_rational_nf.inc"
/* One bounded overflow workspace, shared by exceptional rows. No spinning:
 * a busy reserve defers the task to the ordered commit barrier. Successful results
 * are wholly owned by the original output arena before releasing the lease. */
static int reserve_nf(Lane*l,Poly p,u32 active,u32 snapshot){
 if(!S.reserve_base||S.reserve_bytes<=l->a[active^1].end-l->a[active^1].base)return HEAP_MISS;
 if(!GN_TRY_LOCK(&S.reserve_lock)){l->reserve_busy++;return GN_DEFERRED;}
 l->reserve_attempts++;
 Arena saved=l->a[active^1];l->a[active^1]=(Arena){S.reserve_base,S.reserve_base,S.reserve_base+S.reserve_bytes,0,0};
 l->rational_maxed=0;l->reduction_tier=5;
 int rc=HEAP_MISS;
 if(S.rational_enabled){u64 steps=l->reductions;rc=rational_nf(l,p,active,snapshot);l->rational_steps+=l->reductions-steps;}
 if(rc<0&&S.big_rational_enabled){l->reduction_tier=6;rc=big_rational_nf(l,p,active,snapshot);}
 l->reserve_peak=MAX(l->reserve_peak,l->a[active^1].peak);
 l->a[active^1]=saved;
 if(!rc)l->reserve_successes++;else if(rc<0)l->reserve_misses++;
 GN_UNLOCK(&S.reserve_lock);return rc;
}
static int nf(Lane*l,u32 snapshot){u32 active=l->active;Poly p=l->result;u64 steps=0;u32 scan=0,heap_tried=0;l->rational_maxed=0;l->reduction_tier=3;
 for(;;){if(S.heap_enabled&&p.degree<=GN_INLINE_DEGREE&&!heap_tried&&p.n>=S.heap_threshold){heap_tried=1;l->heap_attempts++;u64 prior_steps=l->reductions;l->reduction_tier=1;int hr=heap_nf(l,p,active,snapshot);l->integer_steps+=l->reductions-prior_steps;if(hr>=0){if(!hr)l->heap_successes++;return hr;}l->heap_fallbacks++;if(S.rational_enabled&&!S.modulus){l->rational_attempts++;prior_steps=l->reductions;l->reduction_tier=2;hr=rational_nf(l,p,active,snapshot);l->rational_steps+=l->reductions-prior_steps;if(hr>=0){if(!hr)l->rational_successes++;return hr;}l->rational_fallbacks++;}
 if(S.big_rational_enabled&&!S.modulus){l->big_attempts++;l->reduction_tier=4;int br=big_rational_nf(l,p,active,snapshot);if(br>=0){if(!br)l->big_successes++;return br;}l->big_fallbacks++;}
 if(!S.modulus&&(l->rational_maxed||S.big_rational_enabled)){int rr=reserve_nf(l,p,active,snapshot);if(rr>=0)return rr;}
 l->reduction_tier=3;}if(l->a[active].error)return l->a[active].error;if((steps&255)==0){publish_lane(l,p.n,0);if(cancelled())return GN_CANCELLED;}Term*t=PTR(Term,p.off);u32 idx=scan,pos=0,id=0;
  for(;idx<p.n;idx++){id=divisor(t[idx].w,p.degree,snapshot,&pos,l);if(id)break;}
  if(!id){int rc=normalise(&p,&l->a[active]);l->result=p;l->active=active;return rc;}
  l->reductions++;steps++;scan=idx;Rule*rr=rule(id);
  if(S.pruning&&rr->n==1){memmove(t+idx,t+idx+1,(size_t)(p.n-idx-1)*sizeof(Term));p.n--;l->pruned++;continue;}
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
 if(!p.n){S.commit_zero++;return 0;}Word leading=pw(p,0);if(S.nrules&&p.degree<rule(S.nrules)->degree)return GN_STATE;
 if(exact_rule(leading,p.degree,S.nrules))return GN_STATE;
 int rc=reserve_slots(p.degree-1);if(rc)return rc;u64 size=record_bytes(p),location=0;Lane*l=&S.lanes[0];
 if(S.spill){location=restoring?existing_disk:S.disk_end;if(!restoring){rc=write_record(p,l->io_base,l->io_size);if(rc)return rc;if(!gn_host_write(location,l->io_base,(u32)size))return GN_IO;}S.disk_end=MAX(S.disk_end,location+size);}
 else{location=alloc_p(size);if(!location)return S.error;rc=write_record(p,location,size);if(rc)return rc;}
 if(wlong(leading)){u64 owned=alloc_p(p.degree);if(!owned)return S.error;memcpy(PTR(u8,owned),PTR(u8,leading.lo),p.degree);leading.lo=owned;}
 u32 id=++S.nrules,b=hash(leading,p.degree);Rule*r=rule(id);*r=(Rule){leading,location,(u32)size,p.n,p.degree,PTR(u32,S.lm_heads)[b],0};PTR(u32,S.lm_heads)[b]=id;
 for(u32 len=1;len<p.degree;len++){
  Word key=part(r->lm,p.degree,0,len);u32 h=prefix_hash(key,len,p.degree);
  u32 count=prefix_count(key,len,p.degree,id-1)+1,pid=++S.nprefix;
  Prefix*q=prefix(pid);*q=(Prefix){id,PTR(u32,S.prefix_heads)[h],len,count};PTR(u32,S.prefix_heads)[h]=pid;
 }
 if(p.degree==2){
  u32 a=letter(leading,2,0),b=letter(leading,2,1);
  if(p.n==1&&a==b)S.square_mask|=1u<<a;
  if(p.n==2&&a!=b){Word tail=pw(p,1);
   if(letter(tail,2,0)==b&&letter(tail,2,1)==a){
    S.commute_mask[a]|=1u<<b;S.commute_mask[b]|=1u<<a;
    Coef lc=pc(p,0),tc=pc(p,1);
    if(a>b&&lc==2&&!(tc&1))S.swap_factor[(a<<4)|b]=S.modulus?(i64)S.modulus-cvalue(tc):-cvalue(tc);
   }
  }
 }
 if(S.spill && size<=S.pin_capacity-S.pin_used){
  u64 dest=S.pin_base+S.pin_used;
  if(restoring)memcpy(PTR(u8,dest),PTR(u8,l->io_base),size);
  else{int prc=write_record(p,dest,size);if(prc)return prc;}
  r->pinned=dest;S.pin_used+=A8(size);
 }
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
API int gn_workers(u32 workers){
 if(!workers||workers>GN_MAX_WORKERS)return GN_INPUT;
 u64 bytes=(S.scratch_size/workers)&~UINT64_C(65535);
 if(bytes<1024*1024)return GN_MEMORY;S.workers=workers;
 for(u32 i=0;i<workers;i++){
  Lane*l=&S.lanes[i];memset(l,0,sizeof(*l));memset(&S.live[i],0,sizeof(LiveLane));
  u64 begin=S.scratch_base+bytes*i;
  u64 cache_bytes=MAX(UINT64_C(2048),(bytes*S.cache_percent/100)&~UINT64_C(7));
  u64 work=((bytes-(bytes/8)-(S.batch_enabled?bytes/8:0)-cache_bytes)/2)&~UINT64_C(7);
  l->a[0]=(Arena){begin,begin,begin+work,0,0};begin+=work;
  l->a[1]=(Arena){begin,begin,begin+work,0,0};begin+=work;
  l->io_base=begin;l->io_size=(bytes/8)&~UINT64_C(7);begin+=l->io_size;
  l->cache_base=begin;u32 slots=64;
  while(slots<65536&&(u64)slots*2*512<=cache_bytes)slots*=2;
  l->cache_mask=slots-1;l->cache_epoch=1;
  memset(PTR(u8,begin),0,(size_t)slots*sizeof(Cache));
  l->cache_data=begin+(u64)slots*sizeof(Cache);l->cache_capacity=cache_bytes-(u64)slots*sizeof(Cache);begin+=cache_bytes;
  l->out_base=begin;l->out_size=S.batch_enabled?(bytes* (i+1)+S.scratch_base-begin):0;
 }
 return 0;
}
API int gn_batch_mode(u32 enabled){S.batch_enabled=!!enabled;return gn_workers(S.workers);}
API int gn_init(u32 generators,u32 degree,u32 workers,u64 budget,u64 scratch_pool,u32 hash_bits,u32 modulus,u32 spill){
 if(!generators||generators>16||degree>GN_INDEX_MAX||budget>GN_HARD_BYTES||scratch_pool>budget||scratch_pool<1024*1024||hash_bits<8||hash_bits>26||modulus==1||modulus>2147483647u)return GN_INPUT;
 if(modulus){for(u32 d=2;(u64)d*d<=modulus;d++)if(modulus%d==0)return GN_INPUT;}
 memset(&S,0,sizeof(S));S.abi=GN_ABI;S.generators=generators;S.target=degree?degree:GN_INDEX_MAX;S.pruning=1;S.heap_enabled=1;S.rational_enabled=1;S.rational_rewrites=1;S.big_rational_enabled=1;S.growing_rational=1;S.reserve_growth=1;S.radix_enabled=1;S.matcher_enabled=1;S.chain_enabled=1;S.telemetry_enabled=1;S.eager_pruning=1;S.quadratic_rewrite=1;S.cost_scheduling=1;S.matcher_limit=MIN(budget/16,UINT64_C(67108864));S.cache_percent=12;S.heap_threshold=16;S.budget=budget;S.modulus=modulus;S.spill=!!spill;S.base=gn_heap_base();S.bump=S.base;S.stack_base=alloc_p((u64)GN_MAX_WORKERS*STACK_BYTES);if(!S.stack_base)return S.error;
 S.scratch_base=alloc_p(scratch_pool);if(!S.scratch_base)return S.error;S.scratch_size=scratch_pool;int rc=gn_workers(workers);if(rc)return rc;
 S.hash_mask=((u32)1<<hash_bits)-1;u64 hb=((u64)S.hash_mask+1)*4;S.lm_heads=alloc_p(hb);S.prefix_heads=alloc_p(hb);if(S.error)return S.error;memset(PTR(u8,S.lm_heads),0,(size_t)hb);memset(PTR(u8,S.prefix_heads),0,(size_t)hb);
 S.table_capacity=(u32)MIN((budget/(PAGE_N*sizeof(Prefix))+2),(u64)UINT32_MAX);u64 tb=(u64)S.table_capacity*8;S.rule_pages=alloc_p(tb);S.prefix_pages=alloc_p(tb);if(S.error)return S.error;memset(PTR(u8,S.rule_pages),0,(size_t)tb);memset(PTR(u8,S.prefix_pages),0,(size_t)tb);return 0;
}
API int gn_tune(u32 flags,u32 cache_percent,u32 heap_threshold){
 if(S.current||S.input_expected||cache_percent>40||heap_threshold<1||heap_threshold>1048576u||flags>3)return GN_INPUT;
 S.pruning=!!(flags&1);S.heap_enabled=!!(flags&2);S.cache_percent=cache_percent;S.heap_threshold=heap_threshold;return gn_workers(S.workers);
}
API int gn_rational_heap(u32 enabled){if(S.current||S.input_expected||enabled>1)return GN_INPUT;S.rational_enabled=enabled;return 0;}
API int gn_optimize(u32 flags,u64 matcher_budget){
 if(S.current||S.input_expected||flags>63||matcher_budget>S.budget)return GN_INPUT;
 S.matcher_enabled=!!(flags&1);S.chain_enabled=!!(flags&2);S.telemetry_enabled=!!(flags&4);
 S.matcher_limit=matcher_budget;S.eager_pruning=!!(flags&8);S.quadratic_rewrite=!!(flags&16);S.cost_scheduling=!!(flags&32);return 0;
}
/* Optional per-lane word->divisor cache. Exact word comparison plus snapshot
 * validity checks are unchanged. It holds no polynomial normal forms. At most
 * budget/16 extra bytes; denied optional growth falls back to a smaller table. */
API int gn_word_cache(u32 entries){
 if(S.current||S.input_expected||S.nrules||entries>1048576u)return GN_INPUT;
 if(!entries)entries=RED_CACHE_N;
 if(entries<RED_CACHE_N||(entries&(entries-1)))return GN_INPUT;
 if(S.word_cache_base)return GN_STATE; /* configure once after each gn_init */
 while(entries>RED_CACHE_N){
  u64 bytes=(u64)entries*S.workers*sizeof(RedCache);
  if(bytes<=S.budget/16&&bytes<=S.budget-S.bump&&gn_host_ensure(S.bump+bytes)){
   S.word_cache_base=S.bump;S.word_cache_bytes=bytes;S.word_cache_entries=entries;S.word_cache_lanes=S.workers;
   S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);memset(PTR(u8,S.word_cache_base),0,(size_t)bytes);return 0;
  }
  entries/=2;
 }
 S.word_cache_entries=RED_CACHE_N;return 0;
}
API u64 gn_live_stat(u32 lane,u32 key){
 if(lane>=S.workers)return 0;LiveLane*v=&S.live[lane];
 switch(key){case 0:return GN_LOAD(&v->reductions);case 1:return GN_LOAD(&v->pruned);
 case 2:return GN_LOAD(&v->reads);case 3:return GN_LOAD(&v->pairs);case 4:return GN_LOAD(&v->terms);
 case 5:return GN_LOAD(&v->hash_probes);case 6:return GN_LOAD(&v->matcher_queries);
 case 7:return GN_LOAD(&v->busy);case 8:return GN_LOAD(&v->sequence);case 9:return GN_LOAD(&v->tier);case 10:return GN_LOAD(&v->exact_fallbacks);
 case 11:return GN_LOAD(&v->left_rule);case 12:return GN_LOAD(&v->right_rule);case 13:return GN_LOAD(&v->overlap);default:return 0;}
}
API u64 gn_progress_stat(u32 key){
 switch(key){case 0:return S.degree_total;case 1:return S.degree_seen;
 case 2:return S.degree_committed;case 3:return S.degree_scheduled;
 case 4:return S.degree_monomial;case 5:return S.degree_chain;
 case 6:return S.degree_replays;case 7:return S.degree_total_known;default:return 0;}
}
API void gn_deadline(double absolute_ms){S.deadline=absolute_ms;}
API u64 gn_completion_bound(void){return S.nrules?(u64)rule(S.nrules)->degree*2-1:0;}
API u64 gn_stack_top(u32 lane){return lane<GN_MAX_WORKERS?S.stack_base+(u64)(lane+1)*STACK_BYTES:0;}
API u64 gn_cancel_ptr(void){
#ifdef __wasm__
 return(u64)(uintptr_t)&S.cancel;
#else
 return 0;
#endif
}
API void gn_cancel(u32 value){GN_STORE(&S.cancel,value);}
API u64 gn_stat(u32 key){switch(key){case 0:return S.nrules;case 1:return S.terms;case 2:return S.completed;case 3:return S.current;case 4:return S.bump;case 5:return S.budget;case 6:return S.disk_end;case 7:return S.pair_count;case 8:return S.zero_pairs;case 9:return S.commit_zero;case 10:return S.workers;case 11:return S.nprefix;case 12:return S.allocated_peak;case 13:return S.error;case 14:return S.target;case 15:return S.generators;case 16:return S.modulus;case 17:return S.batch_epochs;case 18:return S.batch_spills;case 19:return S.hilbert_nodes;case 20:return S.hilbert_bytes;case 21:return S.pruning;case 22:return S.heap_enabled;case 23:return S.cache_percent;case 24:return S.heap_threshold;case 25:return S.matcher_nodes;
 case 26:return S.matcher_allocated;case 27:return S.matcher_builds;case 28:return S.matcher_fallbacks;
 case 29:return S.chain_skipped;case 30:return S.matcher_enabled;case 31:return S.chain_enabled;
 case 32:return S.telemetry_enabled;case 33:return S.matcher_snapshot;case 34:return S.eager_pruning;case 35:return S.quadratic_rewrite;case 36:return S.cost_scheduling;case 37:return S.word_cache_entries?S.word_cache_entries:RED_CACHE_N;case 38:return S.word_cache_bytes;case 39:return S.pin_capacity;case 40:return S.pin_used;case 41:return S.local_degree;case 42:return S.local_used;case 43:return S.local_capacity;case 44:return S.local_entries;case 45:return S.local_declined;case 46:return S.local_built;case 47:return S.local_snapshot;case 48:return S.rational_rewrites;default:return 0;}}
API u64 gn_lane_stat(u32 lane,u32 key){if(lane>=S.workers)return 0;Lane*l=&S.lanes[lane];switch(key){case 27:return l->pinned_hits;case 26:return l->local_hits;case 24:return l->integer_steps;case 25:return l->rational_steps;case 21:return l->rational_attempts;case 22:return l->rational_successes;case 23:return l->rational_fallbacks;case 0:return l->reductions;case 1:return l->pruned;case 2:return l->reads;case 3:return l->read_bytes;case 4:return MAX(l->a[0].peak,l->a[1].peak);case 5:return l->error;case 6:return l->pairs;case 7:return l->cache_hits;case 8:return l->hash_probes;
 case 9:return l->matcher_queries;case 10:return l->matcher_characters;case 11:return l->redcache_hits;
 case 12:return l->heap_attempts;case 13:return l->heap_successes;case 14:return l->heap_fallbacks;case 15:return l->insertion_prunes;case 16:return l->commuting_prunes;case 17:return l->quadratic_swaps;default:return 0;}}
API u32 gn_result_count(u32 lane){return lane<S.workers?S.lanes[lane].result.n:0;}
API int gn_input_begin(u32 degree,u32 terms){if(S.current||(!S.certifying&&degree!=S.completed+1)||degree<1||degree>S.target||!terms||S.input_expected)return GN_STATE;Lane*l=&S.lanes[0];reset_a(&l->a[0]);reset_a(&l->a[1]);l->error=0;l->active=0;u64 off=alloc_a(&l->a[0],(u64)terms*sizeof(Term));if(!off)return GN_SCRATCH;l->result=(Poly){off,terms,degree,0};S.input_degree=degree;S.input_expected=terms;S.input_used=0;return 0;}
API int gn_input_term(u64 lo,u64 hi,i64 coefficient){if(!S.input_expected||S.input_used>=S.input_expected||coefficient>SMALL_MAX||coefficient< -SMALL_MAX||!coefficient)return GN_INPUT;Word w={lo,hi};if(S.input_degree>GN_INLINE_DEGREE)return GN_INPUT;if(!weq(maskw(w,S.input_degree),w))return GN_INPUT;for(u32 i=0;i<S.input_degree;i++)if(part(w,S.input_degree,i,1).lo>=S.generators)return GN_INPUT;Lane*l=&S.lanes[0];Coef c;if(S.modulus){i64 z=coefficient%(i64)S.modulus;if(z<0)z+=S.modulus;c=csmall(z);}else c=csmall(coefficient);PTR(Term,l->result.off)[S.input_used++]=(Term){w,c};return 0;}
API int gn_input_bytes(u32 length,i64 coefficient){
 if(!S.input_expected||S.input_used>=S.input_expected||length!=S.input_degree||length<=GN_INLINE_DEGREE||!coefficient||coefficient>SMALL_MAX||coefficient< -SMALL_MAX)return GN_INPUT;
 Lane*l=&S.lanes[0];if(length>l->io_size)return GN_SCRATCH;
 const u8*src=PTR(u8,l->io_base);for(u32 i=0;i<length;i++)if(src[i]>=S.generators)return GN_INPUT;
 u64 off=alloc_a(&l->a[0],length);if(!off)return l->a[0].error;memcpy(PTR(u8,off),src,length);
 i64 c=coefficient;if(S.modulus){c%=(i64)S.modulus;if(c<0)c+=S.modulus;}
 PTR(Term,l->result.off)[S.input_used++]=(Term){{off,WORD_LONG|length},csmall(c)};return 0;
}
API int gn_input_end(void){if(S.input_used!=S.input_expected||!S.input_expected)return GN_STATE;S.input_expected=0;Lane*l=&S.lanes[0];Term*t=PTR(Term,l->result.off);u32 n=l->result.n;/* Inputs are small; insertion sort avoids library allocation. */
 for(u32 i=1;i<n;i++){Term x=t[i];u32 j=i;while(j&&wcmp(t[j-1].w,x.w)<0){t[j]=t[j-1];--j;}t[j]=x;}
 u32 k=0;for(u32 i=0;i<n;i++){if(k&&weq(t[k-1].w,t[i].w)){t[k-1].c=addf(&l->a[0],t[k-1].c,t[i].c);if(!t[k-1].c)--k;}else if(t[i].c)t[k++]=t[i];}l->result.n=k;if(l->a[0].error)return l->a[0].error;int rc=normalise(&l->result,&l->a[0]);if(!rc)rc=nf(l,S.nrules);if(!rc)rc=S.certifying?(l->result.n?GN_REJECTED:0):append_rule(l->result,0,0);return rc;}
static void reset_degree_progress(void){S.degree_seen=0;S.degree_scheduled=0;S.degree_committed=0;S.degree_monomial=0;S.degree_chain=0;}
API int gn_start_degree(u32 degree){
 if(cancelled())return GN_CANCELLED;if(S.current||degree!=S.completed+1||degree>S.target)return GN_STATE;
 S.current=degree;S.degree_snapshot=S.nrules;S.iter_f=1;S.iter_k=1;S.iter_node=0;S.iter_ready=0;S.iter_done=0;
 reset_degree_progress();S.degree_total=0;S.degree_total_known=0;S.degree_replays=0;
 int rc=matcher_build();if(rc)return rc;
 rc=local_build();if(rc)return rc;
 if(S.telemetry_enabled){
  /* Each prefix node stores the exact population of its word/length/full-degree
   * group. Summing those populations counts all candidates without an S-pair
   * traversal, polynomial reduction, future-degree search or materialized queue. */
  for(u32 id=1;id<=S.degree_snapshot;id++){
   if((id&1023)==0){(void)gn_host_clock();if(cancelled())return GN_CANCELLED;}
   Rule*f=rule(id);if(f->degree>=degree)continue;
   for(u32 k=1;k<f->degree;k++){
    u32 glen=degree-f->degree+k;if(glen<=k||glen>=degree)continue;
    u32 count=prefix_count(part(f->lm,f->degree,f->degree-k,k),k,glen,S.degree_snapshot);
    if(UINT64_MAX-S.degree_total<count)return GN_LIMIT;
    S.degree_total+=count;
   }
  }
  S.degree_total_known=1;
 }
 return 0;
}
API int gn_rewind_degree(void){if(!S.current)return GN_STATE;reset_degree_progress();S.degree_replays++;S.iter_f=1;S.iter_k=1;S.iter_node=0;S.iter_ready=0;S.iter_done=0;return 0;}
API int gn_next_pair(u32 lane){if(lane>=S.workers||!S.current)return -GN_STATE;Lane*l=&S.lanes[lane];if(S.iter_done)return 0;u64 polls=0;
 while(S.iter_f<=S.degree_snapshot){if((++polls&1023)==0){if(S.telemetry_enabled)(void)gn_host_clock();if(cancelled())return -GN_CANCELLED;}Rule*f=rule(S.iter_f);if(f->degree>=S.current||S.iter_k>=f->degree){S.iter_f++;S.iter_k=1;S.iter_ready=0;continue;}
  u32 k=S.iter_k,glen=S.current-f->degree+k;Word suffix=part(f->lm,f->degree,f->degree-k,k);
  if(glen<=k||glen>=S.current){S.iter_k++;S.iter_ready=0;continue;}
  if(!S.iter_ready){S.iter_node=PTR(u32,S.prefix_heads)[prefix_hash(suffix,k,glen)];S.iter_ready=1;}
  while(S.iter_node){if((++polls&1023)==0){if(S.telemetry_enabled)(void)gn_host_clock();if(cancelled())return -GN_CANCELLED;}Prefix*q=prefix(S.iter_node);S.iter_node=q->next;u32 id=q->rule;if(id>S.degree_snapshot||q->length!=k)continue;Rule*g=rule(id);if(g->degree!=glen||!weq(part(g->lm,g->degree,0,k),suffix))continue;
   S.degree_seen++;
   if(S.pruning&&f->n==1&&g->n==1){S.zero_pairs++;S.degree_monomial++;continue;}
   if(S.chain_enabled&&matcher_interior(f,g,k)){S.chain_skipped++;S.degree_chain++;continue;}
   l->f=S.iter_f;l->g=id;l->k=k;l->snapshot=S.nrules;l->error=0;S.pair_count++;S.degree_scheduled++;return 1;
  }
  S.iter_k++;S.iter_ready=0;
 }
 S.iter_done=1;return 0;
}
static int reduce_pair_impl(u32 lane){if(lane>=S.workers)return GN_INPUT;Lane*l=&S.lanes[lane];l->error=0;reset_a(&l->a[0]);reset_a(&l->a[1]);l->active=0;l->result=(Poly){0};l->pairs++;
 Rule*f=rule(l->f),*g=rule(l->g);u32 nr=g->degree-l->k;Word suffix=part(g->lm,g->degree,l->k,nr),left=part(f->lm,f->degree,0,f->degree-l->k);Poly fp=load_rule(l->f,l);if(l->error)return l->error;
 Poly p=copy_poly(fp,&l->a[0],(Word){0,0},suffix,nr,S.current);if(l->a[0].error)return l->a[0].error;Poly gp=load_rule(l->g,l);if(l->error)return l->error;Coef a=pc(gp,0),b=pc(p,0);Arena*ar=&l->a[1];Coef z=S.modulus?2:gcdc(ar,a,b);Coef sp=S.modulus?a:exactdiv(ar,a,z),sg=negf(S.modulus?b:exactdiv(ar,b,z));if(ar->error)return ar->error;
 l->result=combine(p,sp,gp,sg,left,(Word){0,0},0,ar);l->active=1;if(ar->error)return ar->error;int rc=nf(l,l->snapshot);l->error=rc;return rc;
}
API int gn_reduce_pair(u32 lane){
 if(lane>=S.workers)return GN_INPUT;Lane*l=&S.lanes[lane];l->busy=1;publish_lane(l,0,0);
 int rc=reduce_pair_impl(lane);l->busy=0;publish_lane(l,l->result.n,0);return rc;
}
API int gn_commit(u32 lane){if(lane>=S.workers)return GN_INPUT;Lane*l=&S.lanes[lane];if(l->error)return l->error;l->busy=2;publish_lane(l,l->result.n,0);int rc=nf(l,S.nrules);if(!rc){/* The coordinator I/O buffer must not overwrite a row in lane 0. */rc=S.certifying?(l->result.n?GN_REJECTED:0):append_rule(l->result,0,0);}l->error=rc;l->busy=0;if(!rc)S.degree_committed++;publish_lane(l,l->result.n,0);return rc;}
/* An epoch has an immutable basis. Workers dynamically claim pair descriptors.
 * Only the coordinator writes descriptors, commits rows or grows memory, and only
 * outside parallel epochs. Outputs live outside the reduction arenas. */
/* Prioritize larger input records inside the immutable batch. This heuristic
 * changes ONLY dispatch order. Task numbers and ordered exact commits stay put.
 * Stable bounded mergesort; no timing probes or polynomial data are required. */
static u64 batch_weight(u32 i){BatchTask*t=&S.tasks[i];return (u64)rule(t->f)->bytes+rule(t->g)->bytes;}
static void order_batch(void){
 for(u32 i=0;i<S.batch_n;i++)S.batch_order[i]=i;
 if(!S.cost_scheduling||S.workers<2)return;
 for(u32 span=1;span<S.batch_n;span*=2){
  for(u32 left=0;left<S.batch_n;left+=2*span){
   u32 mid=MIN(left+span,S.batch_n),end=MIN(left+2*span,S.batch_n),i=left,j=mid,k=left;
   while(i<mid||j<end){
    int takeleft=j==end||(i<mid&&batch_weight(S.batch_order[i])>=batch_weight(S.batch_order[j]));
    S.batch_sort[k++]=takeleft?S.batch_order[i++]:S.batch_order[j++];
   }
  }
  memcpy(S.batch_order,S.batch_sort,(size_t)S.batch_n*sizeof(u32));
 }
}
API int gn_batch_fill(u32 limit){
 if(!S.batch_enabled||!S.current||!limit||limit>BATCH_MAX)return -GN_STATE;
 S.batch_n=0;GN_STORE(&S.batch_next,0);
 for(u32 l=0;l<S.workers;l++)S.lanes[l].out_used=0;
 for(u32 i=0;i<limit;i++){
  int rc=gn_next_pair(0);if(rc<0)return rc;if(!rc)break;
  Lane*l=&S.lanes[0];S.tasks[i]=(BatchTask){l->f,l->g,l->k,l->snapshot,GN_STATE,0,0};S.batch_n++;
 }
 if(S.batch_n){S.batch_epochs++;order_batch();}return (int)S.batch_n;
}
API int gn_batch_reduce(u32 lane){
 if(lane>=S.workers||!S.batch_enabled)return GN_STATE;
 Lane*l=&S.lanes[lane];
 for(;;){
  u32 i=GN_FETCH_ADD(&S.batch_next,1);if(i>=S.batch_n)break;
  BatchTask*t=&S.tasks[S.batch_order[i]];l->f=t->f;l->g=t->g;l->k=t->k;l->snapshot=t->snapshot;
  int rc=gn_reduce_pair(lane);t->rc=(u32)rc;if(rc||!l->result.n)continue;
  if(S.certifying){t->rc=GN_REJECTED;continue;}
  u64 bytes=record_bytes(l->result);
  if(bytes>l->out_size-l->out_used||bytes>UINT32_MAX){t->rc=GN_BATCH_FULL;continue;}
  t->output=l->out_base+l->out_used;t->bytes=(u32)bytes;
  t->rc=(u32)write_record(l->result,t->output,bytes);
  if(!t->rc)l->out_used+=A8(bytes);
 }
 return 0;
}
API u32 gn_batch_status(u32 task){return task<S.batch_n?S.tasks[task].rc:GN_INPUT;}
API int gn_batch_commit(u32 task){
 if(task>=S.batch_n)return GN_INPUT;BatchTask*t=&S.tasks[task];
 if(t->rc==GN_DEFERRED){
  /* Parallel readers are finished. Recompute this one deferred pair, with
   * its original snapshot, then run the ordinary updated-basis commit. */
  Lane*l=&S.lanes[0];l->f=t->f;l->g=t->g;l->k=t->k;l->snapshot=t->snapshot;
  int rc=gn_reduce_pair(0);if(rc)return rc;t->rc=0;return gn_commit(0);
 }
 if(t->rc)return (int)t->rc;if(!t->bytes){S.commit_zero++;S.degree_committed++;return 0;}
 Lane*l=&S.lanes[0];reset_a(&l->a[0]);reset_a(&l->a[1]);l->active=0;l->error=0;
 Record*h=PTR(Record,t->output);
 Poly stored={t->output+sizeof(Record),h->n,h->degree,t->output};
 l->result=copy_poly(stored,&l->a[0],(Word){0,0},(Word){0,0},0,h->degree);
 if(l->a[0].error)return l->a[0].error;
 return gn_commit(0);
}
API int gn_batch_fallback(void){S.batch_spills++;return gn_batch_mode(0);}
API int gn_finish_degree(void){if(!S.current||!S.iter_done)return GN_STATE;
 if(S.degree_committed!=S.degree_scheduled||(S.degree_total_known&&S.degree_seen!=S.degree_total))return GN_STATE;S.completed=S.current;S.current=0;return 0;}
API u64 gn_rule_stat(u32 id,u32 key){if(!id||id>S.nrules)return 0;Rule*r=rule(id);switch(key){case 0:return r->lm.lo;case 1:return r->lm.hi;case 2:return r->degree;case 3:return r->n;case 4:return r->bytes;case 5:return r->location;default:return 0;}}
API u64 gn_export_rule(u32 id){if(!id||id>S.nrules)return 0;Lane*l=&S.lanes[0];l->error=0;Rule*r=rule(id);if(S.spill){if(r->bytes>l->io_size||!gn_host_read(r->location,l->io_base,r->bytes)){l->error=r->bytes>l->io_size?GN_SCRATCH:GN_IO;return 0;}if(validate_record(l->io_base,r->bytes)){l->error=GN_CORRUPT;return 0;}return l->io_base;}
 Poly p={r->location+sizeof(Record),r->n,r->degree,r->location};if(write_record(p,l->io_base,l->io_size)){l->error=GN_SCRATCH;return 0;}return l->io_base;}
API u32 gn_export_size(void){return PTR(Record,S.lanes[0].io_base)->bytes;}
API u64 gn_import_buffer(void){return S.lanes[0].io_base;}
API u32 gn_import_capacity(void){return(u32)MIN(S.lanes[0].io_size,UINT32_MAX);}
API int gn_restore_rule(u32 bytes,u64 file_offset){Lane*l=&S.lanes[0];if(bytes>l->io_size)return GN_SCRATCH;int rc=validate_record(l->io_base,bytes);if(rc)return rc;Record*h=PTR(Record,l->io_base);Poly p={l->io_base+sizeof(Record),h->n,h->degree,l->io_base};return append_rule(p,file_offset,1);}
API int gn_restored_through(u32 degree){if(S.current||degree>S.target||(S.nrules&&rule(S.nrules)->degree>degree))return GN_STATE;S.completed=degree;return 0;}
API i64 gn_test_small(u32 operation,i64 a,i64 b){Lane*l=&S.lanes[0];reset_a(&l->a[0]);Coef x=csmall(a),y=csmall(b),z=0;if(operation==0)z=addc(&l->a[0],x,y);else if(operation==1)z=mulc(&l->a[0],x,y);else if(operation==2)z=gcdc(&l->a[0],x,y);else if(operation==3)z=exactdiv(&l->a[0],mulc(&l->a[0],x,y),x);return z&1?INT64_MIN:cvalue(z);}

/* A reconstructed candidate is untrusted until ALL required degrees, input
 * membership tests, and the host's independent homogeneous rank-bound witness
 * succeed. This flag never turns a failed composition into a new basis rule. */
API int gn_candidate_check(void){
 if(S.current||S.input_expected||S.modulus)return GN_STATE;
 Lane*l=&S.lanes[0];l->skip_rule=0;int rc=matcher_build();if(rc)return rc;
 for(u32 id=1;id<=S.nrules;id++){
  if((id&255)==0&&cancelled())return GN_CANCELLED;
  u32 pos=0;if(divisor(rule(id)->lm,rule(id)->degree,S.nrules,&pos,l)!=id)return GN_REJECTED;
 }
 S.certifying=1;S.completed=0;return 0;
}
API u32 gn_is_certifying(void){return S.certifying;}
API u64 gn_canonical_rule(u32 id){
 if(S.current||S.input_expected||S.certifying||!id||id>S.nrules)return 0;
 Lane*l=&S.lanes[0];l->skip_rule=0;l->error=0;
 int mrc=matcher_build();if(mrc){l->error=mrc;return 0;}
 u32 pos=0;if(divisor(rule(id)->lm,rule(id)->degree,S.nrules,&pos,l)!=id){l->error=GN_REJECTED;return 0;}
 reset_a(&l->a[0]);reset_a(&l->a[1]);l->active=0;
 Poly input=load_rule(id,l);if(l->error)return 0;
 l->result=copy_poly(input,&l->a[0],(Word){0,0},(Word){0,0},0,input.degree);
 if(l->a[0].error){l->error=l->a[0].error;return 0;}
 l->skip_rule=id;int rc=nf(l,S.nrules);l->skip_rule=0;
 if(!rc&&(!l->result.n||!weq(pw(l->result,0),rule(id)->lm)))rc=GN_REJECTED;
 if(!rc)rc=write_record(l->result,l->io_base,l->io_size);
 l->error=rc;return rc?0:l->io_base;
}
#include "hilbert.inc"

#ifndef __wasm__
/* Native-only independent arithmetic property-test hook. */
API int gn_test_rational(u32 op,i64 an,u64 ad,i64 bn,u64 bd,i64*on,u64*od){
 if(op>1||!ad||!bd||ad>(u64)SMALL_MAX||bd>(u64)SMALL_MAX||an>SMALL_MAX||an< -SMALL_MAX||bn>SMALL_MAX||bn< -SMALL_MAX||rgcd(rabs(an),ad)!=1||rgcd(rabs(bn),bd)!=1)return -1;
 RCoef out;int ok=op?rmul((RCoef){an,ad},(RCoef){bn,bd},&out):radd((RCoef){an,ad},(RCoef){bn,bd},&out);
 if(ok){*on=out.n;*od=out.d;}return ok;
}
#endif

API int gn_pin_cache(u64 bytes){
 if(S.current||S.input_expected||S.nrules||S.pin_base)return GN_STATE;
 if(!bytes||!S.spill)return 0;
 bytes=MIN(bytes,S.budget/16);bytes&=~UINT64_C(7);
 if(!bytes||bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes))return 0;
 S.pin_base=S.bump;S.pin_capacity=bytes;S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return 0;
}

API int gn_local_rewrites(u32 degree,u64 bytes,u32 support){
 if(S.current||S.input_expected||S.nrules||S.local_base||degree>4||degree==1||support<1||support>64)return GN_INPUT;
 if(!degree||!bytes)return 0;
 bytes=MIN(bytes,S.budget/8);bytes=A8(bytes);
 if(bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes))return 0;
 S.local_base=S.bump;S.local_capacity=bytes;S.local_degree=degree;S.local_limit=support;S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return 0;
}

/* Export a compiled identity w - sum c_i*v_i for independent audit.
 * The degree/basis is not changed. Valid only at an idle degree boundary. */
API u64 gn_local_rule(u32 key){
 if(S.current||S.input_expected||S.local_built!=1||key>=(1u<<(4*S.local_degree)))return 0;
 LocalEntry*entry=&PTR(LocalEntry,S.local_base)[key];if(!entry->off)return 0;
 Lane*l=&S.lanes[0];reset_a(&l->a[0]);l->error=0;
 u64 off=alloc_a(&l->a[0],(u64)(entry->n+1)*sizeof(Term));if(l->a[0].error)return 0;
 Term*t=PTR(Term,off);t[0]=(Term){{key,0},2};LocalTerm*lt=PTR(LocalTerm,S.local_base+entry->off);
 for(u32 j=0;j<entry->n;j++)t[j+1]=(Term){{lt[j].word,0},negf(csmall(lt[j].c))};
 Poly p={off,entry->n+1,S.local_degree,0};int rc=write_record(p,l->io_base,l->io_size);l->error=rc;return rc?0:l->io_base;
}

/* Optional exact macro reuse in the compact rational fallback, 0.6.1. */
API int gn_rational_rewrites(u32 enabled){if(enabled>1)return GN_INPUT;if(S.nrules||S.current||S.input_expected)return GN_STATE;S.rational_rewrites=!!enabled;return 0;}
API u64 gn_deep_stat(u32 lane,u32 key){if(lane>=S.workers)return 0;Lane*l=&S.lanes[lane];switch(key){case 0:return l->rational_local_hits;case 1:return l->rational_space_misses;case 2:return l->rational_coefficient_misses;case 3:return l->rational_arithmetic_misses;case 4:return l->rational_table_retries;default:return 0;}}

/* Immutable field identity for audit/harness checks. */
API u32 gn_modulus(void){return S.modulus;}

/* Idle-only tuning: 0 = normalized limb division, 1 = 0.6.1 bitwise reference. */
API int gn_legacy_big_division(u32 enabled){if(enabled>1)return GN_INPUT;if(S.nrules||S.current||S.input_expected)return GN_STATE;S.legacy_big_division=enabled;return 0;}
/* Arithmetic audit hook. Inputs/outputs use little-endian magnitude limbs in
 * the existing I/O buffer; no host pointers or decimal rounding are involved. */
API int gn_test_big(u32 op,u32 na,u32 nb,int sa,int sb){
 Lane*l=&S.lanes[0];Arena*a=&l->a[0];reset_a(a);
 if(op>4||!na||!nb||sa*sa!=1||sb*sb!=1||(u64)(na+nb)*4>l->io_size)return -GN_INPUT;
 Coef x=makec(a,PTR(u32,l->io_base),na,sa),y=makec(a,PTR(u32,l->io_base)+na,nb,sb),r=0;
 if(op==0)r=addc(a,x,y);else if(op==1)r=mulc(a,x,y);else if(op==2)r=divmodc(a,x,y,1);else if(op==3)r=divmodc(a,x,y,0);else r=gcdc(a,x,y);
 if(a->error)return -(int)a->error;u32 n=cn(r);if(8+(u64)n*4>l->io_size)return -GN_SCRATCH;
 PTR(u32,l->io_base)[0]=n;PTR(i64,l->io_base)[0]=(i64)n|((u64)(csign(r)<0)<<32);
 for(u32 i=0;i<n;i++)PTR(u32,l->io_base+8)[i]=cl(r,i);return 0;
}

API int gn_big_rational_heap(u32 enabled){if(enabled>1)return GN_INPUT;if(S.nrules||S.current||S.input_expected)return GN_STATE;S.big_rational_enabled=enabled;return 0;}
API u64 gn_exact_stat(u32 lane,u32 key){if(lane>=S.workers)return 0;Lane*l=&S.lanes[lane];switch(key){case 0:return l->big_attempts;case 1:return l->big_successes;case 2:return l->big_fallbacks;case 3:return l->big_steps;case 4:return l->big_compactions;case 5:return l->big_pool_misses;case 6:return l->big_capacity_misses;case 7:return l->big_arena_misses;case 8:return S.big_rational_enabled;case 9:return S.legacy_big_division;case 10:return l->rational_table_growths;case 11:return S.growing_rational;default:return 0;}}

API int gn_growing_rational(u32 enabled){if(enabled>1)return GN_INPUT;if(S.nrules||S.current||S.input_expected)return GN_STATE;S.growing_rational=enabled;return 0;}

/* Test exact rational arithmetic using four magnitude limb arrays, independent
 * from the normal-form test harness. Input arrays: numerator/denominator A/B. */
API int gn_test_big_fraction(u32 op,u32 an,u32 ad,u32 bn,u32 bd,int sa,int sb){
 Lane*l=&S.lanes[0];Arena*t=&l->a[0];reset_a(t);
 if(op>1||!an||!ad||!bn||!bd||sa*sa!=1||sb*sb!=1||((u64)an+ad+bn+bd)*4>l->io_size)return -GN_INPUT;
 u32*v=PTR(u32,l->io_base);Coef a=makec(t,v,an,sa),d=makec(t,v+an,ad,1),b=makec(t,v+an+ad,bn,sb),e=makec(t,v+an+ad+bn,bd,1);
 BCoef x=bmake(t,a,d),y=bmake(t,b,e),r=op?bmul(t,x,y):badd(t,x,y);
 if(t->error)return -(int)t->error;u32 n=cn(r.n),dn=cn(r.d);if(16+((u64)n+dn)*4>l->io_size)return -GN_SCRATCH;
 v[0]=n;v[1]=dn;v[2]=csign(r.n)<0;v[3]=0;
 for(u32 i=0;i<n;i++)v[4+i]=cl(r.n,i);for(u32 i=0;i<dn;i++)v[4+n+i]=cl(r.d,i);return 0;
}

/* Configure at initialization only. Reservation is bounded by the kernel
 * budget and optional: a budget/host denial never corrupts the base solver. */
API int gn_row_reserve(u64 bytes){
 if(S.current||S.input_expected||S.nrules||S.reserve_base)return GN_STATE;
 bytes&=~UINT64_C(7);if(!bytes||S.modulus)return 0;
 if(bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes))return 0;
 S.reserve_base=S.bump;S.reserve_bytes=bytes;S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);return 0;
}
API u64 gn_reserve_stat(u32 lane,u32 key){
 if(key==0)return S.reserve_bytes;if(lane>=S.workers)return 0;Lane*l=&S.lanes[lane];
 switch(key){case 1:return l->reserve_attempts;case 2:return l->reserve_successes;case 3:return l->reserve_busy;case 4:return l->reserve_misses;case 5:return l->reserve_peak;case 6:return l->reserve_promotions;case 7:return S.reserve_growth;case 8:return S.radix_enabled;case 9:return GN_LOAD(&S.reserve_lock);default:return 0;}
}

API int gn_reserve_growth(u32 enabled){if(enabled>1)return GN_INPUT;if(S.current||S.input_expected||S.nrules)return GN_STATE;S.reserve_growth=enabled;return 0;}

API int gn_radix_queue(u32 enabled){if(enabled>1)return GN_INPUT;if(S.current||S.input_expected||S.nrules)return GN_STATE;S.radix_enabled=enabled;return 0;}
