import ctypes as C,random,json,math
from fractions import Fraction
from pathlib import Path
R=Path(__file__).resolve().parents[1]
lib=C.CDLL(str(R/'dist/libfomkyr.so'));f=lib.gn_test_rational
f.argtypes=[C.c_uint32,C.c_int64,C.c_uint64,C.c_int64,C.c_uint64,C.POINTER(C.c_int64),C.POINTER(C.c_uint64)];f.restype=C.c_int
rng=random.Random(471105);M=(1<<62)-1;counts={'accepted':0,'exactFallback':0,'total':0}
xs=[Fraction(0),Fraction(1),Fraction(-1),Fraction(M),Fraction(-M),Fraction(1,M),Fraction(-1,M),Fraction(M,M-1)]
xs += [Fraction(rng.randrange(-(1<<k),(1<<k)),rng.randrange(1,(1<<j))) for k,j in [(rng.randrange(1,62),rng.randrange(2,62)) for _ in range(200)]]
for i in range(10000):
 a,b=rng.choice(xs),rng.choice(xs);op=i%2;n=C.c_int64();d=C.c_uint64()
 ok=f(op,a.numerator,a.denominator,b.numerator,b.denominator,C.byref(n),C.byref(d));assert ok in (0,1)
 if ok:
  assert Fraction(n.value,d.value)==(a+b if op==0 else a*b)
  assert math.gcd(abs(n.value),d.value)==1 and d.value>0;counts['accepted']+=1
 else:counts['exactFallback']+=1
 counts['total']+=1
for a,b in [(0,0),(2,4),(1,1<<63)]:
 n=C.c_int64();d=C.c_uint64();assert f(0,a,b,1,1,C.byref(n),C.byref(d))==-1
(R/'results/0.5/rational-arithmetic-tests.json').write_text(json.dumps({'passed':True,**counts,'oracle':'Python Fraction, seeded independent arithmetic'},indent=2));print(counts)
