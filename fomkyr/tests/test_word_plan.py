#!/usr/bin/env python3
"""New word-order planner: exact independent completion and portable frontiers.
The original planner tests are retained; these tests force mode3, not mode1/2.
"""
from pathlib import Path
import ctypes as C,json,sys,struct,time
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from cooperative_engine import CooperativeEngine
from physics_cases import cases,fk
from field_oracle import ModularOracle
import oracle
from canonical_audit import canonicalize
O=R/'results/pref4.2';O.mkdir(parents=True,exist_ok=True);report=[]
for f in cases():
 D=f['testDegree'];D=min(D,5) if D<30 else D
 for p in ([0,2,101] if D<30 else [0]):
  o=ModularOracle(p) if p else oracle;g=o.complete(f['relations'],D);ref=canonicalize(g,p)[0]
  for delta in [False,True]:
   e=CooperativeEngine(f,D,workers=4,budget=128<<20,scratch=32<<20,modulus=p,quantum=1,lookahead=16,pair_order=3,pair_min_degree=2,delta_commit=delta)
   e.run();b=e.basis();assert canonicalize(b,p)[0]==ref,(f['name'],p,delta)
   assert all(not o.normal(x,g) for x in b) and all(not o.normal(x,b) for x in g)
   n=o.certify(b,f['relations'],D);assert e.lib.gn_progress_stat(0)==e.lib.gn_progress_stat(1)
   report.append(dict(name=f['name'],degree=D,modulus=p,delta=delta,passed=True,independentCompletion=True,criticalCompositions=n))
  print('MATRIX',f['name'],D,p,flush=True)
def apis(e):
 for name,args,res in [('gn_batch_mode',[C.c_uint32],C.c_int),('gn_batch_fill',[C.c_uint32],C.c_int),('gn_batch_reduce',[C.c_uint32],C.c_int),('gn_batch_commit',[C.c_uint32],C.c_int),('gn_frontier_export',[],C.c_uint64),('gn_frontier_size',[],C.c_uint32),('gn_frontier_restore',[C.c_uint32],C.c_int),('gn_frontier_pending',[],C.c_uint32)]:
  fn=getattr(e.lib,name);fn.argtypes=args;fn.restype=res
 check(e.lib.gn_batch_mode(1))
def get(e):
 records=list(e.records());ptr=e.lib.gn_frontier_export();assert ptr;return records,C.string_at(e.lib.host_pointer(ptr),e.lib.gn_frontier_size())
def put(e,b,cur):
 for row in b:C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),row,len(row));check(e.lib.gn_restore_rule(len(row),0))
 C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),bytes(cur),len(cur));return e.lib.gn_frontier_restore(len(cur))
for p in [0,2,101]:
 for prefix in [0,1,3]:
  f=fk(4,6);e=Engine(f,6,workers=4,budget=128<<20,scratch=32<<20,modulus=p);apis(e);adopted=False
  for d in range(1,7):
   for rel in f['relations']:
    if rel['degree']==d:e.load(rel)
   check(e.lib.gn_start_degree(d))
   while True:
    n=e.lib.gn_batch_fill(16)
    if n<0:check(-n)
    if not n:break
    check(e.lib.gn_batch_reduce(0))
    if not adopted and d>=3 and n>prefix:
     for i in range(prefix):check(e.lib.gn_batch_commit(i))
     b,cur=get(e);committed=int(e.lib.gn_progress_stat(2));pending=n-prefix
     e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=p,pair_order=3,pair_min_degree=2);apis(e);check(put(e,b,cur));assert e.lib.gn_pair_plan_adopt()==1
     assert int(e.lib.gn_progress_stat(2))==committed and int(e.lib.gn_pair_plan_stat(6))==pending
     b,cur=get(e);assert int.from_bytes(cur[8:16],'little')==3
     bad=bytearray(cur);bad[50]^=1
     ee=Engine(f,6,workers=1,budget=128<<20,scratch=32<<20,modulus=p);apis(ee);assert put(ee,b,bad)==6
     e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=p,pair_order=1,pair_min_degree=2);apis(e);check(put(e,b,cur));assert e.lib.gn_pair_plan_stat(1)==3;adopted=True;continue
    for i in range(n):check(e.lib.gn_batch_commit(i))
   check(e.lib.gn_finish_degree())
  o=ModularOracle(p) if p else oracle;g=o.complete(f['relations'],6);b=e.basis();assert canonicalize(b,p)[0]==canonicalize(g,p)[0];n=o.certify(b,f['relations'],6)
  report.append(dict(name='v1-to-word-v3',degree=6,modulus=p,prefix=prefix,passed=True,savedPolicyRetained=True,criticalCompositions=n))
f=fk(3,6);e=Engine(f,6,workers=1,budget=64<<20,scratch=16<<20,pair_order=3,pair_min_degree=2,pair_plan_bytes=1);e.run();assert e.lib.gn_pair_plan_stat(7)==0 and e.lib.gn_pair_plan_stat(9)>0;assert canonicalize(e.basis())[0]==canonicalize(oracle.complete(f['relations'],6))[0]
report.append(dict(name='optional-plan-denied',passed=True))
(O/'word-native.json').write_text(json.dumps(dict(passed=True,cases=report),indent=2));print('WORD NATIVE PASS',len(report))
