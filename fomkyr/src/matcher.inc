/* SPDX-License-Identifier: MIT
 * Immutable Aho-Corasick leading-word index. This is a pattern search index,
 * NOT a different monomial ordering or an approximate normal-form cache.
 * Choose the shortest divisor, then its leftmost occurrence, exactly as the
 * original length/position loop does. Rebuild only at degree barriers.
 *
 * Allocation is optional and bounded. Geometric growth counts ALL abandoned
 * buffers against matcher_limit; failure uses the original exact hash path.
 */
typedef struct {u32 next[16],fail,out,length;} MatchNode;
static int matcher_build(void){
 if(!(S.matcher_enabled||S.chain_enabled)||!S.matcher_limit||!S.nrules){S.matcher_nodes=0;S.matcher_snapshot=0;return 0;}
 if(S.matcher_nodes&&S.matcher_snapshot==S.nrules)return 0;
 u64 upper=1;for(u32 i=1;i<=S.nrules;i++)upper+=rule(i)->degree;
 if(upper>UINT32_MAX){S.matcher_nodes=0;S.matcher_fallbacks++;return 0;}
 if(upper>S.matcher_capacity){
  u64 capacity=128;while(capacity<upper&&capacity<UINT32_MAX/2)capacity*=2;
  if(capacity<upper)capacity=upper;
  u64 bytes=capacity*(sizeof(MatchNode)+sizeof(u32));
  if(S.matcher_allocated>S.matcher_limit||bytes>S.matcher_limit-S.matcher_allocated||bytes>S.budget-S.bump||!gn_host_ensure(S.bump+bytes)){
   /* Keep the older immutable index: unindexed rules use exact lookup. */
   S.matcher_fallbacks++;return 0;
  }
  S.matcher_base=S.bump;S.bump+=bytes;S.allocated_peak=MAX(S.allocated_peak,S.bump);
  S.matcher_capacity=(u32)capacity;S.matcher_allocated+=bytes;
 }
 MatchNode*nodes=PTR(MatchNode,S.matcher_base);
 u32*queue=PTR(u32,S.matcher_base+(u64)S.matcher_capacity*sizeof(MatchNode));
 memset(nodes,0,(size_t)upper*sizeof(MatchNode));u32 used=1,minimum=UINT32_MAX;
 for(u32 id=1;id<=S.nrules;id++){
  if((id&1023)==0){if(S.telemetry_enabled)(void)gn_host_clock();if(cancelled())return GN_CANCELLED;}
  Rule*r=rule(id);u32 q=0;minimum=MIN(minimum,r->degree);
  for(u32 i=0;i<r->degree;i++){
   u32 c=letter(r->lm,r->degree,i),*edge=&nodes[q].next[c];
   if(!*edge){if(used>=S.matcher_capacity)return GN_STATE;*edge=used++;}q=*edge;
  }
  nodes[q].out=id;nodes[q].length=r->degree;
 }
 u32 head=0,tail=0;
 for(u32 c=0;c<S.generators;c++)if(nodes[0].next[c])queue[tail++]=nodes[0].next[c];
 while(head<tail){
  if((head&4095)==0){if(S.telemetry_enabled)(void)gn_host_clock();if(cancelled())return GN_CANCELLED;}
  u32 v=queue[head++],f=nodes[v].fail;
  if(nodes[f].out&&(!nodes[v].out||nodes[f].length<nodes[v].length)){
   nodes[v].out=nodes[f].out;nodes[v].length=nodes[f].length;
  }
  for(u32 c=0;c<S.generators;c++){
   u32 *edge=&nodes[v].next[c],fallback=nodes[f].next[c];
   if(*edge){nodes[*edge].fail=fallback;queue[tail++]=*edge;}else *edge=fallback;
  }
 }
 S.matcher_nodes=used;S.matcher_snapshot=S.nrules;S.matcher_min=minimum;S.matcher_builds++;return 0;
}
static u32 matcher_find(Word w,u32 degree,u32*pos,Lane*l){
 MatchNode*nodes=PTR(MatchNode,S.matcher_base);u32 state=0,best=0,length=UINT32_MAX,at=0,seen=0;
 for(u32 i=0;i<degree;i++){
  state=nodes[state].next[letter(w,degree,i)];seen++;
  if(nodes[state].out&&nodes[state].length<length){
   best=nodes[state].out;length=nodes[state].length;at=i+1-length;
   if(length==S.matcher_min)break; /* first occurrence of the global minimum */
  }
 }
 l->matcher_characters+=seen;*pos=at;return best;
}
/* Homogeneous lower-degree chain criterion.
 * For the ambiguity W = LM(f) r = l LM(g), an LM(h) strictly INSIDE W
 * gives F-G=(F-H)+(H-G). Both overlaps are contained in proper substrings
 * of W, hence have degree < current. They have already been resolved by
 * the degree induction (or are disjoint commuting reductions).
 * Endpoint occurrences of f or g are explicitly excluded. No arbitrary
 * same-degree "already seen" skip and no finite-field guess is used.
 * See docs/SPEED_AND_PROGRESS.md for the proof and verification matrix.
 */
static int matcher_interior(const Rule*f,const Rule*g,u32 overlap){
 if(!S.matcher_nodes||S.matcher_snapshot>S.degree_snapshot||S.current<3)return 0;
 MatchNode*nodes=PTR(MatchNode,S.matcher_base);u32 state=0;
 /* Reset at letter 1 and stop before the last letter: every reported match
  * is wholly in W[1:D-1]. The overlap word is streamed, never allocated. */
 for(u32 i=1;i+1<S.current;i++){
  u32 c=i<f->degree?letter(f->lm,f->degree,i):letter(g->lm,g->degree,overlap+i-f->degree);
  state=nodes[state].next[c];if(nodes[state].out)return 1;
 }
 return 0;
}
