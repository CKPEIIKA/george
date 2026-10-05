// SPDX-License-Identifier: MIT
// Independent explicit prefix-twisted integer-polynomial derivatives.
// No discovery recursion, suffix permutation cache, or modular polynomial arithmetic.
// For d<=20, total coefficient l1 growth <=20! <2^63; signed 64-bit is exact.
// 128-bit words prevent the degree-17 truncation that a 64-bit encoding causes.
#include <array>
#include <cstdint>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <thread>
#include <atomic>
using U=__uint128_t;using Count=uint64_t;
struct WordHash{size_t operator()(U w)const{uint64_t x=uint64_t(w)^((uint64_t(w>>64)+0x9e3779b97f4a7c15ULL)*0xbf58476d1ce4e5b9ULL);x^=x>>30;x*=0xbf58476d1ce4e5b9ULL;x^=x>>27;return x^(x>>31);}};
using Poly=std::unordered_map<U,int64_t,WordHash>;
struct Node{std::array<int,15>next;std::vector<int>rows;Node(){next.fill(-1);}};
struct Verifier{
 int n,d,ne;std::array<std::pair<int,int>,15>edges{};int eid[6][6];int perm[15][15];std::vector<Node>trie{1};
 Verifier(int N,int D,const U*us,int nu):n(N),d(D){
  ne=0;for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){edges[ne]={i,j};eid[i][j]=eid[j][i]=ne++;}
  for(int e=0;e<ne;e++)for(int f=0;f<ne;f++){
   auto [a,b]=edges[e];auto [x,y]=edges[f];x=x==a?b:x==b?a:x;y=y==a?b:y==b?a:y;perm[e][f]=(x<y?1:-1)*(eid[x][y]+1);
  }
  for(int i=0;i<nu;i++){
   U u=us[i];int at=0;
   for(int j=0;j<d;j++){int e=int(u&15)-1;u>>=4;if(e<0||e>=ne)throw 1;int next=trie[at].next[e];if(next<0){next=trie.size();trie[at].next[e]=next;trie.emplace_back();}at=next;}
   if(u)throw 2;trie[at].rows.push_back(i);
  }
 }
 U mask(int l)const{return l>=32?~U(0):(U(1)<<(4*l))-1;}
 Poly derivative(const Poly&input,int e,int len)const{
  Poly out;
  for(auto [word,c]:input){
   U prefix=0;int sign=1;
   for(int j=0;j<len;j++){
    int shift=4*(len-j-1);int f=int((word>>shift)&15)-1;
    if(f==e){U v=(prefix<<shift)|(word&mask(len-j-1));out[v]+=sign*c;}
    int t=perm[e][f];prefix=(prefix<<4)|unsigned(std::abs(t));if(t<0)sign=-sign;
   }
  }
  for(auto it=out.begin();it!=out.end();)if(!it->second)it=out.erase(it);else ++it;
  return out;
 }
 void walk(int node,const Poly&poly,int len,int col,int nv,int64_t*out)const{
  if(poly.empty())return;
  if(!len){auto it=poly.find(0);if(it!=poly.end())for(int row:trie[node].rows)out[(size_t)row*nv+col]=it->second;return;}
  for(int e=0;e<ne;e++)if(trie[node].next[e]>=0){Poly child=derivative(poly,e,len);walk(trie[node].next[e],child,len-1,col,nv,out);}
 }
};
static int matrix_impl(int n,int d,const U*us,int nu,const U*vs,int nv,int64_t*out,int threads){
 if(n<2||n>6||d<0||d>20||nu<1||nv<1||threads<1||threads>16)return 1;
 try{
  Verifier v(n,d,us,nu);std::fill(out,out+(size_t)nu*nv,0);std::atomic<int>next{0},bad{0};
  for(int j=0;j<nv;j++){U w=vs[j];for(int k=0;k<d;k++){int e=int(w&15)-1;w>>=4;if(e<0||e>=v.ne)return 2;}if(w)return 2;}
  auto run=[&](){try{for(;;){int j=next++;if(j>=nv)break;v.walk(0,Poly{{vs[j],1}},d,j,nv,out);}}catch(...){bad=1;}};
  std::vector<std::thread>pool;try{for(int k=1;k<threads;k++)pool.emplace_back(run);run();}catch(...){bad=1;next=nv;}for(auto&t:pool)if(t.joinable())t.join();return bad?3:0;
 }catch(...){return 3;}
}

// Old ABI retained with its old input limit; new ABI explicitly accepts paired
// little-endian 64-bit halves, independently validated before derivative use.
extern "C" int kv_matrix(int n,int d,const Count*us,int nu,const Count*vs,int nv,int64_t*out,int threads){
 if(d<0||d>16||nu<1||nv<1||!us||!vs||!out)return 1;
 try{std::vector<U>u(nu),v(nv);for(int i=0;i<nu;i++)u[i]=us[i];for(int i=0;i<nv;i++)v[i]=vs[i];return matrix_impl(n,d,u.data(),nu,v.data(),nv,out,threads);}catch(...){return 3;}
}
extern "C" int kv_matrix_wide(int n,int d,const Count*us,int nu,const Count*vs,int nv,int64_t*out,int threads){
 if(d<0||d>20||nu<1||nv<1||!us||!vs||!out)return 1;
 try{std::vector<U>u(nu),v(nv);for(int i=0;i<nu;i++)u[i]=U(us[2*i])|(U(us[2*i+1])<<64);for(int i=0;i<nv;i++)v[i]=U(vs[2*i])|(U(vs[2*i+1])<<64);return matrix_impl(n,d,u.data(),nu,v.data(),nv,out,threads);}catch(...){return 3;}
}
extern "C" int kv_det_mod(int n,const int64_t*input,int p){
 if(n<0||n>10000||!input||p<2||p>1000000007)return -1;
 try{
  std::vector<int>a((size_t)n*n);for(size_t k=0;k<a.size();k++){int64_t v=input[k]%p;if(v<0)v+=p;a[k]=int(v);}int64_t det=1;
  for(int j=0;j<n;j++){
   int pivot=j;while(pivot<n&&!a[(size_t)pivot*n+j])pivot++;if(pivot==n)return 0;
   if(pivot!=j){for(int k=0;k<n;k++)std::swap(a[(size_t)j*n+k],a[(size_t)pivot*n+k]);det=(p-det)%p;}
   int v=a[(size_t)j*n+j];det=det*v%p;int64_t inv=1,x=v;int exp=p-2;while(exp){if(exp&1)inv=inv*x%p;x=x*x%p;exp>>=1;}
   for(int i=j+1;i<n;i++)if(a[(size_t)i*n+j]){
    int64_t c=a[(size_t)i*n+j]*inv%p;a[(size_t)i*n+j]=0;
    for(int k=j+1;k<n;k++){int64_t z=a[(size_t)i*n+k]-c*a[(size_t)j*n+k]%p;if(z<0)z+=p;a[(size_t)i*n+k]=int(z);}
   }
  }
  return int(det);
 }catch(...){return -2;}
}

// CLI verifier: exact prefix entries streamed in narrow column tiles. Retain only
// the modular square matrix required by elimination, not a second int64 matrix.
static int det_i32_inplace(int n,int32_t*a,int p){
 int64_t det=1;
 for(int j=0;j<n;j++){
  int pivot=j;while(pivot<n&&!a[(size_t)pivot*n+j])pivot++;if(pivot==n)return 0;
  if(pivot!=j){for(int k=j;k<n;k++)std::swap(a[(size_t)pivot*n+k],a[(size_t)j*n+k]);det=(p-det)%p;}
  int v=a[(size_t)j*n+j];det=det*v%p;int64_t inv=1,x=v;int exp=p-2;while(exp){if(exp&1)inv=inv*x%p;x=x*x%p;exp>>=1;}
  std::vector<int> nz;for(int k=j+1;k<n;k++)if(a[(size_t)j*n+k])nz.push_back(k);
  for(int i=j+1;i<n;i++)if(a[(size_t)i*n+j]){
   int64_t c=a[(size_t)i*n+j]*inv%p;a[(size_t)i*n+j]=0;
   for(int k:nz){int64_t z=a[(size_t)i*n+k]-c*a[(size_t)j*n+k]%p;if(z<0)z+=p;a[(size_t)i*n+k]=int(z);}
  }
 }
 return int(det);
}
extern "C" int kv_verify_compact(int n,int d,const Count*us,const Count*vs,int rank,int prime,int threads,int tile,const int32_t*expected,int32_t*detout,Count*stats){
 if(!us||!vs||!detout||!stats||rank<1||rank>32768||prime<3||prime>1000000007||tile<1||tile>1024||threads<1||threads>16||d<0||d>20)return 1;
 for(int q=2;int64_t(q)*q<=prime;q++)if(prime%q==0)return 1;
 try{std::vector<int32_t>a((size_t)rank*rank);uint64_t entries=0,maxabs=0;
 std::vector<U>u(rank),v(rank);for(int i=0;i<rank;i++){u[i]=U(us[2*i])|(U(us[2*i+1])<<64);v[i]=U(vs[2*i])|(U(vs[2*i+1])<<64);U w=v[i];for(int j=0;j<d;j++){int e=int(w&15)-1;w>>=4;if(e<0||e>=n*(n-1)/2)return 2;}if(w)return 2;}
 Verifier verifier(n,d,u.data(),rank);
 for(int col=0;col<rank;col+=tile){int nc=std::min(tile,rank-col);std::vector<int64_t>raw((size_t)rank*nc);std::atomic<int>next{0},bad{0};
  auto work=[&](){try{for(;;){int j=next++;if(j>=nc)break;verifier.walk(0,Poly{{v[col+j],1}},d,j,nc,raw.data());}}catch(...){bad=1;}};
  std::vector<std::thread>pool;try{for(int i=1;i<threads&&i<nc;i++)pool.emplace_back(work);work();}catch(...){bad=1;next=nc;}for(auto&t:pool)t.join();if(bad)return 3;
  for(int i=0;i<rank;i++)for(int j=0;j<nc;j++){int64_t v=raw[(size_t)i*nc+j];maxabs=std::max(maxabs,uint64_t(v<0?-v:v));int64_t m=v%prime;if(m<0)m+=prime;size_t pos=(size_t)i*rank+col+j;if(expected&&expected[pos]!=m)return 4;a[pos]=int(m);entries++;}
 }
 int det=det_i32_inplace(rank,a.data(),prime);*detout=det;stats[0]=entries;stats[1]=maxabs;return det?0:5;
 }catch(...){return 3;}
}
