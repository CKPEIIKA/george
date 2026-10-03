#!/usr/bin/env python3
"""Independent magnitude arithmetic audit against Python integers."""
from pathlib import Path
import sys,ctypes as C,random,math,json,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.native import Engine,U32,U64
r=random.Random(62002);e=Engine({'variables':['x'],'relations':[]},target=1,budget=64<<20,scratch=32<<20)
f=e.lib.gn_test_big;f.argtypes=[U32,U32,U32,C.c_int,C.c_int];f.restype=C.c_int
legacy=e.lib.gn_legacy_big_division;legacy.argtypes=[U32];legacy.restype=C.c_int
ptr=e.lib.host_pointer(e.lib.gn_import_buffer())
def run(op,a,b):
 na=max(1,(abs(a).bit_length()+31)//32);nb=max(1,(abs(b).bit_length()+31)//32)
 raw=abs(a).to_bytes(na*4,'little')+abs(b).to_bytes(nb*4,'little');C.memmove(ptr,raw,len(raw))
 rc=f(op,na,nb,-1 if a<0 else 1,-1 if b<0 else 1)
 assert rc==0,(rc,op,a,b)
 n=C.c_uint32.from_address(ptr).value;sign=C.c_uint32.from_address(ptr+4).value
 out=int.from_bytes(C.string_at(ptr+8,n*4),'little');return -out if sign else out
cases=[]
for i in range(8000):
 ba=r.choice([1,31,32,33,61,62,63,64,65,95,96,127,128,255,256,511,1024,2048,4096]);bb=r.randint(1,ba+32)
 a=r.getrandbits(ba);b=r.getrandbits(bb) or 1
 if i%5==0:a=a*b+r.randrange(0,min(b,1<<64))
 if i%7==0:b=(1<<bb)-1
 if i%11==0:a=b
 if i%13==0:a=b-1
 op=i%5
 if r.randrange(2):a=-a
 if r.randrange(2):b=-b
 cases.append((op,a,b))
# Deliberate quotient-estimate/addback shapes plus limb boundaries.
for n in range(2,16):
 for shift in (0,1,7,16,31):
  b=((1<<(32*n-1))|r.getrandbits(32*(n-1)))>>shift
  for q in (1,(1<<32)-1,1<<32,(1<<64)-1):
   for rem in (0,1,b-1):
    cases.append((2,b*q+rem,b));cases.append((3,b*q+rem,b))
t=time.perf_counter()
for mode in (0,1):
 assert legacy(mode)==0
 for k,(op,a,b) in enumerate(cases if mode==0 else cases[::19]):
  got=run(op,a,b);expect=[lambda:a+b,lambda:a*b,lambda:abs(a)//abs(b),lambda:abs(a)%abs(b),lambda:math.gcd(a,b)][op]()
  assert got==expect,(mode,k,op,a,b,got,expect)
print(json.dumps({'passed':True,'fastCases':len(cases),'legacyCases':len(cases[::19]),'seconds':time.perf_counter()-t}))
