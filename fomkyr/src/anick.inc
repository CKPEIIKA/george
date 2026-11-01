/* SPDX-License-Identifier: MIT
 * Independent implementation of the right Anick resolution for connected,
 * unit-graded algebras. Differential and lift are built by decreasing-word
 * induction, using a certified leading-obstruction graph. See docs/ANICK.md.
 * No FK-specific presentation, homology assumption, or machine-size rational.
 */
typedef struct {Word w;BCoef c;u32 chain,d;} AnTerm;
typedef struct {AnTerm t;u64 next;} AnNode;
typedef struct {Word w;u64 diff;u32 p,d,parent,tail,state,n,first,next;} AnChain;
typedef struct {Arena store,temp;AnChain*c;u32 n,D;u64 steps,terms;Lane*lane;} AnWork;
static BCoef an_one(void){return(BCoef){2,2};}
static BCoef an_neg(BCoef a){a.n=negf(a.n);return a;}
static BCoef an_addc(Arena*a,BCoef x,BCoef y){return S.modulus?(BCoef){addf(a,x.n,y.n),2}:badd(a,x,y);}
static BCoef an_mulc(Arena*a,BCoef x,BCoef y){return S.modulus?(BCoef){mulf(a,x.n,y.n),2}:bmul(a,x,y);}
static BCoef an_divc(Arena*a,BCoef x,BCoef y){
 if(!y.n){a->error=GN_CORRUPT;return(BCoef){0,2};}
 if(S.modulus)return(BCoef){mulf(a,x.n,csmall(fpow((u32)cvalue(y.n),S.modulus-2))),2};
 BCoef inverse=bmake(a,y.d,y.n);return bmul(a,x,inverse);
}
static int an_poll(AnWork*a){if(!(++a->steps&255)&&cancelled())a->temp.error=GN_CANCELLED;return a->temp.error||a->store.error;}
static u32 an_total(AnWork*a,AnTerm x){return a->c[x.chain].d+x.d;}
static u8 an_letter(AnWork*a,AnTerm x,u32 i){AnChain*c=&a->c[x.chain];return i<c->d?letter(c->w,c->d,i):letter(x.w,x.d,i-c->d);}
static int an_compare(AnWork*a,AnTerm x,AnTerm y){
 u32 n=an_total(a,x),m=an_total(a,y);if(n!=m)return n>m?1:-1;
 for(u32 i=0;i<n;i++){u32 u=an_letter(a,x,i),v=an_letter(a,y,i);if(u!=v)return u>v?1:-1;}
 if(x.chain!=y.chain){a->temp.error=GN_CORRUPT;return x.chain>y.chain?1:-1;}return 0;
}
static int an_prefix(Word x,u32 nx,Word y,u32 ny){if(nx>ny)return 0;for(u32 i=0;i<nx;i++)if(letter(x,nx,i)!=letter(y,ny,i))return 0;return 1;}
static void an_put(AnWork*a,u64*head,AnTerm x){
 if(!x.c.n||an_poll(a))return;
 while(*head){AnNode*q=PTR(AnNode,*head);int cmp=an_compare(a,x,q->t);
  if(cmp>0)break;if(!cmp){q->t.c=an_addc(&a->temp,q->t.c,x.c);if(!q->t.c.n)*head=q->next;return;}head=&q->next;
 }
 u64 off=alloc_a(&a->temp,sizeof(AnNode));if(!off)return;
 x.w=clonew(&a->temp,x.w,x.d);x.c=bcoef_copy(&a->temp,x.c);*PTR(AnNode,off)=(AnNode){x,*head};*head=off;
}
static u64 an_normal(AnWork*a,u64 todo){
 u64 out=0;
 while(todo&&!an_poll(a)){
  AnTerm x=PTR(AnNode,todo)->t;todo=PTR(AnNode,todo)->next;u32 pos=0;
  u32 id=x.d?divisor(x.w,x.d,S.nrules,&pos,a->lane):0;
  if(!id){an_put(a,&out,x);continue;}
  Poly r=load_rule(id,a->lane);if(a->lane->error){a->temp.error=a->lane->error;break;}
  Word l=part(x.w,x.d,0,pos),s=part(x.w,x.d,pos+r.degree,x.d-pos-r.degree);u32 ds=x.d-pos-r.degree;
  BCoef pivot={pc(r,0),2};
  for(u32 j=1;j<r.n&&!an_poll(a);j++){
   AnTerm t=x;t.w=context(l,pw(r,j),r.degree,s,ds,x.d,&a->temp);
   t.c=an_mulc(&a->temp,x.c,an_neg(an_divc(&a->temp,(BCoef){pc(r,j),2},pivot)));an_put(a,&todo,t);
  }
 }
 return out;
}
static u64 an_image(AnWork*a,u32 chain,Word suffix,u32 degree,BCoef scale){
 AnChain*c=&a->c[chain];u64 raw=0;
 for(u32 j=0;j<c->n&&!an_poll(a);j++){
  AnTerm t=PTR(AnTerm,c->diff)[j];t.w=context((Word){0,0},t.w,t.d,suffix,degree,t.d+degree,&a->temp);t.d+=degree;
  t.c=an_mulc(&a->temp,t.c,scale);an_put(a,&raw,t);
 }
 return an_normal(a,raw);
}
static void an_accumulate(AnWork*a,u64*head,u64 row,BCoef scale){
 for(;row&&!an_poll(a);row=PTR(AnNode,row)->next){AnTerm t=PTR(AnNode,row)->t;t.c=an_mulc(&a->temp,t.c,scale);an_put(a,head,t);}
}
/* Lift a cycle in C_q tensor A. The top term uniquely extends its chain;
 * subtracting the known next differential strictly decreases the word. */
static u64 an_lift(AnWork*a,u64 cycle){
 u64 result=0;
 while(cycle&&!an_poll(a)){
  AnTerm top=PTR(AnNode,cycle)->t;AnChain*c=&a->c[top.chain];u32 child=0;
  for(u32 j=c->first;j;j=a->c[j].next){AnChain*n=&a->c[j];Word tail=part(n->w,n->d,c->d,n->tail);
   if(an_prefix(tail,n->tail,top.w,top.d)){if(child){a->temp.error=GN_CORRUPT;return 0;}child=j;}
  }
  if(!child){a->temp.error=GN_CORRUPT;return 0;}AnChain*n=&a->c[child];
  AnTerm lifted={part(top.w,top.d,n->tail,top.d-n->tail),top.c,child,top.d-n->tail};an_put(a,&result,lifted);
  u64 correction=an_image(a,child,lifted.w,lifted.d,top.c);an_accumulate(a,&cycle,correction,an_neg(an_one()));
  if(cycle&&an_compare(a,PTR(AnNode,cycle)->t,top)>=0){a->temp.error=GN_CORRUPT;return 0;}
 }
 return result;
}
static u64 an_freeze(AnWork*a,u64 row,u32*n){
 *n=0;for(u64 q=row;q;q=PTR(AnNode,q)->next)(*n)++;
 u64 out=pb_alloc(&a->store,*n,sizeof(AnTerm));if(!out)return 0;u32 i=0;
 for(;row;row=PTR(AnNode,row)->next){AnTerm t=PTR(AnNode,row)->t;t.w=clonew(&a->store,t.w,t.d);t.c=bcoef_copy(&a->store,t.c);PTR(AnTerm,out)[i++]=t;}return out;
}
API void gn_anick_release(void){
 if(S.an_end&&S.bump==S.an_end)S.bump=S.an_base;
 S.an_base=S.an_end=S.an_chains=S.an_counts=S.an_ranks=S.an_terms=S.an_steps=0;S.an_n=S.an_degree=0;gn_poincare_release();
}
API u64 gn_anick_stat(u32 key){switch(key){case 0:return S.an_n;case 1:return S.an_terms;case 2:return S.an_steps;case 3:return S.an_end-S.an_base;case 4:return S.an_degree;default:return 0;}}
API u32 gn_anick_count(u32 p,u32 d){return S.an_counts&&p<=S.an_degree&&d<=S.an_degree?PTR(u32,S.an_counts)[(u64)p*(S.an_degree+1u)+d]:0;}
API u32 gn_anick_rank(u32 p,u32 d){return S.an_ranks&&p<=S.an_degree&&d<=S.an_degree?PTR(u32,S.an_ranks)[(u64)p*(S.an_degree+1u)+d]:0;}
API u32 gn_anick_chain_stat(u32 id,u32 key){if(id>=S.an_n)return 0;AnChain*c=&PTR(AnChain,S.an_chains)[id];switch(key){case 0:return c->p;case 1:return c->d;case 2:return c->n;case 3:return c->parent;default:return 0;}}
API u32 gn_anick_chain_letter(u32 id,u32 pos){if(id>=S.an_n)return UINT32_MAX;AnChain*c=&PTR(AnChain,S.an_chains)[id];return pos<c->d?letter(c->w,c->d,pos):UINT32_MAX;}
static AnTerm*an_term(u32 id,u32 j){if(id>=S.an_n)return NULL;AnChain*c=&PTR(AnChain,S.an_chains)[id];return j<c->n?&PTR(AnTerm,c->diff)[j]:NULL;}
API u32 gn_anick_term_stat(u32 id,u32 j,u32 key){AnTerm*t=an_term(id,j);if(!t)return 0;switch(key){case 0:return t->chain;case 1:return t->d;case 2:return cn(t->c.n);case 3:return cn(t->c.d);case 4:return csign(t->c.n)<0;default:return 0;}}
API u32 gn_anick_term_letter(u32 id,u32 j,u32 pos){AnTerm*t=an_term(id,j);return t&&pos<t->d?letter(t->w,t->d,pos):UINT32_MAX;}
API u32 gn_anick_term_limb(u32 id,u32 j,u32 denominator,u32 limb){AnTerm*t=an_term(id,j);if(!t)return 0;Coef c=denominator?t->c.d:t->c.n;return limb<cn(c)?cl(c,limb):0;}
API int gn_anick(u32 D,u64 extra_budget){
 if(S.input_expected||S.current||GN_LOAD(&S.batch_running)||reserve_pool_busy())return GN_STATE;
 if(D>GN_INDEX_MAX||(D>S.completed&&(u64)S.completed<gn_completion_bound()))return GN_STATE;
 if(cancelled())return GN_CANCELLED;
 gn_anick_release();gn_poincare_release();int rc=matcher_build();if(rc)return rc;
 Lane*l=&S.lanes[0];rc=ensure_rule_io(l,S.largest_rule_bytes);if(rc)return rc;l->skip_rule=l->delta_floor=l->error=0;
 u64 base=S.bump,limit=MIN(extra_budget,S.budget-base);u32 saved_error=S.error;PbGraph graph={0};
 rc=pb_compute(D,limit,&graph);if(rc)return rc;
 u64 n=0;for(u32 p=0;p<=D;p++)for(u32 d=0;d<=D;d++){
  for(u32 j=1;j<S.pb_limbs;j++)if(gn_poincare_limb(p,d,j)){rc=GN_MEMORY;goto failed;}
  n+=gn_poincare_limb(p,d,0);if(n>=UINT32_MAX){rc=GN_MEMORY;goto failed;}
 }
 if(S.bump-base>limit){rc=GN_MEMORY;goto failed;}u64 available=limit-(S.bump-base),half=A8(available/2);if(half>available)half-=8;
 if(n>half/sizeof(AnChain)||!gn_host_ensure(base+limit)){rc=GN_MEMORY;goto failed;}
 AnWork a={0};a.D=D;a.n=(u32)n;a.lane=l;
 a.store=(Arena){S.bump,S.bump,S.bump+half,S.bump,0};a.temp=(Arena){S.bump+half,S.bump+half,base+limit,S.bump+half,0};
 u64 chainoff=pb_alloc(&a.store,n,sizeof(AnChain)),side=(u64)D+1;
 u64 counts=pb_alloc(&a.store,side,side*4),ranks=pb_alloc(&a.store,side,side*4);
 if(a.store.error){rc=GN_MEMORY;goto failed;}
 a.c=PTR(AnChain,chainoff);memset(a.c,0,(size_t)n*sizeof(AnChain));memset(PTR(u8,counts),0,(size_t)side*side*4);memset(PTR(u8,ranks),0,(size_t)side*side*4);
 for(u32 p=0;p<=D;p++)for(u32 d=0;d<=D;d++)PTR(u32,counts)[(u64)p*side+d]=gn_poincare_limb(p,d,0);
 u32 used=1;
 if(D)for(u32 j=0;j<graph.nletters;j++){
  u32 state=graph.letters[j];PbTail*t=&PTR(PbTail,graph.tails)[state];AnChain*c=&a.c[used];c->w=t->w;c->p=c->d=c->tail=1;c->state=state;c->next=a.c[0].first;a.c[0].first=used++;
 }
 for(u32 id=1;id<used;id++){
  if(an_poll(&a)){rc=a.temp.error?a.temp.error:a.store.error;goto failed;}
  AnChain*c=&a.c[id];PbTail*t=&PTR(PbTail,graph.tails)[c->state];
  for(u64 e=t->edges;e;e=PTR(PbLink,e)->next){u32 state=PTR(PbLink,e)->target;PbTail*v=&PTR(PbTail,graph.tails)[state];if((u64)c->d+v->degree>D)continue;
   if(used>=n){rc=GN_CORRUPT;goto failed;}AnChain*child=&a.c[used];child->w=context(c->w,v->w,v->degree,(Word){0,0},0,c->d+v->degree,&a.store);child->p=c->p+1;child->d=c->d+v->degree;child->tail=v->degree;child->parent=id;child->state=state;child->next=c->first;c->first=used++;
   if(a.store.error){rc=GN_MEMORY;goto failed;}
  }
 }
 if(used!=n){rc=GN_CORRUPT;goto failed;}
 for(u32 id=1;id<used;id++){
  reset_a(&a.temp);AnChain*c=&a.c[id];AnChain*parent=&a.c[c->parent];Word tail=part(c->w,c->d,parent->d,c->tail);u64 row=0;
  an_put(&a,&row,(AnTerm){tail,an_one(),c->parent,c->tail});
  if(c->p>1){u64 cycle=an_image(&a,c->parent,tail,c->tail,an_one());u64 lift=an_lift(&a,cycle);an_accumulate(&a,&row,lift,an_neg(an_one()));}
  if(a.temp.error||a.store.error){rc=a.temp.error?a.temp.error:a.store.error;goto failed;}
  c->diff=an_freeze(&a,row,&c->n);a.terms+=c->n;
  if(a.store.error){rc=a.store.error;goto failed;}
  reset_a(&a.temp);u64 square=0;
  if(c->p>1)for(u32 j=0;j<c->n&&!an_poll(&a);j++){AnTerm t=PTR(AnTerm,c->diff)[j];u64 image=an_image(&a,t.chain,t.w,t.d,t.c);an_accumulate(&a,&square,image,an_one());}
  if(a.temp.error||square){rc=a.temp.error?a.temp.error:GN_CORRUPT;goto failed;}
 }
 /* Augmented matrices split by (p,d). Each new pivot is retained only for its
  * block. Every operation is over Q or the requested prime, never a rank guess. */
 reset_a(&a.temp);u64 pivoff=pb_alloc(&a.store,n,8);if(a.store.error){rc=GN_MEMORY;goto failed;}u64 rankbase=a.store.pos;
 for(u32 p=1;p<=D;p++)for(u32 d=p;d<=D;d++){
  a.store.pos=rankbase;memset(PTR(u8,pivoff),0,(size_t)n*8);u32 rank=0;
  for(u32 id=1;id<used;id++)if(a.c[id].p==p&&a.c[id].d==d){
   reset_a(&a.temp);u64 row=0;AnChain*c=&a.c[id];
   for(u32 j=0;j<c->n;j++){AnTerm t=PTR(AnTerm,c->diff)[j];if(!t.d)an_put(&a,&row,t);}
   while(row&&!an_poll(&a)){
    AnTerm top=PTR(AnNode,row)->t;u64 pivot=PTR(u64,pivoff)[top.chain];
    if(!pivot){u64 saved=0;for(u64 q=row;q;q=PTR(AnNode,q)->next){AnTerm t=PTR(AnNode,q)->t;t.c=an_divc(&a.temp,t.c,top.c);an_put(&a,&saved,t);}u32 len=0;u64 frozen=an_freeze(&a,saved,&len);if(a.store.error)break;/* linked temporary nodes are not retained */
     u64 first=0;for(u32 j=len;j;j--){u64 q=pb_alloc(&a.store,1,sizeof(AnNode));if(a.store.error)break;*PTR(AnNode,q)=(AnNode){PTR(AnTerm,frozen)[j-1],first};first=q;}PTR(u64,pivoff)[top.chain]=first;rank++;break;}
    an_accumulate(&a,&row,pivot,an_neg(top.c));
   }
   if(a.temp.error||a.store.error){rc=a.temp.error?a.temp.error:a.store.error;goto failed;}
  }PTR(u32,ranks)[(u64)p*side+d]=rank;
 }
 a.store.pos=rankbase;
 S.an_base=base;S.an_end=a.store.pos;S.an_chains=chainoff;S.an_counts=counts;S.an_ranks=ranks;S.an_terms=a.terms;S.an_steps=a.steps;S.an_n=used;S.an_degree=D;S.bump=S.an_end;S.error=saved_error;return 0;
 failed:
 S.bump=base;S.error=saved_error;S.pb_offset=S.pb_end=S.pb_base=0;S.pb_limbs=0;return rc==GN_SCRATCH?GN_MEMORY:rc;
}
