#!/usr/bin/env python3
"""Compare the shared C counter with normalized bar homology and exact formulas."""
from pathlib import Path
from itertools import product
import ctypes as C,json,sys,random
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from native import Engine,parse,check,U32,U64

def fixture(variables,relations):
 v,r=parse(variables,relations);return {'variables':v,'relations':r}
def counter(e,D,budget=64<<20):
 l=e.lib
 for n,args,res in [('gn_poincare',[U32,U64],C.c_int),('gn_poincare_limb',[U32,U32,U32],U32),('gn_poincare_limbs',[],U32),('gn_poincare_release',[],None),('gn_poincare_stat',[U32],U64)]:
  f=getattr(l,n);f.argtypes=args;f.restype=res
 before=(e.stats(),e.leaders());check(l.gn_poincare(D,budget));limbs=l.gn_poincare_limbs()
 c=[[sum(int(l.gn_poincare_limb(p,d,i))<<(32*i)for i in range(limbs))for d in range(D+1)]for p in range(D+1)]
 stats=[int(l.gn_poincare_stat(i))for i in range(5)];l.gn_poincare_release()
 assert e.stats()['basisSize']==before[0]['basisSize']and e.leaders()==before[1]
 return c,stats

def bar_counts(leaders,ng,D):
 # Independent algorithm: enumerate words and all normal-factor cuts, then
 # compute normalized bar homology word by word. Only small test inputs.
 def normal(w):return not any(w[i:i+len(l)]==l for l in leaders for i in range(len(w)-len(l)+1))
 def rank(cols):
  piv={}
  for x in cols:
   while x:
    h=x.bit_length()-1
    if h not in piv:piv[h]=x;break
    x^=piv[h]
  return len(piv)
 c=[[0]*(D+1)for _ in range(D+1)];c[0][0]=1
 for d in range(1,D+1):
  for word in product(range(ng),repeat=d):
   groups={p:[]for p in range(1,d+1)}
   for mask in range(1<<(d-1)):
    boundaries=[0]+[j+1 for j in range(d-1)if mask>>j&1]+[d]
    if all(normal(word[a:b])for a,b in zip(boundaries,boundaries[1:])):groups[len(boundaries)-1].append(mask)
   ranks={1:0,d+1:0}
   for p in range(2,d+1):
    idx={m:i for i,m in enumerate(groups[p-1])};cols=[]
    for mask in groups[p]:
     v=0
     for bit in range(d-1):
      if mask>>bit&1 and (mask^(1<<bit))in idx:v^=1<<idx[mask^(1<<bit)]
     cols.append(v)
    ranks[p]=rank(cols)
   for p in range(1,d+1):c[p][d]+=len(groups[p])-ranks[p]-ranks[p+1]
 return c

checks=[]
for name,vars,rels,D in [('free','a,b','',6),('square','a,b','a^2',6),('overlapping','a,b','a*b*a,b*a*b',7),('mixed-lengths','a,b','a*a,a*b*b*a,b*b*b',6),('linear-elimination','a,b','b-a,a^3',6),('all-linear','a,b','a,b',5),('nonmonomial','a,b','b*a-a*b,b*b-a*a',6)]:
 e=Engine(fixture(vars,rels),D,budget=128<<20,scratch=16<<20);e.run();got,stats=counter(e,D);expected=bar_counts([tuple(w)for w in e.leaders()],len(e.fixture['variables']),D);assert got==expected,(name,got,expected)
 # Independent normal-word counts verify the Euler inverse identity.
 def normal(w):return not any(tuple(w[i:i+len(l)])==tuple(l)for l in e.leaders()for i in range(len(w)-len(l)+1))
 h=[sum(normal(w)for w in product(range(len(e.fixture['variables'])),repeat=d))for d in range(D+1)]
 chi=[sum((-1)**p*got[p][d]for p in range(D+1))for d in range(D+1)]
 assert [sum(h[j]*chi[d-j]for j in range(d+1))for d in range(D+1)]==[1]+[0]*D
 assert e.lib.gn_poincare(D,1)==1,'budget must fail without a false zero table'
 e.lib.gn_cancel(1);assert e.lib.gn_poincare(D,64<<20)==5;e.lib.gn_cancel(0)
 again,_=counter(e,D);assert again==got
 checks.append({'name':name,'barHomologyCompared':True,'degree':D,'states':stats[0],'edges':stats[1]})
for power,D in [(3,12),(35,40)]:
 e=Engine(fixture('a',f'a^{power}'),D,budget=128<<20,scratch=16<<20);e.run();got,stats=counter(e,D)
 for p in range(D+1):
  degree=(p//2)*power+(p%2)
  assert got[p]==[int(d==degree)for d in range(D+1)]
 checks.append({'name':f'power-{power}','degree':D,'longWords':power>31})
ng=16;D=16
f={'variables':['x'+str(i)for i in range(ng)],'relations':[{'degree':2,'terms':[{'word':[i,j],'coefficient':'1'}]}for i in range(ng)for j in range(ng)]}
e=Engine(f,D,budget=128<<20,scratch=16<<20);e.run();got,_=counter(e,D)
assert all(got[p][d]==(ng**p if d==p else 0)for p in range(D+1)for d in range(D+1))
assert got[16][16]==2**64
checks.append({'name':'exact-counts-above-uint64','coefficient':str(got[16][16])})
print(json.dumps({'passed':True,'checks':checks}))
