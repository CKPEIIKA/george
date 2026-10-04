/* SPDX-License-Identifier: MIT
 * Sparse monic fast path. The original polynomial is kept intact until success.
 * All row coefficients must fit the tagged immediate range. On a non-unit pivot,
 * large coefficient, or exhausted row table, fall back to fraction-free NF.
 * No algebraic decision is based on a floating-point approximation.
 */
typedef struct { Word w; i64 c; u32 next,pos; } HNode;
typedef struct {
 HNode *nodes; u32 *heads,*heap,*normal;
 u32 capacity,mask,used,free_head,heap_n,normal_n,degree;Lane*lane;u32 radix_enabled;RadixQueue radix;
} HRow;
#define HEAP_MISS (-1)
#define HEAP_FULL (-2)
static u32 row_hash(Word w,u32 mask){return (u32)mix(w.lo^mix(w.hi))&mask;}
static void heap_up(HRow*r,u32 p){
 u32 id=r->heap[p];
 while(p){u32 parent=(p-1)/2,other=r->heap[parent];if(wcmp(r->nodes[other-1].w,r->nodes[id-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=parent;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void heap_down(HRow*r,u32 p){
 u32 id=r->heap[p];
 while(2*p+1<r->heap_n){u32 child=2*p+1;if(child+1<r->heap_n&&wcmp(r->nodes[r->heap[child+1]-1].w,r->nodes[r->heap[child]-1].w)>0)child++;
  u32 other=r->heap[child];if(wcmp(r->nodes[id-1].w,r->nodes[other-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=child;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void heap_remove(HRow*r,u32 id){
 if(r->radix_enabled){radix_erase(&r->radix,r->nodes,sizeof(HNode),id);r->heap_n--;r->nodes[id-1].pos=0;return;}
 u32 p=r->nodes[id-1].pos-1,last=r->heap[--r->heap_n];r->nodes[id-1].pos=0;
 if(p==r->heap_n)return;r->heap[p]=last;r->nodes[last-1].pos=p+1;
 if(p&&wcmp(r->nodes[last-1].w,r->nodes[r->heap[(p-1)/2]-1].w)>0)heap_up(r,p);else heap_down(r,p);
}
static void row_remove(HRow*r,u32 id){
 HNode*n=&r->nodes[id-1];u32 h=row_hash(n->w,r->mask),*link=&r->heads[h];
 while(*link!=id)link=&r->nodes[*link-1].next;
 *link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;
}
static int row_add(HRow*r,Word w,i64 delta){
 if(!delta)return 0;
 // Canonical export retains its own leader. Preconditioning must not erase it
 // before the ordinary divisor lookup has a chance to skip that one rule.
 u32 skip=r->lane->skip_rule;int protected_leader=skip&&r->degree==rule(skip)->degree&&weq(w,rule(skip)->lm);
 if(!protected_leader){if(eager_zero(w,r->degree,r->lane))return 0;quadratic_precondition(&w,r->degree,&delta,r->lane);}
 u32 h=row_hash(w,r->mask),id=r->heads[h];
 while(id&&!weq(r->nodes[id-1].w,w))id=r->nodes[id-1].next;
 if(id){HNode*n=&r->nodes[id-1];if(!n->pos)return HEAP_MISS; // a triangularity invariant
  i64 c;
  if(S.modulus){c=(n->c+delta)%(i64)S.modulus;if(c<0)c+=S.modulus;}
  else{if((delta>0&&n->c>SMALL_MAX-delta)||(delta<0&&n->c< -SMALL_MAX-delta))return HEAP_MISS;c=n->c+delta;}
  if(c)n->c=c;else{heap_remove(r,id);row_remove(r,id);}return 0;
 }
 if(S.modulus){delta%=(i64)S.modulus;if(delta<0)delta+=S.modulus;if(!delta)return 0;}
 if(r->free_head){id=r->free_head;r->free_head=r->nodes[id-1].next;}
 else{if(r->used==r->capacity)return HEAP_FULL;id=++r->used;}
 r->nodes[id-1]=(HNode){w,delta,r->heads[h],r->heap_n+1};r->heads[h]=id;
 if(r->radix_enabled){r->nodes[id-1].pos=1;r->heap_n++;return radix_insert(&r->radix,r->nodes,sizeof(HNode),id);}
 r->heap[r->heap_n++]=id;heap_up(r,r->heap_n-1);return 0;
}
typedef struct {HRow row;u64 steps;} HRowResume;
static HRowResume saved_HRow[GN_MAX_WORKERS];
static int heap_nf_try(Lane*l,Poly original,u32 active,u32 snapshot,u32 capacity){
 HRow row;u64 steps=0;
 if(l->resume_tier==1){row=saved_HRow[l-S.lanes].row;steps=saved_HRow[l-S.lanes].steps;goto resumed_heap;}

 Arena*a=&l->a[active^1];reset_a(a);
 u64 no=alloc_a(a,(u64)capacity*sizeof(HNode)),ho=alloc_a(a,(u64)capacity*2*sizeof(u32)),po=alloc_a(a,(u64)capacity*sizeof(u32)),oo=alloc_a(a,(u64)capacity*sizeof(u32));
 if(a->error)return HEAP_MISS;
 row=(HRow){PTR(HNode,no),PTR(u32,ho),PTR(u32,po),PTR(u32,oo),capacity,2*capacity-1,0,0,0,0,original.degree,l};
 row.radix_enabled=S.radix_enabled;
 if(row.radix_enabled){u64 prev=alloc_a(a,(u64)capacity*4);if(a->error)return HEAP_MISS;
  row.radix=(RadixQueue){0};row.radix.cache_enabled=S.radix_cache_enabled;row.radix.next=row.heap;row.radix.previous=PTR(u32,prev);row.radix.last=maskw((Word){UINT64_MAX,UINT64_MAX},original.degree);
 }
 memset(row.heads,0,(size_t)capacity*2*sizeof(u32));
 Term*input=PTR(Term,original.off);
 for(u32 i=0;i<original.n;i++){Coef c=pc(original,i);if(c&1)return HEAP_MISS;int rc=row_add(&row,input[i].w,cvalue(c));if(rc)return rc;}
 resumed_heap:
 a=&l->a[active^1];
 while(row.heap_n){
  if((steps++&255)==0){publish_lane(l,(u64)row.heap_n+row.normal_n,0);if(cancelled())return GN_CANCELLED;if(slice_expired(l)){saved_HRow[l-S.lanes]=(HRowResume){row,steps};l->resume_tier=1;l->resume_capacity=capacity;l->slice_yields++;return GN_YIELD;}}
  u32 id=row.radix_enabled?radix_top(&row.radix,row.nodes,sizeof(HNode)):row.heap[0];HNode*node=&row.nodes[id-1];Word word=node->w;i64 coefficient=node->c;heap_remove(&row,id);
  u32 pos=0;LocalEntry*local=l->skip_rule?NULL:local_find(word,original.degree,snapshot,&pos);
  if(local){
   row_remove(&row,id);l->reductions++;l->local_hits++;
   if(!local->n){l->pruned++;continue;}
   u32 nr=original.degree-pos-S.local_degree;Word left=part(word,original.degree,0,pos),right=part(word,original.degree,pos+S.local_degree,nr);
   LocalTerm*lt=PTR(LocalTerm,S.local_base+local->off);
   for(u32 j=0;j<local->n;j++){
    i64 v=lt[j].c,delta;u64 x=coefficient<0?(u64)-coefficient:(u64)coefficient,y=v<0?(u64)-v:(u64)v;
    if(S.modulus)delta=(i64)(((u64)coefficient*(u64)v)%S.modulus);
    else{if(y&&x>(u64)SMALL_MAX/y)return HEAP_MISS;delta=coefficient*v;}
    int rc=row_add(&row,context(left,(Word){lt[j].word,0},S.local_degree,right,nr,original.degree,a),delta);if(rc)return rc;
   }continue;
  }
  u32 rid=divisor(word,original.degree,snapshot,&pos,l);
  if(!rid){row.normal[row.normal_n++]=id;continue;}
  row_remove(&row,id);Rule*rr=rule(rid);l->reductions++;
  if(S.pruning&&rr->n==1){l->pruned++;continue;}
  Poly g=load_rule(rid,l);if(l->error)return l->error;
  if(pc(g,0)!=2)return HEAP_MISS; // non-unit leading coefficients use exact pseudo-division
  u32 nr=original.degree-pos-g.degree;Word left=part(word,original.degree,0,pos),right=part(word,original.degree,pos+g.degree,nr);Term*gt=PTR(Term,g.off);
  for(u32 j=1;j<g.n;j++){
   Coef c=pc(g,j);if(c&1)return HEAP_MISS;i64 v=cvalue(c),delta;
   if(S.modulus)delta=-(i64)((u64)coefficient*(u64)v%S.modulus);
   else {u64 x=coefficient<0?(u64)(-coefficient):(u64)coefficient,y=v<0?(u64)(-v):(u64)v;
    if(y&&x>(u64)SMALL_MAX/y)return HEAP_MISS;
    delta= -coefficient*v;
   }
   int rc=row_add(&row,context(left,gt[j].w,g.degree,right,nr,original.degree,a),delta);if(rc)return rc;
  }
 }
 // Commit locally only after the entire fast reduction has succeeded.
 Arena*out=&l->a[active];reset_a(out);u64 off=alloc_a(out,(u64)row.normal_n*sizeof(Term));if(out->error)return GN_SCRATCH;
 Term*t=PTR(Term,off);
 for(u32 i=0;i<row.normal_n;i++){HNode*n=&row.nodes[row.normal[i]-1];t[i]=(Term){n->w,csmall(n->c)};}
 l->result=(Poly){off,row.normal_n,original.degree,0};l->active=active;return normalise(&l->result,out);
}
static int heap_nf(Lane*l,Poly p,u32 active,u32 snapshot){
 u32 cap=128;while(cap<(u64)p.n*2&&cap<(1u<<26))cap*=2;
 if(l->resume_tier==1)cap=l->resume_capacity;
 for(;;){int rc=heap_nf_try(l,p,active,snapshot,cap);if(rc!=GN_YIELD)l->resume_tier=0;if(rc!=HEAP_FULL)return rc;
  if(cap>(1u<<25)||(u64)cap*2*(48+(S.radix_enabled?4:0))>l->a[active^1].end-l->a[active^1].base)return HEAP_MISS;cap*=2;}
}
