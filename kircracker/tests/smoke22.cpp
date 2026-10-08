#include <cstdint>
#include <cstdio>
extern "C" int kv_verify_compact128(int,int,const uint64_t*,const uint64_t*,int,int,int,int,const int32_t*,int32_t*,uint64_t*);
static void pack(const int*w,int n,uint64_t out[2]){__uint128_t x=0;for(int i=0;i<n;i++)x=(x<<4)|unsigned(w[i]);out[0]=uint64_t(x);out[1]=uint64_t(x>>64);}
int main(){
 const int u[22]={5,9,14,9,5,14,15,12,14,9,12,5,9,5,14,5,9,5,12,9,5,15};
 const int v[22]={1,4,15,8,1,2,1,3,7,13,7,4,1,15,11,6,1,13,3,1,4,15};
 uint64_t a[2],b[2],stats[2]={};pack(u,22,a);pack(v,22,b);int32_t det=0;
 int rc=kv_verify_compact128(6,22,a,b,1,1000003,1,64,nullptr,&det,stats);
 if(rc||det!=1000002||stats[0]!=1||stats[1]<1){std::fprintf(stderr,"rc=%d det=%d entries=%llu bits=%llu\n",rc,det,(unsigned long long)stats[0],(unsigned long long)stats[1]);return 1;}
 return 0;
}
