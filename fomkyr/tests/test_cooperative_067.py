"""Exact oracle matrix for state-preserving, out-of-order commit scheduling."""
import sys,json,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from cooperative_engine import CooperativeEngine
from native import Engine
from physics_cases import cases
from field_oracle import ModularOracle
from oracle import normal,complete,certify,hilbert
reports=[]
for f in cases():
    D=f['testDegree']
    for p in ([0,2,101] if D<30 else [0]):
        t=time.perf_counter();o=ModularOracle(p) if p else None
        nf=o.normal if o else normal;co=o.complete if o else complete;ce=o.certify if o else certify
        e=CooperativeEngine(f,D,workers=4,budget=128<<20,scratch=32<<20,modulus=p,quantum=1,lookahead=32)
        e.run();b=e.basis();h=e.hilbert();cs=e.cooperative_stats();assert e.lib.gn_modulus()==p
        g=co(f['relations'],D)
        assert all(not nf(x,g) for x in b) and all(not nf(x,b) for x in g),(f['name'],p,'ideal')
        n=ce(b,f['relations'],D)
        assert h==hilbert([max(x) for x in g],len(f['variables']),D)
        if f.get('expectedHilbert') is not None:assert h==f['expectedHilbert']
        reports.append({'case':f['name'],'degree':D,'field':p,'rules':len(b),'compositions':n,'passed':True,'seconds':time.perf_counter()-t,'cooperative':cs})
        print(json.dumps(reports[-1]),flush=True)
(R/'results/0.6.7/cooperative-native-matrix.json').write_text(json.dumps({'passed':True,'cases':reports},indent=2))
print('PASSED',len(reports),flush=True)
