#!/usr/bin/env python3
"""Exact full pairing-radical checks; no implication of original-FK vanishing.

Every state has all ambient BLM nabla derivatives checked, not a sampled family.
Projective normalization and finite-H block rewrites preserve radical membership.
Finite H model is reconstructed, never loaded from an untrusted pickle.
"""
from pathlib import Path
from fractions import Fraction
from math import gcd,lcm
from itertools import combinations
import sys,json,time,hashlib
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'reference')]
from finite_model_cert.core import deserialize,serialize,permutation_degree
from finite_model_cert.relative_calculus import RelativeCalculus
from finite_model_cert.deletion import all_derivatives,reference_all
from finite_model_cert.budgeted import InconclusiveBudget

class RadicalBudget(RuntimeError):pass

def canon(p):
 if not p:return ()
 den=lcm(*(Fraction(c).denominator for c in p.values()))
 vals={w:int(c*den) for w,c in p.items()};g=gcd(*vals.values())
 if vals[max(vals)]<0:g=-g
 return tuple(sorted((w,c//g) for w,c in vals.items() if c))

def polynomial_hash(p):
 return hashlib.sha256(json.dumps(serialize(p),sort_keys=True,separators=(',',':')).encode()).hexdigest()

def read_polynomial(items,n,degree):
 if not isinstance(items,list) or not items or len(items)>20000:raise ValueError('Nonempty bounded exact polynomial required')
 out={}
 for x in items:
  if not isinstance(x,dict) or set(x)!={'word','coefficient'}:raise ValueError('Polynomial term schema')
  if not isinstance(x['word'],list) or len(x['word'])!=degree:raise ValueError('Wrong homogeneous degree')
  w=[]
  for edge in x['word']:
   if not isinstance(edge,list) or len(edge)!=2 or any(type(v) is not int for v in edge) or not 1<=edge[0]<edge[1]<=n or edge[1]!=n:raise ValueError('Requires positive actual star edges')
   w.append(tuple(edge))
  w=tuple(w);c=x['coefficient']
  if type(c)is not str or len(c)>500 or str(int(c))!=c or not int(c):raise ValueError('Canonical nonzero integer coefficient required')
  if w in out:raise ValueError('Repeated word')
  out[w]=int(c)
 if len({permutation_degree(w,n) for w in out})!=1:raise ValueError('Mixed permutation grade')
 return out

def check(poly,*,n=6,independent=True,seconds=120,max_states=400000,max_terms=20000,model=None):
 if n not in [4,5,6] or seconds<=0 or max_states<1 or max_terms<1:raise ValueError('Invalid scope or budget')
 if not poly or len({len(w) for w in poly})!=1:raise ValueError('Nonempty homogeneous polynomial required')
 degree=len(next(iter(poly)))
 if degree>20:raise ValueError('Audit supports degree <=20; not a limit on FK')
 start=time.monotonic();cal=model or RelativeCalculus(n-1,independent_model=independent);built=time.monotonic();deadline=built+seconds
 memo={};states={};edges=0;calls=0;peak=0;bydegree={};witness=None
 def visit(p,path):
  nonlocal calls,edges,peak,witness
  calls+=1
  if calls%256==0 and time.monotonic()>deadline:raise RadicalBudget('Derivative DAG time budget')
  p=cal.normalize(p,max_terms=max_terms);key=canon(p)
  if not key:return True
  if key in memo:return memo[key]
  if len(states)>=max_states:raise RadicalBudget('Derivative DAG state budget')
  d=len(key[0][0]);peak=max(peak,len(key))
  if any(len(w)!=d for w,c in key):raise ValueError('Nonhomogeneous derivative state')
  if d==0:witness=path;memo[key]=False;return False
  states[key]=True;bydegree[d]=bydegree.get(d,0)+1
  deriv=reference_all(dict(key),n) if independent else all_derivatives(dict(key),n)
  for e,child in sorted(deriv.items()):
   if e not in tuple(combinations(range(1,n+1),2)):raise ValueError('Invalid derivative label')
   edges+=1
   if not visit(child,path+[list(e)]):memo[key]=False;return False
  memo[key]=True;return True
 try:
  zero=visit(poly,[]);status='proved-pairing-radical' if zero else 'nonzero-pairing'
 except (RadicalBudget,InconclusiveBudget) as e:
  return {'status':'incomplete','pairingRadicalCertified':False,'error':str(e),'states':len(states),'calls':calls,'FKZeroCertified':False,'FKNonzeroCertified':False}
 h=hashlib.sha256()
 for key in sorted(states):
  h.update(repr(key).encode());h.update(b'\n')
 return {'status':status,'pairingRadicalCertified':zero,'algebraWhereZeroIsCertified':'Nichols quotient B(V_n)' if zero else None,'n':n,'degree':degree,'permutationDegree':list(permutation_degree(next(iter(poly)),n)),'polynomialSHA256':polynomial_hash(poly),'nonzeroScalarChain':witness,'states':len(states),'calls':calls,'edges':edges,'stateDegreeCounts':bydegree,'peakTerms':peak,'stateDAGSHA256':h.hexdigest(),'independentSuffixEvaluator':independent,'finiteModelDimension':sum(map(len,cal.H.basis)),'finiteModelRanks':cal.H.audit,'modelBuildSeconds':built-start,'dagSeconds':time.monotonic()-built,'allAmbientDerivativeLabelsCovered':True,'FKZeroCertified':False,'FKNonzeroCertified':False}

def verify(cert,*,independent=True,seconds=120,model=None):
 if cert.get('claim')!='NICHOLS_PAIRING_RADICAL' or cert.get('targetField')!='Q' or cert.get('ambientFK')!=6 or cert.get('degree')!=14:raise ValueError('Unsupported certificate claim/field/degree')
 p=read_polynomial(cert['polynomial'],6,14)
 if polynomial_hash(p)!=cert['polynomialSHA256']:raise ValueError('Wrong polynomial binding')
 r=check(p,independent=independent,seconds=seconds,model=model)
 if not r.get('pairingRadicalCertified'):raise ValueError('Full pairing-radical check failed: '+r['status'])
 if r['stateDAGSHA256']!=cert['stateDAGSHA256'] or r['states']!=cert['states']:raise ValueError('DAG certificate mismatch')
 return r
