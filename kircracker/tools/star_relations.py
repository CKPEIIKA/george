#!/usr/bin/env python3
"""Finite, proved star-relation libraries from ambient FK quadratics.
This compiler does NOT assert that the library presents the entire star algebra.
Its role is to supply honest upper models to the relative-only right-module engine.
Every exported row has a rational-membership DAG certificate, replayed independently.
"""
from __future__ import annotations
from collections import defaultdict, Counter
from itertools import combinations, permutations
from pathlib import Path
from math import gcd
import argparse,heapq,json,time,hashlib

def clean(p):return {w:c for w,c in p.items() if c}
def serial(p):return [[list(w),str(c)] for w,c in sorted(p.items())]
def parse(rows,k,degree=None):
 out={}
 for w,c in rows:
  if not isinstance(w,list) or not w or any(type(a) is not int or not 0<=a<k for a in w):raise ValueError('bad star word')
  if degree is not None and len(w)!=degree:raise ValueError('inhomogeneous row')
  if not isinstance(c,(str,int)) or not str(c).lstrip('-').isdigit():raise ValueError('integer coefficient required')
  c=int(c);w=tuple(w)
  if not c or w in out:raise ValueError('zero/duplicate term')
  out[w]=c
 if not out:raise ValueError('zero relation')
 return out

def deriv(p,i,j):
 out=defaultdict(int)
 for w,c in p.items():
  pre=[]
  for at,a in enumerate(w):
   if a==i:out[tuple(pre)+(i,j)+w[at+1:]]-=c
   elif a==j:out[tuple(pre)+(j,i)+w[at+1:]]+=c
   pre.append(j if a==i else i if a==j else a)
 return clean(out)

def derivative_reference(p,i,j):
 # Independent right-to-left Leibniz implementation: d(aQ)=d(a)Q+s(a)d(Q).
 out={}
 for w,c in p.items():
  row={};tail=()
  for a in reversed(w):
   sa=j if a==i else i if a==j else a
   nxt={(sa,)+u:v for u,v in row.items()}
   if a==i:nxt[(i,j)+tail]=nxt.get((i,j)+tail,0)-1
   elif a==j:nxt[(j,i)+tail]=nxt.get((j,i)+tail,0)+1
   row=clean(nxt);tail=(a,)+tail
  for u,v in row.items():out[u]=out.get(u,0)+c*v
 return clean(out)

class Compiler:
 def __init__(self,k,seconds=120,max_nodes=10000,max_steps=10000000):
  self.k=k;self.deadline=time.monotonic()+seconds;self.max_nodes=max_nodes;self.max_steps=max_steps;self.steps=0;self.nodes=[];self.polys=[];self.index={};self.lengths=[];self.stats=[]
  for i in range(k):self.add({(i,i):1},{'op':'square','letter':i})
 def add(self,p,proof):
  if len(self.nodes)>=self.max_nodes:raise RuntimeError('relation budget exceeded; no complete library claim')
  node={'id':len(self.nodes),'degree':len(next(iter(p))),'polynomial':serial(p),'proof':proof};self.nodes.append(node);self.polys.append(p)
  return node['id']
 def reindex(self):
  self.index={};
  for j,p in enumerate(self.polys):
   w=max(p)
   if p[w]==1:self.index.setdefault(len(w),{}).setdefault(w,j)
  self.lengths=sorted(self.index)
 def nf(self,p):
  p=clean(p);heap=[tuple(-a for a in w) for w in p];heapq.heapify(heap);out={};proof=defaultdict(int)
  while heap:
   w=tuple(-a for a in heapq.heappop(heap));c=p.pop(w,0)
   if not c:continue
   self.steps+=1
   if self.steps>self.max_steps:raise RuntimeError('derivation step budget; incomplete')
   if not self.steps%1024 and time.monotonic()>self.deadline:raise RuntimeError('derivation deadline; incomplete')
   hit=None
   # Match the original prototype's oldest applicable rule, then leftmost position.
   for d in self.lengths:
    if d>len(w):break
    for a in range(len(w)-d+1):
     j=self.index[d].get(w[a:a+d])
     if j is not None and (hit is None or (j,a)<hit):hit=(j,a)
   if hit is None:out[w]=c;continue
   j,a=hit;g=self.polys[j];lm=max(g);L=w[:a];R=w[a+len(lm):];proof[j,L,R]+=c
   for v,z in g.items():
    if v==lm:continue
    word=L+v+R;delta=-c*z;old=p.get(word)
    if old is None:
     if delta:p[word]=delta;heapq.heappush(heap,tuple(-x for x in word))
    else:
     new=old+delta
     if new:p[word]=new
     else:p.pop(word)
  return out,[[j,list(L),list(R),str(c)] for (j,L,R),c in sorted(proof.items()) if c]
 def run(self,D):
  frontier=list(range(self.k));started=time.monotonic()
  for d in range(3,D+1):
   self.reindex();nxt=[];seen=set();t=time.monotonic()
   for parent in frontier:
    for i,j in combinations(range(self.k),2):
     p,trace=self.nf(deriv(self.polys[parent],i,j))
     if not p:continue
     g=gcd(*p.values());g=g if p[max(p)]>0 else -g;p={w:c//g for w,c in sorted(p.items())};key=tuple(p.items())
     if key in seen:continue
     seen.add(key);nxt.append(self.add(p,{'op':'twisted-adjoint','parent':parent,'pair':[i,j],'subtract':trace,'divideBy':str(g)}))
   frontier=nxt;st={'degree':d,'newRelations':len(nxt),'newTerms':sum(len(self.polys[j]) for j in nxt),'seconds':time.monotonic()-t,'cumulativeSeconds':time.monotonic()-started,'steps':self.steps};self.stats.append(st);print(json.dumps(st),flush=True)
  return {'schema':'kir-star-identity-library-v1','n':self.k+1,'k':self.k,'degreeBound':D,'source':'initial FK star squares; twisted-adjoint crossing identities; exact contextual subtraction','meaning':'all rows vanish in the rational FK star; no all-degree presentation assertion','nodes':self.nodes,'generation':self.stats}

class OrbitCompiler(Compiler):
 def __init__(self,k,**kwargs):
  super().__init__(k,**kwargs);self.perms=list(permutations(range(k)));self.seeds={2:[0]}
 def add_orbit(self,p,proof):
  seed=self.add(p,proof);count=1
  for sigma in self.perms:
   self.reindex();raw={tuple(sigma[a] for a in w):c for w,c in p.items()};q,trace=self.nf(raw)
   if not q:continue
   g=gcd(*q.values());g=g if q[max(q)]>0 else -g;q={w:c//g for w,c in sorted(q.items())}
   self.add(q,{'op':'permutation','parent':seed,'permutation':list(sigma),'subtract':trace,'divideBy':str(g)});count+=1
  return seed,count
 def run(self,D):
  started=time.monotonic()
  for d in range(3,D+1):
   t=time.monotonic();nstart=len(self.nodes);seeds=[]
   for parent in self.seeds[d-1]:
    for i,j in combinations(range(self.k),2):
     self.reindex();p,trace=self.nf(deriv(self.polys[parent],i,j))
     if not p:continue
     g=gcd(*p.values());g=g if p[max(p)]>0 else -g;p={w:c//g for w,c in sorted(p.items())}
     seed,_=self.add_orbit(p,{'op':'twisted-adjoint','parent':parent,'pair':[i,j],'subtract':trace,'divideBy':str(g)});seeds.append(seed)
   self.seeds[d]=seeds
   st={'degree':d,'newRelations':len(self.nodes)-nstart,'orbitSeeds':len(seeds),'newTerms':sum(len(q) for q in self.polys[nstart:]),'seconds':time.monotonic()-t,'cumulativeSeconds':time.monotonic()-started,'steps':self.steps};self.stats.append(st);print(json.dumps(st),flush=True)
  return {'schema':'kir-star-identity-library-v1','n':self.k+1,'k':self.k,'degreeBound':D,'source':'FK squares, twisted-adjoint original crossing identities, exact contexts and leaf permutations','meaning':'proved upper model; no unverified presentation-completeness assumption','nodes':self.nodes,'generation':self.stats,'orbitSeeds':self.seeds}

def check_crossing_generators(k):
 # Ambient labels are oriented positive pairs; the three bracket identities are
 # exactly defining triangles/disjoint commutations, not derivative vanishing tests.
 def canon(p):
  p=clean(p)
  if not p:return ()
  c=p[max(p)];return tuple(sorted((w,v//c) for w,v in p.items())) if c in (1,-1) else None
 edges=list(combinations(range(k+1),2));rels=set()
 for a in edges:rels.add(canon({(a,a):1}))
 for a,b in combinations(edges,2):
  if set(a).isdisjoint(b):rels.add(canon({(a,b):1,(b,a):-1}))
 for i,j,l in combinations(range(k+1),3):
  a,b,c=(i,j),(j,l),(i,l);rels.add(canon({(a,b):1,(b,c):-1,(c,a):-1}));rels.add(canon({(b,a):1,(c,b):-1,(a,c):-1}))
 checked=0
 for i,j in combinations(range(k),2):
  c=(i,j)
  for a in range(k):
   sa=j if a==i else i if a==j else a
   q={(c,(a,k)):1,((sa,k),c):-1}
   if a==i:q[((i,k),(j,k))]=1
   elif a==j:q[((j,k),(i,k))]=-1
   assert canon(q) in rels,(k,i,j,a,q);checked+=1
 return checked

def verify(obj,max_nodes=10000,max_terms=3000000):
 started=time.monotonic()
 if obj.get('schema')!='kir-star-identity-library-v1' or type(obj.get('k')) is not int or not 1<=obj['k']<=5 or obj.get('n')!=obj['k']+1 or type(obj.get('degreeBound')) is not int or not 2<=obj['degreeBound']<=1000:raise ValueError('invalid library schema')
 k=obj['k'];nodes=obj.get('nodes');
 if not isinstance(nodes,list) or not nodes or len(nodes)>max_nodes:raise ValueError('invalid node count')
 check_crossing_generators(k);polys=[];terms=0;proofs=0
 for idx,node in enumerate(nodes):
  if node.get('id')!=idx or type(node.get('degree')) is not int or not 2<=node['degree']<=obj['degreeBound']:raise ValueError('bad DAG order/degree')
  p=parse(node['polynomial'],k,node['degree']);terms+=len(p)
  if terms>max_terms:raise ValueError('certificate term budget')
  pr=node['proof']
  if pr['op']=='square':
   a=pr['letter']
   if type(a) is not int or not 0<=a<k or p!={(a,a):1}:raise ValueError('invalid FK square')
  elif pr['op']=='twisted-adjoint':
   parent=pr['parent'];i,j=pr['pair']
   if type(parent) is not int or not 0<=parent<idx or not (type(i) is type(j) is int and 0<=i<j<k) or len(next(iter(polys[parent])))+1!=node['degree']:raise ValueError('bad parent/operator')
   value=derivative_reference(polys[parent],i,j)
   for ref,L,R,c in pr['subtract']:
    if type(ref) is not int or not 0<=ref<idx:raise ValueError('forward/cyclic proof')
    if any(type(a) is not int or not 0<=a<k for a in L+R):raise ValueError('bad proof context')
    c=int(c);L=tuple(L);R=tuple(R)
    if len(L)+len(next(iter(polys[ref])))+len(R)!=node['degree']:raise ValueError('inhomogeneous context')
    for w,v in polys[ref].items():value[L+w+R]=value.get(L+w+R,0)-c*v
    proofs+=1
    if proofs>max_terms:raise ValueError('certificate proof budget')
   scale=int(pr['divideBy'])
   if not scale or clean(value)!={w:c*scale for w,c in p.items()}:raise ValueError('invalid original-ideal identity')
  elif pr['op']=='permutation':
   parent=pr['parent'];sigma=pr['permutation'];scale=int(pr['divideBy'])
   if type(parent) is not int or not 0<=parent<idx or len(sigma)!=k or any(type(a) is not int for a in sigma) or sorted(sigma)!=list(range(k)) or not scale:raise ValueError('bad permutation proof')
   value={tuple(sigma[a] for a in w):c for w,c in polys[parent].items()}
   for ref,L,R,c in pr.get('subtract',[]):
    if type(ref) is not int or not 0<=ref<idx or any(type(a) is not int or not 0<=a<k for a in L+R):raise ValueError('bad permutation subtraction')
    L,R,c=tuple(L),tuple(R),int(c)
    if len(L)+len(next(iter(polys[ref])))+len(R)!=node['degree']:raise ValueError('inhomogeneous permutation proof')
    for w,z in polys[ref].items():value[L+w+R]=value.get(L+w+R,0)-c*z
    proofs+=1
    if proofs>max_terms:raise ValueError('certificate proof budget')
   if clean(value)!={w:c*scale for w,c in p.items()}:raise ValueError('invalid transported identity')
  else:raise ValueError('unsupported inference')
  polys.append(p)
 return polys,{'passed':True,'field':'Q','relations':len(polys),'terms':terms,'contextualProofSteps':proofs,'crossingIdentities':check_crossing_generators(k),'seconds':time.monotonic()-started,'fullStarPresentationProved':False,'source':'exact original FK quadratic consequences, not a dimension target'}

def write_native(obj,path):
 polys,checked=verify(obj)
 with Path(path).open('w') as f:
  f.write(f"{obj['k']} {len(polys)}\n")
  for p in polys:
   f.write(f'{len(next(iter(p)))} {len(p)}\n')
   for w,c in sorted(p.items()):f.write(str(c)+' '+' '.join(map(str,w))+'\n')
 return checked

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--orbits',action='store_true');ap.add_argument('--k',type=int,default=5);ap.add_argument('--degree',type=int,default=8);ap.add_argument('--seconds',type=float,default=120);ap.add_argument('--out',type=Path);ap.add_argument('--verify',type=Path);a=ap.parse_args()
 if a.verify:
  obj=json.loads(a.verify.read_text());_,st=verify(obj);print(json.dumps(st))
  if a.out:write_native(obj,a.out)
 elif a.out:
  if not 1<=a.k<=5 or not 2<=a.degree<=20:ap.error('k 1..5, degree 2..20 for bounded compiler')
  obj=(OrbitCompiler if a.orbits else Compiler)(a.k,seconds=a.seconds).run(a.degree);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(obj,separators=(',',':'))+'\n');report=write_native(obj,a.out.with_suffix('.rel'));a.out.with_suffix('.verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
 else:ap.error('--out or --verify is required')
if __name__=='__main__':main()

# Restrict an authenticated proof DAG to the relations relevant to a requested
# degree; never drop a used proof ancestor or silently rewrite its reference.
def truncate_library(obj,D):
 if type(D)is not int or D<1:raise ValueError('positive bound required')
 import copy
 bound=max(2,D);kept=[];mapping={}
 for node in obj['nodes']:
  if node['degree']>bound:continue
  out=copy.deepcopy(node);old=node['id'];out['id']=len(kept);pr=out['proof']
  if 'parent' in pr:
   if pr['parent'] not in mapping:raise ValueError('missing proof ancestor in truncation')
   pr['parent']=mapping[pr['parent']]
  for term in pr.get('subtract',[]):
   if term[0] not in mapping:raise ValueError('missing subtraction ancestor')
   term[0]=mapping[term[0]]
  mapping[old]=out['id'];kept.append(out)
 return {**obj,'degreeBound':min(obj['degreeBound'],bound),'nodes':kept,'truncation':'irrelevant higher-degree relations omitted, every required proof ancestor preserved'}
