#!/usr/bin/env python3
"""Matched, sequential, cold-process 0.6.1/0.6.2 trials with explicit censoring.
Run separately from tests and audits. A timeout is not a completion time.
"""
from pathlib import Path
import argparse,json,os,subprocess,time,shutil,statistics,hashlib
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--part',choices=['matrix','deep','targets','ablations'],default='matrix');p.add_argument('--trials',type=int,default=3)
p.add_argument('--resume-storage',type=Path);p.add_argument('--seconds',type=int)
a=p.parse_args();base=a.baseline.resolve();root=a.out.resolve();root.mkdir(parents=True,exist_ok=True)
records=[]
cases=[('affine-q-serre-q2',15),('affine-q-serre-q3',15),('homogenized-q-onsager-q2',13),('sklyanin-1-2-3',10),('lp1',13),('yang-mills-3',20),('metab3',20),('fk6',11)]
if a.part=='targets':cases=[('affine-q-serre-q2',20),('affine-q-serre-q3',20),('homogenized-q-onsager-q2',15),('sklyanin-1-2-3',15),('lp1',16)]
if a.part=='deep':
 if not a.resume_storage:p.error('--deep requires --resume-storage from the same completed degree-11 checkpoint')
 cases=[('fk6',12)]
if a.part=='ablations':cases=[('affine-q-serre-q2',20)]
for name,D in cases:
 for trial in range(a.trials):
  modes=[('baseline061',base,{}),('current062',R,{})]
  if a.part=='targets':
   # One censored old trial is enough for each hard target, plus three new trials.
   if trial>0:modes=[modes[1]]
   if name in ('sklyanin-1-2-3','lp1') and trial>0:continue
  if a.part=='ablations':modes=[('current062',R,{}),('no-big-heap',R,{'bigRationalHeap':False}),('no-growth',R,{'growingRationalHeap':False}),('old-divider',R,{'fastBigDivision':False})]
  if trial%2:modes.reverse()
  for mode,source,extra in modes:
   dest=root/f'{name}-d{D}-{mode}-{trial}';dest.mkdir()
   if a.resume_storage:shutil.copytree(a.resume_storage,dest/'storage')
   fixture=R/'fixtures'/('fk6.json' if name=='fk6' else f'published/{name}.json')
   limit=a.seconds or (240 if a.part=='deep' else 120 if a.part=='targets' else 90)
   options={'workers':4,'bits':32,'budgetBytes':512<<20,'scratchBytes':128<<20,'hashBits':16,'spill':True,'resume':bool(a.resume_storage),'progress':True,'progressIntervalMs':5000,'hilbert':name!='fk6','exportText':name!='fk6','timeoutMs':limit*1000,**extra}
   env=os.environ|{'FOMKYR_SOURCE':str(source),'TRIAL_OPTIONS':json.dumps(options)};t=time.monotonic()
   with (dest/'console.log').open('w') as log:
    try:exitcode=subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(fixture),str(D),str(dest)],env=env,cwd=R,stdout=log,stderr=subprocess.STDOUT,timeout=limit+15).returncode
    except subprocess.TimeoutExpired:exitcode='external-watchdog'
   rp=dest/'report.json';report=json.loads(rp.read_text()) if rp.exists() else {}
   cps=[]
   for cp in dest.glob('storage/fomkyr/*/checkpoint-*.json'):
    try:cps.append(json.loads(cp.read_text())['payload'])
    except (OSError,ValueError,KeyError):pass
   cp=max(cps,key=lambda x:x['completedThroughDegree']) if cps else {}
   rec={'case':name,'degree':D,'mode':mode,'trial':trial,'source':str(source),'output':str(dest),'status':report.get('status','no-report'),'completedThroughDegree':cp.get('completedThroughDegree',0),'rules':cp.get('basisSize',0),'elapsedSeconds':report.get('elapsedMs',0)/1000 if report else None,'outerSeconds':time.monotonic()-t,'exit':exitcode,'options':options,'censored':report.get('status')!='completed'}
   records.append(rec);(dest/'driver.json').write_text(json.dumps(rec,indent=2));(root/'trials.json').write_text(json.dumps(records,indent=2));print(json.dumps(rec),flush=True)
(root/'protocol.json').write_text(json.dumps({'part':a.part,'sequential':True,'alternatingModes':True,'trials':a.trials,'resumeStorage':str(a.resume_storage) if a.resume_storage else None,'timedOutValuesAreNotCompletionTimes':True,'baseline':str(base),'current':str(R)},indent=2))
