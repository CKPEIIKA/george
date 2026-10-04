#!/usr/bin/env python3
"""Bounded independent check of the NEW planner combined with the existing gate."""
from pathlib import Path
import json,sys,io,time
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from test_fk_gate_068 import GateEngine
from canonical_audit import canonicalize
from oracle import complete,normal,certify,hilbert
f=json.loads((R/'fixtures/fk6.json').read_text());reference=complete(f['relations'],5);canonical=canonicalize(reference)[0];rows=[]
for order in (1,2):
 for sectors in (False,True):
  t=time.perf_counter();e=GateEngine(f,5,workers=4,budget=128<<20,scratch=32<<20,quantum=1,lookahead=16,pair_order=order,pair_min_degree=2,sectors=sectors)
  e.run();basis=e.basis();assert canonicalize(basis)[0]==canonical;assert all(not normal(g,reference)for g in basis)and all(not normal(g,basis)for g in reference);n=certify(basis,f['relations'],5)
  rows.append(dict(order=order,sectors=sectors,degree=5,passed=True,independentCompletion=True,criticalCompositions=n,bothIdealInclusions=True,gate=e.gate_stats(),seconds=time.perf_counter()-t))
(R/'results/0.7.1/pair-plan-gate.json').write_text(json.dumps(dict(passed=True,highDegreeImportedProfileProofReplayed=False,cases=rows),indent=2));print('PAIR PLAN WITH GATE: INDEPENDENT BOUNDED CHECK PASS')
