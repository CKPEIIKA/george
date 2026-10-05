#!/usr/bin/env python3
"""Independent exact canonical equality of completed comparison outputs.
This is not a new high-degree Groebner certificate or independent completion.
"""
from pathlib import Path
import json,hashlib,io,sys,time,gc
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
O=R/'results/pref4';trials=json.loads((O/'native-matched/trials.json').read_text());summ=[]
for name in dict.fromkeys(x['case'] for x in trials):
 selected=[x for x in trials if x['case']==name];base=None;cache={};entries=[];start=time.perf_counter()
 for x in selected:
  p=Path(x['record']);raw=p.read_bytes();h=hashlib.sha256(raw).hexdigest()
  if h in cache:
   oldraw,data,proof,n=cache[h];assert raw==oldraw
  else:
   f=json.loads(Path(x['fixture']).read_text());b,proof=canonicalize(records(p,x['degree'],len(f['variables'])));out=io.BytesIO();canonical_digest(b,f['variables'],0,x['degree'],out);data=out.getvalue();n=len(b);cache[h]=(raw,data,proof,n);del b;gc.collect()
  if base is None:base=data
  assert base==data,(name,x['mode'],x['trial'],'canonical mismatch')
  entries.append(dict(mode=x['mode'],trial=x['trial'],recordSHA256=h,canonicalSHA256=hashlib.sha256(data).hexdigest(),rules=n,passed=True,checks=proof))
 if name=='q2':assert base==(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes()
 report=dict(case=name,degree=selected[0]['degree'],passed=True,exactCanonicalBytesEqual=True,independentGoldenReference=name=='q2',freshIndependentCompletion=False,trials=entries,auditSeconds=time.perf_counter()-start)
 summ.append(report);(O/'canonical-comparisons.json').write_text(json.dumps(dict(passed=True,cases=summ),indent=2));print(name,'canonical',len(entries),'pass',flush=True)
