#!/usr/bin/env python3
"""Whole-engine exact checks, not just a mathematical delta-only prototype."""
from pathlib import Path
import sys,json,time
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine
from cooperative_engine import CooperativeEngine
from physics_cases import cases,fk
from field_oracle import ModularOracle
import oracle
from canonical_audit import canonicalize
O=R/'results/pref4';O.mkdir(exist_ok=True);reports=[]
for f in cases():
 D=f['testDegree'];D=min(D,5) if D<30 else D
 for p in ([0,2,101] if D<30 else [0]):
  o=ModularOracle(p) if p else oracle;g=o.complete(f['relations'],D);ref=canonicalize(g,p)[0]
  for delta in [False,True]:
   e=CooperativeEngine(f,D,workers=4,budget=128<<20,scratch=16<<20,modulus=p,quantum=1,lookahead=16,delta_commit=delta)
   e.run();b=e.basis();assert canonicalize(b,p)[0]==ref,(f['name'],p,delta)
   assert all(not o.normal(x,g) for x in b) and all(not o.normal(x,b) for x in g)
   n=o.certify(b,f['relations'],D);stat=e.stats()['commit']
   if delta:assert stat['contractFallbacks']==0,(f['name'],p,stat)
   reports.append(dict(case=f['name'],degree=D,modulus=p,delta=delta,passed=True,independentCompletion=True,criticalCompositions=n,stats=stat))
  print(f['name'],D,p,'pass',flush=True)
# Ordinary direct calls must not rely on the cooperative output metadata path.
for p in [0,2,101]:
 f=fk(4,6);o=ModularOracle(p) if p else oracle;g=o.complete(f['relations'],6)
 for workers in [1,4]:
  e=Engine(f,6,workers=workers,budget=128<<20,scratch=32<<20,modulus=p,delta_commit=True);e.run();b=e.basis()
  assert canonicalize(b,p)[0]==canonicalize(g,p)[0];n=o.certify(b,f['relations'],6)
  reports.append(dict(case='direct-worker-api',degree=6,modulus=p,workers=workers,delta=True,passed=True,independentCompletion=True,criticalCompositions=n,stats=e.stats()['commit']))
(O/'delta-native.json').write_text(json.dumps(dict(passed=True,cases=reports),indent=2));print('PASS',len(reports),'configurations')
