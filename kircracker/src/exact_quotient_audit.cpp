// SPDX-License-Identifier: MIT
// Independent rational verifier for a supplied bounded quotient. Not fomkyr.
// Exact arithmetic: GMP rational numbers. No data from lower-bound targets.
#include <gmpxx.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <limits>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>
using U=uint64_t;using Clock=std::chrono::steady_clock;
struct T{U w;long c;};struct Rule{unsigned d;std::vector<T>t;};
std::vector<Rule> G;std::vector<std::unordered_map<U,unsigned>> lm(15);std::vector<unsigned> lengths;
struct Hit{unsigned rule,pos;};const unsigned NIL=~0u;unsigned D=14;double seconds=180;Clock::time_point start;std::atomic<uint64_t>checks{0},steps{0};std::atomic<bool>stop{false};std::mutex logmx;
U mask(unsigned d){return d?((U(1)<<(4*d))-1):0;}
unsigned letter(U w,unsigned d,unsigned p){return unsigned(w>>(4*(d-p-1)))&15;}
U piece(U w,unsigned d,unsigned pos,unsigned len){return (w>>(4*(d-pos-len)))&mask(len);}
U ctx(U w,unsigned d,unsigned pos,unsigned k,U rep){unsigned right=d-pos-k;U shell=w&~(mask(k)<<(4*right));return shell|(rep<<(4*right));}
void load(const std::string&file){
 std::ifstream in(file,std::ios::binary);if(!in)throw std::runtime_error("record open");
 unsigned char h[32];uint64_t total_terms=0;bool squares[5]={};
 for(;;){
  in.read((char*)h,32);auto got=in.gcount();if(got==0&&in.eof())break;if(got!=32)throw std::runtime_error("truncated header");
  uint32_t sz,n,d,magic;memcpy(&magic,h,4);memcpy(&sz,h+4,4);memcpy(&n,h+8,4);memcpy(&d,h+12,4);
  if(magic!=0x31424e47||d<1||d>D||!n||sz>64*1024*1024||uint64_t(sz)!=32+uint64_t(n)*24)throw std::runtime_error("unsupported record header/size");
  total_terms+=n;if(total_terms>20000000||G.size()>200000)throw std::runtime_error("input audit budget");
  std::vector<unsigned char>b(sz);memcpy(b.data(),h,32);if(!in.read((char*)b.data()+32,sz-32))throw std::runtime_error("short record");
  U stored;memcpy(&stored,b.data()+16,8);U sum=1469598103934665603ull;for(size_t i=32;i<sz;i++)sum=(sum^b[i])*1099511628211ull;if(stored!=sum)throw std::runtime_error("checksum");
  Rule r;r.d=d;r.t.reserve(n);
  for(unsigned i=0;i<n;i++){
   U w,hi,c;memcpy(&w,b.data()+32+24*i,8);memcpy(&hi,b.data()+40+24*i,8);memcpy(&c,b.data()+48+24*i,8);
   if(hi||(c&1)||!c||w>mask(d))throw std::runtime_error("invalid or unsupported compact record term");
   for(unsigned k=0;k<d;k++)if(letter(w,d,k)>=5)throw std::runtime_error("generator out of range");
   long coefficient=(c>>63)?-long((~c+1)>>1):long(c>>1);if(!coefficient)throw std::runtime_error("zero coefficient");
   r.t.push_back({w,coefficient});if(i&&r.t[i-1].w<=w)throw std::runtime_error("unsorted row");
  }
  if(r.t[0].c<=0)throw std::runtime_error("invalid leading coefficient");
  unsigned id=G.size();if(!lm[d].emplace(r.t[0].w,id).second)throw std::runtime_error("duplicate leader");
  if(d==2&&n==1&&letter(r.t[0].w,2,0)==letter(r.t[0].w,2,1))squares[letter(r.t[0].w,2,0)]=true;
  G.push_back(std::move(r));
 }
 if(G.empty()||!std::all_of(squares,squares+5,[](bool a){return a;}))throw std::runtime_error("all five square relations required");
 for(unsigned d=1;d<=D;d++)if(!lm[d].empty())lengths.push_back(d);
}
struct Reducer{
 std::vector<std::unordered_map<U,Hit>> cache;U localsteps=0;Reducer():cache(D+1){}
 void poll(){if(stop||std::chrono::duration<double>(Clock::now()-start).count()>seconds){stop=true;throw std::runtime_error("budget exceeded; no certificate");}}
 Hit find(U w,unsigned d){auto&cc=cache[d];auto found=cc.find(w);if(found!=cc.end())return found->second;Hit out{NIL,0};for(auto k:lengths){if(k>d)break;for(unsigned p=0;p+k<=d;p++){auto q=lm[k].find(piece(w,d,p,k));if(q!=lm[k].end()){out={q->second,p};goto done;}}}done:if(cc.size()<150000)cc[w]=out;return out;}
 using P=std::unordered_map<U,mpq_class>;
 static void add(P&p,std::priority_queue<U>&heap,U w,const mpq_class&c){if(c==0)return;auto it=p.find(w);if(it==p.end()){p.emplace(w,c);heap.push(w);}else{it->second+=c;if(it->second==0)p.erase(it);}}
 P nf(P input,unsigned d){std::priority_queue<U>heap;for(auto&[w,c]:input)if(c!=0)heap.push(w);P out;while(!heap.empty()){
 U w=heap.top();heap.pop();auto it=input.find(w);if(it==input.end())continue;mpq_class c=std::move(it->second);input.erase(it);if(c==0)continue;if(!(++localsteps&4095))poll();auto h=find(w,d);if(h.rule==NIL){out.emplace(w,std::move(c));continue;}auto&r=G[h.rule];c/=-r.t[0].c;for(size_t j=1;j<r.t.size();j++)add(input,heap,ctx(w,d,h.pos,r.d,r.t[j].w),c*r.t[j].c);
 }steps.fetch_add(localsteps,std::memory_order_relaxed);localsteps=0;return out;}
};
void addterm(Reducer::P&p,U w,const mpq_class&c){auto&v=p[w];v+=c;if(v==0)p.erase(w);}
Reducer::P permute(const Rule&r,unsigned a,unsigned b){Reducer::P p;for(auto&t:r.t){U w=0;for(unsigned i=0;i<r.d;i++){unsigned c=letter(t.w,r.d,i);if(c==a)c=b;else if(c==b)c=a;w=w*16+c;}addterm(p,w,mpq_class(t.c));}return p;}
Reducer::P delta(const Rule&r,unsigned a,unsigned b){Reducer::P p;for(auto&t:r.t){U pre=0;for(unsigned i=0;i<r.d;i++){unsigned c=letter(t.w,r.d,i),n=r.d-i-1;U suf=t.w&mask(n);if(c==a)addterm(p,(pre<<(4*(n+2)))|((U(a)*16+b)<<(4*n))|suf,mpq_class(-t.c));else if(c==b)addterm(p,(pre<<(4*(n+2)))|((U(b)*16+a)<<(4*n))|suf,mpq_class(t.c));pre=pre*16+(c==a?b:c==b?a:c);}}return p;}
struct Job{unsigned type,a,b,k;};std::vector<Job>jobs;
void fail(const Job&j,const Reducer::P&p){std::lock_guard<std::mutex>l(logmx);std::cerr<<"NONZERO type="<<j.type<<" a="<<j.a<<" b="<<j.b<<" k="<<j.k<<" terms="<<p.size()<<"\n";std::ofstream f("audit-nonzero.txt");f<<j.type<<' '<<j.a<<' '<<j.b<<' '<<j.k<<'\n';for(auto&[w,c]:p)f<<w<<' '<<c<<'\n';stop=true;}
int main(int argc,char**argv){try{
 if(argc<3)throw std::runtime_error("usage recordfile critical|closure|query [seconds] [threads]");std::string mode=argv[2];if(argc>3)seconds=std::stod(argv[3]);unsigned nth=argc>4?std::stoul(argv[4]):4;if(!std::isfinite(seconds)||seconds<=0||nth<1||nth>32)throw std::runtime_error("invalid time/thread budget");start=Clock::now();load(argv[1]);
 // Antichain/inclusion audit; no inclusion ambiguity may be ignored.
 for(unsigned id=0;id<G.size();id++){auto&r=G[id];for(auto k:lengths){if(k>r.d)break;for(unsigned p=0;p+k<=r.d;p++){auto it=lm[k].find(piece(r.t[0].w,r.d,p,k));if(it!=lm[k].end()&&it->second!=id)throw std::runtime_error("leading-word inclusion");}}}
 if(mode=="closure"){
 for(unsigned id=0;id<G.size();id++){for(unsigned s=0;s<4;s++)jobs.push_back({1,id,s,0});if(G[id].d<D)jobs.push_back({2,id,0,1});}
 }else if(mode=="critical"){
 std::vector<std::unordered_map<U,std::vector<unsigned>>>prefix(D+1);
 for(unsigned id=0;id<G.size();id++)for(unsigned k=1;k<G[id].d;k++)prefix[k][piece(G[id].t[0].w,G[id].d,0,k)].push_back(id);
 for(unsigned id=0;id<G.size();id++){auto&r=G[id];for(unsigned k=1;k<r.d;k++){auto it=prefix[k].find(r.t[0].w&mask(k));if(it==prefix[k].end())continue;for(unsigned j:it->second)if(r.d+G[j].d-k<=D)jobs.push_back({0,id,j,k});}}
 }else if(mode=="query"){
 unsigned d,n;if(!(std::cin>>d>>n)||d>D||!d||n>200000)throw std::runtime_error("bad query header");Reducer::P p;for(unsigned i=0;i<n;i++){U w;std::string c;if(!(std::cin>>w>>c)||w>mask(d))throw std::runtime_error("bad query term");for(unsigned j=0;j<d;j++)if(letter(w,d,j)>=5)throw std::runtime_error("bad query generator");mpq_class v;if(v.set_str(c,10)||v.get_den()==0)throw std::runtime_error("bad query coefficient");v.canonicalize();addterm(p,w,v);}Reducer reducer;auto out=reducer.nf(std::move(p),d);std::cout<<"{\"mode\":\"query\",\"degree\":"<<d<<",\"terms\":"<<out.size()<<",\"steps\":"<<steps<<"}\n";std::map<U,mpq_class>sorted(out.begin(),out.end());for(auto&[w,c]:sorted)std::cout<<w<<' '<<c<<'\n';return 0;
 }else throw std::runtime_error("mode");
 std::atomic<U>next{0};auto work=[&]{Reducer red;try{for(;;){U id=next.fetch_add(1);if(id>=jobs.size()||stop)break;auto j=jobs[id];Reducer::P p;unsigned d=0;auto&a=G[j.a];
 if(j.type==1){p=permute(a,j.b,j.b+1);d=a.d;}
 else if(j.type==2){p=delta(a,j.b,j.k);d=a.d+1;}
 else{auto&b=G[j.b];d=a.d+b.d-j.k;unsigned suffix=b.d-j.k;U s=b.t[0].w&mask(suffix),pre=a.t[0].w>>(4*j.k);for(auto&t:a.t)addterm(p,(t.w<<(4*suffix))|s,mpq_class(t.c)*b.t[0].c);for(auto&t:b.t)addterm(p,(pre<<(4*b.d))|t.w,-mpq_class(t.c)*a.t[0].c);}
 auto out=red.nf(std::move(p),d);if(!out.empty()){fail(j,out);break;}U c=checks.fetch_add(1)+1;if(!(c%10000)){std::lock_guard<std::mutex>l(logmx);std::cerr<<"checked "<<c<<"/"<<jobs.size()<<" steps "<<steps<<" seconds "<<std::chrono::duration<double>(Clock::now()-start).count()<<"\n";}red.poll();
 }}catch(const std::exception&e){std::lock_guard<std::mutex>l(logmx);std::cerr<<e.what()<<'\n';stop=true;}};
 std::vector<std::thread>th;for(unsigned i=1;i<nth;i++)th.emplace_back(work);work();for(auto&t:th)t.join();double elapsed=std::chrono::duration<double>(Clock::now()-start).count();std::cout<<"{\"mode\":\""<<mode<<"\",\"rules\":"<<G.size()<<",\"jobs\":"<<jobs.size()<<",\"checked\":"<<checks<<",\"steps\":"<<steps<<",\"seconds\":"<<elapsed<<",\"passed\":"<<(!stop&&checks==jobs.size()?"true":"false")<<"}\n";return stop?2:0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
