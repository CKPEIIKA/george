/* SPDX-License-Identifier: MIT
 * Compact exact rational sparse-heap tier. Only entered after the immediate
 * integer heap declines a Q row. Fractions are reduced, checked and bounded;
 * any arithmetic overflow falls back to the original unbounded integer NF.
 * The row is converted to primitive integer form ONCE, after reduction.
 */
typedef struct {i64 n;u64 d;} RCoef;
static u64 rgcd(u64 a,u64 b){if(a==1||b==1)return 1;while(b){u64 q=a%b;a=b;b=q;}return a;}
static u64 rabs(i64 n){return n<0?(u64)-n:(u64)n;}
static int rload(Coef c,RCoef*out){if(c&1)return 0;*out=(RCoef){cvalue(c),1};return 1;}
static int rmulint(i64 a,u64 b,i64*out){if(b&&rabs(a)>(u64)SMALL_MAX/b)return 0;*out=a*(i64)b;return 1;}
static int radd(RCoef a,RCoef b,RCoef*out){
 if(!a.n){*out=b;return 1;}if(!b.n){*out=a;return 1;}
 if(a.d==b.d){if((b.n>0&&a.n>SMALL_MAX-b.n)||(b.n<0&&a.n< -SMALL_MAX-b.n))return 0;
  i64 n=a.n+b.n;if(!n){*out=(RCoef){0,1};return 1;}u64 g=rgcd(rabs(n),a.d);*out=(RCoef){n/(i64)g,a.d/g};return 1;}
 u64 g=rgcd(a.d,b.d);i64 x,y;
 if(!rmulint(a.n,b.d/g,&x)||!rmulint(b.n,a.d/g,&y))return 0;
 if((y>0&&x>SMALL_MAX-y)||(y<0&&x< -SMALL_MAX-y))return 0;
 i64 n=x+y;if(!n){*out=(RCoef){0,1};return 1;}u64 h=rgcd(rabs(n),g),d=a.d/g,v=b.d/h;
 if(v&&d>(u64)SMALL_MAX/v)return 0;*out=(RCoef){n/(i64)h,d*v};return 1;
}
static int rmul(RCoef a,RCoef b,RCoef*out){
 if(!a.n||!b.n){*out=(RCoef){0,1};return 1;}
 if(a.d==1&&(a.n==1||a.n==-1)){*out=(RCoef){a.n*b.n,b.d};return 1;}
 if(b.d==1&&(b.n==1||b.n==-1)){*out=(RCoef){b.n*a.n,a.d};return 1;}
 u64 g=rgcd(rabs(a.n),b.d),h=rgcd(rabs(b.n),a.d),an=rabs(a.n)/g,bn=rabs(b.n)/h,ad=a.d/h,bd=b.d/g;
 if(an>(u64)SMALL_MAX/bn||ad>(u64)SMALL_MAX/bd)return 0;
 *out=(RCoef){(a.n<0)!=(b.n<0)?-(i64)(an*bn):(i64)(an*bn),ad*bd};return 1;
}
typedef struct { Word w; RCoef c; u32 next,pos; } RNode;
typedef struct {
 RNode *nodes; u32 *heads,*heap,*normal;
 u32 capacity,mask,used,free_head,heap_n,normal_n,degree;Lane*lane;
} RRow;
static u32 rrow_hash(Word w,u32 mask){return (u32)mix(w.lo^mix(w.hi))&mask;}
static void rheap_up(RRow*r,u32 p){
 u32 id=r->heap[p];
 while(p){u32 parent=(p-1)/2,other=r->heap[parent];if(wcmp(r->nodes[other-1].w,r->nodes[id-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=parent;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void rheap_down(RRow*r,u32 p){
 u32 id=r->heap[p];
 while(2*p+1<r->heap_n){u32 child=2*p+1;if(child+1<r->heap_n&&wcmp(r->nodes[r->heap[child+1]-1].w,r->nodes[r->heap[child]-1].w)>0)child++;
  u32 other=r->heap[child];if(wcmp(r->nodes[id-1].w,r->nodes[other-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=child;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void rheap_remove(RRow*r,u32 id){
 u32 p=r->nodes[id-1].pos-1,last=r->heap[--r->heap_n];r->nodes[id-1].pos=0;
 if(p==r->heap_n)return;r->heap[p]=last;r->nodes[last-1].pos=p+1;
 if(p&&wcmp(r->nodes[last-1].w,r->nodes[r->heap[(p-1)/2]-1].w)>0)rheap_up(r,p);else rheap_down(r,p);
}
static void rrow_remove(RRow*r,u32 id){
 RNode*n=&r->nodes[id-1];u32 h=rrow_hash(n->w,r->mask),*link=&r->heads[h];
 while(*link!=id)link=&r->nodes[*link-1].next;
 *link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;
}
static int rrow_add(RRow*r,Word w,RCoef delta){
 if(!delta.n)return 0;
 // Canonical export retains its own leader. Preconditioning must not erase it
 // before the ordinary divisor lookup has a chance to skip that one rule.
 u32 skip=r->lane->skip_rule;int protected_leader=skip&&r->degree==rule(skip)->degree&&weq(w,rule(skip)->lm);
 if(!protected_leader){if(eager_zero(w,r->degree,r->lane))return 0;}
 u32 h=rrow_hash(w,r->mask),id=r->heads[h];
 while(id&&!weq(r->nodes[id-1].w,w))id=r->nodes[id-1].next;
 if(id){RNode*n=&r->nodes[id-1];if(!n->pos)return HEAP_MISS; // a triangularity invariant
  RCoef c;if(!radd(n->c,delta,&c))return HEAP_MISS;
  if(c.n)n->c=c;else{rheap_remove(r,id);rrow_remove(r,id);}return 0;
 }
 if(r->free_head){id=r->free_head;r->free_head=r->nodes[id-1].next;}
 else{if(r->used==r->capacity)return HEAP_FULL;id=++r->used;}
 r->nodes[id-1]=(RNode){w,delta,r->heads[h],r->heap_n+1};r->heads[h]=id;r->heap[r->heap_n++]=id;rheap_up(r,r->heap_n-1);return 0;
}
static int rational_nf_try(Lane*l,Poly original,u32 active,u32 snapshot,u32 capacity){
 Arena*a=&l->a[active^1];reset_a(a);
 u64 no=alloc_a(a,(u64)capacity*sizeof(RNode)),ho=alloc_a(a,(u64)capacity*2*sizeof(u32)),po=alloc_a(a,(u64)capacity*sizeof(u32)),oo=alloc_a(a,(u64)capacity*sizeof(u32));
 if(a->error)return HEAP_MISS;
 RRow row={PTR(RNode,no),PTR(u32,ho),PTR(u32,po),PTR(u32,oo),capacity,2*capacity-1,0,0,0,0,original.degree,l};
 memset(row.heads,0,(size_t)capacity*2*sizeof(u32));
 Term*input=PTR(Term,original.off);
 for(u32 i=0;i<original.n;i++){RCoef c;if(!rload(pc(original,i),&c))return HEAP_MISS;int rc=rrow_add(&row,input[i].w,c);if(rc)return rc;}
 u64 steps=0;
 while(row.heap_n){
  if((steps++&255)==0){publish_lane(l,(u64)row.heap_n+row.normal_n,0);if(cancelled())return GN_CANCELLED;}
  u32 id=row.heap[0];RNode*node=&row.nodes[id-1];Word word=node->w;RCoef coefficient=node->c;rheap_remove(&row,id);
  u32 pos=0,rid=divisor(word,original.degree,snapshot,&pos,l);
  if(!rid){row.normal[row.normal_n++]=id;continue;}
  rrow_remove(&row,id);Rule*rr=rule(rid);l->reductions++;
  if(S.pruning&&rr->n==1){l->pruned++;continue;}
  Poly g=load_rule(rid,l);if(l->error)return l->error;
  RCoef lead;if(!rload(pc(g,0),&lead)||!lead.n)return HEAP_MISS;
  u32 nr=original.degree-pos-g.degree;Word left=part(word,original.degree,0,pos),right=part(word,original.degree,pos+g.degree,nr);Term*gt=PTR(Term,g.off);
  for(u32 j=1;j<g.n;j++){
   RCoef v,delta;if(!rload(pc(g,j),&v))return HEAP_MISS;u64 common=rgcd(rabs(v.n),rabs(lead.n));v.n=v.n/(i64)common*(lead.n<0?-1:1);v.d=rabs(lead.n)/common;if(!rmul(coefficient,v,&delta))return HEAP_MISS;delta.n=-delta.n;
   int rc=rrow_add(&row,context(left,gt[j].w,g.degree,right,nr,original.degree,a),delta);if(rc)return rc;
  }
 }
 // Commit locally only after the entire fast reduction has succeeded.
 Arena*out=&l->a[active];reset_a(out);u64 off=alloc_a(out,(u64)row.normal_n*sizeof(Term));if(out->error)return GN_SCRATCH;
 Term*t=PTR(Term,off);Coef denominator=2;
 for(u32 i=0;i<row.normal_n;i++){RNode*n=&row.nodes[row.normal[i]-1];Coef d=csmall((i64)n->c.d),g=gcdc(out,denominator,d);denominator=mulc(out,exactdiv(out,denominator,g),d);if(out->error)return GN_SCRATCH;}
 for(u32 i=0;i<row.normal_n;i++){RNode*n=&row.nodes[row.normal[i]-1];Coef c=mulc(out,csmall(n->c.n),exactdiv(out,denominator,csmall((i64)n->c.d)));t[i]=(Term){n->w,c};if(out->error)return GN_SCRATCH;}
 l->result=(Poly){off,row.normal_n,original.degree,0};l->active=active;return normalise(&l->result,out);
}
static int rational_nf(Lane*l,Poly p,u32 active,u32 snapshot){
 u32 cap=128;while(cap<(u64)p.n*2&&cap<(1u<<26))cap*=2;
 if(S.modulus)return HEAP_MISS;
 for(;;){int rc=rational_nf_try(l,p,active,snapshot,cap);if(rc!=HEAP_FULL)return rc;
  if(cap>(1u<<25)||(u64)cap*2*(sizeof(RNode)+16)>l->a[active^1].end-l->a[active^1].base)return HEAP_MISS;cap*=2;}
}
