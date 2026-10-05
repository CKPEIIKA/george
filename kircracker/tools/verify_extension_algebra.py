#!/usr/bin/env python3
"""Symbolic proof checks for the full FK operator representation.

For any homogeneous S5/δ-stable ideal J containing a_i^2, these formulas give
an E6 representation on T(a_1,...,a_5)/J. This script checks the finite algebraic
identities used by the all-words induction, not just a finite sample of vectors.
Random-vector checks and an independent δ implementation are supplementary.
"""
from pathlib import Path
from collections import defaultdict,Counter
from itertools import combinations,product
import json,random,time,sys
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from star_relations import deriv,derivative_reference

def clean(p):return {w:c for w,c in p.items() if c}
def add(p,q,c=1):
 d=dict(p)
 for w,v in q.items():d[w]=d.get(w,0)+c*v
 return clean(d)
def swap(a,b,k=5):
 s=list(range(k));s[a],s[b]=s[b],s[a];return tuple(s)
def sigma(p,s):
 d=defaultdict(int)
 for w,c in p.items():d[tuple(s[a]for a in w)]+=c
 return clean(d)
def permprod(p,q):return tuple(p[q[i]]for i in range(len(p)))
def signededge(s,e):
 a,b=s[e[0]],s[e[1]];return tuple(sorted((a,b))),1 if a<b else -1

def relations(n):
 e=list(combinations(range(n),2));out=[]
 for a in e:out.append(('square',[(1,a,a)]))
 for a,b in combinations(e,2):
  if not set(a)&set(b):out.append(('disjoint',[(1,a,b),(-1,b,a)]))
 for i,j,k in combinations(range(n),3):
  a,b,c=(i,j),(j,k),(i,k)
  out.extend([('triangle',[(1,a,b),(-1,b,c),(-1,c,a)]),('triangle',[(1,b,a),(-1,c,b),(-1,a,c)])])
 return out

def act(p,e):
 if e[1]==5:return {(e[0],)+w:c for w,c in p.items()}
 return derivative_reference(p,*e)
def apply_relation(p,rel):
 out={}
 for c,a,b in rel:out=add(out,act(act(p,b),a),c)
 return out

def run():
 t=time.monotonic();leaf=relations(5);full=relations(6);edges=list(combinations(range(5),2));cert=[]
 # Every quadratic leaf relation is a twisted derivation: its two tensor-cross
 # terms cancel and its leading permutation is common to all summands.
 for kind,rel in leaf:
  cross=Counter();ps=set()
  for c,a,b in rel:
   sa,sb=swap(*a),swap(*b);ps.add(permprod(sa,sb))
   ab,sg=signededge(sa,b)
   cross[(ab,sa,a)]+=c*sg # σ_a δ_b ⊗ δ_a = sign δ_(a▷b) σ_a ⊗ δ_a
   cross[(a,sb,b)]+=c     # δ_a σ_b ⊗ δ_b
  assert len(ps)==1 and not any(cross.values()),(kind,rel,cross)
  seeds=[]
  for i in range(5):
   z=apply_relation({(i,):1},rel)
   assert all(any(w[j]==w[j+1] for j in range(len(w)-1)) for w in z),(kind,rel,i,z)
   seeds.append({'generator':i,'value':[[list(w),c]for w,c in sorted(z.items())]})
  cert.append({'kind':kind,'relation':rel,'commonPermutation':list(next(iter(ps))),'crossTermsCancel':True,'generatorValuesInSquareIdeal':seeds})
 # Covariance. Equality on the generators extends by the defining skew Leibniz
 # rule, with the transported permutation and signed oriented edge.
 covariance=0
 for i in range(4):
  s=swap(i,i+1)
  for e in edges:
   se,sg=signededge(s,e)
   for g in range(5):
    p={(g,):1}
    assert sigma(derivative_reference(sigma(p,s),*e),s)=={w:sg*c for w,c in derivative_reference(p,*se).items()}
    covariance+=1
 # The 50 δ(a) formulas are exactly the mixed FK triangle/disjoint relations.
 mixed=[]
 for e in edges:
  s=swap(*e)
  for i in range(5):
   d=derivative_reference({(i,):1},*e)
   expected={(e[0],e[1]):-1} if i==e[0] else {(e[1],e[0]):1} if i==e[1] else {}
   assert d==expected
   mixed.append({'leafEdge':e,'starGenerator':i,'sigmaStar':s[i],'delta':[[list(w),c]for w,c in sorted(d.items())]})
 # Supplementary independent evaluations, no quotient/GB called: operator
 # quadratic identities yield only monomial square consequences.
 rng=random.Random(31062026);cases=[]
 words=[()]+[(a,)for a in range(5)]+list(product(range(5),repeat=2))+[tuple(rng.randrange(5)for _ in range(rng.randrange(3,13)))for _ in range(300)]
 count=0;peak=0
 for w in words:
  p={w:1}
  for e in edges:assert deriv(p,*e)==derivative_reference(p,*e)
  for kind,rel in full:
   z=apply_relation(p,rel);peak=max(peak,len(z))
   assert all(any(v[j]==v[j+1]for j in range(len(v)-1))for v in z),(kind,rel,w,z)
   count+=1
 # Check δ on concatenations against the skew Leibniz rule independently.
 for _ in range(500):
  u=tuple(rng.randrange(5)for _ in range(rng.randrange(8)));v=tuple(rng.randrange(5)for _ in range(rng.randrange(8)));e=rng.choice(edges);s=swap(*e)
  lhs=derivative_reference({u+v:1},*e)
  rhs=add({w+v:c for w,c in deriv({u:1},*e).items()},{tuple(s[a]for a in u)+w:c for w,c in deriv({v:1},*e).items()})
  assert lhs==rhs
 result={'passed':True,'generators':5,'ambientFK':6,'field':'Q','fullFKRelations':len(full),'leafRelations':len(leaf),'covarianceGeneratorChecks':covariance,'mixedGeneratorCrossings':len(mixed),'supplementalWordRelationChecks':count,'supplementalMaxPolynomialTerms':peak,'leibnizChecks':500,'leafQuadraticInductionCertificates':cert,'mixedCrossingCertificates':mixed,'logic':'Finite coproduct-cross-term cancellation + generator images proves every leaf quadratic operator is a common-permutation skew derivation vanishing modulo the square ideal. σ/δ closure of the chosen quotient is verified separately.','seconds':time.monotonic()-t}
 return result
if __name__=='__main__':
 r=run();out=R/'evidence/0.3/operator-representation-identities.json';out.write_text(json.dumps(r,indent=2)+'\n');print({k:v for k,v in r.items()if not isinstance(v,list)})
