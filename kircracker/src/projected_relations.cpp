// SPDX-License-Identifier: MIT
// Q-exact elimination of missing literal words, followed by a replayable F2
// minor on the original chart. No missing term or even coefficient is dropped.
// The chart's spanning authority is an external dependency, never inferred here.
#define main contained_reference_program
#include "contained_relations.cpp"
#undef main
#include "checkpoint_io.hpp"
#include <gmpxx.h>
#include <csignal>
#include <iomanip>
#include <limits>
#include <map>

namespace qp {
struct Iterm {U w;mpz_class c;};
using Row=std::vector<Iterm>;
struct Irel {V d;Row terms;};
struct Node {std::array<int,5> next;std::vector<std::pair<V,V>> ends;Node(){next.fill(-1);}};
struct Aux {V number;Row row;};
struct Key {U prefix,suffix;V rel,pos;bool operator==(const Key&x)const{return prefix==x.prefix&&suffix==x.suffix&&rel==x.rel&&pos==x.pos;}};
struct KeyHash{size_t operator()(const Key&x)const{return Hash{}(x.prefix)^Hash{}(x.suffix+U(x.rel)*239+U(x.pos)*31);}};
static volatile std::sig_atomic_t stop=0;
static void signal(int){stop=1;}
static size_t bytes(const Row&r){size_t n=r.capacity()*sizeof(Iterm);for(auto&t:r)n+=size_t(mpz_size(t.c.get_mpz_t()))*sizeof(mp_limb_t)+32;return n;}
static void normalize(Row&r){
 if(r.empty())return;mpz_class g=0;for(auto&t:r){mpz_gcd(g.get_mpz_t(),g.get_mpz_t(),t.c.get_mpz_t());if(g==1)break;}
 if(r.back().c<0)g=-g;if(g!=1)for(auto&t:r)mpz_divexact(t.c.get_mpz_t(),t.c.get_mpz_t(),g.get_mpz_t());
}
static std::vector<Irel> library(const std::string&path,V&k){std::ifstream f(path);V n;need(bool(f>>k>>n)&&k>=1&&k<=5&&n&&n<=10000,"relation library dimensions");std::vector<Irel>out;
 for(V i=0;i<n;i++){Irel r;V nt;need(bool(f>>r.d>>nt)&&r.d>=1&&r.d<=31&&nt&&nt<=100000,"relation shape");std::map<U,mpz_class> combined;
  for(V t=0;t<nt;t++){std::string c;need(bool(f>>c)&&c.size()<=100000,"relation coefficient");size_t at=c[0]=='-'?1:0;need(at<c.size()&&c.find_first_not_of("0123456789",at)==std::string::npos,"integer coefficient");mpz_class v(c);U w=0;for(V j=0;j<r.d;j++){V a;need(bool(f>>a)&&a<k,"relation letter");w=(w<<4)|a;}combined[w]+=v;}
  for(auto&[w,c]:combined)if(c!=0)r.terms.push_back({w,c});need(!r.terms.empty(),"zero relation");
  V g=permutation_grade(r.terms.front().w,r.d);for(auto&t:r.terms)need(permutation_grade(t.w,r.d)==g,"not permutation-homogeneous");out.push_back(std::move(r));
 }std::string extra;need(!(f>>extra),"extra relation input");return out;}
static bool killed(U w,V D,V boundary){return (boundary>>(V((w>>(4*(D-1)))&15)))&1;}
struct Limit{const char*reason;};
}
int main(int argc,char**argv){
 using namespace qp;
 try{
  need(argc==13,"usage: frame relations binding output group seconds memoryBytes maxAuxPivots maxAuxWords maxDepth prefixKillMask first|all");
  std::string frame=argv[1],lib=argv[2],bind=argv[3],out=argv[4],anchor=argv[12];V group=std::stoul(argv[5]),maxAux=std::stoul(argv[8]),maxWords=std::stoul(argv[9]),maxDepth=std::stoul(argv[10]),boundary=std::stoul(argv[11]);double seconds=std::stod(argv[6]);B budget=std::stoull(argv[7]);
  need(bind.size()==64&&bind.find_first_not_of("0123456789abcdef")==std::string::npos&&group<720&&std::isfinite(seconds)&&seconds>0&&budget>=64*1024*1024&&maxAux<10000000&&maxWords<10000000&&maxDepth<=16&&boundary<32&&(anchor=="first"||anchor=="all"),"limits/binding");
  std::signal(SIGINT,qp::signal);std::signal(SIGTERM,qp::signal);auto start=std::chrono::steady_clock::now();auto elapsed=[&](){return std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count();};B polls=0;
  auto check=[&](){if(stop||(!(++polls&511)&&elapsed()>seconds))throw Limit{"deadline-or-signal"};};
  V D,k,prime;{std::ifstream f(frame,std::ios::binary);f.seekg(72);D=get(f,4);k=get(f,4);prime=get(f,4);}need(D>=2&&D<=31&&k>=1&&k<=5&&prime==2,"frame degree/generators/prime");
  BinaryReader f(frame,bind,D,k,2);need(!f.actions&&f.words<100000000,"expected action-free spanning chart");
  std::vector<U> words;
  for(B i=0;i<f.words;i++){U w=U(f.number(8));w|=U(f.number(8))<<64;V g=f.number(4);need(g<720&&!(w>>(4*D)),"frame word metadata");if(g==group){need(permutation_grade(w,D)==g,"frame sector");for(V j=0;j<D;j++)need(((w>>(4*j))&15)<k,"frame alphabet");need(!killed(w,D,boundary),"chart contains words killed by requested module prefix");words.push_back(w);}}
  f.finish();need(!words.empty()&&words.size()<10000000&&std::is_sorted(words.begin(),words.end())&&std::adjacent_find(words.begin(),words.end())==words.end(),"chart word ordering/size");V width=words.size();
  std::unordered_map<U,V,Hash> index;index.reserve(width*2);for(V i=0;i<width;i++)index.emplace(words[i],i);
  V rk;auto rels=library(lib,rk);need(rk==k,"alphabet mismatch");
  auto less=[&](U a,U b){bool ai=index.count(a),bi=index.count(b);if(ai!=bi)return ai;return a<b;};
  // The original library parser sorted and combined terms; preserve that explicit
  // indexing in the trace. Use its first odd term in the conservative mode.
  std::vector<Node>trie(1);for(V ri=0;ri<rels.size();ri++){auto&r=rels[ri];if(r.d>D)continue;bool first=true;for(V ti=0;ti<r.terms.size();ti++){
   if(anchor=="first"){if(!mpz_odd_p(r.terms[ti].c.get_mpz_t())||!first)continue;first=false;}
   U w=r.terms[ti].w;int st=0;for(V j=0;j<r.d;j++){V a=V((w>>(4*j))&15);int n=trie[st].next[a];if(n<0){n=trie.size();trie[st].next[a]=n;trie.emplace_back();}st=n;}trie[st].ends.push_back({ri,ti});
  }}
  need(!std::filesystem::exists(out),"use a NEW output directory (no overwrite)");std::filesystem::create_directories(out);
  std::ofstream trace(out+"/projected.qpr",std::ios::binary);trace.write("QCPREL01",8);trace.write(bind.data(),64);for(V v:{D,k,group,boundary,width})put(trace,v,4);for(U w:words)wordout(trace,w);
  std::unordered_map<U,Aux,Hash> exterior;std::vector<std::vector<V>> inside(width);B stored=0,contexts=0,contained=0,missing=0,recovered=0,rejected=0,identities=0,zeroProjected=0;V rank=0,cursor=0;std::vector<std::pair<U,V>>frontier;frontier.reserve(width+std::min(maxWords,V(100000)));for(U w:words)frontier.push_back({w,0});std::unordered_set<U,Hash>scheduled;scheduled.reserve(width*2);for(U w:words)scheduled.insert(w);std::unordered_set<Key,KeyHash>seen;
  const char*status="completed-selected-contexts";double last=0;V peakTerms=0;B peakBits=0;
  auto overhead=[&](){return B(width)*160+B(frontier.capacity())*sizeof(std::pair<U,V>)+B(scheduled.size())*96+B(seen.size())*96+B(exterior.size())*160+B(trie.capacity())*sizeof(Node)+stored;};
  auto inspect=[&](const Row&r){peakTerms=std::max(peakTerms,V(r.size()));for(auto&t:r)peakBits=std::max(peakBits,B(mpz_sizeinbase(t.c.get_mpz_t(),2)));if(overhead()+8*bytes(r)>budget)throw Limit{"row-memory-budget"};};
  auto record=[&](V kind,U src,V ri,V ti,V pos,U lead,const std::vector<V>&deps,const std::vector<V>&md){put(trace,kind,4);wordout(trace,src);for(V x:{ri,ti,pos,V(deps.size())})put(trace,x,4);for(V x:deps)put(trace,x,4);wordout(trace,lead);put(trace,md.size(),4);for(V x:md)put(trace,x,4);need(bool(trace),"trace write");identities++;};
  auto progress=[&](bool force=false){double t=elapsed();if(!force&&t-last<5)return;last=t;rusage rss{};getrusage(RUSAGE_SELF,&rss);std::cout<<"{\"type\":\"projected_relations\",\"group\":"<<group<<",\"chartColumns\":"<<width<<",\"relationRank\":"<<rank<<",\"upperCandidate\":"<<width-rank<<",\"auxiliaryPivots\":"<<exterior.size()<<",\"sourceContexts\":"<<contexts<<",\"missingContexts\":"<<missing<<",\"missingContextsProjected\":"<<recovered<<",\"wordCursor\":"<<cursor<<",\"frontierWords\":"<<frontier.size()<<",\"pivotBytes\":"<<stored<<",\"maxIntermediateTerms\":"<<peakTerms<<",\"maxCoefficientBits\":"<<peakBits<<",\"seconds\":"<<t<<",\"rssBytes\":"<<B(rss.ru_maxrss)*1024<<"}\n"<<std::flush;};
  try{
   for(cursor=0;cursor<frontier.size();cursor++){
    check();auto [original,depth]=frontier[cursor];
    for(V pos=0;pos<D;pos++){int st=0;for(V q=pos;q<D;q++){V a=(original>>(4*q))&15;st=trie[st].next[a];if(st<0)break;
     for(auto[ri,ti]:trie[st].ends){check();auto&r=rels[ri];U pre=original>>(4*(pos+r.d)),suf=original&mask(pos);Key key{pre,suf,ri,pos};if(!seen.insert(key).second)continue;contexts++;
      Row row;bool hadMissing=false;for(auto&t:r.terms){U w=(pre<<(4*(r.d+pos)))|(t.w<<(4*pos))|suf;need(permutation_grade(w,D)==group,"context sector mismatch");if(killed(w,D,boundary))continue;
       if(!index.count(w)){hadMissing=true;if(depth<maxDepth&&!scheduled.count(w)&&frontier.size()-width<maxWords){scheduled.insert(w);frontier.push_back({w,depth+1});}}
       row.push_back({w,t.c});}
      std::sort(row.begin(),row.end(),[&](auto&a,auto&b){return less(a.w,b.w);});normalize(row);inspect(row);if(hadMissing)missing++;else contained++;
      std::vector<V> deps;bool dropped=false;
      while(!row.empty()&&!index.count(row.back().w)){
       check();auto hit=exterior.find(row.back().w);if(hit==exterior.end()){
        if(exterior.size()>=maxAux){rejected++;dropped=true;break;}
        V id=exterior.size();U lead=row.back().w;record(1,original,ri,ti,pos,lead,deps,{});stored+=bytes(row);exterior.emplace(lead,Aux{id,std::move(row)});dropped=true;break;
       }
       auto&pivot=hit->second.row;deps.push_back(hit->second.number);mpz_class g,a,b;mpz_gcd(g.get_mpz_t(),row.back().c.get_mpz_t(),pivot.back().c.get_mpz_t());mpz_divexact(a.get_mpz_t(),pivot.back().c.get_mpz_t(),g.get_mpz_t());mpz_divexact(b.get_mpz_t(),row.back().c.get_mpz_t(),g.get_mpz_t());
       if(overhead()+8*(bytes(row)+bytes(pivot))>budget)throw Limit{"merge-memory-budget"};
       B nextEstimate=B(row.size()+pivot.size())*(sizeof(Iterm)+64);
       const B abits=mpz_sizeinbase(a.get_mpz_t(),2),bbits=mpz_sizeinbase(b.get_mpz_t(),2);
       for(auto&t:row)nextEstimate+=(B(mpz_sizeinbase(t.c.get_mpz_t(),2))+abits+64)/8;
       for(auto&t:pivot)nextEstimate+=(B(mpz_sizeinbase(t.c.get_mpz_t(),2))+bbits+64)/8;
       if(nextEstimate>budget/4||overhead()+bytes(row)+4*nextEstimate>budget)throw Limit{"coefficient-growth-budget"};
       Row next;next.reserve(row.size()+pivot.size());size_t i=0,j=0;
       while(i<row.size()||j<pivot.size()){
        if(j==pivot.size()||(i<row.size()&&less(row[i].w,pivot[j].w))){mpz_class c=a*row[i].c;if(c!=0)next.push_back({row[i].w,std::move(c)});i++;}
        else if(i==row.size()||less(pivot[j].w,row[i].w)){mpz_class c=-b*pivot[j].c;if(c!=0)next.push_back({pivot[j].w,std::move(c)});j++;}
        else{mpz_class c=a*row[i].c-b*pivot[j].c;if(c!=0)next.push_back({row[i].w,std::move(c)});i++;j++;}
       }row.swap(next);normalize(row);inspect(row);
      }
      if(dropped)continue;
      if(hadMissing)recovered++;
      if(row.empty()){zeroProjected++;continue;}
      std::vector<V> odd,md;for(auto&t:row){need(index.count(t.w),"uncancelled auxiliary");if(mpz_odd_p(t.c.get_mpz_t()))odd.push_back(index[t.w]);}std::sort(odd.begin(),odd.end());
      while(!odd.empty()&&!inside[odd.back()].empty()){check();V h=odd.back();md.push_back(h);std::vector<V>next;auto&pivot=inside[h];next.reserve(odd.size()+pivot.size());std::set_symmetric_difference(odd.begin(),odd.end(),pivot.begin(),pivot.end(),std::back_inserter(next));odd.swap(next);if(overhead()+8*odd.capacity()*4>budget)throw Limit{"chart-memory-budget"};}
      if(odd.empty())continue;V h=odd.back();record(2,original,ri,ti,pos,words[h],deps,md);odd.shrink_to_fit();stored+=odd.capacity()*4;inside[h]=std::move(odd);rank++;
     }
    }}progress();
   }
  }catch(const Limit&x){status=x.reason;}
  put(trace,0,4);put(trace,identities,8);put(trace,exterior.size(),4);put(trace,rank,4);trace.flush();need(bool(trace),"trace finalization");trace.close();
  std::ofstream free(out+"/free-words.bin",std::ios::binary);for(V i=0;i<width;i++)if(inside[i].empty())wordout(free,words[i]);free.close();progress(true);
  std::ofstream result(out+"/RESULT.json");result<<"{\"status\":\""<<status<<"\",\"rankAuthority\":\"UNREPLAYED_CANDIDATE\",\"exactDimension\":false,\"fieldForAuxiliaryElimination\":\"Q\",\"chartRankPrime\":2,\"group\":"<<group<<",\"degree\":"<<D<<",\"prefixKillMask\":"<<boundary<<",\"chartColumns\":"<<width<<",\"projectedRelationRank\":"<<rank<<",\"upperCandidate\":"<<width-rank<<",\"auxiliaryPivots\":"<<exterior.size()<<",\"contexts\":"<<contexts<<",\"containedContexts\":"<<contained<<",\"missingContexts\":"<<missing<<",\"missingContextsProjected\":"<<recovered<<",\"zeroProjected\":"<<zeroProjected<<",\"auxLimitRejected\":"<<rejected<<",\"traceRecords\":"<<identities<<",\"maxIntermediateTerms\":"<<peakTerms<<",\"maxCoefficientBits\":"<<peakBits<<",\"seconds\":"<<elapsed()<<",\"spanningAuthorityReplayedHere\":false,\"namespaceAuthorityExternal\":true}\n";need(bool(result),"result write");
  return 0;
 }catch(const std::exception&e){std::cerr<<"ERROR: "<<e.what()<<"\n";return 2;}
}
