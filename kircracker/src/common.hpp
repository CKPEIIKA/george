#pragma once
// SPDX-License-Identifier: MIT
// Original-relation induced-module lift; no Groebner or Nichols computation.
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <limits>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <mutex>
#include <numeric>
#include <stdexcept>
#include <string>
#include <thread>
#include <type_traits>
#include <unordered_map>
#include <utility>
#include <vector>
#include <boost/multiprecision/cpp_int.hpp>
#include <sys/resource.h>
using u32=uint32_t;using u64=uint64_t;
using Clock=std::chrono::steady_clock;
struct Options {u32 n=6,degree=10,prime=0,threads=1,maxcols=1000000;u64 maxterms=30000000;double seconds=60;bool graded=true,packed2=false;std::string dump;u32 dumpdegree=5;};
static u32 modulus=31991;
struct Mod {using C=u32;static C val(int x){return x>=0?u32(x)%modulus:(modulus-u32(-int64_t(x))%modulus)%modulus;}static C add(C x,C y){u64 s=u64(x)+y;return s>=modulus?s-modulus:s;}static C mul(C x,C y){return u64(x)*y%modulus;}static C neg(C x){return x?modulus-x:0;}static C inv(C a){u32 b=modulus-2,r=1;while(b){if(b&1)r=mul(r,a);a=mul(a,a);b>>=1;}return r;}static bool zero(C x){return !x;}static std::string text(C x){return std::to_string(x);}};
// Exact characteristic-two specialization: remove division/modulo from the
// coefficient hot path, including row assembly before packed elimination.
struct BinaryField {using C=u32;static C val(int x){return u32(x)&1;}static C add(C x,C y){return x^y;}static C mul(C x,C y){return x&y;}static C neg(C x){return x;}static C inv(C x){if(x!=1)throw std::runtime_error("invalid GF2 pivot");return 1;}static bool zero(C x){return !x;}static std::string text(C x){return std::to_string(x);}};
struct Rat {using C=boost::multiprecision::cpp_rational;static C val(int x){return C(x);}static C add(const C&x,const C&y){return x+y;}static C mul(const C&x,const C&y){return x*y;}static C neg(const C&x){return -x;}static C inv(const C&x){return 1/x;}static bool zero(const C&x){return x==0;}static std::string text(const C&x){return x.str();}};
template<class F> struct Term {u32 col;typename F::C c;};
template<class F> using Vec=std::vector<Term<F>>;
template<class F> void axpy(Vec<F>&a,const Vec<F>&b,const typename F::C&c,u32 shift=0){
 if(F::zero(c)||b.empty())return;
 Vec<F> out;out.reserve(a.size()+b.size());size_t i=0,j=0;
 while(i<a.size()||j<b.size()){
  if(j==b.size()||(i<a.size()&&a[i].col<b[j].col+shift)){out.push_back(a[i++]);continue;}
  u32 col=b[j].col+shift;auto value=F::mul(c,b[j++].c);
  if(i<a.size()&&a[i].col==col)value=F::add(value,a[i++].c);
  if(!F::zero(value))out.push_back({col,std::move(value)});
 }
 a.swap(out);
}
struct Relation {struct T{u32 a,b;int c;};std::vector<T> terms;};
struct Permutations {
 u32 n;std::vector<std::vector<u32>> ps;std::unordered_map<u32,u32> index;std::vector<std::vector<u32>> left;
 static u32 code(const std::vector<u32>&p){u32 c=0;for(auto x:p)c=(c<<3)|x;return c;}
 Permutations(u32 nn,const std::vector<std::pair<u32,u32>>&edges):n(nn){std::vector<u32> p(n);std::iota(p.begin(),p.end(),0);do{index[code(p)]=ps.size();ps.push_back(p);}while(std::next_permutation(p.begin(),p.end()));
  left.resize(edges.size(),std::vector<u32>(ps.size()));for(u32 e=0;e<edges.size();e++)for(u32 g=0;g<ps.size();g++){auto q=ps[g];auto [a,b]=edges[e];for(auto&x:q){if(x==a)x=b;else if(x==b)x=a;}left[e][g]=index.at(code(q));}
 }
};
static u32 read_u32(const std::string& value){
 if(value.empty()||value[0]=='-'||value.find_first_not_of("0123456789")!=std::string::npos)throw std::runtime_error("unsigned integer option required");
 auto v=std::stoull(value);if(v>std::numeric_limits<u32>::max())throw std::runtime_error("32-bit option overflow");return u32(v);
}
