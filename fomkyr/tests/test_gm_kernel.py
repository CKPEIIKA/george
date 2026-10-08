#!/usr/bin/env python3
"""Exercise each GM family in the actual graded kernel, both enumerators."""
import ctypes as C,sys,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];(R/'results/gm').mkdir(parents=True,exist_ok=True);sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from canonical_audit import canonicalize
import oracle
reports=[]
for name,words,mask,key in [
 ('multiply',[[1,2,3,4],[0,1,2,3],[2,3,4,5]],1,2),
 ('leading-word',[[1,2,3,4],[0,1,2,3],[2,3,4,5]],2,3),
 ('backward',[[0,1,2,3],[2,3,4,5],[1,2,3,4]],4,4)]:
 f={'variables':list('abcdef'),'relations':[{'degree':4,'terms':[{'word':w,'coefficient':'1'}]}for w in words]}
 for order in [0,3]:
  e=Engine(f,6,workers=1,budget=64<<20,scratch=16<<20,optimize=61,pair_order=order,pair_min_degree=2)
  # Disable the general monomial shortcut, isolate actual GM dispatch.
  check(e.lib.gn_tune(2,12,16));e.lib.gn_gm_config.argtypes=[C.c_uint32];e.lib.gn_gm_config.restype=C.c_int;check(e.lib.gn_gm_config(mask));e.lib.gn_gm_stat.argtypes=[C.c_uint32];e.lib.gn_gm_stat.restype=C.c_uint64
  e.run();skips=int(e.lib.gn_gm_stat(key));assert skips>0,(name,order)
  b=e.basis();assert canonicalize(b)[0]==canonicalize(oracle.complete(f['relations'],6))[0];oracle.certify(b,f['relations'],6)
  reports.append(dict(criterion=name,pairOrder=order,skipped=skips,passed=True))
(R/'results/gm/gm-kernel-tests.json').write_text(json.dumps(dict(passed=True,cases=reports),indent=2));print('GM KERNEL PASS',len(reports))
