/* SPDX-License-Identifier: MIT
 * Budgeted sparse arbitrary-precision rational normal form.
 * No fraction-free whole-row rescaling: only the affected coefficient changes.
 * All big coefficients are immutable; two bounded semispaces recycle dead
 * coefficients. One per-operation scratch arena holds arithmetic temporaries.
 * The original polynomial remains untouched until a complete exact result exists.
 */
typedef struct { Coef n,d; } BCoef;
static BCoef bcopy(Arena*t,BCoef a){return(BCoef){clonec(t,a.n),clonec(t,a.d)};}
static BCoef bmake(Arena*t,Coef n,Coef d){
 if(t->error)return(BCoef){0,2};
 if(!d){t->error=GN_CORRUPT;return(BCoef){0,2};}if(!n)return(BCoef){0,2};
 if(csign(d)<0){n=cneg(n);d=cneg(d);}if(d==2)return(BCoef){clonec(t,n),2};
 Coef g=gcdc(t,n,d);return(BCoef){exactdiv(t,n,g),exactdiv(t,d,g)};
}
static BCoef badd(Arena*t,BCoef a,BCoef b){
 if(t->error)return(BCoef){0,2};
 if(!a.n)return bcopy(t,b);if(!b.n)return bcopy(t,a);
 if(magcmp(a.d,b.d)==0)return bmake(t,addc(t,a.n,b.n),a.d);
 Coef g=gcdc(t,a.d,b.d),ad=exactdiv(t,a.d,g),bd=exactdiv(t,b.d,g);
 Coef n=addc(t,mulc(t,a.n,bd),mulc(t,b.n,ad));if(!n)return(BCoef){0,2};
 Coef h=gcdc(t,n,g);return(BCoef){exactdiv(t,n,h),mulc(t,ad,exactdiv(t,b.d,h))};
}
static BCoef bmul(Arena*t,BCoef a,BCoef b){
 if(t->error)return(BCoef){0,2};
 if(!a.n||!b.n)return(BCoef){0,2};
 if(a.d==2&&(a.n==2||a.n==csmall(-1))){BCoef r=bcopy(t,b);if(csign(a.n)<0)r.n=cneg(r.n);return r;}
 if(b.d==2&&(b.n==2||b.n==csmall(-1))){BCoef r=bcopy(t,a);if(csign(b.n)<0)r.n=cneg(r.n);return r;}
 Coef g=gcdc(t,a.n,b.d),h=gcdc(t,b.n,a.d);
 return(BCoef){mulc(t,exactdiv(t,a.n,g),exactdiv(t,b.n,h)),mulc(t,exactdiv(t,a.d,h),exactdiv(t,b.d,g))};
}
typedef struct {Word w;BCoef c;u32 next,pos;} BNode;
typedef struct {
 BNode*nodes;u32*heads,*heap,*normal;u32 capacity,mask,used,free_head,heap_n,normal_n,degree;
 Arena temp,pool[2];u32 pool_active;BCoef pivot;Lane*lane;
} BRow;
static void bheap_up(BRow*r,u32 p){
 u32 id=r->heap[p];while(p){u32 parent=(p-1)/2,other=r->heap[parent];if(wcmp(r->nodes[other-1].w,r->nodes[id-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=parent;}r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void bheap_down(BRow*r,u32 p){
 u32 id=r->heap[p];while(2*p+1<r->heap_n){u32 child=2*p+1;if(child+1<r->heap_n&&wcmp(r->nodes[r->heap[child+1]-1].w,r->nodes[r->heap[child]-1].w)>0)child++;u32 other=r->heap[child];if(wcmp(r->nodes[id-1].w,r->nodes[other-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=child;}r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void bheap_remove(BRow*r,u32 id){
 u32 p=r->nodes[id-1].pos-1,last=r->heap[--r->heap_n];r->nodes[id-1].pos=0;if(p==r->heap_n)return;r->heap[p]=last;r->nodes[last-1].pos=p+1;if(p&&wcmp(r->nodes[last-1].w,r->nodes[r->heap[(p-1)/2]-1].w)>0)bheap_up(r,p);else bheap_down(r,p);
}
static void brow_remove(BRow*r,u32 id){
 BNode*n=&r->nodes[id-1];u32 h=rrow_hash(n->w,r->mask),*link=&r->heads[h];while(*link!=id)link=&r->nodes[*link-1].next;*link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;
}
static u64 bbytes(BCoef c){return(c.n&1?A8(8+(u64)cn(c.n)*4):0)+(c.d&1?A8(8+(u64)cn(c.d)*4):0);}
static int brow_collect(BRow*r){
 Arena*out=&r->pool[r->pool_active^1];reset_a(out);u64 need=bbytes(r->pivot);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u64 n=bbytes(r->nodes[i].c);if(n>out->end-out->base||need>out->end-out->base-n)return HEAP_MISS;need+=n;}
 if(need>out->end-out->base)return HEAP_MISS;
 for(u32 i=0;i<r->used;i++){if((i&1023)==0&&cancelled())return GN_CANCELLED;if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcopy(out,r->nodes[i].c);}
 r->pivot=bcopy(out,r->pivot);if(out->error)return HEAP_MISS;r->pool_active^=1;r->lane->big_compactions++;return 0;
}
/* The source is always in operation scratch or stable input/cache memory, never
 * a borrowed semispace root. Collection may relocate the pivot and live nodes. */
static int brow_store(BRow*r,BCoef c,BCoef*out){
 u64 need=bbytes(c);Arena*p=&r->pool[r->pool_active];
 if(need>p->end-p->pos){int rc=brow_collect(r);if(rc)return rc;p=&r->pool[r->pool_active];}
 if(need>p->end-p->pos){r->lane->big_pool_misses++;return HEAP_MISS;}
 *out=bcopy(p,c);return p->error?HEAP_MISS:0;
}
static int brow_add(BRow*r,Word w,BCoef delta){
 if(r->temp.error){r->lane->big_arena_misses++;return r->temp.error==GN_CANCELLED?GN_CANCELLED:HEAP_MISS;}
 if(!delta.n)return 0;
 u32 skip=r->lane->skip_rule;int protected_leader=skip&&r->degree==rule(skip)->degree&&weq(w,rule(skip)->lm);
 if(!protected_leader&&eager_zero(w,r->degree,r->lane))return 0;
 u32 h=rrow_hash(w,r->mask),id=r->heads[h];while(id&&!weq(r->nodes[id-1].w,w))id=r->nodes[id-1].next;
 if(id){BNode*n=&r->nodes[id-1];if(!n->pos)return HEAP_MISS;
  BCoef value=badd(&r->temp,n->c,delta);
  if(r->temp.error){r->lane->big_arena_misses++;return r->temp.error==GN_CANCELLED?GN_CANCELLED:HEAP_MISS;}
  if(!value.n){bheap_remove(r,id);brow_remove(r,id);return 0;}
  return brow_store(r,value,&n->c);
 }
 BCoef owned;int rc=brow_store(r,delta,&owned);if(rc)return rc;
 if(r->free_head){id=r->free_head;r->free_head=r->nodes[id-1].next;}
 else{if(r->used==r->capacity){r->lane->big_capacity_misses++;return HEAP_MISS;}id=++r->used;}
 r->nodes[id-1]=(BNode){w,owned,r->heads[h],r->heap_n+1};r->heads[h]=id;r->heap[r->heap_n++]=id;bheap_up(r,r->heap_n-1);return 0;
}
static int big_rational_nf(Lane*l,Poly original,u32 active,u32 snapshot){
 /* An already exhausted larger compact table cannot fit this smaller table.
  * Do not replay a deterministically identical support path just to fail. */
 if(l->rational_maxed){l->big_capacity_misses++;return HEAP_MISS;}
 Arena*a=&l->a[active^1];reset_a(a);u64 bytes=a->end-a->base;
 /* Fixed maximum table inside this attempt: at most one quarter of workspace.
  * No exponentially growing queue or allocation outside the lane's budget. */
 u32 cap=128;while(cap<(1u<<20)&&(u64)cap*2*(sizeof(BNode)+16)<=bytes/4)cap*=2;
 if(cap<original.n){l->big_capacity_misses++;return HEAP_MISS;}
 u64 no=alloc_a(a,(u64)cap*sizeof(BNode)),ho=alloc_a(a,(u64)cap*2*4),po=alloc_a(a,(u64)cap*4),oo=alloc_a(a,(u64)cap*4);
 if(a->error)return HEAP_MISS;
 BRow r={0};r.nodes=PTR(BNode,no);r.heads=PTR(u32,ho);r.heap=PTR(u32,po);r.normal=PTR(u32,oo);r.capacity=cap;r.mask=cap*2-1;r.degree=original.degree;r.lane=l;r.pivot=(BCoef){0,2};
 memset(r.heads,0,(size_t)cap*8);
 u64 remain=a->end-a->pos,partbytes=(remain/4)&~UINT64_C(7),begin=a->pos;
 r.pool[0]=(Arena){begin,begin,begin+partbytes,0,0};begin+=partbytes;
 r.pool[1]=(Arena){begin,begin,begin+partbytes,0,0};begin+=partbytes;
 r.temp=(Arena){begin,begin,a->end,0,0};
 for(u32 i=0;i<original.n;i++){reset_a(&r.temp);BCoef c={clonec(&r.temp,pc(original,i)),2};int rc=brow_add(&r,pw(original,i),c);if(rc)return rc;}
 u64 steps=0;
 while(r.heap_n){
  if((steps++&63)==0){publish_lane(l,(u64)r.heap_n+r.normal_n,0);if(cancelled())return GN_CANCELLED;}
  u32 id=r.heap[0];Word w=r.nodes[id-1].w;r.pivot=r.nodes[id-1].c;bheap_remove(&r,id);
  u32 pos=0;LocalEntry*local=(!S.rational_rewrites||l->skip_rule)?NULL:local_find(w,original.degree,snapshot,&pos);
  u32 rid=local?0:divisor(w,original.degree,snapshot,&pos,l);
  if(!local&&!rid){r.normal[r.normal_n++]=id;r.pivot=(BCoef){0,2};continue;}
  brow_remove(&r,id);l->reductions++;l->big_steps++;
  if(local){
   l->local_hits++;if(!local->n){l->pruned++;continue;}
   u32 nr=original.degree-pos-S.local_degree;Word left=part(w,original.degree,0,pos),right=part(w,original.degree,pos+S.local_degree,nr);LocalTerm*lt=PTR(LocalTerm,S.local_base+local->off);
   for(u32 j=0;j<local->n;j++){reset_a(&r.temp);BCoef delta=bmul(&r.temp,r.pivot,(BCoef){csmall(lt[j].c),2});int rc=brow_add(&r,context(left,(Word){lt[j].word,0},S.local_degree,right,nr,original.degree,&r.temp),delta);if(rc)return rc;}
  }else{
   Rule*rr=rule(rid);if(S.pruning&&rr->n==1){l->pruned++;continue;}
   Poly g=load_rule(rid,l);if(l->error)return l->error;
   u32 nr=original.degree-pos-g.degree;Word left=part(w,original.degree,0,pos),right=part(w,original.degree,pos+g.degree,nr);
   for(u32 j=1;j<g.n;j++){
    if(!(j&255)&&cancelled())return GN_CANCELLED;
    reset_a(&r.temp);BCoef ratio=bmake(&r.temp,cneg(pc(g,j)),pc(g,0)),delta=bmul(&r.temp,r.pivot,ratio);
    int rc=brow_add(&r,context(left,pw(g,j),g.degree,right,nr,original.degree,&r.temp),delta);if(rc)return rc;
   }
  }
  r.pivot=(BCoef){0,2};
 }
 /* Commit only after a complete normal form. Keep all fraction roots in the
  * other arena while clearing denominators in the original output arena. */
 Arena*out=&l->a[active];reset_a(out);u64 off=alloc_a(out,(u64)r.normal_n*sizeof(Term));if(out->error)return GN_SCRATCH;
 Term*t=PTR(Term,off);Coef denominator=2;
 for(u32 i=0;i<r.normal_n;i++){
  if(!(i&255)&&cancelled())return GN_CANCELLED;
  BCoef c=r.nodes[r.normal[i]-1].c;Coef g=gcdc(out,denominator,c.d);denominator=mulc(out,exactdiv(out,denominator,g),c.d);if(out->error)return out->error;
 }
 for(u32 i=0;i<r.normal_n;i++){
  if(!(i&255)&&cancelled())return GN_CANCELLED;
  BNode*n=&r.nodes[r.normal[i]-1];t[i]=(Term){n->w,mulc(out,n->c.n,exactdiv(out,denominator,n->c.d))};if(out->error)return out->error;
 }
 l->result=(Poly){off,r.normal_n,original.degree,0};l->active=active;return normalise(&l->result,out);
}
