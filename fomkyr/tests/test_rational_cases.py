import sys,json,random
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine
from physics_cases import case,rel,cases
from oracle import complete,certify,normal
rng=random.Random(508)
fixtures=cases()+[case('nonmonic-random-'+str(i),['x','y'],[rel(*[(tuple(rng.randrange(2) for _ in range(2)),rng.choice([-17,-5,2,3,7,13])) for _ in range(3)]) for _ in range(2)],4) for i in range(12)]
# Native kernel owns global State: engines are strictly sequential.
results=[]
for f in fixtures:
 D=f['testDegree'] if f['testDegree']>30 else min(f['testDegree'],5)
 old=Engine(f,D,workers=1,rational_heap=False);old.lib.gn_tune(3,12,1);old.run();a=old.basis()
 new=Engine(f,D,workers=1,rational_heap=True)
 new.lib.gn_tune(3,12,1);new.run();b=new.basis();stats=new.stats();attempts=int(new.lib.gn_lane_stat(0,21));success=int(new.lib.gn_lane_stat(0,22));fallback=int(new.lib.gn_lane_stat(0,23))
 assert {max(p) for p in a}=={max(p) for p in b},(f['name'],'leading-set mismatch')
 assert all(not normal(p,b) for p in a) and all(not normal(p,a) for p in b)
 oracle=complete(f['relations'],D);assert all(not normal(p,oracle) for p in b);assert all(not normal(p,b) for p in oracle);certify(b,f['relations'],D)
 results.append({'name':f['name'],'degree':D,'passed':True,'identicalBasis':a==b,'mutualExactReduction':True,'independentOracle':True,'attempts':attempts,'successes':success,'fallbacks':fallback});print(results[-1],flush=True)
(R/'results/0.5/rational-cases.json').write_text(json.dumps({'passed':True,'cases':results},indent=2))
