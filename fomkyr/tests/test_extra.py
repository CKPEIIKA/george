import sys,json,itertools,time,tempfile
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,parse
from oracle import complete,normal,certify,hilbert
results=[]
def report(**x):results.append(x);print(json.dumps(x),flush=True)
f=json.loads((R/'fixtures/fk6.json').read_text());t=time.perf_counter()
e=Engine(f,4,scratch=16<<20);e.run();b=e.basis();g=complete(f['relations'],4)
assert {max(p) for p in b}=={max(p) for p in g}
assert all(not normal(p,g) for p in b)
assert all(not normal(p,b) for p in g)
report(test='independent-Fraction-completion-FK6',passed=True,throughDegree=4,rules=len(b),seconds=time.perf_counter()-t)
# Canonical FK4 with six generators; Hilbert polynomial [2]^2 [3]^2 [4]^2.
edges=list(itertools.combinations(range(4),2));names=['x'+str(i)+str(j) for i,j in edges];ids={e:i for i,e in enumerate(edges)}
rels=[]
def add(p):rels.append({'degree':2,'terms':[{'word':[ids[a],ids[b]],'coefficient':str(c)} for a,b,c in p]})
for a in edges:add([(a,a,1)])
for a,b in itertools.combinations(edges,2):
    if not set(a)&set(b):add([(a,b,1),(b,a,-1)])
for i,j,k in itertools.combinations(range(4),3):
    a,b,c=(i,j),(j,k),(i,k);add([(a,b,1),(b,c,-1),(c,a,-1)]);add([(b,a,1),(c,b,-1),(a,c,-1)])
f={'variables':names,'relations':rels};e=Engine(f,13,scratch=16<<20);e.run();h=hilbert(e.leaders(),6,13)
expected=[1]
for n in [2,2,3,3,4,4]:
    new=[0]*(len(expected)+n-1)
    for i,c in enumerate(expected):
        for j in range(n):new[i+j]+=c
    expected=new
assert h==expected+[0],(h,expected)
n=certify(e.basis(),rels,13)
report(test='FK4-Hilbert-and-critical-pairs',passed=True,hilbert=h,totalDimension=sum(h),criticalPairs=n,**e.stats())
# The ledger fills during a real calculation; stop without a memory trap.
f=json.loads((R/'fixtures/fk6.json').read_text())
e=Engine(f,10,budget=6<<20,scratch=1<<20,hash_bits=8)
try:
    e.run();report(test='small-budget-computation',passed=True,outcome='completed',**e.stats())
except RuntimeError as exc:
    assert 'BUDGET' in str(exc),str(exc)
    assert e.stats()['allocatedBytes'] <= e.stats()['budgetBytes']
    report(test='small-budget-computation',passed=True,outcome=str(exc),**e.stats())
(R/'results/extra-tests.json').write_text(json.dumps(results,indent=2))
