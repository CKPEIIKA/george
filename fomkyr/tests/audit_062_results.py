#!/usr/bin/env python3
"""Post-timing exact differential audits; never runs during benchmarks.
Canonical equality is explicitly not a new Groebner certificate.
"""
from pathlib import Path
from collections import defaultdict
import json,sys,io,hashlib,time
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
result=R/'results/0.6.2';rows=[];normcache={}
def checkpoint(run):
 cps=[json.loads(p.read_text())['payload'] for p in run.glob('storage/fomkyr/*/checkpoint-*.json')]
 return max(cps,key=lambda x:x['completedThroughDegree'])
def canon(rec,d):
 run=Path(rec['output']);file=next(run.glob('storage/fomkyr/*/basis.gnb'))
 key=(str(file),d)
 if key in normcache:return normcache[key]
 fixture=R/'fixtures'/('fk6.json' if rec['case']=='fk6' else f"published/{rec['case']}.json")
 f=json.loads(fixture.read_text());basis,checks=canonicalize(records(file,d,len(f['variables'])));stream=io.BytesIO();sha=canonical_digest(basis,f['variables'],0,d,stream)
 normcache[key]=(stream.getvalue(),sha,len(basis),checks);return normcache[key]
for part in ['matched-matrix','matched-fk12','targets']:
 file=result/part/'trials.json'
 if not file.exists():continue
 grouped=defaultdict(list)
 for rec in json.loads(file.read_text()):grouped[(rec['case'],rec['degree'])].append(rec)
 for (name,D),group in grouped.items():
  t=time.perf_counter();current=[x for x in group if x['mode']=='current062'];old=[x for x in group if x['mode']=='baseline061'];entry={'case':name,'requestedDegree':D,'part':part,'independentGroebnerCertificate':False}
  if not current or not old:continue
  d=min(old[0]['completedThroughDegree'],current[0]['completedThroughDegree']);a=canon(old[0],d);b=canon(current[0],d)
  assert a[0]==b[0],(name,D,part,'canonical differential mismatch')
  entry.update({'comparedThroughDegree':d,'canonicalBytesEqual':True,'canonicalSHA256':a[1],'rules':a[2]})
  for side in [old,current]:
   first=side[0]
   for later in side[1:]:
    if first['status']==later['status']=='completed':assert canon(first,D)[0]==canon(later,D)[0]
  entry['repeatCanonicalEqual']=True
  if name=='affine-q-serre-q2' and D==20 and current[0]['status']=='completed':
   c=canon(current[0],20);gold=(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes();assert c[0]==gold,'q2 degree20 golden mismatch'
   entry['goldenDegree20CanonicalBytesEqual']=True;entry['goldenSHA256']=c[1];entry['goldenRules']=c[2]
  entry['passed']=True;entry['seconds']=time.perf_counter()-t;rows.append(entry);print(json.dumps(entry),flush=True)
  (result/'canonical-comparisons.json').write_text(json.dumps({'passed':True,'scope':'exact canonical equality and repeatability; not a new independent Groebner certificate','cases':rows},indent=2))
