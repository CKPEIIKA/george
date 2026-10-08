/* SPDX-License-Identifier: MIT
 * Noncommutative Gebauer-Moeller predicates (Kreuzer-Xiu, Props3.6/3.7/3.14).
 * Occurrences are embedded in the SAME ambiguity word. The caller must verify
 * literal leading-word matches and supply the normalized-obstruction ledger.
 * A backward witness is accepted only when BOTH replacement obstructions have
 * a known GB representation or remain in the retained new-obstruction set.
 */
#ifndef FOMKYR_NC_GM_H
#define FOMKYR_NC_GM_H
#include <stdint.h>
enum { GM_MULTIPLY=1, GM_LEADING_WORD=2, GM_BACKWARD=4 };
typedef struct {uint32_t rule;uint64_t begin,end;} GmOccurrence;
typedef int (*GmDependency)(void*,GmOccurrence,GmOccurrence,int require_retained);
typedef struct {uint32_t criterion;GmOccurrence bridge;uint64_t left_context,right_context;} GmWitness;
static int gm_same(GmOccurrence a,GmOccurrence b){return a.rule==b.rule&&a.begin==b.begin&&a.end==b.end;}
static int gm_less(GmOccurrence a,GmOccurrence b){return a.rule<b.rule||(a.rule==b.rule&&a.begin<b.begin);}
static int gm_overlap(GmOccurrence a,GmOccurrence b){return a.begin<b.end&&b.begin<a.end;}
static uint64_t gm_start(GmOccurrence a,GmOccurrence b){return a.begin<b.begin?a.begin:b.begin;}
static uint64_t gm_end(GmOccurrence a,GmOccurrence b){return a.end>b.end?a.end:b.end;}
static int gm_valid(GmOccurrence a,uint64_t length){return a.rule&&a.begin<a.end&&a.end<=length;}
static uint32_t gm_witness(GmOccurrence a,GmOccurrence b,GmOccurrence h,
 uint64_t length,uint32_t mask,GmDependency dependency,void*context,GmWitness*out){
 if(!out||!dependency||!gm_valid(a,length)||!gm_valid(b,length)||!gm_valid(h,length)||gm_same(a,b)||gm_same(h,a)||gm_same(h,b))return 0;
 if(gm_start(a,b)!=0||gm_end(a,b)!=length||!gm_overlap(a,b))return 0;
 GmOccurrence s=gm_less(a,b)?b:a,i=gm_less(a,b)?a:b;
 /* Newer bridge, with the original two occurrences held fixed. */
 if(h.rule>s.rule){
  if((mask&GM_BACKWARD)&&dependency(context,a,h,1)&&dependency(context,b,h,1)){
   *out=(GmWitness){GM_BACKWARD,h,0,0};return GM_BACKWARD;
  }
  return 0;
 }
 /* The common s-occurrence must be the larger module term, including self
  * obstructions. This preserves Definition3.1's canonical self orientation. */
 if(!gm_less(h,s)||!gm_overlap(s,h))return 0;
 uint64_t left=gm_start(s,h),right=length-gm_end(s,h);
 int proper=left||right;
 uint32_t kind=(mask&GM_MULTIPLY)&&proper?GM_MULTIPLY:0;
 if(!kind&&(mask&GM_LEADING_WORD)&&(i.rule>h.rule||(i.rule==h.rule&&!proper&&i.begin>h.begin)))kind=GM_LEADING_WORD;
 if(!kind||!dependency(context,s,h,0)||!dependency(context,i,h,0))return 0;
 *out=(GmWitness){kind,h,left,right};return kind;
}
#endif
