"""Portable cursor roundtrip, rejection checks, and independent Q/Fp proofs."""
from pathlib import Path
import ctypes as C,json,sys,struct
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from physics_cases import fk
from field_oracle import ModularOracle
import oracle
rows=[]
def apis(e):
 for name,args,result in [('gn_batch_mode',[C.c_uint32],C.c_int),('gn_batch_fill',[C.c_uint32],C.c_int),('gn_batch_reduce',[C.c_uint32],C.c_int),('gn_batch_commit',[C.c_uint32],C.c_int),('gn_frontier_export',[],C.c_uint64),('gn_frontier_size',[],C.c_uint32),('gn_frontier_restore',[C.c_uint32],C.c_int),('gn_frontier_pending',[],C.c_uint32)]:
  fn=getattr(e.lib,name);fn.argtypes=args;fn.restype=result
 check(e.lib.gn_batch_mode(1))
def export(e):
 data=[]
 for i in range(1,int(e.lib.gn_stat(0))+1):
  p=e.lib.gn_export_rule(i);data.append(C.string_at(e.lib.host_pointer(p),e.lib.gn_export_size()))
 p=e.lib.gn_frontier_export();assert p;return data,C.string_at(e.lib.host_pointer(p),e.lib.gn_frontier_size())
def put(e,records,cursor):
 for data in records:
  C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),data,len(data));check(e.lib.gn_restore_rule(len(data),0))
 C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),bytes(cursor),len(cursor));return e.lib.gn_frontier_restore(len(cursor))
for prime in [0,2,101]:
 for prefix in [0,1,3]:
  f=fk(4,6);e=Engine(f,6,workers=4,budget=128<<20,scratch=32<<20,modulus=prime);apis(e);restored=False
  for d in range(1,7):
   for rel in f['relations']:
    if rel['degree']==d:e.load(rel)
   check(e.lib.gn_start_degree(d))
   while True:
    n=e.lib.gn_batch_fill(16)
    if not n:break
    check(n if n<0 else 0);check(e.lib.gn_batch_reduce(0));first=0
    if not restored and d>=3 and n>prefix:
     for i in range(prefix):check(e.lib.gn_batch_commit(i))
     records,cur=export(e)
     # Mutation detected by cursor integrity check, even with a valid record prefix.
     bad=bytearray(cur);bad[100]^=1
     for raw,expected in [(bad,6),(cur,0)]:
      e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=prime);apis(e)
      assert put(e,records,raw)==expected
     n=e.lib.gn_frontier_pending();assert n>0;check(e.lib.gn_batch_reduce(0));restored=True
    for i in range(first,n):check(e.lib.gn_batch_commit(i))
   check(e.lib.gn_finish_degree())
  b=e.basis();o=ModularOracle(prime)if prime else oracle;g=o.complete(f['relations'],6)
  assert all(not o.normal(p,g)for p in b);assert all(not o.normal(p,b)for p in g)
  count=o.certify(b,f['relations'],6)
  rows.append({'prime':prime,'committedPrefix':prefix,'rules':len(b),'independentCompositionChecks':count,'passed':True});print(rows[-1],flush=True)
(R/'results/0.6.5/frontier-native.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2))
