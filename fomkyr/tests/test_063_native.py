"""Queue equivalence and small nearby FK cases, not degree-13 proof."""
import sys,json,ctypes
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine
from physics_cases import fk
from field_oracle import ModularOracle
import oracle as rational_oracle
from fractions import Fraction
rows=[]
for n,D in [(3,7),(4,6),(5,4)]:
 for p in [0,2,101]:
  f=fk(n,D);outputs=[]
  for radix in [False,True]:
   e=Engine(f,D,workers=2,budget=128<<20,scratch=8<<20,modulus=p,radix_heap=radix,row_reserve=16<<20)
   e.run();outputs.append(e.basis())
   assert bool(e.lib.gn_reserve_stat(0,8))==radix
   assert not e.lib.gn_reserve_stat(0,9)
  assert outputs[0]==outputs[1],(n,D,p)
  oracle=ModularOracle(p) if p else rational_oracle;g=oracle.complete(f['relations'],D)
  assert all(not oracle.normal(x,g) for x in outputs[1]);assert all(not oracle.normal(x,outputs[1]) for x in g)
  count=oracle.certify(outputs[1],f['relations'],D)
  rows.append({'FK':n,'degree':D,'modulus':p,'queueOutputsExactlyEqual':True,'independentCompletion':True,'criticalCompositions':count,'passed':True});print(json.dumps(rows[-1]),flush=True)
(R/'results/0.6.3/fk-nearby.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2))
