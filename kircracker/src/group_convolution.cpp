// MIT. Exact offline group-graded finite-factor convolution. No float counters.
#include <cstdint>
#include <vector>
#include <atomic>
#include <thread>
#include <limits>
extern "C" int kc_convolve(const uint64_t*a,const uint64_t*b,uint64_t*out,int D,const uint16_t*table,int threads){
 if(!a||!b||!out||!table||D<0||D>22||threads<1||threads>128)return 1;
 try{using Item=std::pair<uint16_t,uint64_t>;std::vector<std::vector<Item>>A(D+1),B(D+1);
 for(int d=0;d<=D;d++)for(int g=0;g<720;g++){if(a[d*720+g])A[d].emplace_back(g,a[d*720+g]);if(b[d*720+g])B[d].emplace_back(g,b[d*720+g]);}
 for(int i=0;i<720*720;i++)if(table[i]>=720)return 1;
 std::atomic<int>next{0},bad{0};auto work=[&](){for(;;){int d=next++;if(d>D)break;__uint128_t accum[720]={};for(int j=0;j<=d;j++)for(auto x:A[j])for(auto y:B[d-j]){auto h=table[x.first*720+y.first];auto value=__uint128_t(x.second)*y.second;auto old=accum[h];accum[h]+=value;if(accum[h]<old)bad=1;}for(int g=0;g<720;g++){if(accum[g]>std::numeric_limits<uint64_t>::max())bad=1;out[d*720+g]=uint64_t(accum[g]);}}};
 std::vector<std::thread>pool;try{for(int j=1;j<threads&&j<=D;j++)pool.emplace_back(work);work();}catch(...){bad=1;next=D+1;}for(auto&t:pool)t.join();return bad?2:0;
 }catch(...){return 3;}
}
