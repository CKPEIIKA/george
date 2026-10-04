/* SPDX-License-Identifier: MIT
 * Independent audit of ABI-3 words, product homogeneity, antichain/proper tails,
 * and actual permutation-graded normal-word counts. No fomkyr/FK Gate code or
 * compiled tables are included. This does NOT certify the Groebner property.
 * Scope of this audit utility: <=16-letter words, the 15 generators of S6.
 */
#include <algorithm>
#include <array>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <limits>
#include <queue>
#include <stdexcept>
#include <string>
#include <vector>
using U=uint64_t;using P=std::array<unsigned,6>;
static unsigned rd32(const unsigned char*p){unsigned v=0;for(int k=3;k>=0;--k)v=(v<<8)|p[k];return v;}
static U rd64(const unsigned char*p){return U(rd32(p))|(U(rd32(p+4))<<32);}
static unsigned rankp(const P&p){unsigned n=0;for(unsigned i=0;i<6;i++){unsigned c=0;for(unsigned j=i+1;j<6;j++)c+=p[j]<p[i];n=n*(6-i)+c;}return n;}
struct N{std::array<int,15> next;unsigned fail=0,own=0,best=0;bool bad=false;N(){next.fill(-1);}};
struct Lead{U w;unsigned d;};
struct Audit{
 std::array<std::array<unsigned,2>,15> edges;
 std::array<std::array<unsigned,15>,720> step;
 std::array<P,720> perms;
 std::vector<N> nodes{N()};std::vector<Lead> leads;U terms=0,bytes=0,maxbits=0,proper_checks=0;
 unsigned target;
 static unsigned letter(U w,unsigned d,unsigned j){return unsigned((w>>(4*(d-j-1)))&15);}
 unsigned grade(U w,unsigned d){unsigned g=0;for(unsigned j=0;j<d;j++){unsigned c=letter(w,d,j);if(c>=15)throw std::runtime_error("invalid generator");g=step[g][c];}return g;}
 void prepare(const std::string&edgefile){std::ifstream in(edgefile);for(auto&e:edges){if(!(in>>e[0]>>e[1])||e[0]>=6||e[1]>=6||e[0]==e[1])throw std::runtime_error("invalid edge input");}P p={0,1,2,3,4,5};unsigned k=0;do{if(rankp(p)!=k)throw std::runtime_error("permutation rank");perms[k++]=p;}while(std::next_permutation(p.begin(),p.end()));for(unsigned g=0;g<720;g++)for(unsigned c=0;c<15;c++){P q=perms[g];std::swap(q[edges[c][0]],q[edges[c][1]]);step[g][c]=rankp(q);}}
 void insert(U w,unsigned d){unsigned s=0;for(unsigned j=0;j<d;j++){unsigned c=letter(w,d,j);if(nodes[s].next[c]<0){nodes[s].next[c]=nodes.size();nodes.emplace_back();}s=nodes[s].next[c];}if(nodes[s].own)throw std::runtime_error("duplicate leader");nodes[s].own=d;leads.push_back({w,d});}
 void scan(const std::string&file,bool second){std::ifstream in(file,std::ios::binary);if(!in)throw std::runtime_error("open basis");std::array<unsigned char,32> h;unsigned lastd=0;
  for(;;){in.read(reinterpret_cast<char*>(h.data()),32);if(!in.gcount())break;if(in.gcount()!=32)throw std::runtime_error("header truncation");unsigned magic=rd32(h.data()),size=rd32(h.data()+4),n=rd32(h.data()+8),d=rd32(h.data()+12);if(d>target)break;
   if(magic!=0x31424e47||!n||size<32||U(n)*24+32>size||size>(256u<<20)||!d||d>16||d<lastd||rd64(h.data()+24))throw std::runtime_error("record shape");lastd=d;
   std::vector<unsigned char>b(size);std::copy(h.begin(),h.end(),b.begin());in.read(reinterpret_cast<char*>(b.data()+32),size-32);if(unsigned(in.gcount())!=size-32)throw std::runtime_error("record truncation");
   if(!second){U sum=1469598103934665603ULL;for(size_t j=32;j<size;j++)sum=(sum^b[j])*1099511628211ULL;if(sum!=rd64(h.data()+16))throw std::runtime_error("checksum");terms+=n;bytes+=size;}
   U previous=0;unsigned g0=0;
   for(unsigned i=0;i<n;i++){auto*t=b.data()+32+size_t(i)*24;U w=rd64(t),hi=rd64(t+8),co=rd64(t+16);if(hi||(d<16&&(w>>(4*d)))||(i&&w>=previous))throw std::runtime_error("word shape/order");previous=w;
    if(!second){unsigned g=grade(w,d);if(!i)g0=g;else if(g!=g0)throw std::runtime_error("inhomogeneous permutation grade");
     if(co&1){U off=co&~U(7);if((co&4)||off<32+U(n)*24||off>size-8)throw std::runtime_error("coefficient offset");unsigned limbs=rd32(b.data()+off);if(!limbs||off+8+U(limbs)*4>size)throw std::runtime_error("coefficient extent");unsigned top=rd32(b.data()+off+8+size_t(limbs-1)*4);if(!top)throw std::runtime_error("zero high limb");U bits=U(limbs-1)*32;while(top){bits++;top>>=1;}maxbits=std::max(maxbits,bits);}
     else{int64_t c=int64_t(co)>>1;if(!c)throw std::runtime_error("zero coefficient");U v=c<0?U(-c):U(c),bits=0;while(v){bits++;v>>=1;}maxbits=std::max(maxbits,bits);}
     if(!i)insert(w,d);
    }else{unsigned s=0;for(unsigned j=0;j<d;j++){s=nodes[s].next[letter(w,d,j)];if(nodes[s].best&&nodes[s].best<d)throw std::runtime_error("proper-subword reducibility");}proper_checks++;}
   }
  }
 }
 void finish_automaton(){std::queue<unsigned> q;for(unsigned c=0;c<15;c++){int u=nodes[0].next[c];if(u<0)nodes[0].next[c]=0;else q.push(u);}while(!q.empty()){unsigned v=q.front();q.pop();N&n=nodes[v];n.bad=n.own||nodes[n.fail].bad;n.best=n.own;unsigned inherited=nodes[n.fail].best;if(inherited)n.best=n.best?std::min(n.best,inherited):inherited;for(unsigned c=0;c<15;c++){int u=n.next[c];if(u<0)n.next[c]=nodes[n.fail].next[c];else{nodes[u].fail=nodes[n.fail].next[c];q.push(u);}}}}
 void count(){std::vector<int> ids(nodes.size(),-1);unsigned good=0;for(unsigned s=0;s<nodes.size();s++)if(!nodes[s].bad)ids[s]=good++;
  std::vector<std::array<int,15>> tr(good);for(unsigned s=0;s<nodes.size();s++)if(ids[s]>=0)for(unsigned c=0;c<15;c++)tr[ids[s]][c]=ids[nodes[s].next[c]];
  std::vector<U>a(size_t(good)*720),b(a.size());a[0]=1;std::vector<std::array<U,720>> counts(target+1);counts[0][0]=1;
  for(unsigned d=1;d<=target;d++){std::fill(b.begin(),b.end(),0);for(unsigned s=0;s<good;s++)for(unsigned g=0;g<720;g++){U val=a[size_t(s)*720+g];if(!val)continue;for(unsigned c=0;c<15;c++){int dest=tr[s][c];if(dest<0)continue;U&v=b[size_t(dest)*720+step[g][c]];if(v>std::numeric_limits<U>::max()-val)throw std::runtime_error("count overflow");v+=val;}}
   a.swap(b);for(unsigned s=0;s<good;s++)for(unsigned g=0;g<720;g++){U&v=counts[d][g],add=a[size_t(s)*720+g];if(v>std::numeric_limits<U>::max()-add)throw std::runtime_error("count sum overflow");v+=add;}}
  std::cout<<"{\"independentGroebnerCertificate\":false,\"rules\":"<<leads.size()<<",\"terms\":"<<terms<<",\"recordBytes\":"<<bytes<<",\"maxCoefficientBits\":"<<maxbits<<",\"properSubwordChecks\":"<<proper_checks<<",\"automatonStates\":"<<nodes.size()<<",\"goodStates\":"<<good<<",\"coefficients\":[";
  for(unsigned d=0;d<=target;d++){if(d)std::cout<<',';U sum=0;for(U v:counts[d])sum+=v;std::cout<<sum;}std::cout<<"],\"groups\":[";
  for(unsigned g=0;g<720;g++){if(g)std::cout<<',';std::cout<<"{\"permutation\":[";for(unsigned j=0;j<6;j++){if(j)std::cout<<',';std::cout<<perms[g][j];}std::cout<<"],\"dimensions\":[";for(unsigned d=0;d<=target;d++){if(d)std::cout<<',';std::cout<<counts[d][g];}std::cout<<"]}";}std::cout<<"]}\n";
 }
};
int main(int argc,char**argv){try{if(argc!=4)throw std::runtime_error("usage: audit basis.gnb degree edges.txt");Audit a;a.target=std::stoul(argv[2]);if(a.target>16)throw std::runtime_error("audit scope is at most degree 16");a.prepare(argv[3]);a.scan(argv[1],false);a.finish_automaton();a.scan(argv[1],true);a.count();return 0;}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
