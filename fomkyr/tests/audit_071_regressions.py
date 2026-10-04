#!/usr/bin/env python3
"""Independent canonical-byte comparison of every timed regression output.
Known q2 reference is additional evidence; this is not a new full GB proof for
all timed degrees. The separate bounded/native/WASM suites check compositions.
"""
from pathlib import Path
import json,sys,io,hashlib,time
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
O=R/'results/0.7.1';trials=json.loads((O/'regressions/trials.json').read_text());rows=[]
for name in dict.fromkeys(x['case']for x in trials):
 group=[x for x in trials if x['case']==name];assert len(group)==9 and all(x['complete']for x in group),name;D=group[0]['degree'];fixture=json.loads((R/'fixtures'/group[0]['fixture']).read_text());expected=None;seen={};detail=[];start=time.perf_counter()
 for t in group:
  p=Path(t['record']);raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest();assert sha==t['recordSHA256']
  if sha in seen:
   oldraw,canonical,normsha,checks=seen[sha];assert raw==oldraw
  else:
   basis,checks=canonicalize(records(p,D,len(fixture['variables'])));s=io.BytesIO();normsha=canonical_digest(basis,fixture['variables'],0,D,s);canonical=s.getvalue();seen[sha]=(raw,canonical,normsha,checks)
  if expected is None:expected=canonical
  else:assert canonical==expected,(name,t['mode'],t['trial'])
  detail.append(dict(mode=t['mode'],trial=t['trial'],canonicalSHA256=normsha,exactCanonicalBytesEqual=True,checks=checks))
 if name=='q-serre-2':assert expected==(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes()
 row=dict(case=name,degree=D,passed=True,comparisons=len(group),independentGroebnerCertificate=False,degree20IndependentReferenceExactlyEqual=name=='q-serre-2',seconds=time.perf_counter()-start,runs=detail);rows.append(row);print(json.dumps({k:v for k,v in row.items()if k!='runs'}),flush=True)
 (O/'regression-canonical.json').write_text(json.dumps(dict(passed=True,cases=rows),indent=2))
