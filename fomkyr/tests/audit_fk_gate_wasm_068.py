"""Independent completion through degree 5 of gate-assisted record prefixes.

Higher computed degrees are recorded separately and are not certified here.
Native/Wasm exchange also compares full degree-7 output with ungated reduction.
"""
import json,sys,time,io
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests'),str(R/'tests/published')]
from canonical_audit import records,canonicalize,canonical_digest
from oracle import normal,complete,certify
from field_oracle import ModularOracle
from exact_reference import Reducer,monic,compositions
from fractions import Fraction
def sparse_complete(relations,D):
    gs=[];nr=Reducer(gs)
    def insert(row):
        nonlocal nr
        r=nr.nf(row)
        if r:gs.append(monic(r));nr=Reducer(gs)
    for d in range(1,D+1):
        for rel in relations:
            if rel['degree']==d:insert({tuple(t['word']):Fraction(t['coefficient']) for t in rel['terms']})
        for row in compositions(list(gs),degree=d,bound=d,include=False):insert(row)
        print('Independent sparse construction',d,len(gs),flush=True)
    return gs
fixture=json.loads((R/'fixtures/fk6.json').read_text());manifest=json.loads(Path(sys.argv[1]).read_text());cache={};report=[]
for item in manifest:
    start=time.perf_counter();computed=item['result']['completedThroughDegree'];D=min(computed,5);p=item.get('modulus',0)
    if (D,p) not in cache:
        o=ModularOracle(p) if p else None;co=o.complete if o else sparse_complete
        cache[D,p]=co(fixture['relations'],D)
    o=ModularOracle(p) if p else None
    b=list(records(Path(item['record']),D,15));g=cache[D,p]
    if p:
        assert all(not o.normal(x,g) for x in b);assert all(not o.normal(x,b) for x in g)
        n=o.certify(b,fixture['relations'],D)
    else:
        rb,rg=Reducer(b),Reducer(g)
        assert all(not rg.nf(x) for x in b);assert all(not rb.nf(x) for x in g)
        for rel in fixture['relations']:
            if rel['degree']<=D:assert not rb.nf({tuple(t['word']):Fraction(t['coefficient']) for t in rel['terms']})
        n=0
        for row in compositions(b,bound=D):assert not rb.nf(row);n+=1
        for row in compositions(g,bound=D):assert not rg.nf(row)

    c,checks=canonicalize(b,p);buf=io.BytesIO();digest=canonical_digest(c,fixture['variables'],p,D,buf)
    row={'record':item['record'],'degree':D,'computedThroughDegree':computed,'independentlyCertifiedThroughDegree':D,'modulus':p,'rules':len(b),'compositions':n,'canonicalSHA256':digest,'passed':True,'seconds':time.perf_counter()-start};print(json.dumps(row),flush=True);report.append(row)
    Path(sys.argv[1]).with_name('independent-audit.json').write_text(json.dumps({'passed':len(report)==len(manifest),'cases':report,'highDegreeProfileProofReplayed':False},indent=2))
Path(sys.argv[1]).with_name('independent-audit.json').write_text(json.dumps({'passed':True,'cases':report,'highDegreeProfileProofReplayed':False},indent=2))
