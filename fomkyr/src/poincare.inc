/* SPDX-License-Identifier: MIT
 * Anick chain counts = bigraded Betti numbers of the associated MONOMIAL
 * algebra, not of the original algebra. The finite tail graph is constructed
 * from the minimal leading-word antichain, then counted with exact limbs.
 * No chains/normal words are enumerated; no coefficient-field arithmetic.
 */
typedef struct {Word w;u64 edges;u32 degree,next,distance,ac;} PbTail;
typedef struct {u64 next;u32 target,pad;} PbLink;
typedef struct {Arena a;u64 tails,buckets;u32 mask,used,max;} PbWords;
static u64 pb_hash(Word w,u32 d){
 if(!wlong(w))return mix(w.lo^mix(w.hi+((u64)d<<32)));
 u64 h=UINT64_C(1469598103934665603);for(u32 j=0;j<d;j++){h^=letter(w,d,j);h*=UINT64_C(1099511628211);}return mix(h^d);
}
static u32 pb_tail(PbWords*p,Word w,u32 d){
 u32 h=(u32)pb_hash(w,d)&p->mask,node=PTR(u32,p->buckets)[h];PbTail*t=PTR(PbTail,p->tails);
 while(node){u32 i=node-1;if(t[i].degree==d&&weq(t[i].w,w))return i;node=t[i].next;}
 if(p->used>=p->max){p->a.error=GN_LIMIT;return UINT32_MAX;}u32 i=p->used++;
 t[i]=(PbTail){w,0,d,PTR(u32,p->buckets)[h],UINT32_MAX,0};PTR(u32,p->buckets)[h]=i+1;return i;
}
static u64 pb_alloc(Arena*a,u64 count,u64 size){if(count&&size>(a->end-a->pos)/count){a->error=GN_MEMORY;return 0;}u64 at=alloc_a(a,count*size);if(at&&!gn_host_ensure(a->pos)){a->error=GN_MEMORY;return 0;}if(at)S.allocated_peak=MAX(S.allocated_peak,a->pos);return at;}
static void pb_heap_up(u32*heap,u32*pos,PbTail*t,u32 i){
 while(i){u32 parent=(i-1)/2;if(t[heap[parent]].distance<=t[heap[i]].distance)break;u32 x=heap[i];heap[i]=heap[parent];heap[parent]=x;pos[heap[i]]=i;pos[x]=parent;i=parent;}
}
static u32 pb_heap_pop(u32*heap,u32*pos,PbTail*t,u32*n){
 u32 out=heap[0];pos[out]=UINT32_MAX;--*n;if(!*n)return out;heap[0]=heap[*n];pos[heap[0]]=0;u32 i=0;
 for(;;){u32 a=i*2+1;if(a>=*n)break;u32 b=a+1;if(b<*n&&t[heap[b]].distance<t[heap[a]].distance)a=b;if(t[heap[i]].distance<=t[heap[a]].distance)break;u32 x=heap[i];heap[i]=heap[a];heap[a]=x;pos[heap[i]]=i;pos[x]=a;i=a;}return out;
}
API void gn_poincare_release(void){
 if(S.pb_end&&S.bump==S.pb_end)S.bump=S.pb_base;
 S.pb_offset=S.pb_end=S.pb_base=S.pb_bytes=S.pb_edges=0;
 S.pb_degree=S.pb_limbs=S.pb_states=S.pb_obstructions=S.pb_generators=0;
}
API u32 gn_poincare_limbs(void){return S.pb_limbs;}
API u32 gn_poincare_limb(u32 p,u32 d,u32 limb){
 if(!S.pb_offset||p>S.pb_degree||d>S.pb_degree||limb>=S.pb_limbs)return 0;
 return PTR(u32,S.pb_offset)[(((u64)p*(S.pb_degree+1u)+d)*S.pb_limbs)+limb];
}
API u64 gn_poincare_stat(u32 key){switch(key){case 0:return S.pb_states;case 1:return S.pb_edges;case 2:return S.pb_obstructions;case 3:return S.pb_generators;case 4:return S.pb_bytes;default:return 0;}}
typedef struct {u64 tails;u32 states,nletters,letters[16];} PbGraph;
static int pb_compute(u32 D,u64 extra_budget,PbGraph*graph){
 if(S.input_expected||S.current||GN_LOAD(&S.batch_running)||reserve_pool_busy())return GN_STATE;
 if(D>GN_INDEX_MAX||(D>S.completed&&(u64)S.completed<gn_completion_bound()))return GN_STATE;
 if(cancelled())return GN_CANCELLED;
 gn_poincare_release();u64 saved=S.bump;u32 saved_error=S.error;int rc=0;u64 polls=0;
 u64 limit=MIN(extra_budget,S.budget-S.bump),rows=(u64)D+1;u32 bits=0;while((1u<<bits)<S.generators)bits++;
 /* A fixed-p Anick chain has a unique word; c[p,d] <= generators^d. */
 u32 limbs=(u32)(((u64)D*bits+1+31)/32);if(!limbs)limbs=1;
 u64 stride=4*(u64)limbs;
 if(rows>limit/stride||rows>limit/(rows*stride))return GN_MEMORY;
 u64 countbytes=rows*rows*stride;if(A8(countbytes)>limit)return GN_MEMORY;
 u64 counts=alloc_p(A8(countbytes));if(!counts){S.bump=saved;S.error=saved_error;return GN_MEMORY;}memset(PTR(u8,counts),0,(size_t)countbytes);
 u64 outputs_end=S.bump;
 PbWords work={0};work.a=(Arena){outputs_end,outputs_end,saved+limit,outputs_end,0};Arena*a=&work.a;
 u64 maxnodes=1,maxstates=S.generators;
 for(u32 i=1;i<=S.nrules;i++){Rule*r=rule(i);if(r->degree<=D){maxnodes+=r->degree;if(r->degree>1)maxstates+=r->degree-1;}}
 if(maxnodes>UINT32_MAX||maxstates>=UINT32_MAX){rc=GN_MEMORY;goto done;}
 u32 ng=S.generators,nmax=(u32)maxnodes;
 u64 tr_off=pb_alloc(a,maxnodes,4*(u64)ng),fail_off=pb_alloc(a,maxnodes,4),term_off=pb_alloc(a,maxnodes,4),min_off=pb_alloc(a,maxnodes,4),out_off=pb_alloc(a,maxnodes,4),queue_off=pb_alloc(a,maxnodes,4),ext_off=pb_alloc(a,maxnodes,8),minimal_off=pb_alloc(a,(u64)S.nrules+1,4);
 if(a->error){rc=a->error;goto done;}
 u32*tr=PTR(u32,tr_off),*fail=PTR(u32,fail_off),*terminal=PTR(u32,term_off),*minimum=PTR(u32,min_off),*out=PTR(u32,out_off),*queue=PTR(u32,queue_off),*minimal=PTR(u32,minimal_off);u64*extensions=PTR(u64,ext_off);
 memset(tr,0,(size_t)maxnodes*ng*4);memset(fail,0,(size_t)maxnodes*4);memset(terminal,0,(size_t)maxnodes*4);memset(out,0,(size_t)maxnodes*4);memset(extensions,0,(size_t)maxnodes*8);memset(minimal,0,((size_t)S.nrules+1)*4);for(u32 i=0;i<nmax;i++)minimum[i]=UINT32_MAX;
 u32 used=1;
 for(u32 i=1;i<=S.nrules;i++){
  Rule*r=rule(i);if(r->degree>D)continue;u32 q=0;
  for(u32 j=0;j<r->degree;j++){if(!(++polls&4095)&&cancelled()){rc=GN_CANCELLED;goto done;}u32 c=letter(r->lm,r->degree,j),*slot=&tr[(u64)q*ng+c];if(!*slot)*slot=used++;q=*slot;}
  if(!terminal[q])terminal[q]=i;minimum[q]=MIN(minimum[q],r->degree);
 }
 u32 head=0,tail=0;for(u32 c=0;c<ng;c++)if(tr[c])queue[tail++]=tr[c];
 while(head<tail){u32 v=queue[head++];minimum[v]=MIN(minimum[v],minimum[fail[v]]);for(u32 c=0;c<ng;c++){u32*slot=&tr[(u64)v*ng+c],f=tr[(u64)fail[v]*ng+c];if(*slot){fail[*slot]=f;queue[tail++]=*slot;}else *slot=f;}if(!(++polls&4095)&&cancelled()){rc=GN_CANCELLED;goto done;}}
 u32 nobstructions=0,linear=0;
 for(u32 i=1;i<=S.nrules;i++){
  Rule*r=rule(i);if(r->degree>D)continue;u32 q=0,proper=0;
  for(u32 j=0;j<r->degree;j++){q=tr[(u64)q*ng+letter(r->lm,r->degree,j)];if(minimum[q]<r->degree){proper=1;break;}if(!(++polls&4095)&&cancelled()){rc=GN_CANCELLED;goto done;}}
  if(!proper&&terminal[q]==i){minimal[i]=1;if(r->degree==1)linear|=1u<<letter(r->lm,1,0);else nobstructions++;}
 }
 /* Only minimal obstructions count as occurrences; remove redundant tips. */
 for(u32 j=0;j<tail;j++){u32 v=queue[j];out[v]=MIN(2u,(terminal[v]?minimal[terminal[v]]:0u)+out[fail[v]]);}
 work.max=(u32)maxstates;u64 cap=16;while(cap<maxstates*2){cap*=2;if(cap>UINT32_MAX){rc=GN_MEMORY;goto done;}}work.mask=(u32)cap-1;
 work.tails=pb_alloc(a,maxstates,sizeof(PbTail));work.buckets=pb_alloc(a,cap,4);if(a->error){rc=a->error;goto done;}memset(PTR(u32,work.buckets),0,(size_t)cap*4);
 u32 letters[16],nletters=0;
 for(u32 c=0;c<ng;c++)if(!(linear&(1u<<c))){letters[nletters++]=pb_tail(&work,(Word){c,0},1);}
 for(u32 i=1;i<=S.nrules;i++)if(minimal[i]){
  Rule*r=rule(i);u32 q=0;
  for(u32 j=1;j<r->degree;j++){
   q=tr[(u64)q*ng+letter(r->lm,r->degree,j-1)];u32 t=pb_tail(&work,part(r->lm,r->degree,j,r->degree-j),r->degree-j);if(a->error){rc=a->error;goto done;}
   u64 link=pb_alloc(a,1,sizeof(PbLink));if(!link){rc=a->error;goto done;}*PTR(PbLink,link)=(PbLink){extensions[q],t,0};extensions[q]=link;
  }
 }
 u32 ns=work.used;PbTail*t=PTR(PbTail,work.tails);
 u64 heap_off=pb_alloc(a,MAX(ns,1u),4),pos_off=pb_alloc(a,MAX(ns,1u),4),stamp_off=pb_alloc(a,MAX(ns,1u),4);if(a->error){rc=a->error;goto done;}u32*heap=PTR(u32,heap_off),*pos=PTR(u32,pos_off),*stamp=PTR(u32,stamp_off);for(u32 i=0;i<ns;i++){pos[i]=UINT32_MAX;stamp[i]=UINT32_MAX;u32 q=0;for(u32 j=0;j<t[i].degree;j++)q=tr[(u64)q*ng+letter(t[i].w,t[i].degree,j)];t[i].ac=q;}
 if(ns&&rows>(a->end-a->pos)/stride/ns/2){rc=GN_MEMORY;goto done;}u64 dpbytes=rows*ns*stride;
 u64 dp_off=pb_alloc(a,1,dpbytes),next_off=pb_alloc(a,1,dpbytes);if(a->error){rc=a->error;goto done;}u32*dp=PTR(u32,dp_off),*next=PTR(u32,next_off);memset(dp,0,(size_t)dpbytes);
 u32 hn=0;if(D)for(u32 j=0;j<nletters;j++){u32 v=letters[j];t[v].distance=1;heap[hn]=v;pos[v]=hn++;dp[((u64)ns+v)*limbs]=1;}
 u64 nedges=0;
 while(hn){
  u32 s=pb_heap_pop(heap,pos,t,&hn),q=t[s].ac;
  for(;q;q=fail[q])for(u64 e=extensions[q];e;e=PTR(PbLink,e)->next){
   if(!(++polls&1023)&&cancelled()){rc=GN_CANCELLED;goto done;}u32 v=PTR(PbLink,e)->target;if(stamp[v]==s)continue;stamp[v]=s;
   u64 nd=(u64)t[s].distance+t[v].degree;if(nd>D)continue;u32 ac=t[s].ac,noccur=0,last=0;
   for(u32 j=0;j<t[v].degree;j++){ac=tr[(u64)ac*ng+letter(t[v].w,t[v].degree,j)];last=out[ac];noccur+=last;if(noccur>1)break;}
   if(noccur!=1||!last)continue;
   u64 link=pb_alloc(a,1,sizeof(PbLink));if(!link){rc=a->error;goto done;}*PTR(PbLink,link)=(PbLink){t[s].edges,v,0};t[s].edges=link;nedges++;
   if(nd<t[v].distance){t[v].distance=(u32)nd;if(pos[v]==UINT32_MAX){pos[v]=hn;heap[hn++]=v;}pb_heap_up(heap,pos,t,pos[v]);}
  }
 }
 PTR(u32,counts)[0]=1;
 for(u32 p=1;p<=D;p++){
  memset(next,0,(size_t)dpbytes);
  for(u32 d=p;d<=D;d++)for(u32 s=0;s<ns;s++){
   if(!(++polls&4095)&&cancelled()){rc=GN_CANCELLED;goto done;}u32*value=dp+((u64)d*ns+s)*limbs,nonzero=0;for(u32 j=0;j<limbs;j++)nonzero|=value[j];if(!nonzero)continue;
   if((rc=count_add(PTR(u32,counts)+((u64)p*rows+d)*limbs,value,limbs)))goto done;
   for(u64 e=t[s].edges;e;e=PTR(PbLink,e)->next){u32 v=PTR(PbLink,e)->target;if((u64)d+t[v].degree>D)continue;if((rc=count_add(next+(((u64)d+t[v].degree)*ns+v)*limbs,value,limbs)))goto done;}
  }
  u32*swap=dp;dp=next;next=swap;
 }
 S.pb_offset=counts;S.pb_base=saved;S.pb_end=graph?a->pos:outputs_end;S.pb_degree=D;S.pb_limbs=limbs;S.pb_states=ns;S.pb_edges=nedges;S.pb_obstructions=nobstructions;S.pb_generators=nletters;S.pb_bytes=a->pos-saved;
 if(graph){graph->tails=work.tails;graph->states=ns;graph->nletters=nletters;for(u32 i=0;i<nletters;i++)graph->letters[i]=letters[i];}
 done:
 if(rc==GN_SCRATCH)rc=GN_MEMORY;
 S.bump=rc?saved:S.pb_end;S.error=saved_error;return rc;
}

API int gn_poincare(u32 D,u64 extra_budget){return pb_compute(D,extra_budget,NULL);}
