"""Exercise optional paths and large coefficients, not just easy PBW output."""
import json,sys,random,itertools,time
from pathlib import Path
from collections import defaultdict
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check
from oracle import complete,normal,certify
from physics_cases import rel
out=[]
f=json.loads((R/'fixtures/fk6.json').read_text());oracle=complete(f['relations'],5)
for flags in [0,1,2,4,8,16,32,63]:
 e=Engine(f,5,budget=64<<20,scratch=16<<20,optimize=flags);e.run();b=e.basis();assert {max(p) for p in b}=={max(p) for p in oracle};assert all(not normal(p,oracle) for p in b);assert all(not normal(p,b) for p in oracle)
 out.append({'test':'optimization-flags','flags':flags,'passed':True})
# Optional matcher cap too small must preserve exact fallback, not discard work.
e=Engine(f,5,budget=64<<20,scratch=16<<20,optimize=63,matcher_budget=1);e.run();assert all(not normal(p,oracle) for p in e.basis());assert e.lib.gn_stat(28)>0
out.append({'test':'matcher-budget-fallback','passed':True})
for entries in [256,4096,16384,65536]:
 e=Engine(f,5,budget=64<<20,scratch=16<<20,word_cache_entries=entries);e.run();assert all(not normal(p,oracle) for p in e.basis())
 out.append({'test':'word-cache-size','entries':entries,'passed':True})
# Every added term pair is a context multiple of an input relation. The many-term
# input forces the heap path, while q^k causes exact large coefficient promotion.
for a,q in [(1,1073741827),(2,3)]:
 basic=rel(((1,0),a),((0,1),-q));rs=[basic];terms=defaultdict(int)
 for i,w in enumerate(itertools.product(range(2),repeat=8)):
  if i>=40:break
  cut=i%9;l=w[:cut];r=w[cut:];terms[l+(1,0)+r]+=a;terms[l+(0,1)+r]-=q
 rs.append(rel(*[(w,c) for w,c in terms.items() if c]));fixture={'variables':['a','b'],'relations':rs}
 e=Engine(fixture,10,budget=64<<20,scratch=16<<20);check(e.lib.gn_tune(3,12,1));e.run();b=e.basis();assert len(b)==1;assert all(not normal(p,[{(1,0):a,(0,1):-q}]) for p in b);n=certify(b,rs,10)
 out.append({'test':'big-or-nonmonic-heap-fallback','leading':a,'q':q,'passed':True,'termsInRedundantInput':len(rs[1]['terms']),'heapFallbacks':e.stats()['heapFallbacks'],'criticalCompositions':n})
# Mixed-degree and reversed-variable exact tests, fixed reproducible seed.
rng=random.Random(4604)
for i in range(24):
 n=3;rs=[]
 for j in range(3):
  d=2 if j<2 else 3;terms={}
  for _ in range(3):w=tuple(rng.randrange(n) for _ in range(d));terms[w]=rng.choice([-3,-2,-1,1,2,3])
  rs.append(rel(*terms.items()))
 fixture={'variables':['a','b','c'],'relations':rs};g=complete(rs,5)
 e=Engine(fixture,5,budget=64<<20,scratch=16<<20);e.run();b=e.basis();assert {max(p) for p in b}=={max(p) for p in g};assert all(not normal(p,g) for p in b);assert all(not normal(p,b) for p in g);certify(b,rs,5)
 out.append({'test':'mixed-degree-random','seed':4604,'case':i,'passed':True})
(R/'results/optimizer-edge-tests.json').write_text(json.dumps({'passed':True,'checks':out},indent=2));print('Optimizer edge tests passed:',len(out))
