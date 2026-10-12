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
 if(n&1){u32 count=cn(n);if(!count||!cl(n,count-1)){t->error=GN_CORRUPT;return(BCoef){0,2};}}
 if(d&1){u32 count=cn(d);if(!count||!cl(d,count-1)){t->error=GN_CORRUPT;return(BCoef){0,2};}}
 if(csign(d)<0){n=cneg(n);d=cneg(d);}if(d==2)return(BCoef){clonec(t,n),2};
 /* Own the fraction operands before using the shared arithmetic arena. */
 n=clonec(t,n);d=clonec(t,d);if(t->error)return(BCoef){0,2};
 /* Keep the GCD root across both explicitly sequenced divisions. */
 Coef g=gcdc(t,n,d);if(t->error)return(BCoef){0,2};
 if((g&1)&&!cn(g)){t->error=GN_CORRUPT;return(BCoef){0,2};}
 g=clonec(t,g);if(t->error)return(BCoef){0,2};
 if(!g){t->error=GN_CORRUPT;return(BCoef){0,2};}
 Coef numerator=exactdiv(t,n,g);if(t->error)return(BCoef){0,2};
 Coef denominator=exactdiv(t,d,g);if(t->error)return(BCoef){0,2};
 return(BCoef){numerator,denominator};
}
static BCoef badd(Arena*t,BCoef a,BCoef b){
 if(t->error)return(BCoef){0,2};
 if(!a.n)return bcopy(t,b);if(!b.n)return bcopy(t,a);
 if(a.d==2&&b.d==2)return(BCoef){addc(t,a.n,b.n),2};
 if(a.d==b.d||magcmp(a.d,b.d)==0)return bmake(t,addc(t,a.n,b.n),a.d);
 Coef g=gcdc(t,a.d,b.d),ad=exactdiv(t,a.d,g),bd=exactdiv(t,b.d,g);
 Coef n=addc(t,mulc(t,a.n,bd),mulc(t,b.n,ad));if(!n)return(BCoef){0,2};
 Coef h=gcdc(t,n,g);return(BCoef){exactdiv(t,n,h),mulc(t,ad,exactdiv(t,b.d,h))};
}
static BCoef bmul(Arena*t,BCoef a,BCoef b){
 if(t->error)return(BCoef){0,2};
 if(!a.n||!b.n)return(BCoef){0,2};
 if(a.d==2&&b.d==2)return(BCoef){mulc(t,a.n,b.n),2};
 if(a.d==2&&(a.n==2||a.n==csmall(-1))){BCoef r=bcopy(t,b);if(csign(a.n)<0)r.n=cneg(r.n);return r;}
 if(b.d==2&&(b.n==2||b.n==csmall(-1))){BCoef r=bcopy(t,a);if(csign(b.n)<0)r.n=cneg(r.n);return r;}
 Coef g=gcdc(t,a.n,b.d),h=gcdc(t,b.n,a.d);
 return(BCoef){mulc(t,exactdiv(t,a.n,g),exactdiv(t,b.n,h)),mulc(t,exactdiv(t,a.d,h),exactdiv(t,b.d,g))};
}
#ifndef FOMKYR_RATIONAL_TAIL_RATIO_BASELINE
/* a is canonical; cancelling its numerator against the integer divisor
 * suffices because its denominator is already coprime to that numerator. */
static BCoef bdiv_integer(Arena*t,BCoef a,Coef divisor){
 if(t->error)return(BCoef){0,2};
 if(!divisor){t->error=GN_CORRUPT;return(BCoef){0,2};}
 if(!a.n)return(BCoef){0,2};
 Coef g=gcdc(t,a.n,divisor),n=exactdiv(t,a.n,g);
 Coef d=mulc(t,a.d,exactdiv(t,cabs(divisor),g));
 return(BCoef){csign(divisor)<0?cneg(n):n,d};
}
#endif
typedef struct {Word w;BCoef c;u32 next,pos;} BNode;
typedef struct {
 BNode*nodes;u32*heads,*heap,*normal;u32 capacity,mask,used,free_head,heap_n,normal_n,degree,reserved,radix_enabled;RadixQueue radix;
 Arena temp,pool[2];u64 workspace_bytes;u32 pool_active;BCoef pivot;Lane*lane;
 Word pending_word;u32 pending_kind,pending_rule,pending_pos,pending_tail,input_next,pivot_scaled;
} BRow;
static void bheap_up(BRow*r,u32 p){
 u32 id=r->heap[p];while(p){u32 parent=(p-1)/2,other=r->heap[parent];if(wcmp(r->nodes[other-1].w,r->nodes[id-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=parent;}r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void bheap_down(BRow*r,u32 p){
 u32 id=r->heap[p];while(2*p+1<r->heap_n){u32 child=2*p+1;if(child+1<r->heap_n&&wcmp(r->nodes[r->heap[child+1]-1].w,r->nodes[r->heap[child]-1].w)>0)child++;u32 other=r->heap[child];if(wcmp(r->nodes[id-1].w,r->nodes[other-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=child;}r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void bheap_remove(BRow*r,u32 id){
 if(r->radix_enabled){radix_erase(&r->radix,r->nodes,sizeof(BNode),id);r->heap_n--;r->nodes[id-1].pos=0;return;}
 u32 p=r->nodes[id-1].pos-1,last=r->heap[--r->heap_n];r->nodes[id-1].pos=0;if(p==r->heap_n)return;r->heap[p]=last;r->nodes[last-1].pos=p+1;if(p&&wcmp(r->nodes[last-1].w,r->nodes[r->heap[(p-1)/2]-1].w)>0)bheap_up(r,p);else bheap_down(r,p);
}
static u32 bheap_top(BRow*r){return r->radix_enabled?radix_top(&r->radix,r->nodes,sizeof(BNode)):r->heap[0];}
static void brow_remove(BRow*r,u32 id){
 BNode*n=&r->nodes[id-1];u32 h=rrow_hash(n->w,r->mask),*link=&r->heads[h];while(*link!=id)link=&r->nodes[*link-1].next;*link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;
}
static u64 bbytes(BCoef c){return(c.n&1?A8(8+(u64)cn(c.n)*4):0)+(c.d&1?A8(8+(u64)cn(c.d)*4):0);}
/* Arena peaks are maintained by alloc_a; unlike the current bump extent they
 * survive reset_a. Copy peaks before a promotion replaces the arena descriptors. */
static void brow_pressure(BRow*r){
 Lane*l=r->lane;l->big_pool_high_water=MAX(l->big_pool_high_water,MAX(r->pool[0].peak,r->pool[1].peak));
 l->big_arithmetic_high_water=MAX(l->big_arithmetic_high_water,r->temp.peak);
}
static int brow_collect(BRow*r){
 Arena*out=&r->pool[r->pool_active^1];reset_a(out);u64 need=bbytes(r->pivot);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u64 n=bbytes(r->nodes[i].c);if(n>out->end-out->base||need>out->end-out->base-n)return HEAP_MISS;need+=n;}
 if(need>out->end-out->base)return HEAP_MISS;
 for(u32 i=0;i<r->used;i++){if((i&1023)==0&&cancelled())return GN_CANCELLED;if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcopy(out,r->nodes[i].c);}
 r->pivot=bcopy(out,r->pivot);if(out->error)return HEAP_MISS;r->lane->big_collected_live_high_water=MAX(r->lane->big_collected_live_high_water,need);r->pool_active^=1;r->lane->big_compactions++;return 0;
}
/* The source is always in operation scratch or stable input/cache memory, never
 * a borrowed semispace root. Collection may relocate the pivot and live nodes. */
static int brow_promote(BRow*r);
static int brow_store(BRow*r,BCoef c,BCoef*out){
 u64 need=bbytes(c);Arena*p=&r->pool[r->pool_active];
 if(need>p->end-p->pos){int rc=brow_collect(r);if(rc&&rc!=HEAP_MISS)return rc;p=&r->pool[r->pool_active];
  if(rc||need>p->end-p->pos){rc=brow_promote(r);if(rc){if(rc!=GN_YIELD)r->lane->big_pool_misses++;r->lane->memory_detail=1;return rc;}p=&r->pool[r->pool_active];}
 }
 if(need>p->end-p->pos){r->lane->big_pool_misses++;r->lane->memory_detail=1;return HEAP_MISS;}
 *out=bcopy(p,c);return p->error?HEAP_MISS:0;
}
/* Reserve structural address ranges once. Only initialized slots become live;
 * doubling rehashes their indices, leaving the exact reduction state intact.
 * Keep the original node-capacity bands when radix links are enabled: their
 * additional four bytes per node use at most 3% of the workspace. More than
 * 55% remains for coefficients and operations with either queue. */
static u32 brow_budget_capacity(u64 bytes){
 u64 limit=(bytes/5)*2/(sizeof(BNode)+16);
 u32 cap=0,max=S.big_row_max_terms?S.big_row_max_terms:(1u<<30);
 if(limit>=128){cap=128;while(cap<max&&(u64)cap*2<=limit)cap*=2;}return cap;
}
static int brow_layout(BRow*r,Lane*l,Arena*a,u32 reserved,u32 capacity,u32 degree){
 reset_a(a);u64 no=alloc_a(a,(u64)reserved*sizeof(BNode)),ho=alloc_a(a,(u64)reserved*8),po=alloc_a(a,(u64)reserved*4),oo=alloc_a(a,(u64)reserved*4);
 if(a->error)return HEAP_MISS;
 *r=(BRow){0};r->nodes=PTR(BNode,no);r->heads=PTR(u32,ho);r->heap=PTR(u32,po);r->normal=PTR(u32,oo);
 r->workspace_bytes=a->end-a->base;r->reserved=reserved;r->capacity=capacity;r->mask=capacity*2-1;r->degree=degree;r->lane=l;r->pivot=(BCoef){0,2};
 r->radix_enabled=S.radix_enabled;
 if(r->radix_enabled){u64 prev=alloc_a(a,(u64)reserved*4);if(a->error)return HEAP_MISS;
  r->radix.cache_enabled=S.radix_cache_enabled;r->radix.next=r->heap;r->radix.previous=PTR(u32,prev);r->radix.last=maskw((Word){UINT64_MAX,UINT64_MAX},degree);
 }
 u64 remain=a->end-a->pos,partbytes=((remain/8)*3)&~UINT64_C(7),begin=a->pos;
 r->pool[0]=(Arena){begin,begin,begin+partbytes,0,0};begin+=partbytes;
 r->pool[1]=(Arena){begin,begin,begin+partbytes,0,0};begin+=partbytes;
 r->temp=(Arena){begin,begin,a->end,0,0};return 0;
}
static void brow_report(BRow*r){
 brow_pressure(r);Lane*l=r->lane;if(l->reserve_owned||l->reserve_retry)l->reduction_tier=6;l->big_capacity=r->capacity;l->big_reserved=r->reserved;
 l->big_peak_terms=MAX(l->big_peak_terms,(u64)r->heap_n+r->normal_n);
 l->big_coefficient_live=r->pool[r->pool_active].pos-r->pool[r->pool_active].base;
 l->big_coefficient_bytes=r->pool[r->pool_active].end-r->pool[r->pool_active].base;
}
/* Reader-free relocation. The old row remains authoritative until every live
 * fraction and the pivot have been copied; no reduction or cursor is replayed. */
static int brow_relocate(BRow*r,Lane*l,u64 base,u64 bytes){
 u32 reserved=brow_budget_capacity(bytes);if(reserved<r->capacity)return HEAP_MISS;
 Arena a={base,base,base+bytes,0,0};BRow next;int rc=brow_layout(&next,l,&a,reserved,r->capacity,r->degree);
 u64 need=bbytes(r->pivot);
 if(!rc)for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u64 n=bbytes(r->nodes[i].c);if(n>next.pool[0].end-next.pool[0].base||need>next.pool[0].end-next.pool[0].base-n){rc=HEAP_MISS;break;}need+=n;}
 if(!rc&&need>next.pool[0].end-next.pool[0].base)rc=HEAP_MISS;if(rc)return rc;
 memcpy(next.nodes,r->nodes,(size_t)r->used*sizeof(BNode));
 memcpy(next.heap,r->heap,(size_t)(r->radix_enabled?r->used:r->heap_n)*4);memcpy(next.normal,r->normal,(size_t)r->normal_n*4);
 if(r->radix_enabled)memcpy(next.radix.previous,r->radix.previous,(size_t)r->used*4);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){
  if(!(i&1023)&&cancelled())return GN_CANCELLED;
  next.nodes[i].c=bcopy(&next.pool[0],r->nodes[i].c);
 }
 BCoef pivot=bcopy(&next.pool[0],r->pivot);if(next.pool[0].error)return HEAP_MISS;
 r->nodes=next.nodes;r->heads=next.heads;r->heap=next.heap;r->normal=next.normal;r->reserved=reserved;
 if(r->radix_enabled){r->radix.next=r->heap;r->radix.previous=next.radix.previous;}
 r->pool[0]=next.pool[0];r->pool[1]=next.pool[1];r->pool_active=0;r->temp=next.temp;r->pivot=pivot;r->workspace_bytes=bytes;r->lane=l;
 memset(r->heads,0,(size_t)r->capacity*8);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u32 h=rrow_hash(r->nodes[i].w,r->mask);r->nodes[i].next=r->heads[h];r->heads[h]=i+1;}
 return 0;
}
static int brow_promote(BRow*r){
 brow_pressure(r);Lane*l=r->lane;
  if(l->no_reserve)return GN_DEFERRED;
  u32 available=brow_budget_capacity(S.reserve_bytes);
  if(!S.reserve_growth||!S.reserve_base||l->reserve_owned||l->reserve_retry||available<r->capacity||S.reserve_bytes<=r->workspace_bytes)return HEAP_MISS;
  if(!reserve_acquire(l)){
   l->reserve_busy++;l->big_reserve_waits++;l->reserve_waiting=1;
   /* Retain even a partially emitted rewrite when the reserve is occupied.
    * A later cooperative wave retries this one tail, not the S-polynomial. */
   return HEAP_MISS;
  }
  u64 base=reserve_lease_base(l),bytes=reserve_lease_bytes(l);available=brow_budget_capacity(bytes);
  if(available<r->capacity||bytes<=r->workspace_bytes){reserve_release(l);return HEAP_MISS;}
  Arena a={base,base,base+bytes,0,0};BRow next;
  int rc=brow_layout(&next,l,&a,available,r->capacity,r->degree);
  u64 need=bbytes(r->pivot);
  if(!rc)for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u64 n=bbytes(r->nodes[i].c);if(n>next.pool[0].end-next.pool[0].base||need>next.pool[0].end-next.pool[0].base-n){rc=HEAP_MISS;break;}need+=n;}
  if(!rc&&need>next.pool[0].end-next.pool[0].base)rc=HEAP_MISS;
  if(rc){reserve_release(l);return rc;}
  memcpy(next.nodes,r->nodes,(size_t)r->used*sizeof(BNode));
  memcpy(next.heap,r->heap,(size_t)(r->radix_enabled?r->used:r->heap_n)*4);memcpy(next.normal,r->normal,(size_t)r->normal_n*4);
  if(r->radix_enabled)memcpy(next.radix.previous,r->radix.previous,(size_t)r->used*4);
  for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)next.nodes[i].c=bcopy(&next.pool[0],r->nodes[i].c);
  BCoef pivot=bcopy(&next.pool[0],r->pivot);
  /* Preserve cursor, free-list and normal prefix; only storage moves. */
  r->nodes=next.nodes;r->heads=next.heads;r->heap=next.heap;r->normal=next.normal;r->reserved=available;
  if(r->radix_enabled){r->radix.next=r->heap;r->radix.previous=next.radix.previous;}
  r->pool[0]=next.pool[0];r->pool[1]=next.pool[1];r->pool_active=0;r->temp=next.temp;r->pivot=pivot;r->workspace_bytes=next.workspace_bytes;
  l->reserve_owned=1;l->reserve_attempts++;l->reserve_promotions++;l->reduction_tier=6;
  l->reserve_peak=MAX(l->reserve_peak,a.pos-a.base+need);
  memset(r->heads,0,(size_t)r->capacity*8);
  for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u32 h=rrow_hash(r->nodes[i].w,r->mask);r->nodes[i].next=r->heads[h];r->heads[h]=i+1;}
  brow_report(r);return 0;
}
static int brow_grow(BRow*r){
 Lane*l=r->lane;
 if(r->capacity>=r->reserved){if(S.big_row_max_terms&&r->capacity>=S.big_row_max_terms)return GN_LIMIT;if(brow_budget_capacity(S.reserve_bytes)<=r->capacity)return HEAP_MISS;int rc=brow_promote(r);if(rc)return rc;if(r->capacity>=r->reserved)return HEAP_MISS;}
 u32 cap=MIN(r->capacity*2,r->reserved);r->capacity=cap;r->mask=cap*2-1;
 memset(r->heads,0,(size_t)cap*8);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u32 h=rrow_hash(r->nodes[i].w,r->mask);r->nodes[i].next=r->heads[h];r->heads[h]=i+1;}
 l->big_growths++;brow_report(r);return 0;
}
static int brow_add(BRow*r,Word w,BCoef delta){
 if(r->temp.error){if(r->temp.error!=GN_SCRATCH)return r->temp.error;r->lane->big_arena_misses++;r->lane->memory_detail=3;return HEAP_MISS;}
 if(!delta.n)return 0;
 u32 skip=r->lane->skip_rule;int protected_leader=skip&&r->degree==rule(skip)->degree&&weq(w,rule(skip)->lm);
 if(!protected_leader&&eager_zero(w,r->degree,r->lane))return 0;
 u32 h=rrow_hash(w,r->mask),*link=&r->heads[h],id=*link;
 while(id&&!weq(r->nodes[id-1].w,w)){link=&r->nodes[id-1].next;id=*link;}
 if(id){BNode*n=&r->nodes[id-1];if(!n->pos)return GN_CORRUPT;
  BCoef value=badd(&r->temp,n->c,delta);
  if(r->temp.error){if(r->temp.error!=GN_SCRATCH)return r->temp.error;r->lane->big_arena_misses++;r->lane->memory_detail=3;return HEAP_MISS;}
  /* The lookup already found the predecessor. Arithmetic scratch cannot move
   * this table; unlink a cancellation without hashing and walking it again. */
  if(!value.n){bheap_remove(r,id);*link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;return 0;}
  BCoef owned;int rc=brow_store(r,value,&owned);if(!rc)r->nodes[id-1].c=owned;return rc;
 }
 if(!r->free_head&&r->used==r->capacity){int rc=brow_grow(r);if(rc){if(rc!=GN_YIELD)r->lane->big_capacity_misses++;r->lane->memory_detail=2;return rc;}h=rrow_hash(w,r->mask);}
 BCoef owned;int rc=brow_store(r,delta,&owned);if(rc)return rc;
 if(r->free_head){id=r->free_head;r->free_head=r->nodes[id-1].next;}
 else id=++r->used;
 r->nodes[id-1]=(BNode){w,owned,r->heads[h],r->heap_n+1};r->heads[h]=id;
 if(r->radix_enabled){r->nodes[id-1].pos=1;r->heap_n++;int rc=radix_insert(&r->radix,r->nodes,sizeof(BNode),id);if(rc)return HEAP_MISS;}
 else{r->heap[r->heap_n++]=id;bheap_up(r,r->heap_n-1);}
 r->lane->big_peak_terms=MAX(r->lane->big_peak_terms,(u64)r->heap_n+r->normal_n);return 0;
}
typedef struct {BRow row;u64 steps;} BRowResume;
static BRowResume saved_BRow[GN_RESUME_SLOTS];
static int big_rational_nf_inner(Lane*l,Poly original,u32 active,u32 snapshot){
 BRow r;u64 steps=0;u32 resume_rule=0,resume_tail=UINT32_MAX;
 if(l->resume_tier==4){r=saved_BRow[l->resume_slot].row;steps=saved_BRow[l->resume_slot].steps;goto resumed_heap;}

 Arena*a=&l->a[active^1];u32 reserved=brow_budget_capacity(a->end-a->base);
 /* Avoid replay only when the compact reducer exhausted a table at least as
  * large as this workspace can provide. A larger reserve is tried separately. */
 if(l->rational_maxed&&reserved<=l->rational_full_capacity){l->big_capacity_misses++;return HEAP_MISS;}
 if(!reserved||reserved<128){l->big_capacity_misses++;return HEAP_MISS;}
 u32 cap=128;while(cap<original.n&&cap<reserved)cap*=2;
 int init=brow_layout(&r,l,a,reserved,cap,original.degree);if(init)return init;
 memset(r.heads,0,(size_t)cap*8);
 resumed_heap:
 /* Loading/checking a large immutable record can consume an entire slice.
  * A resumed tail must advance before its next deadline check; otherwise the
  * same record is reloaded forever at the same 256-term boundary. */
 if(r.pending_kind==2){resume_rule=r.pending_rule;resume_tail=r.pending_tail;}
 while(r.input_next<original.n){
  if(!(r.input_next&255)){brow_report(&r);publish_lane(l,(u64)r.heap_n+r.normal_n,0);if(cancelled())return GN_CANCELLED;if(slice_expired(l))goto yield_row;}
  reset_a(&r.temp);BCoef c={clonec(&r.temp,pc(original,r.input_next)),2};
  int rc=brow_add(&r,pw(original,r.input_next),c);if(rc==GN_YIELD)goto yield_row;if(rc==HEAP_MISS)goto wait_growth;if(rc)return rc;r.input_next++;
 }
 while(r.heap_n||r.pending_kind){
  if(!r.pending_kind){
   if((steps++&63)==0){brow_report(&r);publish_lane(l,(u64)r.heap_n+r.normal_n,0);if(cancelled())return GN_CANCELLED;if(slice_expired(l))goto yield_row;}
   u32 id=bheap_top(&r);Word w=r.nodes[id-1].w;r.pivot=r.nodes[id-1].c;bheap_remove(&r,id);
   u32 pos=0;LocalEntry*local=(l->delta_floor||!S.rational_rewrites||l->skip_rule)?NULL:local_find(w,original.degree,snapshot,&pos);
   u32 rid=local?0:divisor(w,original.degree,snapshot,&pos,l);
   if(!local&&!rid){r.normal[r.normal_n++]=id;r.pivot=(BCoef){0,2};continue;}
   brow_remove(&r,id);l->reductions++;l->big_steps++;
   r.pending_word=w;r.pending_pos=pos;r.pending_rule=rid;r.pending_kind=local?1:2;r.pending_tail=local?0:1;r.pivot_scaled=0;
   if(local){l->local_hits++;if(!local->n)l->pruned++;}
   else if(S.pruning&&rule(rid)->n==1)l->pruned++;
  }
  u32 pos=r.pending_pos;
  if(r.pending_kind==1){
   LocalEntry*local=local_find(r.pending_word,original.degree,snapshot,&pos);if(!local)return GN_CORRUPT;
   u32 nr=original.degree-pos-S.local_degree;Word left=part(r.pending_word,original.degree,0,pos),right=part(r.pending_word,original.degree,pos+S.local_degree,nr);LocalTerm*lt=PTR(LocalTerm,S.local_base+local->off);
   while(r.pending_tail<local->n){u32 j=r.pending_tail;reset_a(&r.temp);BCoef delta=bmul(&r.temp,r.pivot,(BCoef){csmall(lt[j].c),2});int rc=brow_add(&r,context(left,(Word){lt[j].word,0},S.local_degree,right,nr,original.degree,&r.temp),delta);if(rc==GN_YIELD)goto yield_row;if(rc==HEAP_MISS)goto wait_growth;if(rc)return rc;r.pending_tail++;}
  }else{
   Poly g=load_rule(r.pending_rule,l);if(l->error)return l->error;
#ifndef FOMKYR_RATIONAL_TAIL_RATIO_BASELINE
   /* The pivot/leading-coefficient factor is shared by every term of this
    * rewrite. Root it in the coefficient pool so collection, workspace
    * promotion and cooperative suspension preserve the scaled pivot. */
   if(!r.pivot_scaled&&g.n>1){
    Coef lead=pc(g,0);
    if(lead==2||lead==csmall(-1)){if(csign(lead)<0)r.pivot.n=cneg(r.pivot.n);}
    else{
     reset_a(&r.temp);BCoef factor=bdiv_integer(&r.temp,r.pivot,lead);
     if(r.temp.error){if(r.temp.error!=GN_SCRATCH)return r.temp.error;l->big_arena_misses++;l->memory_detail=3;goto wait_growth;}
     BCoef owned;int rc=brow_store(&r,factor,&owned);if(rc==GN_YIELD)goto yield_row;if(rc==HEAP_MISS)goto wait_growth;if(rc)return rc;
     r.pivot=owned;
    }
    r.pivot_scaled=1;
   }
#endif
   u32 nr=original.degree-pos-g.degree;Word left=part(r.pending_word,original.degree,0,pos),right=part(r.pending_word,original.degree,pos+g.degree,nr);
   while(r.pending_tail<g.n){u32 j=r.pending_tail;if(!(j&255)){brow_report(&r);publish_lane(l,(u64)r.heap_n+r.normal_n,0);if(cancelled())return GN_CANCELLED;
     if(slice_expired(l)&&!(r.pending_rule==resume_rule&&j==resume_tail))goto yield_row;
    }reset_a(&r.temp);
#ifdef FOMKYR_RATIONAL_TAIL_RATIO_BASELINE
    BCoef ratio=bmake(&r.temp,cneg(pc(g,j)),pc(g,0)),delta=bmul(&r.temp,r.pivot,ratio);
#else
    BCoef delta=bmul(&r.temp,r.pivot,(BCoef){cneg(pc(g,j)),2});
#endif
    int rc=brow_add(&r,context(left,pw(g,j),g.degree,right,nr,original.degree,&r.temp),delta);if(rc==GN_YIELD)goto yield_row;if(rc==HEAP_MISS)goto wait_growth;if(rc)return rc;r.pending_tail++;
    resume_rule=0;resume_tail=UINT32_MAX;
   }
  }
  r.pending_kind=0;r.pivot=(BCoef){0,2};
 }
 brow_report(&r);
 /* Commit only after a complete normal form. Keep all fraction roots in the
  * other arena while clearing denominators in the original output arena. */
 Arena*out=&l->a[active];reset_a(out);u64 off=alloc_a(out,(u64)r.normal_n*sizeof(Term));if(out->error)goto wait_output;
 Term*t=PTR(Term,off);Coef denominator=2;
 for(u32 i=0;i<r.normal_n;i++){
  if(!(i&255)&&cancelled())return GN_CANCELLED;
  BCoef c=r.nodes[r.normal[i]-1].c;Coef g=gcdc(out,denominator,c.d);denominator=mulc(out,exactdiv(out,denominator,g),c.d);if(out->error){if(out->error==GN_SCRATCH)goto wait_output;return out->error;}
 }
 for(u32 i=0;i<r.normal_n;i++){
  if(!(i&255)&&cancelled())return GN_CANCELLED;
  BNode*n=&r.nodes[r.normal[i]-1];t[i]=(Term){n->w,mulc(out,n->c.n,exactdiv(out,denominator,n->c.d))};if(out->error){if(out->error==GN_SCRATCH)goto wait_output;return out->error;}
 }
 {Poly result={off,r.normal_n,original.degree,0};int rc=normalise(&result,out);if(rc==GN_SCRATCH)goto wait_output;if(!rc){l->result=result;l->active=active;}return rc;}
 wait_output:
 l->memory_wait=ROW_WAIT_OUTPUT;l->memory_need=MAX(UINT64_C(1048576),(out->end-out->base)*2);goto wait_row;
 wait_growth:
 l->memory_wait=l->reserve_slot?ROW_WAIT_GROW:ROW_WAIT_RESERVE;
 l->memory_need=MAX(UINT64_C(1048576),r.workspace_bytes*2);
 wait_row:
 if(!l->slice_enabled||l->no_reserve){l->memory_wait=0;return GN_SCRATCH;}
 brow_report(&r);saved_BRow[l->resume_slot]=(BRowResume){r,steps};l->resume_tier=4;return GN_ROW_WAIT;
 yield_row:
 brow_report(&r);saved_BRow[l->resume_slot]=(BRowResume){r,steps};l->resume_tier=4;l->slice_yields++;return GN_YIELD;
}
static int big_rational_nf(Lane*l,Poly original,u32 active,u32 snapshot){
 int rc=big_rational_nf_inner(l,original,active,snapshot);
 if(rc==GN_YIELD||rc==GN_ROW_WAIT)return rc;
 if(l->coefficient_extra_base)l->coefficient_extra_retired=1;
 if(l->reserve_owned){if(!rc)l->reserve_successes++;else l->reserve_misses++;l->reserve_owned=0;reserve_release(l);}
 return rc;
}
/* Called only between joined waves. Returning 0 means the retained row must
 * wait; returning 1 means its exact cursor may resume. No global re-layout. */
static int brow_service_wait(Lane*l){
 if(!l->memory_wait)return 0;
 if(l->memory_wait==ROW_WAIT_OUTPUT){
  u64 bytes=l->memory_need,base=workspace_take(&bytes);if(!base)return 0;
  u32 active=l->active;Arena old=l->a[active];
  if(!l->output_extra_base){l->output_saved=old;l->output_extra_index=active;}
  else workspace_return(l->output_extra_base,l->output_extra_bytes);
  l->output_extra_base=base;l->output_extra_bytes=bytes;l->a[active]=(Arena){base,base,base+bytes,0,0};
  l->memory_wait=0;l->memory_need=0;l->row_growths++;return 1;
 }
 if(l->resume_tier==5){
  if(!reserve_acquire(l))return 0;l->memory_wait=0;l->memory_need=0;return 1;
 }
 if(l->resume_tier!=4)return -GN_STATE;
 if(!S.reserve_growth)return 0;
 BRow*r=&saved_BRow[l->resume_slot].row;r->lane=l;
 if(!l->reserve_slot&& !reserve_acquire(l))return 0;
 /* Expand coefficient semispaces while retaining the node table. Move roots to one new pool, then combine the two adjacent old pools
  * into the other. This can borrow an idle worker lease within the same budget. */
 if(l->memory_detail==1&&!l->coefficient_extra_base&&!l->coefficient_extra_slot&&
    (r->pool[0].end==r->pool[1].base||r->pool[1].end==r->pool[0].base)){
  u64 begin=MIN(r->pool[0].base,r->pool[1].base),end=MAX(r->pool[0].end,r->pool[1].end),bytes=end-begin;
  u32 other=0;u64 base=reserve_growth_target(l,&bytes,&other);
  if(base){
   u64 tempbytes=MAX(UINT64_C(65536),r->temp.peak);
   u64 poolbytes=bytes>tempbytes?MIN(r->temp.end-begin,bytes-tempbytes):0;
   Arena out={base,base,base+poolbytes,0,0};u64 need=bbytes(r->pivot);
   for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)need+=bbytes(r->nodes[i].c);
   if(need<=poolbytes){
    for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcopy(&out,r->nodes[i].c);
    r->pivot=bcopy(&out,r->pivot);
    /* Byte-count preflight guarantees these copies cannot allocate-fail. */
    if(out.error)return -GN_CORRUPT;
    r->pool[0]=out;r->pool[1]=(Arena){begin,begin,begin+poolbytes,0,0};r->pool_active=0;r->temp=(Arena){base+poolbytes,base+poolbytes,base+bytes,0,0};
    if(other)l->coefficient_extra_slot=other;else{l->coefficient_extra_base=base;l->coefficient_extra_bytes=bytes;}
    l->memory_wait=0;l->memory_need=0;l->memory_detail=0;l->row_growths++;brow_report(r);return 1;
   }
   reserve_growth_cancel(base,bytes,other);
  }
 }
 u64 base=reserve_lease_base(l),bytes=reserve_lease_bytes(l);u32 other=0,replace=0;
 if(bytes<l->memory_need){
  bytes=l->memory_need;base=reserve_growth_target(l,&bytes,&other);replace=1;
  if(!base)return 0;
 }
 int rc=brow_relocate(r,l,base,bytes);
 if(rc){if(replace)reserve_growth_cancel(base,bytes,other);if(rc==HEAP_MISS){l->memory_need=MIN(S.budget,bytes>S.budget/2?S.budget:bytes*2);return 0;}return -rc;}
 if(replace)reserve_growth_commit(l,base,bytes,other);
 /* A full relocation no longer references its old overflow coefficient pool. */
 if(l->coefficient_extra_slot){GN_UNLOCK(reserve_slot_lock(l->coefficient_extra_slot));l->coefficient_extra_slot=0;}
 if(l->coefficient_extra_base){workspace_return(l->coefficient_extra_base,l->coefficient_extra_bytes);l->coefficient_extra_base=l->coefficient_extra_bytes=0;}
 if(l->reserve_retry)l->a[l->active^1]=(Arena){base,base,base+bytes,0,0};else l->reserve_owned=1;
 l->memory_wait=0;l->memory_need=0;l->memory_detail=0;l->row_growths++;l->reserve_promotions++;brow_report(r);return 1;
}
