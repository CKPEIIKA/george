"""Signed FK action and braided tensor computations in explicit coordinates."""
from itertools import combinations,permutations
from collections import defaultdict
from functools import lru_cache
from math import factorial
from .core import *
GEORGE=['a','b','c','d','e','f','g','h','k','m','n','p','q','r','s']
# Directed pairs mean the generator IS x_ij; x_ji=-x_ij.
GEORGE_EDGES=[(2, 3), (2, 4), (5, 4), (5, 1), (6, 1), (6, 3), (6, 2), (5, 3), (1, 4), (3, 4), (1, 3), (2, 1), (5, 2), (6, 5), (6, 4)]
class FK:
 def __init__(self,n,edges=None):
  self.n=n;self.edges=list(map(tuple,edges)) if edges is not None else list(combinations(range(1,n+1),2));self.ng=len(self.edges)
  if len({tuple(sorted(e)) for e in self.edges})!=self.ng or any(len(e)!=2 or e[0]==e[1] or min(e)<1 or max(e)>n for e in self.edges):raise Invalid('invalid signed FK edge list')
  self.index={tuple(sorted(e)):(i,1 if e[0]<e[1] else -1) for i,e in enumerate(self.edges)}
 def edge(self,a,b):
  i,s=self.index[tuple(sorted((a,b)))];return i,s*(1 if a<b else -1)
 def perm_word(self,w,sigma):
  sign=1;out=[]
  for a in w:
   u,v=self.edges[a];i,s=self.edge(sigma[u-1],sigma[v-1]);out.append(i);sign*=s
  return tuple(out),sign
 def perm_poly(self,p,sigma):
  out=defaultdict(F)
  for w,c in p.items():v,s=self.perm_word(w,sigma);out[v]+=s*c
  return clean(out)
 def grade(self,w):
  g=list(range(1,self.n+1))
  for a in w:
   i,j=self.edges[a];g[i-1],g[j-1]=g[j-1],g[i-1]
  return tuple(g)
 def relations(self):
  rows=[]
  for a in range(self.ng):rows.append({(a,a):F(1)})
  for a,b in combinations(range(self.ng),2):
   if not set(self.edges[a])&set(self.edges[b]):rows.append({(a,b):F(1),(b,a):F(-1)})
  def row(terms):
   p=defaultdict(F)
   for edges,c in terms:
    w=[]
    for a,b in edges:i,s=self.edge(a,b);w.append(i);c*=s
    p[tuple(w)]+=c
   return clean(p)
  for i,j,k in combinations(range(1,self.n+1),3):
   rows.append(row([([(i,j),(j,k)],1), ([(j,k),(i,k)],-1), ([(i,k),(i,j)],-1)]))
   rows.append(row([([(j,k),(i,j)],1), ([(i,k),(j,k)],-1), ([(i,j),(i,k)],-1)]))
  return rows
 def right_derivative(self,p,e):
  sigma=list(range(1,self.n+1));u,v=self.edges[e];sigma[u-1],sigma[v-1]=sigma[v-1],sigma[u-1];out=defaultdict(F)
  for w,c in p.items():
   for j,a in enumerate(w):
    if a==e:
     tail,s=self.perm_word(w[j+1:],sigma);out[w[:j]+tail]+=c*s
  return clean(out)
 def coproduct_slice(self,p,k,budget=None):
  b=budget or Budget();out=defaultdict(F)
  for w,c in p.items():
   n=len(w)
   for inds in combinations(range(n),k):
    selected=set(inds);g=list(range(1,self.n+1));left=[];right=[];sign=1
    for i,a in enumerate(w):
     if i in selected:
      u,v=self.edges[a];z,s=self.edge(g[u-1],g[v-1]);left.append(z);sign*=s
     else:
      right.append(a);u,v=self.edges[a];g[u-1],g[v-1]=g[v-1],g[u-1]
    key=(tuple(left),tuple(right));out[key]+=c*sign
    if not out[key]:del out[key]
    if b.used%1024==0:b.check(len(out))
    else:b.used+=1
  b.check(len(out));return dict(out)

def tensor_normal(p,oracle,budget=None):
 """Reduce grouped factors; many zero groups disappear before cross expansion."""
 b=budget or Budget();byright=defaultdict(dict)
 for (u,v),c in p.items():byright[v][u]=byright[v].get(u,0)+c
 byleft=defaultdict(dict)
 for v,row in byright.items():
  b.check();out=oracle.nf(clean(row),b)
  for u,c in out.items():byleft[u][v]=byleft[u].get(v,0)+c
 ans={}
 for u,row in byleft.items():
  b.check();out=oracle.nf(clean(row),b)
  for v,c in out.items():ans[u,v]=c
  b.check(len(ans))
 return ans

def source_Q(fk,path=None):
 p=load(path or ROOT/'data/Q14-radical-source.json');out=defaultdict(F)
 for term in p['polynomial']:
  c=F(term['coefficient']);w=[]
  for a,b in term['word']:i,s=fk.edge(a,b);w.append(i);c*=s
  out[tuple(w)]+=c
 return clean(out)

def partitions(n,top=None):
 if n==0:yield();return
 for a in range(min(n,top or n),1-1,-1):
  for tail in partitions(n-a,a):yield(a,)+tail
@lru_cache(None)
def char_value(lam,cycle):
 if not cycle:return int(not lam)
 k=cycle[0];n=sum(lam);cells={(i,j) for i,r in enumerate(lam) for j in range(r)};out=0
 for mu in partitions(n-k):
  if len(mu)>len(lam) or any(mu[i]>lam[i] for i in range(len(mu))):continue
  rem=cells-{(i,j) for i,r in enumerate(mu) for j in range(r)}
  if len(rem)!=k:continue
  if any({(i,j),(i+1,j),(i,j+1),(i+1,j+1)}<=rem for i,j in rem):continue
  seen={next(iter(rem))};todo=list(seen)
  while todo:
   i,j=todo.pop()
   for x in [(i+1,j),(i-1,j),(i,j+1),(i,j-1)]:
    if x in rem and x not in seen:seen.add(x);todo.append(x)
  if seen!=rem:continue
  out+=(-1)**(len({i for i,j in rem})-1)*char_value(mu,cycle[1:])
 return out

def cycle_perm(cycle):
 n=sum(cycle);p=list(range(1,n+1));start=0
 for k in cycle:
  for j in range(k):p[start+j]=start+(j+1)%k+1
  start+=k
 return tuple(p)
def class_size(c):
 from collections import Counter
 den=1
 for k,m in Counter(c).items():den*=k**m*factorial(m)
 return factorial(sum(c))//den

def representation(fk,oracle,words,budget=None):
 b=budget or Budget();idx={w:i for i,w in enumerate(words)}
 def column(w,sigma):
  v,sg=fk.perm_word(w,sigma);out=oracle.nf({v:F(sg)},b)
  if any(u not in idx for u in out):raise Invalid('action leaves the given complete normal basis')
  return {idx[u]:c for u,c in out.items()}
 adjacent=[]
 for s in range(fk.n-1):
  sigma=list(range(1,fk.n+1));sigma[s],sigma[s+1]=sigma[s+1],sigma[s];adjacent.append([[[i,str(c)] for i,c in sorted(column(w,sigma).items())] for w in words])
 cyc=list(partitions(fk.n));chars=[]
 for c in cyc:
  sigma=cycle_perm(c);tr=sum(column(w,sigma).get(j,0) for j,w in enumerate(words));chars.append(tr)
 mult=[]
 for lam in cyc:
  m=sum(class_size(c)*x*char_value(lam,c) for c,x in zip(cyc,chars))/F(factorial(fk.n))
  if m.denominator!=1 or m<0:raise Invalid('character decomposition is not an honest representation')
  mult.append({'partition':list(lam),'multiplicity':int(m),'irrepDimension':char_value(lam,(1,)*fk.n)})
 return {'group':f'S{fk.n}','basis':[list(w) for w in words],'adjacentTranspositionMatrices':adjacent,'matrixConvention':'columns are images of ordered basis vectors; sparse [row,coefficient]','cycleTypes':[list(c) for c in cyc],'classSizes':[class_size(c) for c in cyc],'characters':[str(x) for x in chars],'multiplicities':mult,'dimension':len(words)}

def full_radical(fk,oracle,D,limit=10000,budget=None):
 """Actual nullspace of all scalar iterated derivatives on the normal-word basis.
 Deliberately budgeted: billion-dimensional spaces are not silently substituted.
 """
 b=budget or Budget();words=normal_words(oracle.leaders,fk.ng,D,limit);memo={():{():F(1)}}
 def pairing_word(w):
  if w in memo:return memo[w]
  out=defaultdict(F)
  for e in range(fk.ng):
   q=oracle.nf(fk.right_derivative({w:F(1)},e),b)
   for v,c in q.items():
    for tail,a in pairing_word(v).items():out[(e,)+tail]+=c*a
  result=clean(out);b.check(len(result));memo[w]=result;return result
 echelon=Echelon(b);ind=[];kernel=[]
 for w in words:
  b.check();yes,c=echelon.append(pairing_word(w))
  if yes:ind.append(w)
  else:
   k={w:F(1)}
   for i,v in c.items():k[ind[i[0]]]=k.get(ind[i[0]],0)-v
   kernel.append(clean(k))
 return {'degree':D,'ambientNormalWords':len(words),'pairingRank':len(ind),'kernelDimension':len(kernel),'basis':[serial(p) for p in kernel],'method':'complete scalar-pairing nullspace on all normal words of this bounded space','completeKernel':True}
