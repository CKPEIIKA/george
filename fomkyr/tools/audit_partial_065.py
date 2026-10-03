#!/usr/bin/env python3
"""Independent prefix/normal-word accounting. NOT a Groebner certificate."""
from pathlib import Path
import argparse,json,struct,hashlib,sys,zipfile
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tests'));from oracle import hilbert
p=argparse.ArgumentParser();p.add_argument('job',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--source-degree13',type=Path);a=p.parse_args()
dir=next((a.job/'fomkyr').glob('alg-*'));cps=[json.loads(p.read_text())['payload']for p in dir.glob('*-?.json')if p.name.startswith(('partial-','checkpoint-'))];cp=max(cps,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)))
leaders=[];off=0;floorhash=hashlib.sha256();filehash=hashlib.sha256();d13bytes=0
with (dir/'basis.gnb').open('rb')as f:
 for i in range(cp['basisSize']):
  header=f.read(32);assert len(header)==32;size,n,D=struct.unpack_from('<III',header,4);assert size>=56 and n and D<=cp['currentDegree']
  record=header+f.read(size-32);assert len(record)==size
  lo,hi=struct.unpack_from('<QQ',record,32);assert not hi>>63,'this audit supports the inline FK14 record form'
  word=(hi<<64)|lo;w=tuple((word>>(4*(D-1-k)))&15 for k in range(D));assert all(x<15 for x in w)
  leaders.append(w);off+=size;filehash.update(record)
  if D<=13:floorhash.update(record);d13bytes+=size
 assert off==cp['diskBytes']
h=hilbert(leaders,15,cp['currentDegree']);reported=cp.get('hilbertReference');assert reported
assert str(h[cp['currentDegree']])==reported['normalWordsUpperBound']
assert h[13]==137268120
source_match=None
if a.source_degree13:
 with zipfile.ZipFile(a.source_degree13)as z:
  candidates=[n for n in z.namelist()if n.endswith('/basis.gnb')]
  assert candidates
  matched=[]
  for n in candidates:
   with z.open(n)as f:
    sh=hashlib.sha256();count=0
    while b:=f.read(1<<20):sh.update(b);count+=len(b)
   if count==d13bytes and sh.hexdigest()==floorhash.hexdigest():matched.append(n)
  assert matched,'original completed-degree13 prefix changed';source_match=matched
report=dict(passed=True,completedThroughDegree=cp['completedThroughDegree'],currentDegree=cp['currentDegree'],partial=cp['partial'],
 rules=cp['basisSize'],recordBytes=cp['diskBytes'],retainedCommittedPairs=cp['retainedCommittedPairs'],
 normalWordsUpperBound=h[cp['currentDegree']],externalDimension=int(reported['externalDimension']),dimensionGap=h[cp['currentDegree']]-int(reported['externalDimension']),
 countMethod='Independent Python forbidden-word automaton using only serialized leading words',hilbertCoefficientsThroughCompletedDegree=h[:cp['completedThroughDegree']+1],
 degree13PrefixBytes=d13bytes,degree13PrefixSHA256=floorhash.hexdigest(),originalDegree13ArchiveMatch=source_match,
 recordPrefixSHA256=filehash.hexdigest(),independentGroebnerCertificate=False,
 limitation='Upper-bound counting, checksum/provenance and completed-prefix equality are not independent degree14 completion.')
a.out.parent.mkdir(exist_ok=True,parents=True);a.out.write_text(json.dumps(report,indent=2));print(json.dumps(report))
