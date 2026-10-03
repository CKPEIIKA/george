#!/usr/bin/env python3
"""Run exact WASM with a single memory ceiling. Preserve deadline/error reports.
This is a Node/filesystem adapter, not a browser or an external CAS benchmark.
"""
from pathlib import Path
import argparse,json,os,shutil,subprocess,time
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--fixture',type=Path,default=R/'fixtures/fk6.json')
p.add_argument('--degree',type=int,default=14)
p.add_argument('--budget-mib',type=int,default=3584)
p.add_argument('--workers',type=int,default=4)
p.add_argument('--seconds',type=int,default=1800)
p.add_argument('--resume-storage',type=Path)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
if a.degree<1 or a.seconds<1 or not 16<=a.budget_mib<=14304 or not 1<=a.workers<=32:p.error('Invalid degree, deadline, memory ceiling or worker count')
out=a.out.resolve()
if out.exists():p.error('--out must be a fresh directory (existing checkpoints are never overwritten)')
out.mkdir(parents=True)
if a.resume_storage:
 if not a.resume_storage.is_dir():p.error('--resume-storage must contain the fomkyr/ subtree')
 shutil.copytree(a.resume_storage,out/'storage')
options=dict(memoryPolicy='auto',workers=a.workers,bits='auto',budgetBytes=a.budget_mib*1048576,
 scratchBytes=None,rowReserveBytes=None,timeoutMs=a.seconds*1000,resume=bool(a.resume_storage),
 spill=True,hilbert=False,exportText=False,progress=True,progressIntervalMs=5000)
env=os.environ|{'FOMKYR_SOURCE':str(R),'TRIAL_OPTIONS':json.dumps(options)}
t=time.monotonic()
with (out/'console.log').open('w') as log:
 try:
  code=subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(a.fixture.resolve()),str(a.degree),str(out)],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=a.seconds+45).returncode
 except subprocess.TimeoutExpired:code=124
(out/'driver.json').write_text(json.dumps({'exitCode':code,'outerSeconds':time.monotonic()-t,'options':options,
 'resumed':bool(a.resume_storage),'timeoutIsCompletion':False},indent=2))
print(out/'report.json' if (out/'report.json').exists() else out/'console.log')
raise SystemExit(code)
