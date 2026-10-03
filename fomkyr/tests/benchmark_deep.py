#!/usr/bin/env python3
"""Sequential, bounded high-degree trials. Keeps interruptions; never calls them completed."""
from __future__ import annotations
import argparse,json,os,subprocess,sys,time,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--degree',type=int,default=12);p.add_argument('--seconds',type=float,default=900);p.add_argument('--workers',type=int,default=4);p.add_argument('--budget-mib',type=int,default=512);p.add_argument('--scratch-mib',type=int,default=128);p.add_argument('--trials',type=int,default=1);p.add_argument('--out',type=Path,required=True);p.add_argument('--baseline',type=Path);p.add_argument('--resume-storage',type=Path);p.add_argument('--ablate-rational-rewrites',action='store_true');a=p.parse_args()
if a.degree<12 or a.seconds<=0 or a.trials<1:p.error('Use degree >=12, positive deadline and trials')
a.out=a.out.resolve();a.out.mkdir(parents=True,exist_ok=True)
modes=[('current',R,{})]
if a.baseline:modes.insert(0,('baseline',a.baseline.resolve(),{}))
if a.ablate_rational_rewrites:modes.insert(0,('rational-rewrites-off',R,{'rationalRewrites':False}))
reports=[]
for trial in range(a.trials):
 for name,source,extra in (modes if trial%2==0 else list(reversed(modes))):
  dest=a.out/f'{name}-{trial}';dest.mkdir() # Do not silently replace prior evidence.
  if a.resume_storage:shutil.copytree(a.resume_storage,dest/'storage')
  options={'workers':a.workers,'budgetBytes':a.budget_mib<<20,'scratchBytes':a.scratch_mib<<20,'timeoutMs':int(a.seconds*1000),'resume':bool(a.resume_storage),**extra}
  env={**os.environ,'FOMKYR_SOURCE':str(source),'TRIAL_OPTIONS':json.dumps(options)}
  with (dest/'stdout.log').open('w') as log:
   try:
    proc=subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(R/'fixtures/fk6.json'),str(a.degree),str(dest)],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=a.seconds+60)
    code=proc.returncode
   except subprocess.TimeoutExpired:code=124
  file=dest/'report.json';report=json.loads(file.read_text()) if file.exists() else {'status':'incomplete','reason':'host watchdog stopped the worker; inspect the last checkpoint'}
  reports.append({'mode':name,'trial':trial,'returncode':code,'report':str(file),'status':report['status'],'elapsedMs':report.get('elapsedMs')})
  (a.out/'summary.json').write_text(json.dumps({'sequential':True,'degree':a.degree,'reports':reports,'timedOutTrialsAreCensored':True},indent=2))
  print(json.dumps(reports[-1]),flush=True)
