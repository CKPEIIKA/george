#!/usr/bin/env python3
"""Cross-check the bounded-memory normalizer against the older independent one.
This validates audit implementation, not a full high-degree Groebner proof.
"""
from pathlib import Path
from fractions import Fraction
import json,subprocess,sys,tempfile,struct,io
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools')]
from canonical_audit import records,canonicalize
from stream_canonical import canon
O=R/'results/0.7.1/stream-audit-tests';O.mkdir(parents=True,exist_ok=True);reports=[]
for name,D in [('fk3',5),('pair-plan-fk4',5),('published/affine-q-serre-q2',10),('homogenized-weyl',6)]:
 f=R/'fixtures'/f'{name}.json';job=O/name.replace('/','-');q=subprocess.run([str(R/'dist/fomkyr'),'-i',str(f),'-d',str(D),'-j','2','--memory','128M','--pair-order','overlap','--plan-min-degree','2','--workdir',str(job),'--quiet'],capture_output=True,text=True,timeout=30);assert not q.returncode,q.stderr
 p=next(job.glob('fomkyr/*/basis.gnb'));fixture=json.loads(f.read_text());reference,_=canonicalize(records(p,D,len(fixture['variables'])));out=O/(job.name+'.jsonl');check=canon(p,D,fixture['variables'],out,cache_bytes=4096)
 got={}
 for line in out.read_text().splitlines()[1:]:
  row={tuple(int(x,16)for x in word):Fraction(c)for word,c in json.loads(line)};got[max(row)]=row
 assert got==reference,(name,'audit mismatch');reports.append(dict(case=name,degree=D,exactEqualToPreviousIndependentNormalizer=True,smallCacheBytes=4096,checks=check))
 # Corrupt a body byte to exercise rejection by the independent checksum scan.
 if name=='homogenized-weyl':
  bad=bytearray(p.read_bytes());bad[-1]^=1;(O/'bad.gnb').write_bytes(bad)
  x=subprocess.run([str(R/'dist/packed-basis-audit'),str(O/'bad.gnb'),str(D),str(len(fixture['variables'])),str(O/'bad.tsv')],capture_output=True,text=True)
  assert x.returncode!=0
(O/'summary.json').write_text(json.dumps(dict(passed=True,cases=reports,corruptBodyRejected=True,independentGroebnerCertificate=False),indent=2));print('STREAMING CANONICAL AUDIT TESTS PASS')
