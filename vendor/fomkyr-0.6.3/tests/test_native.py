#!/usr/bin/env python3
import sys,json,random,tempfile,time
from pathlib import Path
sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'tools'),str(Path(__file__).resolve().parent)]
from native import Engine,parse,check
from oracle import certify,hilbert,normal,poly
ROOT=Path(__file__).resolve().parents[1]
results=[]
def report(name,**kw):
    v={'test':name,'passed':True,**kw};results.append(v);print(json.dumps(v),flush=True)
def fixture(v,r,name='synthetic'):
    vs,rs=parse(v,r);return {'name':name,'variables':vs,'relations':rs}
for name in ['commutative','exterior','fk3','fk6']:
    f=json.loads((ROOT/f'fixtures/{name}.json').read_text());D=7
    e=Engine(f,D,scratch=16<<20);t=time.perf_counter();e.run();seconds=time.perf_counter()-t
    h=hilbert(e.leaders(),len(f['variables']),D)
    assert h==f['expectedHilbertThrough7'],(name,h)
    # FK6 independent critical-pair test through degree 4, full for smaller cases.
    dcheck=4 if name=='fk6' else D
    b=[p for p in e.basis() if len(max(p))<=dcheck]
    n=certify(b,f['relations'],dcheck)
    report(name,hilbert=h,criticalPairsChecked=n,criticalPairsThroughDegree=dcheck,nativeSeconds=seconds,**e.stats())
# Words cross the 64-bit boundary at length 17 and use all 16 symbols.
f=fixture(','.join('x'+str(i) for i in range(16)),'x15^20,x0^20,x15^19*x0-x0*x15^19;')
e=Engine(f,20,scratch=8<<20);e.run();assert all(len(max(p))==20 for p in e.basis());assert len(e.basis())==3;certify(e.basis(),f['relations'],20);report('80-bit-words')
# Q arithmetic: promote to >64 bits, perform exact divisions; don't wrap to i64.
e=Engine(f,20,scratch=8<<20)
for a,b in [(2**61-1,2**59+3),(-2**60+13,2**58-1),(123456789,987654321)]:
    assert e.lib.gn_test_small(3,a,b)==b
report('bigint-multiply-exact-divide')
# Persistent large coefficients in the completed basis, then decode records.
f=json.loads((ROOT/'fixtures/big-coefficients.json').read_text())
e=Engine(f,5,scratch=16<<20);e.run();b=e.basis();certify(b,f['relations'],5)
assert max(abs(c).bit_length() for p in b for c in p.values())==155
report('persistent-bigint-coefficients',largestBits=155)

f=fixture('a,b',f'{2**45+3}*b*a-{2**44+7}*a*b,b*b-a*a;')
e=Engine(f,6,scratch=16<<20);e.run();b=e.basis();certify(b,f['relations'],6);report('large-coefficient-relations',largestBits=max(abs(c).bit_length() for p in b for c in p.values()))
# Exact spill/readback, parallel immutable snapshots, checkpoint restart.
f=json.loads((ROOT/'fixtures/fk6.json').read_text());e=Engine(f,6,scratch=16<<20);e.run();leaders=e.leaders();hb=hilbert(leaders,15,6)
with tempfile.TemporaryDirectory() as td:
    disk=str(Path(td)/'basis.bin');e=Engine(f,4,workers=4,scratch=32<<20,disk=disk);e.run();cp=e.stats()
    e=Engine(f,6,workers=3,scratch=32<<20,disk=disk,resume=cp);e.run()
    assert hilbert(e.leaders(),15,6)==hb
    certify([p for p in e.basis() if len(max(p))<=4],f['relations'],4)
    report('spill-parallel-resume',**e.stats())
# Prime fields are opt-in. Over Q no mod-p substitution is made.
f=fixture('a,b','b*a-a*b,b^2-2*a^2;')
for mod in [2,101,2147483647]:
    e=Engine(f,6,modulus=mod,scratch=8<<20);e.run()
    assert all(0<c<mod for p in e.basis() for c in p.values())
report('finite-fields')
# Fail before overrunning a deliberately tiny heap.
try:Engine(f,6,budget=4<<20,scratch=1<<20)
except RuntimeError as exc:assert 'MEMORY_BUDGET' in str(exc)
else:raise AssertionError('Allocation was not bounded')
report('memory-budget-denial')
e=Engine(f,6,scratch=8<<20);e.lib.gn_cancel(1)
try:e.run()
except RuntimeError as exc:assert 'CANCELLED' in str(exc)
else:raise AssertionError('Cancellation was ignored')
report('cooperative-cancellation')
# Random small presentations exercise nonzero completion and Q coefficients.
rng=random.Random(8113)
for seed in range(12):
    rels=[]
    for _ in range(3):
        terms=[]
        for _ in range(3):terms.append({'word':[rng.randrange(2),rng.randrange(2)],'coefficient':str(rng.choice([-7,-3,-1,1,2,5]))})
        # combine repeated input words before handing oracle the fixture
        d={}
        for t in terms:w=tuple(t['word']);d[w]=d.get(w,0)+int(t['coefficient'])
        terms=[{'word':list(w),'coefficient':str(c)} for w,c in d.items() if c]
        if terms:rels.append({'degree':2,'terms':terms})
    f={'variables':['a','b'],'relations':rels}
    e=Engine(f,5,scratch=16<<20);e.run();certify(e.basis(),rels,5)
report('random-Q-presentations',cases=12)
(ROOT/'results/native-tests.json').write_text(json.dumps(results,indent=2))
