"""Independent sparse Fraction completion (Q); existing field oracle (Fp)."""
import sys,json,time
from pathlib import Path
from fractions import Fraction
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests'),str(R/'tests'/'published')]
from canonical_audit import records,canonicalize,canonical_digest
from exact_reference import Reducer,compositions,monic,hseries
from field_oracle import ModularOracle
cache={};rows=[]
def independent(rels,D):
 gs=[]
 for d in range(1,D+1):
  todo=[{tuple(t['word']):Fraction(t['coefficient']) for t in p['terms']} for p in rels if p['degree']==d]
  for p in todo:
   r=Reducer(gs).nf(p)
   if r:gs.append(monic(r))
  for p in list(compositions(gs,degree=d,bound=D)):
   r=Reducer(gs).nf(p)
   if r:gs.append(monic(r))
 return gs
for e in json.loads(Path(sys.argv[1]).read_text()):
 t=time.perf_counter();f=e['fixture'];D=e['degree'];p=e['modulus'];b=list(records(Path(e['record']),D,len(f['variables'])));k=json.dumps([f,D,p],sort_keys=True)
 o=ModularOracle(p) if p else None
 if k not in cache:cache[k]=o.complete(f['relations'],D) if o else independent(f['relations'],D)
 g=cache[k]
 if o:
  assert all(not o.normal(x,g) for x in b);assert all(not o.normal(x,b) for x in g);n=o.certify(b,f['relations'],D)
 else:
  nf=Reducer(b);nr=Reducer(g)
  assert all(not nf.nf(x) for x in g);assert all(not nr.nf(x) for x in b)
  for rel in f['relations']:
   if rel['degree']<=D:assert not nf.nf({tuple(t['word']):Fraction(t['coefficient']) for t in rel['terms']})
  n=0
  for x in compositions(b,bound=D):assert not nf.nf(x);n+=1
 h=hseries(b,len(f['variables']),D);assert list(map(str,h))==e['hilbert']
 rows.append({'name':e['name'],'degree':D,'modulus':p,'rules':len(b),'independentCompletion':True,'bothIdealInclusions':True,'criticalCompositions':n,'passed':True,'seconds':time.perf_counter()-t})
 print(json.dumps(rows[-1]),flush=True)
Path(sys.argv[2]).write_text(json.dumps({'passed':True,'cases':rows},indent=2))
