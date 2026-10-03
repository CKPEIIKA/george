"""Exact regression checks on held-out parameters and presentation changes.
No parameter-specific identities are injected into the engine.
"""
from pathlib import Path
from fractions import Fraction
from copy import deepcopy
import json,sys,random,itertools,time
R=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(R/'tools'),str(R/'tests'),str(R/'tests/published')]
from native import Engine
from exact_reference import Reducer,monic,compositions,hseries
from canonical_audit import canonicalize

def polynomial(row):return {tuple(t['word']):Fraction(t['coefficient']) for t in row['terms']}
def pack(p):return {'degree':len(next(iter(p))),'terms':[{'word':list(w),'coefficient':str(c)} for w,c in p.items() if c]}
def construct(f,D):
 gs=[]
 for d in range(1,D+1):
  for row in f['relations']:
   if row['degree']==d:
    p=Reducer(gs).nf(polynomial(row))
    if p:gs.append(monic(p))
  for row in list(compositions(gs,degree=d,bound=d)):
   p=Reducer(gs).nf(row)
   if p:gs.append(monic(p))
 return gs
q2=json.loads((R/'fixtures/published/affine-q-serre-q2.json').read_text())
q3=json.loads((R/'fixtures/published/affine-q-serre-q3.json').read_text())
sky=json.loads((R/'fixtures/published/sklyanin-1-2-3.json').read_text())
fixtures=[]
for q in [4,5]:
 f=deepcopy(q2);f['name']=f'held-out-q-serre-{q}'
 for rel in f['relations']:
  for term,c in zip(rel['terms'],[q*q,-(q**4+q*q+1),q**4+q*q+1,-q*q]):term['coefficient']=str(c)
 fixtures.append((f,12))
for f0,D in [(q2,11),(q3,11),(sky,7)]:
 for kind in ['reordered-scaled','swapped-generators']:
  f=deepcopy(f0);f['name']=f0['name']+'-'+kind
  if kind=='reordered-scaled':
   f['relations'].reverse()
   for i,row in enumerate(f['relations']):
    for t in row['terms']:t['coefficient']=str(int(t['coefficient'])*([-17,13,5][i%3]))
  else:
   n=len(f['variables'])
   for row in f['relations']:
    for t in row['terms']:t['word']=[n-1-a for a in t['word']]
  fixtures.append((f,D))
# Invertible generator shear a -> a+2b; total degree is preserved.
f=deepcopy(q2);f['name']='q-serre-shear-a-plus-2b';out=[]
for row in f['relations']:
 p={}
 for w,c in polynomial(row).items():
  expanded={():c}
  for a in w:
   terms=[(0,1),(1,2)] if a==0 else [(1,1)];nxt={}
   for pre,v in expanded.items():
    for b,z in terms:nxt[pre+(b,)]=nxt.get(pre+(b,),0)+v*z
   expanded=nxt
  for v,z in expanded.items():p[v]=p.get(v,0)+z
 out.append(pack({w:c for w,c in p.items() if c}))
f['relations']=out;fixtures.append((f,6))
res=[]
for f,D in fixtures:
 start=time.perf_counter();ref=construct(f,D);oracle=Reducer(ref)
 variants=[]
 for opts in [{},{'big_rational':False,'fast_big_division':False,'growing_rational':False}]:
  engine=Engine(f,D,workers=1,budget=128<<20,scratch=16<<20,**opts)
  engine.lib.gn_tune(3,12,1);engine.run();basis=engine.basis();nf=Reducer(basis)
  assert all(not oracle.nf(g) for g in basis)
  assert all(not nf.nf(g) for g in ref)
  for row in f['relations']:assert not nf.nf(polynomial(row))
  ct=0
  for p in compositions(basis,bound=D):assert not nf.nf(p);ct+=1
  if f.get('expectedHilbert'):assert list(map(str,hseries(basis,len(f['variables']),D)))==f['expectedHilbert'][:D+1]
  canon,_=canonicalize(basis);variants.append(canon)
 assert variants[0]==variants[1],f['name']
 item={'name':f['name'],'degree':D,'canonicalEqual':True,'independentCompletion':True,'criticalCompositions':ct,'seconds':time.perf_counter()-start,'passed':True}
 res.append(item);print(json.dumps(item),flush=True)
(R/'results/0.6.2/presentation-regressions.json').write_text(json.dumps({'passed':True,'cases':res},indent=2))
