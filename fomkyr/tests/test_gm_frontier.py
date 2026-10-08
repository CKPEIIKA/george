#!/usr/bin/env python3
"""GM mask persistence, raw/planned/bitmap cursor and changed-worker replay."""
from pathlib import Path
import ctypes as C,json,sys,struct,time
R=Path(__file__).resolve().parents[1];(R/'results/gm').mkdir(parents=True,exist_ok=True);sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
import oracle
from canonical_audit import canonicalize
f=json.loads((R/'fixtures/pair-plan-fk4.json').read_text());report=[]
def apis(e,mask):
 for name,args,res in [('gn_gm_config',[C.c_uint32],C.c_int),('gn_gm_stat',[C.c_uint32],C.c_uint64),('gn_batch_mode',[C.c_uint32],C.c_int),('gn_batch_fill',[C.c_uint32],C.c_int),('gn_batch_reduce',[C.c_uint32],C.c_int),('gn_batch_commit',[C.c_uint32],C.c_int),('gn_frontier_export',[],C.c_uint64),('gn_frontier_size',[],C.c_uint32),('gn_frontier_restore',[C.c_uint32],C.c_int),('gn_frontier_pending',[],C.c_uint32),('gn_pair_plan_reorder',[],C.c_int)]:
  fn=getattr(e.lib,name);fn.argtypes=args;fn.restype=res
 check(e.lib.gn_gm_config(mask));check(e.lib.gn_batch_mode(1))
def put(e,rows,blob):
 for row in rows:C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),row,len(row));check(e.lib.gn_restore_rule(len(row),0))
 C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),blob,len(blob));return e.lib.gn_frontier_restore(len(blob))
for prime in [0,2,101]:
 for mode in [0,1,3]:
  e=Engine(f,6,workers=3,budget=128<<20,scratch=32<<20,modulus=prime,pair_order=mode,pair_min_degree=2,optimize=61);apis(e,7);restored=False
  for d in range(1,7):
   for rel in f['relations']:
    if rel['degree']==d:e.load(rel)
   check(e.lib.gn_start_degree(d))
   while True:
    n=e.lib.gn_batch_fill(16)
    if n<0:check(-n)
    if not n:break
    check(e.lib.gn_batch_reduce(0))
    if not restored and d>=3 and n>1:
     check(e.lib.gn_batch_commit(0));rows=list(e.records());ptr=e.lib.gn_frontier_export();assert ptr;blob=C.string_at(e.lib.host_pointer(ptr),e.lib.gn_frontier_size());assert struct.unpack_from('<Q',blob,8)[0]==6
     done=int(e.lib.gn_progress_stat(2));pending=n-1
     e=Engine(f,6,workers=1,budget=128<<20,scratch=32<<20,modulus=prime,pair_order=3,pair_min_degree=2);apis(e,0);check(put(e,rows,blob));assert e.lib.gn_gm_stat(0)==7;assert e.lib.gn_progress_stat(2)==done;assert e.lib.gn_frontier_pending()==pending
     if mode==1:
      assert e.lib.gn_pair_plan_reorder()==1
      rows=list(e.records());ptr=e.lib.gn_frontier_export();blob=C.string_at(e.lib.host_pointer(ptr),e.lib.gn_frontier_size());assert struct.unpack_from('<Q',blob,8)[0]==6;assert struct.unpack_from('<Q',blob,32*8)[0]&2
      e=Engine(f,6,workers=2,budget=128<<20,scratch=32<<20,modulus=prime,pair_order=0);apis(e,0);check(put(e,rows,blob));assert e.lib.gn_gm_stat(0)==7
     pending=int(e.lib.gn_frontier_pending())
     if pending:
      check(e.lib.gn_batch_reduce(0))
      for i in range(pending):check(e.lib.gn_batch_commit(i))
     restored=True;continue
    for i in range(n):check(e.lib.gn_batch_commit(i))
   rc=e.lib.gn_finish_degree()
   if rc:print('FINISH',prime,mode,d,e.stats(),'batch',e.lib.gn_frontier_pending(),flush=True)
   check(rc)
   if restored and d==3:assert e.lib.gn_gm_stat(0)==7
  o=oracle if not prime else __import__('field_oracle').ModularOracle(prime)
  assert restored and canonicalize(e.basis(),prime)[0]==canonicalize(o.complete(f['relations'],6),prime)[0]
  report.append(dict(modulus=prime,originalOrder=mode,passed=True,gmMaskRetained=True,bitmap=mode==1))
(R/'results/gm/gm-frontier-tests.json').write_text(json.dumps(dict(passed=True,cases=report),indent=2));print('GM FRONTIER PASS',len(report))
