/* SPDX-License-Identifier: MIT
 * F4-inspired WHOLE-degree selection, retaining the direct exact normal forms.
 * The plan changes order only, never the set of unprocessed critical overlaps.
 * 0.7.3 adds a certificate-aware gateword mode: after the imported FK sector
 * counter is available, the unseen suffix is regrouped toward sectors with the
 * highest closure leverage, then ordered by the actual ambiguity word.
 */
static u32 plan_hash(u32 f,u32 g,u32 k){return(u32)mix(((u64)f<<32)^g^mix(k))&1023;}
static int plan_word_before(PlanPair a,PlanPair b){
 Rule*af=rule(a.f),*ag=rule(a.g),*bf=rule(b.f),*bg=rule(b.g);
 for(u32 i=0;i<S.current;i++){
  u32 x=i<af->degree?letter(af->lm,af->degree,i):letter(ag->lm,ag->degree,a.k+i-af->degree);
  u32 y=i<bf->degree?letter(bf->lm,bf->degree,i):letter(bg->lm,bg->degree,b.k+i-bf->degree);
  if(x!=y)return x<y;
 }
 return a.ordinal<b.ordinal;
}
static int plan_before(PlanPair a,PlanPair b,u32 mode){
 u64 ac=(u64)rule(a.f)->n+rule(a.g)->n,bc=(u64)rule(b.f)->n+rule(b.g)->n;
 if(mode==3||mode==4)return plan_word_before(a,b);
 if(mode==1){if(a.k!=b.k)return a.k>b.k;if(ac!=bc)return ac<bc;}
 else {if(ac!=bc)return ac<bc;if(a.k!=b.k)return a.k>b.k;}
 return a.ordinal<b.ordinal;
}
static void plan_sift(PlanPair*t,u32 root,u32 n,u32 mode){
 PlanPair x=t[root];for(;;){u64 ll=(u64)root*2+1;if(ll>=n)break;u32 c=(u32)ll;
  if(c+1<n&&plan_before(t[c],t[c+1],mode))c++;
  if(!plan_before(x,t[c],mode))break;t[root]=t[c];root=c;
 }t[root]=x;
}
static int plan_sort(PlanPair*t,u32 n,u32 mode){
 for(u32 i=n/2;i--;)plan_sift(t,i,n,mode);
 for(u32 i=n;i>1;){if(!(i&1023)&&cancelled())return -GN_CANCELLED;PlanPair x=t[0];t[0]=t[--i];t[i]=x;plan_sift(t,0,i,mode);}return 0;
}
static int plan_build(u32 mode,u64 anchor_seen,const BatchTask*anchors,u32 anchor_n){
 if(mode<1||mode>4||anchor_n>BATCH_MAX||!S.current)return -GN_INPUT;
 double started=gn_host_clock();u64 total=0;
 for(u32 id=1;id<=S.degree_snapshot;id++){
  if(!(id&255)&&cancelled())return -GN_CANCELLED;Rule*f=rule(id);if(f->degree>=S.current)continue;
  for(u32 k=1;k<f->degree;k++){u32 glen=S.current-f->degree+k;if(glen<=k||glen>=S.current)continue;
   u32 n=prefix_count(part(f->lm,f->degree,f->degree-k,k),k,glen,S.degree_snapshot);if(UINT64_MAX-total<n)return -GN_LIMIT;total+=n;
  }
 }
 if(P.excluded_bytes&&(P.excluded_bytes!=(total+7)/8||anchor_n||anchor_seen!=P.excluded_count))return -GN_CORRUPT;
 if(anchor_seen>total||anchor_n>anchor_seen)return -GN_CORRUPT;
 u64 count=total-anchor_seen+anchor_n,bytes=count*sizeof(PlanPair);
 if(total>UINT32_MAX||count>UINT32_MAX||bytes>P.budget||P.excluded_bytes>P.budget-bytes){P.declines++;return 0;}
 if(count>P.capacity){
  if(bytes>P.budget-P.allocated||bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes)){P.declines++;return 0;}
  P.base=S.bump;S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);P.allocated+=bytes;P.capacity=count;
 }
 u32 slots[1024]={0};u8 found[BATCH_MAX]={0};
 for(u32 i=0;i<anchor_n;i++){
  const BatchTask*a=&anchors[i];u32 h=plan_hash(a->f,a->g,a->k);
  while(slots[h]){const BatchTask*b=&anchors[slots[h]-1];if(a->f==b->f&&a->g==b->g&&a->k==b->k)return -GN_CORRUPT;h=(h+1)&1023;}
  slots[h]=i+1;
 }
 PlanPair*t=PTR(PlanPair,P.base);u32 used=0;u64 ordinal=0;
 for(u32 f=1;f<=S.degree_snapshot;f++){
  if(!(f&255)&&cancelled())return -GN_CANCELLED;Rule*a=rule(f);if(a->degree>=S.current)continue;
  for(u32 k=1;k<a->degree;k++){
   u32 glen=S.current-a->degree+k;if(glen<=k||glen>=S.current)continue;
   Word suffix=part(a->lm,a->degree,a->degree-k,k);u32 node=PTR(u32,S.prefix_heads)[prefix_hash(suffix,k,glen)];
   while(node){Prefix*q=prefix(node);node=q->next;u32 g=q->rule;if(g>S.degree_snapshot||q->length!=k)continue;Rule*b=rule(g);if(b->degree!=glen||!weq(part(b->lm,b->degree,0,k),suffix))continue;
    int keep=P.excluded_bytes?!(PTR(u8,P.excluded_base)[ordinal>>3]&(1u<<(ordinal&7))):ordinal>=anchor_seen;
    if(!keep&&!P.excluded_bytes){u32 h=plan_hash(f,g,k);while(slots[h]){u32 i=slots[h]-1;const BatchTask*p=&anchors[i];if(p->f==f&&p->g==g&&p->k==k){if(found[i])return -GN_CORRUPT;found[i]=1;keep=1;break;}h=(h+1)&1023;}}
    if(keep){if(used>=count)return -GN_CORRUPT;t[used++]=(PlanPair){f,g,k,(u32)ordinal,UINT32_MAX};}ordinal++;
   }
  }
 }
 if(ordinal!=total||used!=count)return -GN_CORRUPT;
 for(u32 i=0;i<anchor_n;i++)if(!found[i])return -GN_CORRUPT;
 P.gate_ready=0;int sr=plan_sort(t,used,mode);if(sr)return sr;
 if(anchor_n)memmove(P.anchor,anchors,anchor_n*sizeof(BatchTask));P.anchor_n=anchor_n;P.anchor_seen=anchor_seen;
 P.mode=mode;P.count=used;P.cursor=0;P.total=total;P.active=1;P.builds++;
 S.degree_total=total;S.degree_total_known=1;P.build_us+=(u64)((gn_host_clock()-started)*1000);return 1;
}
static int plan_next(u32 lane){
 Lane*l=&S.lanes[lane];PlanPair*t=PTR(PlanPair,P.base);
 while(P.cursor<P.count){if(!(P.cursor&1023)&&cancelled())return -GN_CANCELLED;
  PlanPair p=t[P.cursor++];Rule*f=rule(p.f),*g=rule(p.g);S.degree_seen++;
  if(S.pruning&&f->n==1&&g->n==1){S.zero_pairs++;S.degree_monomial++;continue;}
  if(S.chain_enabled&&matcher_interior(f,g,p.k)){S.chain_skipped++;S.degree_chain++;continue;}
  if(gm_pair(p.f,p.g,p.k)){S.degree_chain++;continue;}
  l->f=p.f;l->g=p.g;l->k=p.k;l->snapshot=S.nrules;l->error=0;S.pair_count++;S.degree_scheduled++;return 1;
 }
 S.iter_done=1;return 0;
}
static int plan_check_pending(const BatchTask*t,u32 n){
 u32 slots[1024]={0};u8 found[BATCH_MAX]={0};
 for(u32 i=0;i<n;i++){u32 h=plan_hash(t[i].f,t[i].g,t[i].k);while(slots[h]){u32 j=slots[h]-1;if(t[i].f==t[j].f&&t[i].g==t[j].g&&t[i].k==t[j].k)return GN_CORRUPT;h=(h+1)&1023;}slots[h]=i+1;}
 PlanPair*p=PTR(PlanPair,P.base);
 for(u32 i=0;i<P.cursor;i++){if(!(i&4095)&&cancelled())return GN_CANCELLED;u32 h=plan_hash(p[i].f,p[i].g,p[i].k);while(slots[h]){u32 j=slots[h]-1;if(p[i].f==t[j].f&&p[i].g==t[j].g&&p[i].k==t[j].k){if(found[j])return GN_CORRUPT;found[j]=1;break;}h=(h+1)&1023;}}
 for(u32 i=0;i<n;i++)if(!found[i])return GN_CORRUPT;return 0;
}

/* V7 stores finished identities, independently of any unissued permutation.
 * Pending identities are explicit and are replayed before a freshly ranked tail.
 * These helpers never touch task indices, arenas or an in-flight normal form. */
static int plan_pending_prefix(const BatchTask*pending,u32 n){
 if(n>P.count||n>BATCH_MAX)return GN_CORRUPT;
 u32 slots[1024]={0};u8 found[BATCH_MAX]={0};PlanPair saved[BATCH_MAX];
 for(u32 i=0;i<n;i++){
  u32 h=plan_hash(pending[i].f,pending[i].g,pending[i].k);
  while(slots[h]){u32 j=slots[h]-1;if(pending[j].f==pending[i].f&&pending[j].g==pending[i].g&&pending[j].k==pending[i].k)return GN_CORRUPT;h=(h+1)&1023;}
  slots[h]=i+1;
 }
 PlanPair*t=PTR(PlanPair,P.base);u32 tail=0;
 for(u32 i=0;i<P.count;i++){
  PlanPair p=t[i];u32 h=plan_hash(p.f,p.g,p.k),match=UINT32_MAX;
  while(slots[h]){u32 j=slots[h]-1;if(p.f==pending[j].f&&p.g==pending[j].g&&p.k==pending[j].k){match=j;break;}h=(h+1)&1023;}
  if(match==UINT32_MAX)t[tail++]=p;
  else{if(found[match])return GN_CORRUPT;found[match]=1;saved[match]=p;}
 }
 for(u32 i=0;i<n;i++)if(!found[i])return GN_CORRUPT;
 if(tail+n!=P.count)return GN_CORRUPT;
 memmove(t+n,t,(u64)tail*sizeof(*t));if(n)memcpy(t,saved,(u64)n*sizeof(*t));P.cursor=n;return 0;
}
static int plan_clear_identities(u8*bits,const BatchTask*task,u32 n,u32 limit){
 u32 slots[1024]={0};u8 found[BATCH_MAX]={0};
 if(n>BATCH_MAX||limit>P.count)return GN_CORRUPT;
 for(u32 i=0;i<n;i++){
  u32 h=plan_hash(task[i].f,task[i].g,task[i].k);
  while(slots[h]){u32 j=slots[h]-1;if(task[j].f==task[i].f&&task[j].g==task[i].g&&task[j].k==task[i].k)return GN_CORRUPT;h=(h+1)&1023;}slots[h]=i+1;
 }
 PlanPair*t=PTR(PlanPair,P.base);
 for(u32 i=0;i<limit;i++){
  PlanPair p=t[i];if(p.ordinal>=P.total)return GN_CORRUPT;
  u32 h=plan_hash(p.f,p.g,p.k);
  while(slots[h]){u32 j=slots[h]-1;if(p.f==task[j].f&&p.g==task[j].g&&p.k==task[j].k){
   if(found[j])return GN_CORRUPT;found[j]=1;bits[p.ordinal>>3]&=(u8)~(1u<<(p.ordinal&7));break;
  }h=(h+1)&1023;}
 }
 for(u32 i=0;i<n;i++)if(!found[i])return GN_CORRUPT;return 0;
}
static int plan_completed_bitmap(u8*bits,u32 bytes,const BatchTask*pending,u32 n){
 if(bytes!=(P.total+7)/8||P.cursor>P.count||P.anchor_seen>P.total)return GN_CORRUPT;
 memset(bits,0,bytes);
 if(P.excluded_bytes){if(P.excluded_bytes!=bytes)return GN_CORRUPT;memcpy(bits,PTR(u8,P.excluded_base),bytes);}
 else{
  memset(bits,255,(size_t)(P.anchor_seen/8));if(P.anchor_seen&7)bits[P.anchor_seen/8]=(u8)((1u<<(P.anchor_seen&7))-1);
  int rc=plan_clear_identities(bits,P.anchor,P.anchor_n,P.count);if(rc)return rc;
 }
 PlanPair*t=PTR(PlanPair,P.base);
 for(u32 i=0;i<P.cursor;i++){if(t[i].ordinal>=P.total)return GN_CORRUPT;bits[t[i].ordinal>>3]|=(u8)(1u<<(t[i].ordinal&7));}
 int rc=plan_clear_identities(bits,pending,n,P.cursor);if(rc)return rc;
 u64 count=0;for(u32 i=0;i<bytes;i++){u8 b=bits[i];for(;b;b&=(u8)(b-1))count++;}
 return S.degree_seen>=n&&count==S.degree_seen-n?0:GN_CORRUPT;
}
