#include <stdio.h>
#include <assert.h>
#include "../src/nc_gm.h"
static int known(void*ctx,GmOccurrence a,GmOccurrence b,int retain){(void)ctx;(void)a;(void)b;(void)retain;return 1;}
static int ledger(void*ctx,GmOccurrence a,GmOccurrence b,int retain){
 if(!gm_overlap(a,b))return 1;
 assert(retain);GmOccurrence h=a.rule==3?a:b;
 return *(int*)ctx&&h.rule==3&&h.begin==4;
}
int main(void){
 GmWitness w;
 /* Paper3.5b: y^3, x^2y^2, xyx^2y; W=xyx^2y^3. */
 assert(gm_witness((GmOccurrence){3,0,5},(GmOccurrence){1,4,7},(GmOccurrence){2,2,6},7,GM_MULTIPLY,known,0,&w)==GM_MULTIPLY);
 assert(w.left_context==0&&w.right_context==1);
 /* Leading-word condition(a), with multiply disabled: the lower-id y
  * obstruction dominates the older (xy)^2 endpoint. */
 assert(gm_witness((GmOccurrence){3,0,5},(GmOccurrence){2,3,7},(GmOccurrence){1,1,2},7,GM_LEADING_WORD,known,0,&w)==GM_LEADING_WORD);
 /* Leading-word condition(b): equal old rule, same common context, smaller
  * left context. x occurs at both ends of the newer tip xyx. */
 assert(gm_witness((GmOccurrence){1,2,3},(GmOccurrence){2,0,3},(GmOccurrence){1,0,1},3,GM_LEADING_WORD,known,0,&w)==GM_LEADING_WORD);
 /* Paper3.13/3.14: x^3yx, x^2, newer x. The last x inclusion remains;
  * the other replacement is a disjoint/product obstruction. */
 int retained=1;
 assert(gm_witness((GmOccurrence){1,0,5},(GmOccurrence){2,1,3},(GmOccurrence){3,4,5},5,GM_BACKWARD,ledger,&retained,&w)==GM_BACKWARD);
 retained=0;
 assert(!gm_witness((GmOccurrence){1,0,5},(GmOccurrence){2,1,3},(GmOccurrence){3,4,5},5,GM_BACKWARD,ledger,&retained,&w));
 retained=1;
 assert(!gm_witness((GmOccurrence){1,0,5},(GmOccurrence){2,1,3},(GmOccurrence){3,0,1},5,GM_BACKWARD,ledger,&retained,&w));
 /* Canonical self orientation must not be reversed. */
 assert(!gm_witness((GmOccurrence){3,0,3},(GmOccurrence){1,2,5},(GmOccurrence){3,1,4},5,GM_MULTIPLY,known,0,&w));
 assert(!gm_witness((GmOccurrence){3,0,5},(GmOccurrence){1,4,7},(GmOccurrence){2,2,6},7,0,known,0,&w));
 puts("{\"passed\":true,\"multiply\":true,\"leadingWordBothConditions\":true,\"backwardRetainedDependencies\":true,\"canonicalSelfOrientation\":true,\"testScope\":\"geometry predicates\"}");
 return 0;
}
