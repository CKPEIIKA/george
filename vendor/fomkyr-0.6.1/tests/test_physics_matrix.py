"""Compare optimized exact kernel, optimization-disabled kernel and independent
completion/critical compositions. Q and prime fields are separate exact problems.
"""
import json,sys,time,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine
from oracle import normal,complete,certify,hilbert
from field_oracle import ModularOracle
from physics_cases import cases
rows=[]
for fixture in cases():
    D=fixture['testDegree'];fields=[0,2,101] if D<30 else [0]
    for prime in fields:
        t=time.perf_counter();oracle=ModularOracle(prime) if prime else None
        nf=oracle.normal if oracle else normal;comp=oracle.complete if oracle else complete;cert=oracle.certify if oracle else certify
        e=Engine(fixture,D,budget=128<<20,scratch=16<<20,modulus=prime,optimize=63);e.run();b=e.basis();h=e.hilbert();st=e.stats();assert st['modulus']==prime
        e=Engine(fixture,D,budget=128<<20,scratch=16<<20,modulus=prime,optimize=0);e.run();plain=e.basis()
        g=comp(fixture['relations'],D)
        assert {max(x) for x in b}=={max(x) for x in g}=={max(x) for x in plain},(fixture['name'],prime,'leading set')
        for other in [g,plain]:
            assert all(not nf(x,other) for x in b),(fixture['name'],prime,'forward')
            assert all(not nf(x,b) for x in other),(fixture['name'],prime,'backward')
        critical=cert(b,fixture['relations'],D)
        assert h==hilbert([max(x) for x in b],len(fixture['variables']),D)
        if fixture.get('expectedHilbert') is not None:assert h==fixture['expectedHilbert'],(fixture['name'],prime,h)
        rows.append({'name':fixture['name'],'modulus':prime,'field':'Q' if not prime else f'F{prime}','degree':D,'passed':True,'rules':len(b),'hilbert':[str(x) for x in h], 'criticalCompositionsChecked':critical,'independentCompletion':True,'mutualReductionWithPlainAndOracle':True,'seconds':time.perf_counter()-t,'stats':st})
        print(json.dumps({k:v for k,v in rows[-1].items() if k not in ['stats','hilbert']}),flush=True)
report={'scope':'Homogeneous graded-algebra regression tests, not validation of physical models or full FK6 degree20','cases':rows,'passed':all(x['passed'] for x in rows)}
(R/'results/physics-matrix.json').write_text(json.dumps(report,indent=2))
print('PASSED',len(rows),'case/field combinations',flush=True)
