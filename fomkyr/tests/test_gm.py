#!/usr/bin/env python3
"""Requested targeted GM regression; exact independent Fraction/modular oracle.
No imported Hilbert targets, no FK-gate pruning, no timing assertion.
"""
from pathlib import Path
import subprocess,sys,json,time,tempfile,random
R=Path(__file__).resolve().parents[1];(R/'results/gm').mkdir(parents=True,exist_ok=True);sys.path[:0]=[str(R/'tools'),str(R/'tests')]
import oracle
from field_oracle import ModularOracle
from canonical_audit import records,canonicalize
out=R/'results/gm/gm-tests.json';report=[];begin=time.monotonic()
cases=[('fk4',R/'fixtures/pair-plan-fk4.json',6),('fk6',R/'fixtures/fk6.json',4),('sparse-cubic',R/'fixtures/modular-stress-0.json',5)]
# Rational coefficients and different supports, deliberately independent of FK.
rng=random.Random(7403);rels=[]
for k in range(5):
 terms=[]
 for j in range(3):terms.append({'word':[rng.randrange(3),rng.randrange(3)],'coefficient':str(rng.choice([-3,-2,-1,1,2,3]))})
 rels.append({'degree':2,'terms':terms})
f={'name':'GM deterministic random','variables':['a','b','c'],'relations':rels}
with tempfile.TemporaryDirectory(prefix='fomkyr-gm-')as tmp:
 tmp=Path(tmp);randomPath=tmp/'random.json';randomPath.write_text(json.dumps(f));cases.append(('random',randomPath,5))
 for name,fixture,D in cases:
  f=json.loads(fixture.read_text())
  for prime in [0,2,101]:
   o=oracle if not prime else ModularOracle(prime)
   ref=o.complete(f['relations'],D);expected=canonicalize(ref,prime)[0]
   for mode in ['off','multiply','leading-word','backward','all']:
    dest=tmp/f'{name}-{prime}-{mode}'
    cmd=[str(R/'dist/fomkyr'),'-i',str(fixture),'-d',str(D),'-j','1','--memory','256M','--field',str(prime),'--workdir',str(dest),'--gm',mode,'--quiet','--hilbert','--export','--pair-order','word','--plan-min-degree','2']
    # Isolate each criterion; default chain coverage is compared separately.
    if mode!='off':cmd+=['--no-chain']
    q=subprocess.run(cmd,capture_output=True,text=True,timeout=120);assert not q.returncode,(cmd,q.stdout,q.stderr[-1000:]);result=json.loads(q.stdout)
    basis=next((dest/'fomkyr').glob('alg-*/basis.gnb'));polys=list(records(basis,D,len(f['variables'])))
    assert canonicalize(polys,prime)[0]==expected,(name,prime,mode,'canonical mismatch')
    n=o.certify(polys,f['relations'],D)
    row=dict(name=name,degree=D,modulus=prime,mode=mode,passed=True,basisSize=len(polys),criticalCompositions=n,gm=result['gm'],seconds=result['elapsedSeconds']);report.append(row)
   print('PASS',name,prime,flush=True)
report=dict(passed=True,independentCompletion=True,cases=report,elapsedSeconds=time.monotonic()-begin)
out.write_text(json.dumps(report,indent=2));print('GM MATRIX PASS',len(report['cases']),flush=True)
