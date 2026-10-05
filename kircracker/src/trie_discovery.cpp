// SPDX-License-Identifier: MIT
// Column-wise version of the existing MODULAR suffix-deletion recurrence.
// Discovery only. Certificates are checked with the independent INTEGER
// prefix-twisted derivative implementation in prefix_verify.cpp.
#include "pair_kernel.cpp"
struct SuffixNode{std::array<int,15>next;std::vector<int>rows;SuffixNode(){next.fill(-1);}};
struct SuffixHash{size_t operator()(U w)const{return mix(Count(w))^mix(Count(w>>64));}};
using SuffixPoly=std::unordered_map<U,int,SuffixHash>;
struct SuffixTrie {
 Eval&e;int d,nu;std::vector<SuffixNode>nodes{1};Count walks=0,terms=0;
 SuffixTrie(Eval&eval,const std::vector<Prepared>&us,int degree):e(eval),d(degree),nu(us.size()){
  for(int i=0;i<nu;i++){
   if(us[i].zero)continue;int node=0;U w=us[i].word;
   for(int j=d-1;j>=0;j--){int letter=int((w>>(4*j))&15)-1;int q=nodes[node].next[letter];if(q<0){q=nodes.size();nodes[node].next[letter]=q;nodes.emplace_back();}node=q;}
   nodes[node].rows.push_back(i);
  }
 }
 SuffixPoly deriv(const SuffixPoly&in,int a,int len){
  SuffixPoly out;
  for(auto [w,c]:in){int s=0;
   for(int j=0;j<len;j++){
    int q=int((w>>(4*j))&15)-1,t=e.conj[s][a];
    if(q==std::abs(t)-1){
     // Adjacent equal edge squares are proven zero. This matches the old
     // suffix recursion's shortcut; no unproved word is discarded.
     bool square=j>0&&j+1<len&&((w>>(4*(j-1)))&15)==((w>>(4*(j+1)))&15);
     if(!square){U cut=((w>>(4*(j+1)))<<(4*j))|(w&e.mask(j));int&v=out[cut];int64_t sum=int64_t(v)+(t<0?-c:c);sum%=e.p;if(sum<0)sum+=e.p;v=int(sum);terms++;}
    }
    s=e.left[q][s];
   }
  }
  for(auto it=out.begin();it!=out.end();)if(!it->second)it=out.erase(it);else ++it;
  if(out.size()>2000000)throw std::runtime_error("suffix discovery polynomial budget");
  return out;
 }
 void walk(int node,const SuffixPoly&poly,int len,std::vector<int>&col){
  walks++;if(poly.empty())return;
  if(!len){auto it=poly.find(0);if(it!=poly.end())for(int r:nodes[node].rows)col[r]=it->second;return;}
  for(int a=0;a<e.n*(e.n-1)/2;a++)if(nodes[node].next[a]>=0){auto child=deriv(poly,a,len);walk(nodes[node].next[a],child,len-1,col);}
 }
};
extern "C" int kp_minor_trie_wide(void*ptr,const Count*us,int nu,const Count*vs,int nv,int len,int*rowids,int*colids,int*matrix,Count*stats,double seconds){
 if(!ptr||!us||!vs||!rowids||!colids||!matrix||!stats||nu<1||nv<1||nu>10000||nv>1000000||len<0||len>20||!(seconds>0))return -1;
 try{
  Eval&e=*(Eval*)ptr;auto t0=std::chrono::steady_clock::now();std::vector<Prepared>u,v;u.reserve(nu);v.reserve(nv);
  for(int i=0;i<nu;i++)u.push_back(prepare_word(e,U(us[2*i])|(U(us[2*i+1])<<64),len));
  for(int j=0;j<nv;j++)v.push_back(prepare_word(e,U(vs[2*j])|(U(vs[2*j+1])<<64),len));
  SuffixTrie trie(e,u,len);std::vector<SparseRow>piv(nu);std::vector<std::vector<int>>kept;std::vector<int>rr,cc;Count evaluations=0,axpys=0,offered=0;
  for(int j=0;j<nv&&(int)rr.size()<nu;j++){
   if(std::chrono::duration<double>(std::chrono::steady_clock::now()-t0).count()>seconds)return -4;
   offered++;std::vector<int>original(nu);SparseRow row;
   if(!v[j].zero)trie.walk(0,SuffixPoly{{v[j].word,1}},len,original);
   for(int i=0;i<nu;i++){if(u[i].grade!=e.inv[v[j].grade]&&original[i])throw std::runtime_error("pairing grade mismatch");if(original[i])row.push_back({i,original[i]});}
   evaluations+=nu;
   while(!row.empty()){
    int pivot=row[0].index,c=row[0].value;
    if(piv[pivot].empty()){int inv=modpow(c,e.p);for(auto&a:row)a.value=int(int64_t(a.value)*inv%e.p);piv[pivot]=std::move(row);rr.push_back(pivot);cc.push_back(j);kept.push_back(std::move(original));break;}
    const auto&b=piv[pivot];SparseRow out;out.reserve(row.size()+b.size());size_t k=0,l=0;axpys++;
    while(k<row.size()||l<b.size()){
     if(l==b.size()||(k<row.size()&&row[k].index<b[l].index)){out.push_back(row[k++]);continue;}
     int at=b[l].index;int64_t value=-(int64_t(c)*b[l++].value%e.p);if(k<row.size()&&row[k].index==at)value+=row[k++].value;value%=e.p;if(value<0)value+=e.p;if(value)out.push_back({at,int(value)});
    }
    row.swap(out);
   }
  }
  int rank=rr.size();for(int i=0;i<rank;i++){rowids[i]=rr[i];colids[i]=cc[i];for(int j=0;j<rank;j++)matrix[(size_t)i*rank+j]=kept[j][rr[i]];}
  stats[0]=evaluations;stats[1]=axpys;stats[2]=offered;stats[3]=trie.walks;stats[4]=trie.terms;stats[5]=trie.nodes.size();return rank;
 }catch(...){return -2;}
}
