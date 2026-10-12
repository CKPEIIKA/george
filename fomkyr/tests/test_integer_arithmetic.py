#!/usr/bin/env python3
"""Independent exact division and limb arithmetic audit against Python integers."""
from pathlib import Path
import ctypes as C
import json
import random
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.native import Engine,U32
engine=Engine({'variables':['x'],'relations':[]},target=1,budget=64<<20,scratch=32<<20)
f=engine.lib.gn_test_big;f.argtypes=[U32,U32,U32,C.c_int,C.c_int];f.restype=C.c_int
ptr=engine.lib.host_pointer(engine.lib.gn_import_buffer())
def run(op,a,b):
 na=max(1,(abs(a).bit_length()+31)//32);nb=max(1,(abs(b).bit_length()+31)//32)
 raw=abs(a).to_bytes(na*4,'little')+abs(b).to_bytes(nb*4,'little');C.memmove(ptr,raw,len(raw))
 rc=f(op,na,nb,-1 if a<0 else 1,-1 if b<0 else 1)
 if rc:return rc,None
 n=C.c_uint32.from_address(ptr).value;sg=C.c_uint32.from_address(ptr+4).value
 out=int.from_bytes(C.string_at(ptr+8,n*4),'little');return rc,-out if sg else out
rng=random.Random(71213);cases=[]
for bits in [1,31,32,33,61,62,63,64,65,95,96,127,128,255,256,511,512,1024,2048,4096,8192]:
 for i in range(120):
  b=rng.getrandbits(bits) or 1;q=rng.getrandbits(rng.choice([1,31,32,33,61,64,65,127,256,512]))
  if i%4==0:b<<=rng.choice([1,31,32,33,63,64,127])
  if i%7==0:b=1<<bits
  if i%11==0:q=(1<<rng.randrange(1,257))-1
  if i%13==0:q=1
  if i%17==0:q=0
  for sa,sb in [(1,1),(-1,1),(1,-1),(-1,-1)]:cases.append((5,sa*b*q,sb*b,sa*sb*q))
  a=rng.getrandbits(bits)
  cases.extend([(0,a,b,a+b),(0,a,-b,a-b),(0,-a,-b,-a-b),
                (1,a,b,a*b),(1,-a,b,-a*b),(1,a,a,a*a)])
# Dense carries and cancellation at limb/tag boundaries.
for limbs in range(1,65):
 a=(1<<(32*limbs))-1;b=a+1
 cases.extend([(0,a,1,b),(0,a,-a,0),(1,a,a,a*a),
               (5,a*b,a,b),(5,b*b,b,b)])
t=time.perf_counter()
for op,a,b,expected in cases:
 rc,got=run(op,a,b);assert rc==0 and got==expected,(rc,op,a,b,got,expected)
for a in [0,1,-1,1<<128]:assert run(5,a,0)[0]==-6
assert f(0,0xffffffff,1,1,1)==-3
assert f(0,1,1,-0x80000000,1)==-3
print(json.dumps({'passed':True,'cases':len(cases),'zeroDivisorCases':4,
                  'invalidInputCases':2,'oracle':'Python integer arithmetic','seconds':time.perf_counter()-t}))
