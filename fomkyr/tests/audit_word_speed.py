#!/usr/bin/env python3
"""Post-timing, bounded-memory exact normalization and source-prefix auditing.
This compares constructed ideals/normal forms; it is NOT a fresh FK14 critical-
composition proof. Partial-degree15 discovery counts are not completion claims.
"""
from pathlib import Path
import argparse,json,hashlib,sys,time,shutil
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from stream_canonical import canon
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--partial-job',type=Path,required=True);p.add_argument('--degree14-job',type=Path,required=True);a=p.parse_args();E=R/'results/pref4.2';O=E/'audits';O.mkdir(parents=True,exist_ok=True)
def latest(job):
 cs=[]
 for f in job.glob('fomkyr/*/*-?.json'):
  try:cs.append(json.loads(f.read_text())['payload'])
  except (ValueError,KeyError):pass
 return max(cs,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)))
def sha(p,n=None):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while n is None or n:
   b=f.read(min(n,4<<20) if n is not None else 4<<20)
   if not b:
    if n:raise ValueError('short source prefix')
    break
   h.update(b)
   if n is not None:n-=len(b)
 return h.hexdigest()
def equal(x,y):
 with x.open('rb') as a,y.open('rb') as b:
  while True:
   u=a.read(1<<20);v=b.read(1<<20)
   if u!=v:return False
   if not u:return True
src={14:a.partial_job.resolve(),15:a.degree14_job.resolve()};prefix={}
for d,j in src.items():
 cp=latest(j);file=next(j.glob('fomkyr/*/basis.gnb'));prefix[d]=(cp['diskBytes'],sha(file,cp['diskBytes']),cp['basisSize'])
reports=[];names=json.loads((R/'fixtures/fk6.json').read_text())['variables'];reference=O/'reference-fk14.jsonl'
ref=next(src[15].glob('fomkyr/*/basis.gnb'));refcheck=canon(ref,14,names,reference);(O/'reference-fk14-checks.json').write_text(json.dumps(refcheck,indent=2))
for part in ['fk14','fk15']:
 for t in json.loads((E/part/'trials.json').read_text()):
  file=Path(t['record']);D=t['degree'];size,expected,count=prefix[D];assert sha(file,size)==expected,'source prefix modified'
  row={'part':part,'mode':t['mode'],'trial':t['trial'],'degree':D,'status':t['status'],'sourcePrefixBytes':size,'sourcePrefixSHA256':expected,'sourcePrefixExactlyRetained':True,'recordSHA256':sha(file),'independentGroebnerCertificate':False}
  if D==14 and t['status']=='complete':
   output=O/f"fk14-{t['mode']}-{t['trial']}.jsonl";checks=canon(file,14,names,output);assert equal(reference,output),row;row.update(exactCanonicalEqualsIndependentNormalizedReference=True,checks=checks);output.unlink()
  else:
   # Check checksums, minimal leaders and all proper subwords of the incomplete
   # stored prefix without claiming that it is a complete basis through D.
   import subprocess
   q=subprocess.run([str(R/'dist/packed-basis-audit'),str(file),str(D),'15',str(O/f"{part}-{t['mode']}-{t['trial']}.tsv")],capture_output=True,text=True,timeout=180);assert q.returncode==0,q.stderr;row['recordAndSubwordChecks']=json.loads(q.stdout);assert row['recordAndSubwordChecks']['rows']-count==t['newRules']
  row['passed']=True;reports.append(row);(O/'deep-summary.json').write_text(json.dumps({'passed':True,'scope':'Exact canonical equality at completed14; record/subword/prefix checks for partial15. No independent full high-degree GB proof.','runs':reports},indent=2));print(row,flush=True)
# Small/medium completed regression records: independent canonical equality;
# q=2 has a separately constructed reference, retained as an additional oracle.
from canonical_audit import records,canonicalize,canonical_digest
import io
rs=[];trials=json.loads((E/'regressions/trials.json').read_text())
for case in dict.fromkeys(t['case'] for t in trials):
 group=[t for t in trials if t['case']==case];D=group[0]['degree'];fixtures={'q2':'affine-q-serre-q2','q3':'affine-q-serre-q3','onsager':'homogenized-q-onsager-q2','sklyanin':'sklyanin-1-2-3','lp1':'lp1'};f=json.loads((R/'fixtures/published'/f'{fixtures[case]}.json').read_text());expected=None
 for t in group:
  assert t['status']=='complete',t
  b,checks=canonicalize(records(Path(t['record']),D,len(f['variables'])));stream=io.BytesIO();digest=canonical_digest(b,f['variables'],0,D,stream);data=stream.getvalue()
  if expected is None:expected=data
  else:assert data==expected,(case,t['mode'],t['trial'])
  if case=='q2':assert data==(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes()
  rs.append({'case':case,'degree':D,'mode':t['mode'],'trial':t['trial'],'passed':True,'canonicalSHA256':digest,'exactCanonicalEqual':True,'independentQ2Degree20GoldenEqual':case=='q2','checks':checks})
  del b
 (O/'regression-summary.json').write_text(json.dumps({'passed':True,'runs':rs},indent=2));print('REGRESSION CANONICAL',case,flush=True)
(E/'audits-finished.json').write_text(json.dumps({'passed':True}))
