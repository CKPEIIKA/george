/* Exact GM filtering for the graded engine's immutable degree snapshot.
 * gn_input_end and ordered exact commit keep its leading words an antichain.
 * Every genuine third occurrence is therefore interior, and both normalized
 * replacement obstructions have smaller internal degree or are products.
 * For an antichain, any third occurrence is strictly interior: endpoint
 * inclusion would contradict minimality. Both parent overlaps are therefore
 * strictly shorter than W. Their standard representations are certified by
 * completed-degree induction. No same-degree retained ledger is required in
 * this homogeneous architecture. General predicates still check retention
 * for nonminimal input (see the independent geometry tests). This adapter never assumes
 * that a pending/removed obstruction has been reduced to zero.
 */
#include "nc_gm.h"
static int gm_dependency(void*unused,GmOccurrence a,GmOccurrence b,int retained){
 (void)unused;(void)retained;
 if(gm_same(a,b)||!gm_overlap(a,b))return 1;
 u64 span=gm_end(a,b)-gm_start(a,b);
 /* In this degree-by-degree engine, lower-degree completions are the retained
  * standard representations. No unsupported same-degree assertion is made. */
 return span<=S.completed;
}
static u32 gm_pair(u32 f,u32 g,u32 overlap){
 if(!S.gm_mask)return 0;
 GN_FETCH_ADD(&S.gm_examined,1);
 if(!S.matcher_nodes||S.matcher_snapshot>S.degree_snapshot){
  GN_FETCH_ADD(&S.gm_unavailable,1);Rule*a=rule(f),*b=rule(g);u64 rightStart=(u64)a->degree-overlap;
  GmOccurrence left={f,0,a->degree},right={g,rightStart,rightStart+b->degree};
  for(u32 at=1;at+1<S.current;at++){
   Word w={0,0};
   for(u32 n=1;n<=GN_INLINE_DEGREE&&at+n<S.current;n++){
    u32 pos=at+n-1,c=pos<a->degree?letter(a->lm,a->degree,pos):letter(b->lm,b->degree,overlap+pos-a->degree);
    w.hi=(w.hi<<4)|(w.lo>>60);w.lo=(w.lo<<4)|c;u32 id=exact_rule(w,n,S.degree_snapshot);if(!id)continue;
    GmWitness witness;u32 hit=gm_witness(left,right,(GmOccurrence){id,at,at+n},S.current,S.gm_mask,gm_dependency,NULL,&witness);
    if(hit){u32 index=hit==GM_MULTIPLY?0:hit==GM_LEADING_WORD?1:2;GN_FETCH_ADD(&S.gm_skipped[index],1);return hit;}
   }
  }return 0;
 }
 Rule*a=rule(f),*b=rule(g);u64 start=(u64)a->degree-overlap;
 GmOccurrence left={f,0,a->degree},right={g,start,start+b->degree};
 MatchNode*nodes=PTR(MatchNode,S.matcher_base);u32 state=0;
 for(u32 pos=0;pos<S.current;pos++){
  if(!(pos&1023)&&cancelled())return 0;
  u32 c=pos<a->degree?letter(a->lm,a->degree,pos):letter(b->lm,b->degree,overlap+pos-a->degree);
  state=nodes[state].next[c];u32 id=nodes[state].out;
  if(!id||id>S.degree_snapshot)continue;
  Rule*h=rule(id);GmOccurrence at={id,(u64)pos+1-h->degree,(u64)pos+1};GmWitness witness;
  u32 hit=gm_witness(left,right,at,S.current,S.gm_mask,gm_dependency,NULL,&witness);
  if(hit){u32 index=hit==GM_MULTIPLY?0:hit==GM_LEADING_WORD?1:2;GN_FETCH_ADD(&S.gm_skipped[index],1);return hit;}
 }
 return 0;
}

/* A replayed descriptor remains scheduled: its zero consequence commits through
 * normal accounting. Never add this to degree_chain as another consumed pair. */
static int pair_replay_filter(u32 f,u32 g,u32 k){
 int skipped=S.chain_enabled&&matcher_interior(rule(f),rule(g),k);
 if(!skipped)skipped=gm_pair(f,g,k)!=0;
 if(skipped)GN_FETCH_ADD(&S.gm_pending,1);return skipped;
}
