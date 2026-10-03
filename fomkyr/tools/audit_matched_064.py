#!/usr/bin/env python3
"""Exact canonical comparison of actual old/new outputs.
This is differential validation, not fresh high-degree Groebner certification.
"""
from pathlib import Path
import argparse,gc,json,sys,tempfile,time
sys.path.insert(0,str(Path(__file__).resolve().parent))
from canonical_audit import records,canonicalize,canonical_digest
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('trials',type=Path);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
trials=json.loads(a.trials.read_text());groups={}
for x in trials:groups.setdefault((x['case'],x['degree']),[]).append(x)
rows=[];all_pass=True
for (case,D),items in groups.items():
 fixture=json.loads((R/'fixtures'/('fk6.json' if case=='fk6' else f'published/{case}.json')).read_text())
 names=fixture['variables'];baseline=None;checks=[];t=time.perf_counter()
 try:
  for item in items:
   if item['status']!='completed':raise AssertionError('Cannot claim equivalence for an incomplete target')
   directory=Path(item['directory'])
   if not directory.is_dir():directory=a.trials.resolve().parent/directory.name
   paths=list(directory.glob('storage/fomkyr/*/basis.gnb'))
   assert len(paths)==1,paths
   basis,flags=canonicalize(records(paths[0],D,len(names)),0)
   with tempfile.TemporaryFile() as stream:
    sha=canonical_digest(basis,names,0,D,stream);count=len(basis)
    del basis;gc.collect();stream.seek(0)
    if baseline is None:
     baseline=a.out/f'{case}-d{D}-canonical.jsonl'
     with baseline.open('wb') as target:
      while chunk:=stream.read(1<<20):target.write(chunk)
    else:
     with baseline.open('rb') as expected:
      while True:
       x=expected.read(1<<20);y=stream.read(1<<20)
       if x!=y:raise AssertionError('Canonical byte streams differ')
       if not x:break
   checks.append({'mode':item['mode'],'trial':item['trial'],'rules':count,'sha256':sha,'byteStreamEqual':True,**flags})
  golden=False
  if case=='affine-q-serre-q2' and D==20:
   ref=R/'reference/q-serre-q2-degree20/canonical.jsonl'
   with baseline.open('rb') as x,ref.open('rb') as y:
    while True:
     left=x.read(1<<20);right=y.read(1<<20)
     assert left==right,'Independent q=2 reference differs'
     if not left:break
   golden=True
  row=dict(case=case,degree=D,passed=True,outputs=checks,independentReferenceMatch=golden)
 except Exception as e:
  all_pass=False;row=dict(case=case,degree=D,passed=False,error=str(e),outputs=checks)
 row['seconds']=time.perf_counter()-t;rows.append(row);print(json.dumps(row),flush=True)
 (a.out/'summary.json').write_text(json.dumps({'passed':all_pass,'method':'exact canonical byte-stream equality; checksums and normalization preconditions checked',
 'freshIndependentGroebnerCompletion':False,'cases':rows},indent=2))
raise SystemExit(0 if all_pass else 1)
