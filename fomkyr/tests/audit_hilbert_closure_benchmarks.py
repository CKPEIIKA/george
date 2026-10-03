#!/usr/bin/env python3
from pathlib import Path
import json,subprocess,sys,hashlib,io,shutil,time,struct
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from canonical_audit import records,canonicalize,canonical_digest
from oracle import hilbert
O=R/'results/0.6.6/benchmark-audits';O.mkdir(parents=True,exist_ok=True)
trials=json.loads((R/'results/0.6.6/paired-wasm/trials.json').read_text());summary=[]
for case in ('q-serre-2','q-serre-3','Sklyanin','FK6'):
 rows=[x for x in trials if x['case']==case];first=None;cache={};reports=[]
 for row in rows:
  file=Path(row['record']);data=file.read_bytes();digest=hashlib.sha256(data).hexdigest();assert digest==row['recordSHA256']
  if digest in cache:
   assert data==cache[digest]['raw'];canonical=cache[digest]['canonical'];checks=cache[digest]['checks']
  else:
   f=json.loads(Path(row['fixture']).read_text());can,checks=canonicalize(records(file,row['degree'],len(f['variables'])));s=io.BytesIO();ch=canonical_digest(can,f['variables'],0,row['degree'],s);canonical=s.getvalue();cache[digest]=dict(raw=data,canonical=canonical,checks=checks);(O/f'{case}-{digest[:12]}.jsonl').write_bytes(canonical)
  if first is None:first=canonical
  assert canonical==first,case
  reports.append(dict(mode=row['mode'],trial=row['trial'],rules=row['basisSize'],recordSHA256=digest,canonicalSHA256=hashlib.sha256(canonical).hexdigest(),checks=checks))
 if case=='q-serre-2':
  golden=R/'reference/q-serre-q2-degree20/canonical.jsonl';assert golden.read_bytes()==first
 summary.append(dict(case=case,degree=rows[0]['degree'],canonicalEqual=True,comparison='Actual canonical bytes, not hash-only',independentGroebnerCertificate=False,runs=reports))
 (O/'canonical-summary.json').write_text(json.dumps(summary,indent=2));print('CANONICAL PASS',case,flush=True)
# Independently rebuild and check the full published output; do not invoke C for verification.
for case,name in [('q-serre-2','affine-q-serre-q2'),('q-serre-3','affine-q-serre-q3'),('Sklyanin','sklyanin-1-2-3')]:
 row=next(x for x in trials if x['case']==case and x['mode']=='closure066');stage=O/(case+'-stage');stage.mkdir(exist_ok=True)
 link=stage/'storage'
 if not link.exists():link.symlink_to(Path(row['output']).resolve(),target_is_directory=True)
 out=O/(case+'-independent.json');cmd=[sys.executable,str(R/'tests/published/audit_one.py'),name,'--run-dir',str(stage),'--degree',str(row['degree']),'--engine',str(R),'--out',str(out)]
 try:
  q=subprocess.run(cmd,cwd=R,text=True,capture_output=True,timeout=300);(O/(case+'-independent.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr);assert not q.returncode,(case,q.stderr[-2000:])
 except subprocess.TimeoutExpired:
  report=json.loads(out.read_text()) if out.exists() else {};report.update(status='timeout',independentGroebnerCertificate=False);out.write_text(json.dumps(report,indent=2));raise
 assert json.loads(out.read_text())['independentGroebnerCertificate'];print('INDEPENDENT GB PASS',case,flush=True)
# Independently count the new partial FK6 leading ideal and verify all old prefix bytes.
job=R/'results/0.6.6/fk14-assisted/job';source=Path('/mnt/data/work066/fk14source/fk6-degree14-partial/job')
cps=[(json.loads(p.read_text())['payload'],p) for p in job.glob('fomkyr/*/partial-?.json')];cp,p=max(cps,key=lambda q:q[0]['sequence']);dest=next(job.glob('fomkyr/*/basis.gnb'));orig=next(source.glob('fomkyr/*/basis.gnb'))
with orig.open('rb') as a,dest.open('rb') as b:
 while True:
  x=a.read(1048576)
  if not x:break
  assert b.read(len(x))==x
leaders=[];scanned=0
with dest.open('rb') as f:
 while f.tell()<cp['diskBytes']:
  h=f.read(32);magic,size,nt,d,ck,res=struct.unpack('<IIIIQQ',h);assert magic==0x31424e47 and not res and d<=14
  lo,hi,c=struct.unpack('<QQQ',f.read(24));value=(hi<<64)|lo;assert not (hi>>63);leaders.append(tuple((value>>(4*j))&15 for j in reversed(range(d))));f.seek(size-56,1);scanned+=1
 assert f.tell()==cp['diskBytes'] and scanned==cp['basisSize']
hs=hilbert(leaders,15,14);assert hs[-1]==int(cp['hilbertReference']['normalWordsUpperBound']) and hs[-2]==137268120
result=dict(passed=True,kind='partial-degree leading-ideal count, not independent Groebner certification',independentGroebnerCertificate=False,completedThroughDegree=13,currentDegree=14,committedOverlaps=cp['resolvedOverlaps'],totalOverlaps=cp['totalOverlaps'],pendingPairs=cp['pendingPairs'],rules=cp['basisSize'],storedTerms=cp['terms'],diskBytes=cp['diskBytes'],originalPrefixBytes=orig.stat().st_size,originalPrefixByteEqual=True,normalWordsUpperBound=str(hs[-1]),externalDimension='346652740',dimensionGap=str(hs[-1]-346652740),hilbertClosureEvents=cp['hilbertClosureEvents'],metadataABI=cp['abi'],conditional=cp['conditionalOnExternalDimensions'],counter='Independent Python automaton on streamed leading words; not production C')
(O/'fk14-partial.json').write_text(json.dumps(result,indent=2));print('FK14 PARTIAL COUNTER PASS',result,flush=True)
(O/'summary.json').write_text(json.dumps(dict(passed=True,canonicalComparisonRuns=len(trials),independentCompletePublishedCases=3,FK6d11IndependentGroebnerCertificate=False,fk14IndependentGroebnerCertificate=False),indent=2))
