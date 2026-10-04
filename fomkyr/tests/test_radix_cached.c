/* SPDX-License-Identifier: MIT. Cached queue against independent maximum search. */
#include <stdint.h>
#include <stddef.h>
#ifdef __wasm__
void *memset(void*,int,size_t);void *memcpy(void*,const void*,size_t);
#else
#include <string.h>
#endif
typedef uint64_t u64;typedef uint32_t u32;typedef uint8_t u8;typedef struct{u64 lo,hi;}Word;
static int wcmp(Word a,Word b){return a.hi!=b.hi?(a.hi>b.hi?1:-1):a.lo!=b.lo?(a.lo>b.lo?1:-1):0;}
#include "../src/radix_queue.inc"
typedef struct{Word w;u64 coeff_num,coeff_den;u32 hash_link,position;}Node;
static u64 seed=0x3743352128ac123dULL;
static u64 rnd(void){seed^=seed<<13;seed^=seed>>7;seed^=seed<<17;return seed;}
static u64 mix(u64 z){z^=z>>30;z*=0xbf58476d1ce4e5b9ULL;z^=z>>27;z*=0x94d049bb133111ebULL;return z^(z>>31);}
static Word maxword(u32 bits){return(Word){bits>=64?UINT64_MAX:(UINT64_C(1)<<bits)-1,bits>64?(bits==128?UINT64_MAX:(UINT64_C(1)<<(bits-64))-1):0};}

#ifndef __wasm__
#include <stdio.h>
#endif
#define CAP 257
static Node nodes[CAP];static u32 links[2][2][CAP];static RadixQueue q;
static Word bounded_word(u32 bits){Word v={rnd(),rnd()},m=maxword(bits);v.lo&=m.lo;v.hi&=m.hi;if(wcmp(v,q.last)>0){v.hi&=q.last.hi;if(wcmp(v,q.last)>0)v.lo&=q.last.lo;}return v;}
__attribute__((visibility("default")))u64 property(u32 trials,u32 steps){
 const u32 widths[]={12,52,56,64,65,80,124,128};u64 digest=0;seed=0x3743352128ac123dULL;
 for(u32 k=0;k<8;k++)for(u32 t=0;t<trials;t++){
  memset(nodes,0,sizeof(nodes));memset(&q,0,sizeof(q));u32 storage=0;q.previous=links[storage][0];q.next=links[storage][1];q.last=maxword(widths[k]);q.cache_enabled=t%2;u32 live=0;
  for(u32 i=0;i<steps;i++){
   u32 action=rnd()%10;
   if((action<6&&live<CAP)||!live){u32 id=1+rnd()%CAP;while(nodes[id-1].position)id=id%CAP+1;Word w=bounded_word(widths[k]);int dup=0;for(u32 j=0;j<CAP;j++)if(nodes[j].position&&!wcmp(w,nodes[j].w)){dup=1;break;}if(dup)continue;nodes[id-1].w=w;nodes[id-1].position=1;if(radix_insert(&q,nodes,sizeof(Node),id))return UINT64_MAX;live++;}
   else if(action<8){u32 id=1+rnd()%CAP;while(!nodes[id-1].position)id=id%CAP+1;radix_erase(&q,nodes,sizeof(Node),id);nodes[id-1].position=0;live--;}
   else{u32 best=0;for(u32 j=0;j<CAP;j++)if(nodes[j].position&&(!best||wcmp(nodes[j].w,nodes[best-1].w)>0))best=j+1;u32 id=radix_top(&q,nodes,sizeof(Node));if(id!=best)return UINT64_MAX-1;digest=mix(digest^nodes[id-1].w.lo^mix(nodes[id-1].w.hi));radix_erase(&q,nodes,sizeof(Node),id);nodes[id-1].position=0;live--;}
   if(i%127==0){storage^=1;memcpy(links[storage][0],q.previous,sizeof(links[storage][0]));memcpy(links[storage][1],q.next,sizeof(links[storage][1]));q.previous=links[storage][0];q.next=links[storage][1];}
  }
  while(live){u32 best=0;for(u32 j=0;j<CAP;j++)if(nodes[j].position&&(!best||wcmp(nodes[j].w,nodes[best-1].w)>0))best=j+1;u32 id=radix_top(&q,nodes,sizeof(Node));if(id!=best)return UINT64_MAX-2;radix_erase(&q,nodes,sizeof(Node),id);nodes[id-1].position=0;live--;}
  if(radix_top(&q,nodes,sizeof(Node)))return UINT64_MAX-3;
 }
 return digest;
}
#ifndef __wasm__
int main(void){u64 d=property(20,10000);printf("{\"cached\":%d,\"attemptedOperations\":1600000,\"digest\":\"%016llx\",\"queueBytes\":%zu}\n",1,(unsigned long long)d,sizeof(q));return d>=UINT64_MAX-3?1:0;}
#else
void*memset(void*p,int v,size_t n){u8*b=p;for(size_t i=0;i<n;i++)b[i]=(u8)v;return p;}
void*memcpy(void*p,const void*s,size_t n){u8*a=p;const u8*b=s;for(size_t i=0;i<n;i++)a[i]=b[i];return p;}
#endif
