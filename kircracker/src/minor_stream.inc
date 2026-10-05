// SPDX-License-Identifier: MIT
// Optional native discovery only. All output entries and determinants must be
// re-evaluated by the separate prefix-integer certificate checker.
#include <chrono>
struct SparseEntry {int index,value;};
using SparseRow=std::vector<SparseEntry>;
static int modpow(int a,int p){int64_t x=a,r=1;int n=p-2;while(n){if(n&1)r=r*x%p;x=x*x%p;n>>=1;}return int(r);}
struct Prepared {U word;int grade;bool zero;};
static Prepared prepare_word(Eval&e,U w,int len){
 if(len<0||len>20||(w>>(4*len)))throw std::invalid_argument("packed word");
 int g=0,last=-1;bool zero=false;
 for(int k=len-1;k>=0;k--){int a=int((w>>(4*k))&15)-1;if(a<0||a>=e.n*(e.n-1)/2)throw std::invalid_argument("letter");zero|=a==last;last=a;g=e.right[g][a];}
 return {w,g,zero};
}
extern "C" int kp_minor_wide(void*ptr,const Count*us,int nu,const Count*vs,int nv,int len,int*rowids,int*colids,int*matrix,Count*stats,double seconds){
 if(!ptr||!us||!vs||!rowids||!colids||!matrix||!stats||nu<1||nv<1||nu>10000||nv>1000000||len<0||len>20||!(seconds>0))return -1;
 try{
  Eval&e=*(Eval*)ptr;auto t0=std::chrono::steady_clock::now();
  std::vector<Prepared>u,v;u.reserve(nu);v.reserve(nv);for(int i=0;i<nu;i++)u.push_back(prepare_word(e,U(us[2*i])|(U(us[2*i+1])<<64),len));for(int i=0;i<nv;i++)v.push_back(prepare_word(e,U(vs[2*i])|(U(vs[2*i+1])<<64),len));
  std::vector<SparseRow> piv(nu);std::vector<std::vector<int>> kept;std::vector<int> rr,cc;Count evaluations=0,axpys=0,offered=0;
  for(int j=0;j<nv&&(int)rr.size()<nu;j++){
   if(std::chrono::duration<double>(std::chrono::steady_clock::now()-t0).count()>seconds)return -4;
   offered++;std::vector<int>original(nu);SparseRow row;
   for(int i=0;i<nu;i++){
    int x=(!u[i].zero&&!v[j].zero&&u[i].grade==e.inv[v[j].grade])?e.eval(u[i].word,v[j].word,len):0;
    original[i]=x;if(x)row.push_back({i,x});
   }
   evaluations+=nu;
   while(!row.empty()){
    int pivot=row[0].index,c=row[0].value;
    if(piv[pivot].empty()){
     int inv=modpow(c,e.p);for(auto&a:row)a.value=int(int64_t(a.value)*inv%e.p);piv[pivot]=std::move(row);rr.push_back(pivot);cc.push_back(j);kept.push_back(std::move(original));break;
    }
    const auto&b=piv[pivot];SparseRow out;out.reserve(row.size()+b.size());size_t k=0,l=0;axpys++;
    while(k<row.size()||l<b.size()){
     if(l==b.size()||(k<row.size()&&row[k].index<b[l].index)){out.push_back(row[k++]);continue;}
     int at=b[l].index;int64_t value=-(int64_t(c)*b[l++].value%e.p);if(k<row.size()&&row[k].index==at)value+=row[k++].value;
     value%=e.p;if(value<0)value+=e.p;if(value)out.push_back({at,int(value)});
    }
    row.swap(out);
   }
  }
  int rank=int(rr.size());for(int i=0;i<rank;i++){rowids[i]=rr[i];colids[i]=cc[i];for(int j=0;j<rank;j++)matrix[(size_t)i*rank+j]=kept[j][rr[i]];}
  stats[0]=evaluations;stats[1]=axpys;stats[2]=offered;stats[3]=e.calls;stats[4]=e.hits;stats[5]=e.cache.size();return rank;
 }catch(...){return -2;}
}
