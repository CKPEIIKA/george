#!/usr/bin/env python3
"""Canonical exact comparisons after all timings; never a new GB certificate."""
from pathlib import Path
from collections import defaultdict
import json,sys,io,time
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
root=R/'results/0.6.3';rows=[]
groups=defaultdict(list)
for x in json.loads((root/'regressions/trials.json').read_text()):groups[(x['case'],x['degree'])].append(x)
for (name,D),group in groups.items():
 if any(x['status']!='completed' for x in group):raise AssertionError(('incomplete regression',name))
 f=json.loads((R/'fixtures'/('fk6.json' if name=='fk6' else f'published/{name}.json')).read_text())
 reference=None;detail=[];t=time.perf_counter()
 for x in group:
  file=next(Path(x['directory']).glob('storage/fomkyr/*/basis.gnb'))
  basis,checks=canonicalize(records(file,D,len(f['variables'])));stream=io.BytesIO();sha=canonical_digest(basis,f['variables'],0,D,stream);data=stream.getvalue()
  if reference is None:reference=data
  else:assert data==reference,(name,x['mode'],x['trial'])
  detail.append({'mode':x['mode'],'trial':x['trial'],'rules':len(basis),'sha256':sha,'checks':checks});del basis
 if name=='affine-q-serre-q2' and D==20:
  assert reference==(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes(),'independent q2 golden reference mismatch'
 entry={'case':name,'degree':D,'passed':True,'exactCanonicalBytesEqual':True,'independentGroebnerCertificate':False,'trials':detail,'seconds':time.perf_counter()-t}
 if name=='affine-q-serre-q2' and D==20:entry['independentDegree20GoldenExactlyEqual']=True
 rows.append(entry);print(json.dumps(entry),flush=True);(root/'regression-canonical.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2))
