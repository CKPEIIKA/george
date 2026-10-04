#!/usr/bin/env python3
"""Exact pair-order regressions and frontier accounting, including legacy adoption."""
from pathlib import Path
import ctypes as C,json,sys,struct,time
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from cooperative_engine import CooperativeEngine
from physics_cases import cases,fk
from field_oracle import ModularOracle
import oracle
from canonical_audit import canonicalize
O=R/'results/0.7.1';O.mkdir(parents=True,exist_ok=True);report=[]
for f in cases():
 D=f['testDegree']
 if D<30:D=min(D,5)
 for field in ([0,2,101] if D<30 else [0]):
  o=ModularOracle(field)if field else oracle;g=o.complete(f['relations'],D);ref,_=canonicalize(g,field)
  for order in [1,2]:
   e=CooperativeEngine(f,D,workers=4,budget=128<<20,scratch=32<<20,modulus=field,quantum=1,lookahead=16,pair_order=order,pair_min_degree=2)
   e.run();b=e.basis();c,_=canonicalize(b,field)
   assert c==ref,(f['name'],field,order,'canonical')
   assert all(not o.normal(x,g)for x in b) and all(not o.normal(x,b)for x in g)
   n=o.certify(b,f['relations'],D)
   assert int(e.lib.gn_progress_stat(0))==int(e.lib.gn_progress_stat(1)),(f['name'],'coverage')
   report.append(dict(case=f['name'],degree=D,field=field,order=order,rules=len(b),compositions=n,independentCompletion=True,passed=True))
  print('MATRIX',f['name'],D,field,flush=True)
# Adapt the current uncommitted suffix of a v1 batch, not its entire degree.
def apis(e):
 for name,args,res in [('gn_batch_mode',[C.c_uint32],C.c_int),('gn_batch_fill',[C.c_uint32],C.c_int),('gn_batch_reduce',[C.c_uint32],C.c_int),('gn_batch_commit',[C.c_uint32],C.c_int),('gn_frontier_export',[],C.c_uint64),('gn_frontier_size',[],C.c_uint32),('gn_frontier_restore',[C.c_uint32],C.c_int),('gn_frontier_pending',[],C.c_uint32)]:
  f=getattr(e.lib,name);f.argtypes=args;f.restype=res
 check(e.lib.gn_batch_mode(1))
def export(e):
 b=list(e.records());p=e.lib.gn_frontier_export();assert p;return b,C.string_at(e.lib.host_pointer(p),e.lib.gn_frontier_size())
def restore(e,b,cur):
 for x in b:
  C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),x,len(x));check(e.lib.gn_restore_rule(len(x),0))
 C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),bytes(cur),len(cur));return e.lib.gn_frontier_restore(len(cur))
for field in [0,2,101]:
 for prefix in [0,1,3]:
  f=fk(4,6);e=Engine(f,6,workers=4,budget=128<<20,scratch=32<<20,modulus=field);apis(e);adopted=False
  for d in range(1,7):
   for rel in f['relations']:
    if rel['degree']==d:e.load(rel)
   check(e.lib.gn_start_degree(d))
   while True:
    n=e.lib.gn_batch_fill(16)
    if n<0:check(n)
    if not n:break
    check(e.lib.gn_batch_reduce(0))
    if not adopted and d>=3 and n>prefix:
     for i in range(prefix):check(e.lib.gn_batch_commit(i))
     b,c=export(e);committed=int(e.lib.gn_progress_stat(2));pending=n-prefix
     e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=field,pair_order=1,pair_min_degree=2);apis(e);check(restore(e,b,c));assert e.lib.gn_pair_plan_adopt()==1
     assert int(e.lib.gn_progress_stat(2))==committed and e.lib.gn_frontier_pending()==0
     assert int(e.lib.gn_pair_plan_stat(6))==pending
     # New frontier roundtrip with different requested future order. The active
     # degree MUST retain the saved order, not reinterpret its cursor.
     b,c=export(e);assert int.from_bytes(c[8:16],'little')==2
     for data,expected in [(bytearray(c),0),(bytearray(c),6)]:
      if expected:data[50]^=1
      ee=Engine(f,6,workers=1,budget=128<<20,scratch=32<<20,modulus=field,pair_order=2,pair_min_degree=2);apis(ee);assert restore(ee,b,data)==expected
      if not expected:valid=b,c
     e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=field,pair_order=2,pair_min_degree=2);apis(e);check(restore(e,*valid));assert e.lib.gn_pair_plan_stat(1)==1;adopted=True;continue
    for i in range(n):check(e.lib.gn_batch_commit(i))
   check(e.lib.gn_finish_degree())
  o=ModularOracle(field)if field else oracle;b=e.basis();g=o.complete(f['relations'],6);assert canonicalize(b,field)[0]==canonicalize(g,field)[0];n=o.certify(b,f['relations'],6)
  report.append(dict(case='legacy-partial-adoption',field=field,prefix=prefix,passed=True,committedPrefixRetained=True,checksummedV2Roundtrip=True,independentCompositions=n));print('ADOPTION',field,prefix,flush=True)
# Optional memory denial is an ordinary path, not a false completed degree.
f=fk(3,6);e=Engine(f,6,workers=1,budget=64<<20,scratch=16<<20,pair_order=1,pair_min_degree=2,pair_plan_bytes=1);e.run();assert e.lib.gn_pair_plan_stat(7)==0 and e.lib.gn_pair_plan_stat(9)>0
assert canonicalize(e.basis())[0]==canonicalize(oracle.complete(f['relations'],6))[0]
report.append(dict(case='optional-budget-denial',passed=True,ordinaryFallback=True))
(O/'pair-plan-native.json').write_text(json.dumps(dict(passed=True,cases=report),indent=2));print('PAIR PLAN NATIVE PASS',len(report),flush=True)
