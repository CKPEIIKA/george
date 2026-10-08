"""Exact normal-word and Anick-chain automata; no enumeration of long chains."""
from collections import deque,defaultdict,Counter
import heapq
from .core import Invalid,Incomplete,Budget
class Avoidance:
 def __init__(self,leaders,ng):
  self.ng=ng;self.next=[{}];self.fail=[0];self.output=[[]];self.leaders=sorted(set(map(tuple,leaders)),key=lambda w:(len(w),w))
  if any(not w for w in self.leaders):raise Invalid('unit leading word not supported')
  for i,w in enumerate(self.leaders):
   s=0
   for a in w:
    if not 0<=a<ng:raise Invalid('bad generator')
    if a not in self.next[s]:self.next[s][a]=len(self.next);self.next.append({});self.fail.append(0);self.output.append([])
    s=self.next[s][a]
   self.output[s].append((i,len(w)))
  q=deque(self.next[0].values())
  while q:
   v=q.popleft()
   for a,u in list(self.next[v].items()):
    q.append(u);f=self.fail[v]
    while f and a not in self.next[f]:f=self.fail[f]
    self.fail[u]=self.next[f].get(a,0);self.output[u]+=self.output[self.fail[u]]
  self.table=[[self.step(s,a) for a in range(ng)] for s in range(len(self.next))]
 def step(self,s,a):
  while s and a not in self.next[s]:s=self.fail[s]
  return self.next[s].get(a,0)
 def occurrences(self,w):
  s=0
  for end,a in enumerate(w):
   s=self.table[s][a]
   for i,n in self.output[s]:yield end+1-n,end+1,i
 def minimal(self):
  for w in self.leaders:
   occ=list(self.occurrences(w))
   if len(occ)!=1 or occ[0][:2]!=(0,len(w)):raise Invalid('leading words not a reduced obstruction antichain')
 def hilbert(self,D,budget=None):
  b=budget or Budget();v={0:1};h=[1]
  for d in range(1,D+1):
   nxt=defaultdict(int)
   for s,c in v.items():
    b.check()
    for a in range(self.ng):
     u=self.table[s][a]
     if not self.output[u]:nxt[u]+=c
   v=nxt;h.append(sum(v.values()))
  return h

def anick(leaders,ng,D,budget=None):
 """Path construction: vertices are letters/proper obstruction suffixes.
 u->v iff uv contains exactly one obstruction, at its end. Homological C_0={1},
 C_1=letters, C_2=obstructions; traditional Anick index is p-1.
 """
 b=budget or Budget();a=Avoidance(leaders,ng);a.minimal()
 if any(len(w)<2 for w in a.leaders):raise Invalid('eliminate degree-one relations before Anick construction')
 prefixes=defaultdict(set)
 for w in a.leaders:
  for k in range(1,len(w)):prefixes[w[:k]].add(w[k:])
 states={(i,) for i in range(ng)}
 for w in a.leaders:
  states.update(w[k:] for k in range(1,len(w)))
 states=sorted(states,key=lambda w:(len(w),w));idx={w:i for i,w in enumerate(states)};edges=[[] for _ in states]
 # Degree-bounded Dijkstra frontier: many algebraic tail states cannot occur
 # in any chain of internal degree <=D. Never expand their irrelevant edges.
 distance={idx[(i,)]:1 for i in range(ng)} if D>=1 else {}
 pending=[(d,s) for s,d in distance.items()];heapq.heapify(pending);visited=set()
 while pending:
  d,s=heapq.heappop(pending)
  if s in visited:continue
  visited.add(s);u=states[s];b.check();candidates=set()
  for k in range(1,len(u)+1):
   candidates.update(v for v in prefixes.get(u[-k:],()) if d+len(v)<=D)
  for v in candidates:
   b.check();oc=[]
   for occurrence in a.occurrences(u+v):
    oc.append(occurrence)
    if len(oc)>1:break
   if len(oc)==1 and oc[0][1]==len(u)+len(v):
    t=idx[v];edges[s].append(t);nd=d+len(v)
    if nd<distance.get(t,D+1):distance[t]=nd;heapq.heappush(pending,(nd,t))
  edges[s].sort()
 # dp[p][total degree][last tail] counts paths; stores counts, not path words.
 counts=[[0]*(D+1) for _ in range(D+1)];counts[0][0]=1
 current={(1,idx[(i,)]):1 for i in range(ng)} if D>=1 else {}
 for p in range(1,D+1):
  nxt=defaultdict(int)
  for (d,s),c in current.items():
   counts[p][d]+=c;b.check(len(current))
   for t in edges[s]:
    nd=d+len(states[t])
    if nd<=D:nxt[(nd,t)]+=c
  current=nxt
 chi=[sum((-1)**p*counts[p][d] for p in range(D+1)) for d in range(D+1)]
 h=a.hilbert(D,b);conv=[sum(h[i]*chi[d-i] for i in range(d+1)) for d in range(D+1)]
 if conv!=[1]+[0]*D:raise Invalid('Anick/Euler independent automaton cross-check failed')
 return {'schema':'kir-anick-v1','throughDegree':D,'indexing':'homological: C0={1}, C1=generators, C2=minimal leading words; traditional Anick index=p-1', 'counts':[[str(c) for c in row] for row in counts],'chi':[str(x) for x in chi],'normalWordCounts':[str(x) for x in h], 'eulerCheck':True,'torBettiNumbers':False,'usesOnlyLeadingIdeal':True,'states':len(states),'reachableStatesThroughBound':len(visited),'degreePrunedGraph':True,'edges':sum(map(len,edges)),'graph':{'tails':[list(w) for w in states],'edges':edges},'warning':'These are Anick resolution ranks, not homology dimensions/differentials. Agreement is bounded by the independently established GB frontier.'}

def rename_orbit_word(w):
 m={};return tuple(m.setdefault(a,len(m)) for a in w)
def orbit_summary(rows,ng):
 """Equality-pattern classes only. Not a group action on a fixed lex basis."""
 buckets=defaultdict(list)
 for i,p in enumerate(rows):
  w=max(p);buckets[(len(w),rename_orbit_word(w))].append(i)
 return {'kind':'leading-word alphabet-renaming orbit fingerprints','notAQuotientGroebnerBasis':True,'notAGroupActionOnRules':True,'groups':[{'degree':d,'representative':list(w),'ruleIds':ids,'count':len(ids)} for (d,w),ids in sorted(buckets.items())]}

def polynomial_orbits(rows,ng,budget=None):
 """Exact projective polynomial orbits under alphabet permutations.
 Valid S_(n-1) leaf action for standard star letters a_i=x_i,n. An orbit need
 not be wholly present in a fixed-order GB; this is NOT an orbit quotient GB.
 """
 from itertools import permutations
 from math import factorial
 from fractions import Fraction
 from .core import monic,serial
 if not 1<=ng<=6:raise Invalid('full polynomial alphabet orbits limited to 6 letters; ambient FK6 uses a different S6 action, not S15')
 b=budget or Budget();sigmas=list(permutations(range(ng)));groups={}
 def key(p):return tuple((w,c.numerator,c.denominator) for w,c in sorted(monic(p).items(),reverse=True))
 for i,p in enumerate(rows):
  original=key(p);best=None;stabilizer=0
  for s in sigmas:
   q={tuple(s[a] for a in w):c for w,c in p.items()};k=key(q);b.check(len(k))
   if k==original:stabilizer+=1
   if best is None or k<best:best=k
  if not stabilizer:raise Invalid('identity permutation missing in orbit')
  if best not in groups:groups[best]={'representative':serial({w:Fraction(a,d) for w,a,d in best}),'degree':len(best[0][0]),'fullOrbitSize':factorial(ng)//stabilizer,'presentRuleIds':[]}
  groups[best]['presentRuleIds'].append(i)
 return {'kind':f'exact projective polynomial S{ng} alphabet-permutation orbits','normalization':'each image divided by its leading coefficient in the fixed order','notAnActionOnTheSuppliedGroebnerBasis':True,'notAnEquivariantQuotientGraph':True,'groups':list(groups.values())}
