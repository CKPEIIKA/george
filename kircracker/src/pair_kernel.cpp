// SPDX-License-Identifier: MIT
// Exact modular complementary-pairing evaluator; discovery acceleration only.
// Independent explicit-integer prefix derivatives replay every saved certificate.
#include <array>
#include <cstdint>
#include <algorithm>
#include <unordered_map>
#include <vector>
#include <stdexcept>
using U=__uint128_t;using Count=uint64_t;
struct Key{U u,v;bool operator==(const Key&b)const{return u==b.u&&v==b.v;}};
static Count mix(Count x){x^=x>>30;x*=0xbf58476d1ce4e5b9ULL;x^=x>>27;x*=0x94d049bb133111ebULL;return x^(x>>31);}
struct Hash{size_t operator()(const Key&k)const{return mix(Count(k.u))^mix(Count(k.u>>64)+0x517cc1b727220a95ULL)^mix(Count(k.v)+0x9e3779b97f4a7c15ULL)^mix(Count(k.v>>64)+0x6eed0e9da4d94a4fULL);}};
struct Eval{
 int n,p;size_t limit;std::vector<std::array<int,6>> ps;int left[15][720],right[720][15],inv[720],conj[720][15];std::array<std::pair<int,int>,15>es{};int idedge[6][6];std::unordered_map<Key,int,Hash>cache;Count calls=0,hits=0,skips=0;
 Eval(int N,int P,size_t lim):n(N),p(P),limit(lim){
  if(n<2||n>6||p<2||p>1000000007)throw std::invalid_argument("input");
  int E=0;for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){es[E]={i,j};idedge[i][j]=idedge[j][i]=E++;}
  std::array<int,6>a={0,1,2,3,4,5};do{ps.push_back(a);}while(std::next_permutation(a.begin(),a.begin()+n));
  auto lookup=[&](std::array<int,6>b){return int(std::lower_bound(ps.begin(),ps.end(),b)-ps.begin());};
  for(int s=0;s<(int)ps.size();s++){
   auto g=ps[s];a=g;for(int i=0;i<n;i++)a[g[i]]=i;inv[s]=lookup(a);
   for(int e=0;e<E;e++){
    int x=es[e].first,y=es[e].second;int u=g[x],v=g[y];conj[s][e]=(u<v?1:-1)*(idedge[u][v]+1);
    a=g;for(int i=0;i<n;i++)a[i]=a[i]==x?y:a[i]==y?x:a[i];left[e][s]=lookup(a);
    a=g;std::swap(a[x],a[y]);right[s][e]=lookup(a);
   }
  }
  cache.reserve(std::min(limit,size_t(2000000)));
 }
 U mask(int n){return n>=32?~U(0):(U(1)<<(4*n))-1;}
 int eval(U u,U v,int len){
  ++calls;if(!len)return 1;Key k{u,v};auto it=cache.find(k);if(it!=cache.end()){++hits;return it->second;}
  int e=int(u>>(4*(len-1)))-1;U tail=u&mask(len-1);int s=0;int64_t sum=0;
  for(int j=0;j<len;j++){
   int q=int((v>>(4*j))&15)-1;int match=conj[s][e];
   if(q==std::abs(match)-1){
    bool square=j>0&&j+1<len&&((v>>(4*(j-1)))&15)==((v>>(4*(j+1)))&15);
    if(square)++skips;else{
     U low=v&mask(j);U high=(j+1>=32?0:v>>(4*(j+1)));U cut=(high<<(4*j))|low;
     int a=eval(tail,cut,len-1);sum+=(match<0?-a:a);
    }
   }
   s=left[q][s];
  }
  int ans=int(sum%p);if(ans<0)ans+=p;if(cache.size()<limit)cache.emplace(k,ans);return ans;
 }
 int checked(U u,U v,int len){
  if(len<0||len>22)return -1;if(len<32&&((u>>(4*len))||(v>>(4*len))))return -1;int gu=0,gv=0,pu=-1,pv=-1,E=n*(n-1)/2;
  for(int j=len-1;j>=0;j--){int a=int((u>>(4*j))&15)-1,b=int((v>>(4*j))&15)-1;if(a<0||a>=E||b<0||b>=E)return -1;if(a==pu||b==pv)return 0;pu=a;pv=b;gu=right[gu][a];gv=right[gv][b];}
  if(gu!=inv[gv])return 0;return eval(u,v,len);
 }
};
extern "C" {
void* kp_create(int n,int p,Count limit){try{return new Eval(n,p,limit);}catch(...){return nullptr;}}
int kp_eval(void*e,Count u,Count v,int len){try{if(len>16)return -1;return ((Eval*)e)->checked(u,v,len);}catch(...){return -2;}}
Count kp_stat(void*e,int k){Eval*x=(Eval*)e;return k==0?x->calls:k==1?x->hits:k==2?x->cache.size():x->skips;}
int kp_eval_wide(void*e,Count ul,Count uh,Count vl,Count vh,int len){try{return ((Eval*)e)->checked(U(ul)|(U(uh)<<64),U(vl)|(U(vh)<<64),len);}catch(...){return -2;}}
int kp_column_wide(void*e,const Count*us,int nu,Count vl,Count vh,int len,int*out){
 if(!e||!us||!out||nu<0||nu>2000000||len<0||len>22)return 1;
 try{U v=U(vl)|(U(vh)<<64);for(int i=0;i<nu;i++){int value=((Eval*)e)->checked(U(us[2*i])|(U(us[2*i+1])<<64),v,len);if(value<0)return 2;out[i]=value;}return 0;}catch(...){return 3;}
}
void kp_clear(void*e){((Eval*)e)->cache.clear();}
void kp_destroy(void*e){delete (Eval*)e;}
}

#include "minor_stream.inc"
