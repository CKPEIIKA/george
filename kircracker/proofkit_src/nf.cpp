// SPDX-License-Identifier: MIT
// Exact read-only GNB oracle. Not the completion producer; no FK-specific rewrite.
#include <gmpxx.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <map>
#include <queue>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>
#include <stdexcept>
#include <memory>
#include <cmath>
using Word=std::string;using P=std::unordered_map<Word,mpq_class>;
using Clock=std::chrono::steady_clock;
static uint32_t u32(const unsigned char*p){return uint32_t(p[0])|uint32_t(p[1])<<8|uint32_t(p[2])<<16|uint32_t(p[3])<<24;}
static uint64_t u64(const unsigned char*p){return uint64_t(u32(p))|uint64_t(u32(p+4))<<32;}
struct Entry{uint64_t at;uint32_t size,n,d;Word lm;};
struct Oracle{
 int fd=-1;const unsigned char*data=nullptr;size_t bytes=0;unsigned ng,D;std::vector<Entry>g;
 std::map<unsigned,std::unordered_map<Word,size_t>>ix;std::unordered_map<size_t,std::vector<std::pair<Word,mpq_class>>>cache;
 size_t cached=0,cacheLimit=64u<<20;std::string result;Clock::time_point end;size_t maxterms=1000000;uint64_t steps=0;bool oldest=false;
 Oracle(const char*path,unsigned gen,unsigned degree):ng(gen),D(degree){
  if(!ng||ng>16)throw std::runtime_error("generator count 1..16 required");
  fd=open(path,O_RDONLY);if(fd<0)throw std::runtime_error("cannot open basis");struct stat s{};if(fstat(fd,&s)||s.st_size<0){close(fd);fd=-1;throw std::runtime_error("cannot stat basis");}bytes=size_t(s.st_size);
  if(bytes){void*p=mmap(nullptr,bytes,PROT_READ,MAP_PRIVATE,fd,0);if(p==MAP_FAILED){close(fd);fd=-1;throw std::runtime_error("cannot map basis");}data=(const unsigned char*)p;}
  try{size_t off=0;unsigned prev=0;while(off<bytes){if(bytes-off<32)throw std::runtime_error("short record header");auto*h=data+off;uint32_t sz=u32(h+4),n=u32(h+8),d=u32(h+12);
   if(u32(h)!=0x31424e47||sz<32||sz>bytes-off||!n||uint64_t(n)*24+32>sz||!d||u64(h+24)||d<prev)throw std::runtime_error("invalid/unsorted GNB record");prev=d;
   if(d>D)break;Entry e{off,sz,n,d,{}};e.lm=word(e,0);auto id=g.size();if(!ix[d].emplace(e.lm,id).second)throw std::runtime_error("duplicate leading word");g.push_back(e);off+=sz;
  }}catch(...){if(data)munmap((void*)data,bytes);close(fd);data=nullptr;fd=-1;throw;}
 }
 ~Oracle(){if(data)munmap((void*)data,bytes);if(fd>=0)close(fd);}
 Word word(const Entry&e,unsigned i)const{
  const auto*h=data+e.at;const auto*t=h+32+24ull*i;uint64_t lo=u64(t),hi=u64(t+8);Word w;
  if(hi>>63){if(e.d<=31||hi!=((1ull<<63)|e.d)||lo<32ull+24ull*e.n||lo>e.size||e.d>e.size-lo)throw std::runtime_error("invalid long word offset");w.assign((const char*)h+lo,e.d);}
  else{if(e.d>31)throw std::runtime_error("invalid inline word");w.resize(e.d);__uint128_t v=(__uint128_t(hi)<<64)|lo;if(v>>(4*e.d))throw std::runtime_error("noncanonical word");for(unsigned j=e.d;j--;){w[j]=char(unsigned(v&15));v>>=4;}}
  for(unsigned char c:w)if(c>=ng)throw std::runtime_error("out of range generator");return w;
 }
 mpq_class coef(const Entry&e,unsigned i)const{
  const auto*h=data+e.at;uint64_t c=u64(h+48+24ull*i);mpz_class z;
  if(c&1){uint64_t a=c&~7ull;if(a<32ull+24ull*e.n||a>e.size||e.size-a<8)throw std::runtime_error("invalid coefficient offset");uint32_t n=u32(h+a);if(!n||8ull+4ull*n>e.size-a||u32(h+a+4))throw std::runtime_error("invalid coefficient limbs");mpz_import(z.get_mpz_t(),n,-1,4,-1,0,h+a+8);if(c&2)z=-z;}
  else{int64_t v;std::memcpy(&v,&c,8);z=std::to_string(v/2);}
  if(z==0)throw std::runtime_error("zero coefficient");return mpq_class(z);
 }
 const std::vector<std::pair<Word,mpq_class>>& row(size_t id){
  auto it=cache.find(id);if(it!=cache.end())return it->second;const Entry&e=g.at(id);const auto*h=data+e.at;
  uint64_t ch=1469598103934665603ull;for(size_t i=32;i<e.size;i++)ch=(ch^h[i])*1099511628211ull;if(ch!=u64(h+16))throw std::runtime_error("record checksum mismatch");
  std::vector<std::pair<Word,mpq_class>>v;v.reserve(e.n);mpq_class lead=coef(e,0);if(lead<0)throw std::runtime_error("negative stored leading coefficient");Word prev;
  for(unsigned i=0;i<e.n;i++){auto w=word(e,i);if(i&&w>=prev)throw std::runtime_error("unsorted/duplicate terms");prev=w;v.emplace_back(std::move(w),coef(e,i)/lead);}
  // Cache charge is a conservative logical byte budget, not a process RSS promise.
  size_t cost=e.size+e.n*(sizeof(mpq_class)+sizeof(Word)+e.d+48ull);if(cached>=cacheLimit||cost>cacheLimit-cached){cache.clear();cached=0;}cached+=cost;
  return cache.emplace(id,std::move(v)).first->second;
 }
 std::pair<size_t,unsigned> hit(const Word&w,size_t skip){size_t best=SIZE_MAX;unsigned pos=0;for(auto&[d,m]:ix){if(d>w.size())break;for(unsigned j=0;j+d<=w.size();j++){auto it=m.find(w.substr(j,d));if(it!=m.end()&&it->second!=skip){if(!oldest)return{it->second,j};if(it->second<best){best=it->second;pos=j;}}}}return{best,pos};}
 void poll(){if(Clock::now()>end)throw std::runtime_error("TIME_LIMIT");}
 static void add(P&p,std::priority_queue<Word>&q,const Word&w,const mpq_class&c){if(c==0)return;auto it=p.find(w);if(it==p.end()){p.emplace(w,c);q.push(w);}else{it->second+=c;if(it->second==0)p.erase(it);}}
 P nf(P p,unsigned d,size_t skip){std::priority_queue<Word>q;for(auto&x:p)if(x.second!=0)q.push(x.first);P out;steps=0;
  while(!q.empty()){auto w=q.top();q.pop();auto it=p.find(w);if(it==p.end())continue;mpq_class c=std::move(it->second);p.erase(it);if((++steps&1023)==0)poll();if(p.size()+out.size()>maxterms||q.size()>maxterms*8ull+1024)throw std::runtime_error("TERM_LIMIT");auto[id,j]=hit(w,skip);if(id==SIZE_MAX){out.emplace(std::move(w),std::move(c));continue;}auto&rr=row(id);auto left=w.substr(0,j),right=w.substr(j+g[id].d);for(size_t k=1;k<rr.size();k++){if(!(k&511)){poll();if(p.size()+out.size()>maxterms)throw std::runtime_error("TERM_LIMIT");}add(p,q,left+rr[k].first+right,-c*rr[k].second);}
  }poll();return out;
 }
};
thread_local std::string error;
static Word hexword(std::string v,unsigned ng){if(v=="-")return{};Word w;for(char c:v){unsigned a=c>='0'&&c<='9'?c-'0':c>='a'&&c<='f'?c-'a'+10:999;if(a>=ng)throw std::runtime_error("invalid query letter");w+=char(a);}return w;}
static std::string hex(const Word&w){if(w.empty())return"-";std::string v;for(unsigned char c:w)v+="0123456789abcdef"[c];return v;}
extern "C"{
void* kp_open(const char*p,unsigned n,unsigned d){try{return new Oracle(p,n,d);}catch(std::exception&e){error=e.what();return nullptr;}}
void kp_close(void*p){delete (Oracle*)p;}
const char* kp_error(){return error.c_str();}
uint64_t kp_rules(void*p){return ((Oracle*)p)->g.size();}
const char* kp_query(void*ptr,const char*text,double seconds,uint64_t maxterms,int64_t skip,int oldest){auto&o=*(Oracle*)ptr;try{
 if(!std::isfinite(seconds)||seconds<=0||seconds>1e9||maxterms<1)throw std::runtime_error("invalid query budget");o.end=Clock::now()+std::chrono::milliseconds((int64_t)(seconds*1000));o.maxterms=maxterms;o.oldest=oldest;
 std::istringstream in(text);unsigned d,n;if(!(in>>d>>n)||n>maxterms)throw std::runtime_error("invalid query header");P p;for(unsigned i=0;i<n;i++){std::string w,c;if(!(in>>w>>c))throw std::runtime_error("short query");auto u=hexword(w,o.ng);if(u.size()!=d)throw std::runtime_error("inhomogeneous query");mpq_class z;if(z.set_str(c,10)||z.get_den()==0)throw std::runtime_error("invalid rational");z.canonicalize();p[u]+=z;if(p[u]==0)p.erase(u);}std::string extra;if(in>>extra)throw std::runtime_error("extra query data");auto out=o.nf(std::move(p),d,skip<0?SIZE_MAX:size_t(skip));std::map<Word,mpq_class,std::greater<Word>>sorted(out.begin(),out.end());std::ostringstream s;s<<"OK "<<d<<' '<<out.size()<<' '<<o.steps<<'\n';for(auto&[w,c]:sorted)s<<hex(w)<<' '<<c.get_str()<<'\n';o.result=s.str();return o.result.c_str();
 }catch(std::exception&e){error=e.what();o.result="ERROR "+error;return o.result.c_str();}}
}
