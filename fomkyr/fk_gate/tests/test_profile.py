#!/usr/bin/env python3
"""Recompute all group transition/class tables from integer permutations.
Also checks code headers and their dimensions against the replayed profile.
This is a metadata/adapter contract test, not a new algebra certificate.
"""
import json,re,hashlib
from pathlib import Path
from itertools import permutations
R=Path(__file__).resolve().parents[1];H=(R/'profiles/fk6_sectors.h').read_text();Q=(R/'profiles/fk6_q.h').read_text()
def array(name):
 raw=re.search(r'\b'+name+r'(?:\[\d+\])+\s*=([^;]*);',H).group(1)
 return json.loads(raw.replace('{','[').replace('}',']'))
steps=array('fkg_group_step');classes=array('fkg_group_class');per=array('fkg_class_per_grade');whole=array('fkg_class_dimension')
p=json.loads((R/'profiles/sector-profile.json').read_text());interval=json.loads((R/'profiles/frontier-intervals.json').read_text());prov=json.loads((R/'profiles/proof-provenance.json').read_text());ps=list(permutations(range(1,7)))
def cycle(g):
 seen=set();parts=[]
 for x in range(1,7):
  if x in seen:continue
  n=0;y=x
  while y not in seen:seen.add(y);n+=1;y=g[y-1]
  parts.append(n)
 return sorted(parts,reverse=True)
classid={tuple(c):i for i,c in enumerate(p['classes'])};parities=[sum(c-1 for c in cycle(g))%2 for g in ps];sides=[[g for g,parity in zip(ps,parities) if parity==s] for s in range(2)];ix=[{g:i for i,g in enumerate(side)} for side in sides]
f=json.loads((R/'profiles/fixture-fk6.json').read_text());ident=json.loads((R/'profiles/signed-identification.json').read_text())['generatorMap'];edges=[ident[v]['edge'] for v in f['variables']];n=0
for s in range(2):
 for i,g in enumerate(sides[s]):
  assert classes[s][i]==classid[tuple(cycle(g))]
  for c,(a,b) in enumerate(edges):
   h=list(g);h[a-1],h[b-1]=h[b-1],h[a-1];assert steps[s][i][c]==ix[s^1][tuple(h)];n+=1
assert len(per)==len(whole)==len(p['totals'])==18
for d,row in enumerate(per):
 assert whole[d]==[x*y for x,y in zip(row,p['classSizes'])]
 assert sum(whole[d])==p['totals'][d]
 assert row==interval['degrees'][d]['lowerPerClass']==interval['degrees'][d]['upperPerClass']
 assert interval['degrees'][d]['exactGrades']==360
assert p['completeDimensionThrough']==17
assert p['proofBundleDigestSHA256']==interval['proofBundleDigestSHA256']==prov['proofBundleDigestSHA256']
assert prov['proofBundleDigestSHA256'] in Q
for name in ['adapters/fomkyr065.inc','adapters/sector_counter.inc']:
 text=(R/name).read_text();assert 'degree>13' not in text and 'FKG_PROFILE_DEGREE' in text
js=(R/'js/fk_gate.js').read_text();assert 'certifiedProfileThroughDegree:13' not in js and 'profileBoundKind:"exact-dimension"' in js
report={'passed':True,'allSignedInputGradeTransitions':n,'allParityClassAssignments':720,'headerAndProfileValuesAgree':True,'noLiteralDegree13GateCap':True,'completeDimensionMetadataExactThrough17':True}
(R/'evidence').mkdir(exist_ok=True)
(R/'evidence/current-profile-tests.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

previous=json.loads((R/'profiles/fk6-exact-through16.json').read_text())
assert p['totals'][:17]==previous['dimensions']
assert per[:17]==previous['dimensionsPerClass']
assert p['totals'][17]>2**32 and p['totals'][17]==4735557180
print('PASS all degrees0..16 unchanged; h17 retained beyond uint32')
