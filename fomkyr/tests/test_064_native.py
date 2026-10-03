"""Repack uncommitted batch suffix; no input/order/field changes. Exact oracle."""
import sys,json,ctypes
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from physics_cases import fk
from field_oracle import ModularOracle
import oracle
rows=[]
for modulus in [0,2,101]:
 for prefix in [0,1,3]:
  f=fk(4,6);e=Engine(f,6,workers=4,budget=128<<20,scratch=16<<20,modulus=modulus)
  lib=e.lib
  for name,n in [('gn_batch_mode',1),('gn_batch_fill',1),('gn_batch_reduce',1),('gn_batch_commit',1),('gn_memory_policy',1),('gn_batch_retry',2)]:
   fn=getattr(lib,name);fn.argtypes=[ctypes.c_uint32]*n;fn.restype=ctypes.c_int
  lib.gn_memory_stat.argtypes=[ctypes.c_uint32];lib.gn_memory_stat.restype=ctypes.c_uint64
  check(lib.gn_batch_mode(1));check(lib.gn_memory_policy(1));resized=False
  for d in range(1,7):
   for rel in f['relations']:
    if rel['degree']==d:e.load(rel)
   check(lib.gn_start_degree(d))
   while True:
    n=lib.gn_batch_fill(32)
    if n<0:check(n)
    if not n:break
    check(lib.gn_batch_reduce(0));first=0
    if not resized and d>=3 and n>prefix:
     for i in range(prefix):check(lib.gn_batch_commit(i))
     assert lib.gn_batch_retry(4,prefix)==7
     assert lib.gn_batch_retry(2,prefix+1)==7
     check(lib.gn_batch_retry(2,prefix));check(lib.gn_batch_reduce(0));resized=True;first=prefix
    for i in range(first,n):check(lib.gn_batch_commit(i))
   check(lib.gn_finish_degree())
  assert resized and lib.gn_memory_stat(3)==1
  b=e.basis();o=ModularOracle(modulus) if modulus else oracle;g=o.complete(f['relations'],6)
  assert all(not o.normal(x,g) for x in b);assert all(not o.normal(x,b) for x in g)
  n=o.certify(b,f['relations'],6)
  rows.append({'modulus':modulus,'committedPrefix':prefix,'rules':len(b),'compositions':n,'passed':True});print(rows[-1],flush=True)
(R/'results/0.6.4/batch-retry-native.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2))
