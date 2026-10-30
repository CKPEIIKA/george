// Synthetic but representative restored rank plateau: exact same pivot rows,
// input columns, loop order and compiler; compare arithmetic ONLY.
#include "modular_rank.hpp"
#include <chrono>
#include <iostream>
#include <random>
#include <numeric>
#include <sys/resource.h>
using Clock=std::chrono::steady_clock;
int main(int argc,char**argv){int width=argc>1?std::stoi(argv[1]):8192,rank=argc>2?std::stoi(argv[2]):2048,count=argc>3?std::stoi(argv[3]):12;double density=argc>4?std::stod(argv[4]):.8;const int p=1000003;std::mt19937_64 gen(2323007);std::vector<SparseRow> piv(rank);
 for(int k=0;k<rank;k++){piv[k].push_back({k,1});for(int j=k+1;j<width;j++)if(gen()%1000000<uint64_t(density*1000000))piv[k].push_back({j,1+int(gen()%(p-1))});}
 std::vector<std::vector<int>>cols(count,std::vector<int>(width));for(auto&v:cols){std::vector<uint64_t>sum(width);for(auto&r:piv){int c=int(gen()%p);for(auto e:r)sum[e.index]+=uint64_t(c)*e.value;}for(int j=0;j<width;j++)v[j]=sum[j]%p;}
 for(int trial=0;trial<3;trial++)for(int jj=0;jj<2;jj++){bool fast=(jj+trial)%2;setenv("KIR_RANK_MODE",fast?"delayed":"reference",1);unsetenv("KIR_DENSE_THRESHOLD");ModularRank r(width,p);for(int k=0;k<rank;k++)r.restore(k,k,piv[k]);auto start=Clock::now();uint64_t hash=0;for(int i=0;i<count;i++){auto v=cols[i];if(r.offer(v,rank+i))throw std::runtime_error("dependent column changed rank");for(auto x:v)hash|=x;}double seconds=std::chrono::duration<double>(Clock::now()-start).count();if(hash)throw std::runtime_error("nonzero remainder");rusage u{};getrusage(RUSAGE_SELF,&u);std::cout<<"{\"mode\":\""<<(fast?"delayed":"reference")<<"\",\"trial\":"<<trial<<",\"rows\":"<<width<<",\"rank\":"<<rank<<",\"density\":"<<density<<",\"columns\":"<<count<<",\"seconds\":"<<seconds<<",\"updates\":"<<r.updates<<",\"pivotBytes\":"<<r.allocated_bytes()<<",\"RSS\":"<<uint64_t(u.ru_maxrss)*1024<<",\"allRemaindersZero\":true}\n"<<std::flush;}
}
