#!/usr/bin/env python3
from pathlib import Path
import sys,ctypes as C,random,math,json,time
from fractions import Fraction as F
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.native import Engine,U32
rng=random.Random(62003);e=Engine({'variables':['x'],'relations':[]},target=1,budget=64<<20,scratch=32<<20)
f=e.lib.gn_test_big_fraction;f.argtypes=[U32]*5+[C.c_int]*2;f.restype=C.c_int
ptr=e.lib.host_pointer(e.lib.gn_import_buffer())
def run(op,a,b):
 vals=[abs(a.numerator),a.denominator,abs(b.numerator),b.denominator];sizes=[max(1,(v.bit_length()+31)//32) for v in vals]
 raw=b''.join(v.to_bytes(n*4,'little') for v,n in zip(vals,sizes));C.memmove(ptr,raw,len(raw))
 rc=f(op,*sizes,-1 if a<0 else 1,-1 if b<0 else 1);assert rc==0,rc
 n=C.c_uint32.from_address(ptr).value;dn=C.c_uint32.from_address(ptr+4).value;sg=C.c_uint32.from_address(ptr+8).value
 v=int.from_bytes(C.string_at(ptr+16,n*4),'little');d=int.from_bytes(C.string_at(ptr+16+4*n,dn*4),'little')
 assert d>0 and math.gcd(v,d)==1,(v,d)
 return F(-v if sg else v,d)
t=time.perf_counter()
for i in range(4000):
 bits=rng.choice([1,31,63,127,255,511,1024,2048,4096])
 a=F(rng.getrandbits(bits),rng.getrandbits(bits) or 1);b=F(rng.getrandbits(bits),rng.getrandbits(bits) or 1)
 if i%5==0:b=F(rng.getrandbits(bits),a.denominator)
 if i%7==0:b=1/a if a else F(1)
 if i%11==0:b=-a
 if i%13==0:b=F(0)
 if i%17==0:b=F(1)
 if i%19==0:b=F(-1)
 if rng.randrange(2):a=-a
 if rng.randrange(2):b=-b
 op=i%2;got=run(op,a,b);expected=a+b if not op else a*b
 assert got==expected,(i,a,b,got,expected)
print(json.dumps({'passed':True,'exactFractionCases':4000,'seconds':time.perf_counter()-t}))
