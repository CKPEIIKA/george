/* SPDX-License-Identifier: MIT
 * Optional wide (256-bit magnitude) sparse-heap tier. Used only after the
 * compact heap has declined a Q row. Exact checked arithmetic, no per-update
 * coefficient allocations, and no change to the general arbitrary-precision
 * fallback. Not a modular algorithm and not a coefficient bit limit.
 */
typedef struct {u32 v[8];int sign;} WCoef;
static u32 wn(WCoef a){u32 n=8;while(n&&!a.v[n-1])--n;return n;}
static int wload(Coef c,WCoef*out){u32 n=cn(c);if(n>8)return 0;memset(out,0,sizeof(*out));out->sign=csign(c);for(u32 i=0;i<n;i++)out->v[i]=cl(c,i);return 1;}
static int wmagcmp(WCoef a,WCoef b){for(u32 i=8;i;i--)if(a.v[i-1]!=b.v[i-1])return a.v[i-1]>b.v[i-1]?1:-1;return 0;}
static int wadd(WCoef a,WCoef b,WCoef*out){
 if(!a.sign){*out=b;return 1;}if(!b.sign){*out=a;return 1;}
 WCoef c={{0},a.sign};
 if(a.sign==b.sign){u64 carry=0;for(u32 i=0;i<8;i++){u64 t=(u64)a.v[i]+b.v[i]+carry;c.v[i]=(u32)t;carry=t>>32;}if(carry)return 0;}
 else{int cmp=wmagcmp(a,b);if(!cmp){memset(out,0,sizeof(*out));return 1;}if(cmp<0){WCoef t=a;a=b;b=t;c.sign=a.sign;}u64 borrow=0;for(u32 i=0;i<8;i++){u64 x=a.v[i],y=(u64)b.v[i]+borrow;c.v[i]=(u32)(x-y);borrow=x<y;}}
 *out=c;return 1;
}
static int wmul(WCoef a,WCoef b,WCoef*out){
 u32 na=wn(a),nb=wn(b),v[16]={0};if(!na||!nb){memset(out,0,sizeof(*out));return 1;}
 for(u32 i=0;i<na;i++){u64 carry=0;for(u32 j=0;j<nb;j++){u64 q=(u64)a.v[i]*b.v[j]+v[i+j]+carry;v[i+j]=(u32)q;carry=q>>32;}v[i+nb]=(u32)carry;}
 for(u32 i=8;i<16;i++)if(v[i])return 0;
 memcpy(out->v,v,sizeof(out->v));out->sign=a.sign*b.sign;return 1;
}
typedef struct { Word w; WCoef c; u32 next,pos; } WNode;
typedef struct {
 WNode *nodes; u32 *heads,*heap,*normal;
 u32 capacity,mask,used,free_head,heap_n,normal_n,degree;Lane*lane;
} WRow;
static u32 wrow_hash(Word w,u32 mask){return (u32)mix(w.lo^mix(w.hi))&mask;}
static void wheap_up(WRow*r,u32 p){
 u32 id=r->heap[p];
 while(p){u32 parent=(p-1)/2,other=r->heap[parent];if(wcmp(r->nodes[other-1].w,r->nodes[id-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=parent;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void wheap_down(WRow*r,u32 p){
 u32 id=r->heap[p];
 while(2*p+1<r->heap_n){u32 child=2*p+1;if(child+1<r->heap_n&&wcmp(r->nodes[r->heap[child+1]-1].w,r->nodes[r->heap[child]-1].w)>0)child++;
  u32 other=r->heap[child];if(wcmp(r->nodes[id-1].w,r->nodes[other-1].w)>=0)break;r->heap[p]=other;r->nodes[other-1].pos=p+1;p=child;}
 r->heap[p]=id;r->nodes[id-1].pos=p+1;
}
static void wheap_remove(WRow*r,u32 id){
 u32 p=r->nodes[id-1].pos-1,last=r->heap[--r->heap_n];r->nodes[id-1].pos=0;
 if(p==r->heap_n)return;r->heap[p]=last;r->nodes[last-1].pos=p+1;
 if(p&&wcmp(r->nodes[last-1].w,r->nodes[r->heap[(p-1)/2]-1].w)>0)wheap_up(r,p);else wheap_down(r,p);
}
static void wrow_remove(WRow*r,u32 id){
 WNode*n=&r->nodes[id-1];u32 h=wrow_hash(n->w,r->mask),*link=&r->heads[h];
 while(*link!=id)link=&r->nodes[*link-1].next;
 *link=n->next;n->pos=UINT32_MAX;n->next=r->free_head;r->free_head=id;
}
static int wrow_add(WRow*r,Word w,WCoef delta){
 if(!delta.sign)return 0;
 // Canonical export retains its own leader. Preconditioning must not erase it
 // before the ordinary divisor lookup has a chance to skip that one rule.
 u32 skip=r->lane->skip_rule;int protected_leader=skip&&r->degree==rule(skip)->degree&&weq(w,rule(skip)->lm);
 if(!protected_leader){if(eager_zero(w,r->degree,r->lane))return 0;}
 u32 h=wrow_hash(w,r->mask),id=r->heads[h];
 while(id&&!weq(r->nodes[id-1].w,w))id=r->nodes[id-1].next;
 if(id){WNode*n=&r->nodes[id-1];if(!n->pos)return HEAP_MISS; // a triangularity invariant
  WCoef c;if(!wadd(n->c,delta,&c))return HEAP_MISS;
  if(c.sign)n->c=c;else{wheap_remove(r,id);wrow_remove(r,id);}return 0;
 }
 if(r->free_head){id=r->free_head;r->free_head=r->nodes[id-1].next;}
 else{if(r->used==r->capacity)return HEAP_FULL;id=++r->used;}
 r->nodes[id-1]=(WNode){w,delta,r->heads[h],r->heap_n+1};r->heads[h]=id;r->heap[r->heap_n++]=id;wheap_up(r,r->heap_n-1);return 0;
}
static int wide_nf_try(Lane*l,Poly original,u32 active,u32 snapshot,u32 capacity){
 Arena*a=&l->a[active^1];reset_a(a);
 u64 no=alloc_a(a,(u64)capacity*sizeof(WNode)),ho=alloc_a(a,(u64)capacity*2*sizeof(u32)),po=alloc_a(a,(u64)capacity*sizeof(u32)),oo=alloc_a(a,(u64)capacity*sizeof(u32));
 if(a->error)return HEAP_MISS;
 WRow row={PTR(WNode,no),PTR(u32,ho),PTR(u32,po),PTR(u32,oo),capacity,2*capacity-1,0,0,0,0,original.degree,l};
 memset(row.heads,0,(size_t)capacity*2*sizeof(u32));
 Term*input=PTR(Term,original.off);
 for(u32 i=0;i<original.n;i++){WCoef c;if(!wload(pc(original,i),&c))return HEAP_MISS;int rc=wrow_add(&row,input[i].w,c);if(rc)return rc;}
 u64 steps=0;
 while(row.heap_n){
  if((steps++&255)==0){publish_lane(l,(u64)row.heap_n+row.normal_n,0);if(cancelled())return GN_CANCELLED;}
  u32 id=row.heap[0];WNode*node=&row.nodes[id-1];Word word=node->w;WCoef coefficient=node->c;wheap_remove(&row,id);
  u32 pos=0,rid=divisor(word,original.degree,snapshot,&pos,l);
  if(!rid){row.normal[row.normal_n++]=id;continue;}
  wrow_remove(&row,id);Rule*rr=rule(rid);l->reductions++;
  if(S.pruning&&rr->n==1){l->pruned++;continue;}
  Poly g=load_rule(rid,l);if(l->error)return l->error;
  if(pc(g,0)!=2)return HEAP_MISS; // non-unit leading coefficients use exact pseudo-division
  u32 nr=original.degree-pos-g.degree;Word left=part(word,original.degree,0,pos),right=part(word,original.degree,pos+g.degree,nr);Term*gt=PTR(Term,g.off);
  for(u32 j=1;j<g.n;j++){
   WCoef v,delta;if(!wload(pc(g,j),&v)||!wmul(coefficient,v,&delta))return HEAP_MISS;delta.sign=-delta.sign;
   int rc=wrow_add(&row,context(left,gt[j].w,g.degree,right,nr,original.degree,a),delta);if(rc)return rc;
  }
 }
 // Commit locally only after the entire fast reduction has succeeded.
 Arena*out=&l->a[active];reset_a(out);u64 off=alloc_a(out,(u64)row.normal_n*sizeof(Term));if(out->error)return GN_SCRATCH;
 Term*t=PTR(Term,off);
 for(u32 i=0;i<row.normal_n;i++){WNode*n=&row.nodes[row.normal[i]-1];t[i]=(Term){n->w,makec(out,n->c.v,wn(n->c),n->c.sign)};}
 l->result=(Poly){off,row.normal_n,original.degree,0};l->active=active;return normalise(&l->result,out);
}
static int wide_nf(Lane*l,Poly p,u32 active,u32 snapshot){
 u32 cap=128;while(cap<(u64)p.n*2&&cap<(1u<<26))cap*=2;
 if(S.modulus)return HEAP_MISS;
 for(;;){int rc=wide_nf_try(l,p,active,snapshot,cap);if(rc!=HEAP_FULL)return rc;
  if(cap>(1u<<25)||(u64)cap*2*(sizeof(WNode)+16)>l->a[active^1].end-l->a[active^1].base)return HEAP_MISS;cap*=2;}
}
