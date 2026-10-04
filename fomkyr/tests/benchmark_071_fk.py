#!/usr/bin/env python3
"""Matched saved-FK6 continuation: all variants start at identical committed bytes.
No independent tests/audits should run concurrently. Censored runs stay censored.
"""
from pathlib import Path
import argparse,subprocess,json,shutil,time,hashlib
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--job',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--old-seconds',type=int,default=180);p.add_argument('--new-seconds',type=int,default=600);a=p.parse_args();O=a.out.resolve();O.mkdir(parents=True,exist_ok=True)
plans=[('baseline70-native',a.baseline.resolve(),False,False,a.old_seconds),('v71-native',R,False,True,a.new_seconds),('baseline70-wasm',a.baseline.resolve(),True,False,a.old_seconds),('v71-wasm',R,True,True,a.new_seconds)]
summary=[]
for label,source,wasm,enabled,seconds in plans:
 dest=O/label
 if dest.exists():raise SystemExit('Refusing to overwrite '+str(dest))
 shutil.copytree(a.job,dest)
 cmd=[str(source/'dist/fomkyr')]+(['--wasm']if wasm else[])+['--resume',str(dest),'-d','14','-j','4','--memory','3584M','--fk-gate','--checkpoint-seconds','30','--time-limit',str(seconds)]
 if enabled:cmd+=['--pair-order','overlap']
 print('START',label,flush=True);start=time.perf_counter()
 with (O/(label+'.stdout')).open('w')as f,(O/(label+'.stderr')).open('w')as g:
  try:code=subprocess.run(cmd,cwd=source,stdout=f,stderr=g,timeout=seconds+45).returncode
  except subprocess.TimeoutExpired:code='outer-watchdog'
 outer=time.perf_counter()-start
 try:r=json.loads((O/(label+'.stdout')).read_text())
 except ValueError:r={}
 cps=[]
 for file in dest.glob('fomkyr/*/*-?.json'):
  try:cps.append(json.loads(file.read_text())['payload'])
  except (ValueError,KeyError):pass
 cp=max(cps,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)))
 row=dict(label=label,command=cmd,exit=code,outerSeconds=outer,elapsedSeconds=r.get('elapsedSeconds',r.get('elapsedMs',0)/1000 if r else None),complete=r.get('complete',False),completedThroughDegree=cp['completedThroughDegree'],currentDegree=cp.get('currentDegree',0),rules=cp['basisSize'],storedTerms=cp['terms'],diskBytes=cp['diskBytes'],resolvedOverlaps=r.get('resolvedOverlaps',cp.get('resolvedOverlaps')),pairPlan=r.get('pairPlan'),fkGate=r.get('fkGate'),conditionalOnImportedFkDimensions=r.get('conditionalOnImportedFkDimensions'),output=str(dest))
 summary.append(row);(O/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(row),flush=True)
(O/'protocol.json').write_text(json.dumps(dict(fixture='Original-order 100-relation FK6 over Q; degleftlex order',sameInitialCheckpoint=True,startedCommittedPairs=8960,requestedDegree=14,runtime='Actual native and WASM32, four workers',budgetBytes=3584*1048576,field=0,profileAssumptionExplicit=True,unknownOldCompletionTimesAreCensored=True,iterationsPerVariant=1,checkpointAndInitializationIncluded=True,hilbertTextOutputExcluded=True),indent=2))
