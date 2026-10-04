#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
typedef uint64_t u64;typedef uint32_t u32;typedef uint8_t u8;
typedef struct{u64 lo,hi;}Word;
static int wcmp(Word a,Word b){return a.hi!=b.hi?(a.hi>b.hi?1:-1):a.lo!=b.lo?(a.lo>b.lo?1:-1):0;}
#include "../src/radix_queue.inc"
typedef struct{Word w;int active;}Node;
static u64 state=132433522;static u64 rng(void){state^=state<<13;state^=state>>7;state^=state<<17;return state;}
int main(int argc,char**argv){
 (void)argv;
 enum{N=257};Node nodes[N];u32 prev[N],next[N];u64 inserts=0,erases=0,pops=0;u32 cases=0;
 const u32 widths[]={12,52,64,80,124};
 for(u32 width=0;width<5;width++)for(u32 trial=0;trial<8;trial++){
  memset(nodes,0,sizeof(nodes));RadixQueue q={0};q.cache_enabled=argc>1;q.previous=prev;q.next=next;__uint128_t mask=(((__uint128_t)1)<<widths[width])-1;
  q.last=(Word){(u64)mask,(u64)(mask>>64)};u32 live=0;
  for(u32 step=0;step<10000;step++){
   u32 action=(u32)(rng()%10);
   if((action<6&&live<N)||!live){
    u32 id=1+(u32)(rng()%N);while(nodes[id-1].active)id=id%N+1;
    __uint128_t limit=((__uint128_t)q.last.hi<<64)|q.last.lo;
    __uint128_t v=((__uint128_t)rng()<<64)|rng();v%=limit+1;
    Word w={(u64)v,(u64)(v>>64)};int duplicate=0;for(u32 j=0;j<N;j++)if(nodes[j].active&&!wcmp(w,nodes[j].w)){duplicate=1;break;}
    if(duplicate)continue;
    nodes[id-1]=(Node){w,1};if(radix_insert(&q,nodes,sizeof(Node),id))return 2;live++;inserts++;
   }else if(action<8){
    u32 id=1+(u32)(rng()%N);while(!nodes[id-1].active)id=id%N+1;
    radix_erase(&q,nodes,sizeof(Node),id);nodes[id-1].active=0;live--;erases++;
   }else{
    u32 expected=0;for(u32 j=0;j<N;j++)if(nodes[j].active&&(!expected||wcmp(nodes[j].w,nodes[expected-1].w)>0))expected=j+1;
    u32 found=radix_top(&q,nodes,sizeof(Node));if(found!=expected){fprintf(stderr,"top mismatch width=%u trial=%u step=%u expected=%u got=%u\n",widths[width],trial,step,expected,found);return 3;}
    radix_erase(&q,nodes,sizeof(Node),found);nodes[found-1].active=0;live--;pops++;
   }
   u32 counted=0;for(u32 j=0;j<N;j++)counted+=nodes[j].active;if(counted!=live)return 4;
  }
  while(live){u32 best=0;for(u32 j=0;j<N;j++)if(nodes[j].active&&(!best||wcmp(nodes[j].w,nodes[best-1].w)>0))best=j+1;u32 found=radix_top(&q,nodes,sizeof(Node));if(best!=found)return 5;radix_erase(&q,nodes,sizeof(Node),found);nodes[found-1].active=0;live--;pops++;}
  if(radix_top(&q,nodes,sizeof(Node)))return 6;cases++;
 }
 printf("{\"passed\":true,\"cases\":%u,\"attemptedOperations\":400000,\"inserts\":%llu,\"erases\":%llu,\"pops\":%llu}\n",cases,(unsigned long long)inserts,(unsigned long long)erases,(unsigned long long)pops);return 0;
}
