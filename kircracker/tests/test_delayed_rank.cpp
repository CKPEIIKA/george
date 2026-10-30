// Exact differential controls for the finite-field discovery accumulator.
#include "modular_rank.hpp"
#include "pair_journal.hpp"
#include <cassert>
#include <random>
#include <iostream>
#include <filesystem>
#include <map>
static std::vector<int> residual(const ModularRank&r,const std::vector<int>&in){auto a=in;for(int k=0;k<r.width();k++)if(a[k]){if(r.pivots[k].empty())break;auto c=a[k];r.pivots[k].each(k,[&](int j,int v){int64_t x=int64_t(a[j])-int64_t(c)*v%r.prime();if(x<0)x+=r.prime();a[j]=int(x);});}return a;}
static bool equal(const ModularRank&a,const ModularRank&b){if(a.rows!=b.rows||a.columns!=b.columns)return false;for(int i=0;i<a.width();i++){std::map<int,int>x,y;a.pivots[i].each(i,[&](int j,int c){x[j]=c;});b.pivots[i].each(i,[&](int j,int c){y[j]=c;});if(x!=y)return false;}return true;}
int main(int argc,char**argv){
 std::mt19937_64 gen(232324);size_t cases=0,offers=0,flush=0;
 for(int p:{2,3,101,1000003,1000033,2147483647})for(double density:{0.01,0.4,1.0})for(double threshold:{0.,.55,1.})for(int n:{9,33,101}){
  unsetenv("KIR_DENSE_THRESHOLD");setenv("KIR_RANK_MODE","reference",1);ModularRank a(n,p,threshold);setenv("KIR_RANK_MODE","delayed",1);ModularRank b(n,p,threshold);
  for(int col=0;col<2*n+17;col++){
   std::vector<int>x(n);for(auto&v:x)if(double(gen()%10000)/10000<density)v=int(gen()%p);
   if(col%3==0&&!a.rows.empty()){std::fill(x.begin(),x.end(),0);for(int k:a.rows)if(gen()%4==0){int c=int(gen()%p);a.pivots[k].each(k,[&](int j,int v){x[j]=(int64_t(x[j])+int64_t(c)*v)%p;});}}
   auto expected=residual(a,x),y=x;bool q=a.offer(x,col),r=b.offer(y,col);assert(q==r&&x==y&&x==expected);assert(equal(a,b));offers++;
  }flush+=b.delayed_flushes;cases++;
 }
 // Cancellation while reducing must neither create a pivot nor advance a journal cursor.
 setenv("KIR_RANK_MODE","delayed",1);ModularRank a(40,1000003),b(40,1000003);
 for(int k=0;k<20;k++){SparseRow row{{k,1},{k+20,13}};a.restore(k,k,row);b.restore(k,k,row);}
 auto v=std::vector<int>(40,1),original=v;int polls=0;a.cooperate=[&](){if(++polls==5)throw 17;};bool caught=false;try{a.offer(v,25);}catch(int x){caught=x==17;}assert(caught&&equal(a,b));a.cooperate={};v=original;auto w=original;assert(a.offer(v,25)==b.offer(w,25));assert(equal(a,b));
 // Chunk/checkpoint reader remains independent of the selected accumulator.
 if(argc>1){std::filesystem::create_directories(argv[1]);std::string root=argv[1],path=root+"/rank.state",binding(64,'c');kir::PairJournal j(path,binding,6,1000003,5,40,100);j.save(a,26);setenv("KIR_RANK_MODE","reference",1);ModularRank restored(40,1000003);kir::PairJournal k(path,binding,6,1000003,5,40,100);assert(k.load(restored)==26);assert(equal(a,restored));}
 assert(flush>0);std::cout<<"{\"passed\":true,\"matrixCases\":"<<cases<<",\"offers\":"<<offers<<",\"highPrimeFlushes\":"<<flush<<",\"cancelSafety\":true,\"journalExchange\":true}\n";
}
