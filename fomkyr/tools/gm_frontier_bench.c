#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include <inttypes.h>
#include "../src/nc_gm.h"
/* Leading-record-only audit: does not read coefficient bodies or change a job.
 * This tool deliberately scans every Aho terminal on the fail chain, independently
 * of the kernel's shortest-output index. Degree <=31 covers the FK6 d17 snapshot. */
typedef unsigned __int128 Word;
typedef struct {Word word;uint32_t degree,terms;} Head;
typedef struct {uint32_t next[16],fail,out;} Node;
typedef struct {uint32_t rule,k,next;Word word;} Prefix;
static Head *heads;static Node *nodes;static Prefix *prefixes;static uint32_t *buckets;
static uint32_t count,used,bits=20;static uint64_t ignored=0;
static uint32_t rd32(const unsigned char*p){uint32_t x=0;for(int i=3;i>=0;i--)x=(x<<8)|p[i];return x;}
static uint64_t rd64(const unsigned char*p){return(uint64_t)rd32(p)|((uint64_t)rd32(p+4)<<32);}
static uint32_t letter(Head h,uint32_t at){return(h.word>>(4*(h.degree-at-1)))&15;}
static uint64_t mix(uint64_t x){x^=x>>30;x*=UINT64_C(0xbf58476d1ce4e5b9);x^=x>>27;x*=UINT64_C(0x94d049bb133111eb);return x^(x>>31);}
static uint32_t hash(Word w,uint32_t k){return mix((uint64_t)w^mix((uint64_t)(w>>64))^mix(k))&((1u<<bits)-1);}
static Word mask(uint32_t n){return(((Word)1)<<(4*n))-1;}
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec/1e9;}
static int lower(void*context,GmOccurrence a,GmOccurrence b,int retained){(void)retained;if(gm_same(a,b)||!gm_overlap(a,b))return 1;return gm_end(a,b)-gm_start(a,b)<*(uint32_t*)context;}
static void load(const char*path,uint32_t max_degree,uint32_t wanted){
 FILE*f=fopen(path,"rb");if(!f){perror(path);exit(1);}heads=calloc((size_t)wanted+1,sizeof(*heads));if(!heads)exit(1);
 uint64_t offset=0,sum=1;unsigned char buf[56];for(uint32_t id=1;id<=wanted;id++){
  if(fseeko(f,(off_t)offset,SEEK_SET)||fread(buf,1,56,f)!=56||rd32(buf)!=0x31424e47||rd32(buf+4)<56)exit(2);
  Head h={((Word)rd64(buf+40)<<64)|rd64(buf+32),rd32(buf+12),rd32(buf+8)};
  if(h.degree>max_degree){ignored=wanted-id+1;break;}if(h.degree>31||!h.degree){fprintf(stderr,"unsupported head width\n");exit(2);}heads[++count]=h;sum+=h.degree;offset+=rd32(buf+4);
 }
 fclose(f);nodes=calloc(sum,sizeof(*nodes));prefixes=calloc(sum,sizeof(*prefixes));buckets=calloc(1u<<bits,4);uint32_t *q=calloc(sum,4);if(!nodes||!prefixes||!buckets||!q)exit(1);used=1;
 uint32_t np=0;for(uint32_t id=1;id<=count;id++){
  Head h=heads[id];uint32_t s=0;for(uint32_t j=0;j<h.degree;j++){uint32_t c=letter(h,j);if(!nodes[s].next[c])nodes[s].next[c]=used++;s=nodes[s].next[c];}if(nodes[s].out)exit(3);nodes[s].out=id;
  for(uint32_t k=1;k<h.degree;k++){Word w=h.word>>(4*(h.degree-k));uint32_t b=hash(w,k);prefixes[++np]=(Prefix){id,k,buckets[b],w};buckets[b]=np;}
 }
 uint32_t h=0,t=0;for(int c=0;c<16;c++)if(nodes[0].next[c])q[t++]=nodes[0].next[c];while(h<t){uint32_t v=q[h++],f=nodes[v].fail;for(int c=0;c<16;c++){uint32_t e=nodes[v].next[c];if(e){nodes[e].fail=nodes[f].next[c];q[t++]=e;}else nodes[v].next[c]=nodes[f].next[c];}}free(q);
}
static uint64_t antichain(void){uint64_t violations=0;for(uint32_t id=1;id<=count;id++){uint32_t s=0;Head a=heads[id];for(uint32_t i=0;i<a.degree;i++){s=nodes[s].next[letter(a,i)];for(uint32_t p=s;p;p=nodes[p].fail){uint32_t j=nodes[p].out;if(j&&j!=id)violations++;}}}return violations;}
typedef struct {uint64_t total,chain,monomial,raw[3],extra[3],pipelineExtra;double seconds;} Result;
static Result bench(uint32_t degree,int gm){Result r={0};double start=now();for(uint32_t f=1;f<=count;f++){
 Head a=heads[f];for(uint32_t k=1;k<a.degree;k++){Word suffix=a.word&mask(k);uint32_t bkt=hash(suffix,k);for(uint32_t p=buckets[bkt];p;p=prefixes[p].next){Prefix x=prefixes[p];Head b=heads[x.rule];if(x.k!=k||x.word!=suffix||a.degree+b.degree-k!=degree)continue;
 r.total++;if(a.terms==1&&b.terms==1)r.monomial++;
 uint32_t startRight=a.degree-k,s=0,hit[3]={0},interior=0;
 GmOccurrence left={f,0,a.degree},right={x.rule,startRight,degree};
 for(uint32_t i=0;i<degree;i++){
  uint32_t c=i<a.degree?letter(a,i):letter(b,k+i-a.degree);s=nodes[s].next[c];
  for(uint32_t n=s;n;n=nodes[n].fail){uint32_t id=nodes[n].out;if(!id)continue;Head h=heads[id];GmOccurrence at={id,i+1-h.degree,i+1};
   if(at.begin>0&&at.end<degree)interior=1;
   if(gm)for(int j=0;j<3;j++)if(!hit[j]){GmWitness w;hit[j]=gm_witness(left,right,at,degree,1u<<j,lower,&degree,&w)!=0;}
  }
 }
 r.chain+=interior;int any=0;for(int j=0;j<3;j++){r.raw[j]+=hit[j];r.extra[j]+=hit[j]&&!interior;any|=hit[j];}r.pipelineExtra+=any&&!interior&&!(a.terms==1&&b.terms==1);
 }}}
 r.seconds=now()-start;return r;}
int main(int argc,char**argv){if(argc!=4){fprintf(stderr,"usage: gm_frontier_bench basis.gnb degree lower-rule-count\n");return 1;}uint32_t d=strtoul(argv[2],0,10),n=strtoul(argv[3],0,10);if(d>32||d<2)return 1;double t=now();load(argv[1],d-1,n);uint64_t violations=antichain();Result a=bench(d,0),b=bench(d,1);
 printf("{\"degree\":%u,\"lowerRules\":%u,\"ignoredRules\":%"PRIu64",\"ahoStates\":%u,\"antichainViolations\":%"PRIu64",\"rawPairs\":%"PRIu64",\"monomialPairs\":%"PRIu64",\"interiorChainEligible\":%"PRIu64",\"gmMultiplyEligible\":%"PRIu64",\"gmLeadingWordEligible\":%"PRIu64",\"gmBackwardEligible\":%"PRIu64",\"extraMultiply\":%"PRIu64",\"extraLeadingWord\":%"PRIu64",\"extraBackward\":%"PRIu64",\"extraPipeline\":%"PRIu64",\"baselineSeconds\":%.9f,\"gmAuditSeconds\":%.9f,\"elapsedSeconds\":%.9f,\"method\":\"exact geometry; every leading occurrence; completed lower-degree dependency check\",\"normalFormTiming\":false}\n",d,count,ignored,used,violations,b.total,b.monomial,b.chain,b.raw[0],b.raw[1],b.raw[2],b.extra[0],b.extra[1],b.extra[2],b.pipelineExtra,a.seconds,b.seconds,now()-t);
 return violations||a.total!=b.total?3:0;
}
