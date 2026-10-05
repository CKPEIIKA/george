// SPDX-License-Identifier: MIT
// Pure right-module recurrence for a PROVED SUBSET of star relations.
// This returns dimensions of T/(H_prefix*T + <R>), an upper model of the actual
// relative FK module unless a separate lower certificate closes the bound.
#include "common.hpp"
#include <sstream>
#include "checkpoint_io.hpp"

struct MOptions:Options{std::string relations,state,binding;u32 k=5;bool resume=false;};
struct MRelation{u32 degree;struct T{std::vector<u32>w;std::string c;};std::vector<T>terms;};
static std::vector<MRelation>read_library(const MOptions&o){
 std::ifstream in(o.relations);if(!in)throw std::runtime_error("cannot open relation library");
 u64 k,count;if(!(in>>k>>count)||k!=o.k||count>100000)throw std::runtime_error("bad library header");
 std::vector<MRelation>r;u64 terms=0;
 for(u64 j=0;j<count;j++){u64 d,m;if(!(in>>d>>m)||d<2||d>1000||!m||m>100000||terms+m>o.maxterms)throw std::runtime_error("bad library limits");terms+=m;MRelation p;p.degree=d;
  for(u64 t=0;t<m;t++){MRelation::T x;if(!(in>>x.c)||x.c.empty()||x.c.size()>100000)throw std::runtime_error("bad coefficient");size_t at=x.c[0]=='-'?1:0;if(at==x.c.size()||x.c.find_first_not_of("0123456789",at)!=std::string::npos)throw std::runtime_error("integer coefficient required");boost::multiprecision::cpp_int c(x.c);if(c==0)throw std::runtime_error("zero coefficient");
   for(u64 a=0;a<d;a++){u64 v;if(!(in>>v)||v>=k)throw std::runtime_error("bad generator");x.w.push_back(v);}p.terms.push_back(std::move(x));}
  r.push_back(std::move(p));}
 std::string extra;if(in>>extra)throw std::runtime_error("trailing library input");return r;
}
template<class F>struct MLevel{std::vector<__uint128_t>words;std::vector<u32>grade;std::vector<Vec<F>>actions;u32 previous=0;};
template<class F>class MBuilder{
 using C=typename F::C;MOptions o;u32 k,n;std::vector<MRelation>rels;std::vector<std::vector<C>>coeff;Permutations perms;std::vector<std::vector<u32>>right;Clock::time_point started;std::vector<MLevel<F>>lev;u64 retained=0;std::atomic<bool>failed{false};
 double elapsed()const{return std::chrono::duration<double>(Clock::now()-started).count();}
 void check(){if(kk_interrupted||failed.load(std::memory_order_relaxed)||elapsed()>o.seconds)throw std::runtime_error("time/task budget; incomplete");}
 static std::vector<std::pair<u32,u32>>edges(u32 k){std::vector<std::pair<u32,u32>>v;for(u32 i=0;i<k;i++)v.push_back({i,k});return v;}
 template<class Fn>void phase(u32 jobs,Fn fn){std::atomic<u32>next{0};std::vector<std::thread>pool;std::mutex mx;std::exception_ptr ep;auto run=[&](){try{for(;;){u32 j=next.fetch_add(1);if(j>=jobs||failed.load())break;fn(j);}}catch(...){std::lock_guard<std::mutex>lk(mx);if(!ep)ep=std::current_exception();failed=true;}};for(u32 t=1;t<std::min(o.threads,jobs);t++)pool.emplace_back(run);run();for(auto&t:pool)t.join();if(ep)std::rethrow_exception(ep);}
 C parse(const std::string&s){if constexpr(std::is_same_v<F,Rat>)return C(s);else{boost::multiprecision::cpp_int x(s);x%=modulus;if(x<0)x+=modulus;return x.convert_to<u32>();}}
 Vec<F>eval_prefix(u32 j,u32 degree,const std::vector<u32>&w,u32 length){Vec<F>v={{j,F::val(1)}};for(u32 a=0;a<length;a++){Vec<F>out;degree++;for(const auto&t:v)axpy<F>(out,lev[degree].actions[u64(t.col)*k+w[a]],t.c);v.swap(out);if(v.empty())break;}return v;}
public:
 explicit MBuilder(MOptions opts):o(opts),k(o.k),n(k+1),rels(read_library(o)),perms(n,edges(k)),started(Clock::now()){
  for(auto&r:rels){std::vector<C>cs;for(auto&t:r.terms)cs.push_back(parse(t.c));coeff.push_back(std::move(cs));}
  right.resize(k,std::vector<u32>(perms.ps.size()));for(u32 a=0;a<k;a++)for(u32 q=0;q<perms.ps.size();q++){auto p=perms.ps[q];std::swap(p[a],p[k]);right[a][q]=perms.index.at(Permutations::code(p));}
  MLevel<F>z;z.words={0};z.grade={0};lev.push_back(std::move(z));
  if(!o.state.empty()){if constexpr(std::is_same_v<F,Rat>)throw std::runtime_error("binary state requires a prime field");else{std::filesystem::create_directories(o.state);if(o.resume)restore();if(lev.size()==1)save_level(0);}}
 }
 void extend(){u32 d=lev.size(),old=lev.back().words.size();u64 c64=u64(old)*k;check();if(c64>o.maxcols)throw std::runtime_error("module candidate-column budget");u32 cols=c64;auto start=Clock::now();
  u32 groups=o.graded?perms.ps.size():1;std::vector<u32>grade(cols),local(cols);std::vector<std::vector<u32>>columns(groups);
  for(u32 j=0;j<old;j++)for(u32 a=0;a<k;a++){u32 c=j*k+a;grade[c]=right[a][lev.back().grade[j]];u32 g=o.graded?grade[c]:0;local[c]=columns[g].size();columns[g].push_back(c);}
  std::vector<std::vector<std::pair<u32,u32>>>jobs(groups);u64 images=0;
  for(u32 ri=0;ri<rels.size();ri++)if(rels[ri].degree<=d){u32 back=d-rels[ri].degree;const auto&w=rels[ri].terms.front().w;for(u32 j=0;j<lev[back].words.size();j++){u32 g=lev[back].grade[j];for(auto a:w)g=right[a][g];jobs[o.graded?g:0].push_back({ri,j});images++;}}
  std::vector<Vec<F>>piv(cols);std::vector<u64>nonzero(groups),steps(groups);
  // Degree-one boundary is imposed ONLY on the cyclic generator; it is not an
  // algebra relation setting those generators to zero in every position.
  if(d==1)for(u32 a=0;a+1<k;a++)piv[a]={{a,F::val(1)}};
  std::vector<u32>schedule(groups);std::iota(schedule.begin(),schedule.end(),0);std::stable_sort(schedule.begin(),schedule.end(),[&](u32 a,u32 b){return jobs[a].size()>jobs[b].size();});
  phase(groups,[&](u32 job){u32 g=schedule[job];u32 width=columns[g].size(),nw=(width+63)/64;std::vector<std::vector<u64>>bp;
   if(o.packed2){if(u64(width)*nw>o.maxterms)throw std::runtime_error("bit block budget");bp.resize(width);if(d==1)for(u32 c:columns[g])if(!piv[c].empty()){auto&b=bp[local[c]];b.resize(nw);b[local[c]/64]|=u64(1)<<(local[c]%64);}}
   for(auto[ri,j]:jobs[g]){check();const auto&r=rels[ri];Vec<F>row;u32 back=d-r.degree;
    for(u32 ti=0;ti<r.terms.size();ti++){const auto&t=r.terms[ti];auto v=eval_prefix(j,back,t.w,r.degree-1);Vec<F>last;last.reserve(v.size());for(auto&a:v)last.push_back({a.col*k+t.w.back(),a.c});axpy<F>(row,last,coeff[ri][ti]);}
    for(auto&t:row)if(o.graded&&grade[t.col]!=g)throw std::runtime_error("relation violates permutation grading");
    if(!row.empty())nonzero[g]++;
    if(o.packed2){std::vector<u64>bits(nw);for(auto&t:row)bits[local[t.col]/64]^=u64(1)<<(local[t.col]%64);for(u32 w=nw;w--;){while(bits[w]){if(!(steps[g]++&1023))check();u32 h=w*64+63-__builtin_clzll(bits[w]);if(bp[h].empty()){bp[h]=std::move(bits);goto inserted;}for(u32 x=0;x<=w;x++)bits[x]^=bp[h][x];}}inserted:;}
    else while(!row.empty()){if(!(steps[g]++&1023))check();u32 h=row.back().col;if(piv[h].empty()){C inv=F::inv(row.back().c);for(auto&t:row)t.c=F::mul(t.c,inv);piv[h]=std::move(row);break;}C factor=F::neg(row.back().c);axpy<F>(row,piv[h],factor);}
   }
   if(o.packed2)for(u32 h=0;h<width;h++)if(!bp[h].empty()){piv[columns[g][h]].clear();for(u32 w=0;w<nw;w++){u64 x=bp[h][w];while(x){u32 j=w*64+__builtin_ctzll(x);piv[columns[g][h]].push_back({columns[g][j],F::val(1)});x&=x-1;}}}
  });
  MLevel<F>cur;cur.previous=old;std::vector<int32_t>free(cols,-1);for(u32 c=0;c<cols;c++)if(piv[c].empty()){free[c]=cur.words.size();auto w=(lev.back().words[c/k]<<4)|u32(c%k);cur.words.push_back(std::move(w));cur.grade.push_back(grade[c]);}
  cur.actions.resize(cols);phase(groups,[&](u32 g){for(u32 c:columns[g]){check();auto&out=cur.actions[c];if(free[c]>=0)out={{u32(free[c]),F::val(1)}};else for(auto&t:piv[c])if(t.col!=c)axpy<F>(out,cur.actions[t.col],F::neg(t.c));}});
  u64 nnz=0,pterms=0;for(auto&v:cur.actions)nnz+=v.size();for(auto&v:piv)pterms+=v.size();if(retained+nnz+pterms>o.maxterms)throw std::runtime_error("module coefficient budget");retained+=nnz;lev.push_back(std::move(cur));if(!o.state.empty())save_level(d);
  u32 nonempty=0;for(auto&v:columns)nonempty+=!v.empty();struct rusage rss{};getrusage(RUSAGE_SELF,&rss);
  std::cout<<"{\"type\":\"degree\",\"degree\":"<<d<<",\"relativeUpperDimension\":"<<lev.back().words.size()<<",\"candidateColumns\":"<<cols<<",\"libraryRelationImages\":"<<images<<",\"nonzeroRelationImages\":"<<std::accumulate(nonzero.begin(),nonzero.end(),u64(0))<<",\"eliminationSteps\":"<<std::accumulate(steps.begin(),steps.end(),u64(0))<<",\"permutationGradeBlocks\":"<<nonempty<<",\"currentActionTerms\":"<<nnz<<",\"retainedActionTerms\":"<<retained<<",\"pivotTerms\":"<<pterms<<",\"retainedInducedStarDimensions\":0,\"seconds\":"<<std::chrono::duration<double>(Clock::now()-start).count()<<",\"cumulativeSeconds\":"<<elapsed()<<",\"peakRSSBytes\":"<<u64(rss.ru_maxrss)*1024<<"}\n"<<std::flush;
 }

 std::string state_file(u32 d)const{std::ostringstream ss;ss<<o.state<<"/level-"<<std::setw(3)<<std::setfill('0')<<d<<".krm";return ss.str();}
 void save_level(u32 d){
  if constexpr(!std::is_same_v<F,Rat>){
   const auto&l=lev[d];const auto path=state_file(d);
   if(std::filesystem::exists(path))throw std::runtime_error("refusing to overwrite immutable checkpoint "+path);
   BinaryWriter w(path,o.binding,d,k,o.prime,l.previous,l.words.size(),l.actions.size());
   for(size_t i=0;i<l.words.size();i++){w.number(u64(l.words[i]),8);w.number(u64(l.words[i]>>64),8);w.number(l.grade[i],4);}
   for(const auto&row:l.actions){w.number(row.size(),4);for(const auto&t:row){w.number(t.col,4);if(o.prime!=2)w.number(t.c,4);}}
   w.finish();
  }
 }
 void restore(){
  if constexpr(!std::is_same_v<F,Rat>){
   for(u32 d=0;d<=o.degree;d++){
    const auto path=state_file(d);if(!std::filesystem::exists(path))break;
    BinaryReader in(path,o.binding,d,k,o.prime);auto sz=in.words,acts=in.actions,prev=in.previous;
    if(sz>o.maxcols||acts>o.maxcols||sz>UINT32_MAX||prev>UINT32_MAX)throw std::runtime_error("checkpoint limits; increase --max-cols for valid saved data");
    if(d==0?(sz!=1||acts||prev):(prev!=lev.back().words.size()||acts!=prev*k))throw std::runtime_error("checkpoint chain shape mismatch");
    MLevel<F>l;l.previous=prev;l.words.resize(sz);l.grade.resize(sz);
    for(u64 i=0;i<sz;i++){
     u64 lo=in.number(8),hi=in.number(8);l.words[i]=__uint128_t(lo)|(__uint128_t(hi)<<64);l.grade[i]=in.number(4);
     if(l.words[i]>>(4*d))throw std::runtime_error("checkpoint word length mismatch");
     u32 g=0;for(u32 j=0;j<d;j++){u32 a=u32((l.words[i]>>(4*(d-j-1)))&15);if(a>=k)throw std::runtime_error("checkpoint letter");g=right[a][g];}
     if(g!=l.grade[i])throw std::runtime_error("checkpoint group grade");
    }
    l.actions.resize(acts);u64 terms=0;
    for(auto&row:l.actions){u32 n=in.number(4);if(n>sz||n>o.maxterms||retained+terms+n>o.maxterms)throw std::runtime_error("checkpoint term limit");terms+=n;row.reserve(n);u32 last=0;
     for(u32 j=0;j<n;j++){u32 col=in.number(4),c=o.prime==2?1:in.number(4);if(col>=sz||!c||c>=o.prime||(j&&col<=last))throw std::runtime_error("checkpoint action term");row.push_back({col,c});last=col;}}
    in.finish();retained+=terms;if(!d)lev[0]=std::move(l);else lev.push_back(std::move(l));
    std::cout<<"{\"type\":\"restored\",\"degree\":"<<d<<",\"relativeUpperDimension\":"<<sz<<",\"retainedActionTerms\":"<<retained<<"}\n"<<std::flush;
   }
  }
 }
 void dump(){if(o.dump.empty())return;std::ofstream out(o.dump);if(!out)throw std::runtime_error("cannot open map dump");out<<"{\"schema\":\"kircracker-relative-maps-v1\",\"generators\":"<<k<<",\"prime\":"<<o.prime<<",\"rightModule\":true,\"completeFKPresentationAssumed\":false,\"levels\":[";for(u32 d=0;d<lev.size()&&d<=o.dumpdegree;d++){if(d)out<<',';auto&l=lev[d];out<<"{\"degree\":"<<d<<",\"words\":[";for(u32 i=0;i<l.words.size();i++){if(i)out<<',';out<<'[';for(u32 j=0;j<d;j++){if(j)out<<',';out<<u32((l.words[i]>>(4*(d-j-1)))&15);}out<<']';}out<<"],\"rightActions\":[";for(u32 i=0;i<l.actions.size();i++){if(i)out<<',';out<<'[';for(u32 j=0;j<l.actions[i].size();j++){if(j)out<<',';auto&t=l.actions[i][j];out<<'['<<t.col<<",\""<<F::text(t.c)<<"\"]";}out<<']';}out<<"]}";}out<<"]}\n";}
 int run(){try{for(u32 d=lev.size();d<=o.degree;d++)extend();dump();finish(true);return 0;}catch(const std::exception&e){std::cerr<<e.what()<<'\n';finish(false);return 2;}}
 void finish(bool ok){std::cout<<"{\"complete\":"<<(ok?"true":"false")<<",\"scope\":\"presented right module; FK upper bound after library proof; not a GB\",\"completedThrough\":"<<lev.size()-1<<",\"n\":"<<n<<",\"prime\":"<<o.prime<<",\"threads\":"<<o.threads<<",\"packedGF2\":"<<(o.packed2?"true":"false")<<",\"relative\":[";for(u32 d=0;d<lev.size();d++){if(d)std::cout<<',';std::cout<<lev[d].words.size();}std::cout<<"],\"retainedInducedStarDimensions\":0,\"seconds\":"<<elapsed()<<"}\n";}
};
int main(int argc,char**argv){std::signal(SIGINT,kk_signal);std::signal(SIGTERM,kk_signal);try{MOptions o;for(int i=1;i<argc;i++){std::string a=argv[i];auto val=[&](){if(++i>=argc)throw std::runtime_error("missing option");return std::string(argv[i]);};if(a=="--n")o.n=read_u32(val());else if(a=="--degree")o.degree=read_u32(val());else if(a=="--prime")o.prime=read_u32(val());else if(a=="--threads")o.threads=read_u32(val());else if(a=="--relations")o.relations=val();else if(a=="--state")o.state=val();else if(a=="--bind")o.binding=val();else if(a=="--resume")o.resume=true;else if(a=="--max-cols")o.maxcols=read_u32(val());else if(a=="--max-terms")o.maxterms=read_u32(val());else if(a=="--seconds"){auto v=val();size_t used;o.seconds=std::stod(v,&used);if(used!=v.size()||!std::isfinite(o.seconds))throw std::runtime_error("finite time required");}else if(a=="--dump")o.dump=val();else if(a=="--dump-degree")o.dumpdegree=read_u32(val());else if(a=="--ungraded")o.graded=false;else if(a=="--gf2-packed")o.packed2=true;else if(a=="--help"){std::cout<<"kir-relative --n 2..6 --degree 1..31 --relations verified.rel --prime 0|p [--threads n --gf2-packed --dump file --dump-degree d]\nThe native program computes a presented-module upper model, not certified FK dimensions by itself.\n";return 0;}else throw std::runtime_error("unknown option "+a);}
 if(o.n<2||o.n>6||o.degree<1||o.degree>31||o.threads<1||o.threads>32||o.seconds<=0||o.prime>2147483647||o.relations.empty()||!o.maxcols||o.maxcols>2147483647||!o.maxterms)throw std::runtime_error("invalid limits");o.k=o.n-1;if(!o.state.empty()&&(o.binding.size()!=64||o.binding.find_first_not_of("0123456789abcdef")!=std::string::npos))throw std::runtime_error("state requires a 64-character SHA256 binding");
 if(o.packed2&&o.prime!=2)throw std::runtime_error("packing requires F2");if(o.prime){if(o.prime<2)throw std::runtime_error("bad prime");for(u32 d=2;u64(d)*d<=o.prime;d++)if(o.prime%d==0)throw std::runtime_error("composite modulus");modulus=o.prime;if(o.prime==2)return MBuilder<BinaryField>(o).run();return MBuilder<Mod>(o).run();}return MBuilder<Rat>(o).run();
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
