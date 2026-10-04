#!/usr/bin/env python3
"""Exercise the 512-anchor + 512-pending frontier and semantic tamper rejection."""
from pathlib import Path
import sys,json,ctypes as C,struct
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from physics_cases import fk
f=json.loads((R/'fixtures/fk6.json').read_text())
def api(e):
 for name,args,res in [('gn_batch_mode',[C.c_uint32],C.c_int),('gn_batch_fill',[C.c_uint32],C.c_int),('gn_batch_reduce',[C.c_uint32],C.c_int),('gn_batch_commit',[C.c_uint32],C.c_int),('gn_frontier_export',[],C.c_uint64),('gn_frontier_size',[],C.c_uint32),('gn_frontier_restore',[C.c_uint32],C.c_int),('gn_frontier_pending',[],C.c_uint32)]:
  fn=getattr(e.lib,name);fn.argtypes=args;fn.restype=res
 check(e.lib.gn_batch_mode(1));check(e.lib.gn_tune(2,12,16))
def get(e):
 b=list(e.records());p=e.lib.gn_frontier_export();assert p;return b,C.string_at(e.lib.host_pointer(p),e.lib.gn_frontier_size())
def put(e,b,frame):
 for row in b:C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),row,len(row));check(e.lib.gn_restore_rule(len(row),0))
 C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()),bytes(frame),len(frame));return e.lib.gn_frontier_restore(len(frame))
e=Engine(f,5,workers=4,budget=128<<20,scratch=32<<20,optimize=61);api(e);e.target=4;e.run();check(e.lib.gn_start_degree(5));n=e.lib.gn_batch_fill(512);print('first',n,e.stats(),flush=True);assert n==512;b,old=get(e)
e=Engine(f,5,workers=2,budget=128<<20,scratch=32<<20,optimize=61,pair_order=1,pair_min_degree=5);api(e);check(put(e,b,old));assert e.lib.gn_pair_plan_adopt()==1;assert e.lib.gn_batch_fill(512)==512;b,cur=get(e)
assert len(cur)==40*8+1024*16
pairs=[struct.unpack_from('<IIII',cur,320+i*16) for i in range(1024)];keys={x[:3] for x in pairs[512:]};unused=next(x for x in pairs[:512] if x[:3] not in keys)
bad=bytearray(cur);struct.pack_into('<IIII',bad,320+512*16,*unused);h=1469598103934665603
for i,x in enumerate(bad):
 if not 24<=i<32:h=((h^x)*1099511628211)&((1<<64)-1)
struct.pack_into('<Q',bad,24,h)
for frame,expect in [(bad,6),(cur,0)]:
 e=Engine(f,5,workers=1,budget=128<<20,scratch=32<<20,optimize=61);api(e);assert put(e,b,frame)==expect
out=dict(passed=True,anchorPairs=512,pendingPairs=512,bytes=len(cur),newReaderRestoresWithoutChangingActiveOrder=True,checksummedButUnissuedValidPairRejected=True)
(R/'results/0.7.1/pair-plan-frame.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
