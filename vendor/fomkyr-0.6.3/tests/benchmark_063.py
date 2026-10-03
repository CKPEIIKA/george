#!/usr/bin/env python3
"""Sequential same-input direct-exact benchmarks. Timeouts remain censored.
No tests/audits should run concurrently. Baseline and current are fresh processes.
"""
from pathlib import Path
import argparse,json,os,subprocess,time,shutil,hashlib
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline',type=Path);p.add_argument('--out',type=Path,required=True)
p.add_argument('--part',choices=['matrix','fk13','queue-ablation'],default='matrix')
p.add_argument('--trials',type=int,default=3);p.add_argument('--seconds',type=int)
p.add_argument('--resume-storage',type=Path);p.add_argument('--only-current',action='store_true')
p.add_argument('--budget-mib',type=int);p.add_argument('--scratch-mib',type=int);p.add_argument('--reserve-mib',type=int);p.add_argument('--batch-pairs',type=int)
a=p.parse_args();root=a.out.resolve();root.mkdir(parents=True,exist_ok=True)
if a.trials<1:p.error('trials must be positive')
if not a.baseline and not a.only_current and a.part!='queue-ablation':p.error('specify --baseline or --only-current')
if a.part=='fk13' and not a.resume_storage:p.error('fk13 comparison requires identical completed-degree12 --resume-storage')
cases=[('affine-q-serre-q2',20),('affine-q-serre-q3',20),('homogenized-q-onsager-q2',15),('sklyanin-1-2-3',10),('lp1',13),('fk6',11)] if a.part=='matrix' else [('fk6',13)] if a.part=='fk13' else [('affine-q-serre-q2',20),('lp1',13),('fk6',11)]
records=[]
for case,D in cases:
 for trial in range(a.trials):
  modes=[('063',R,{})]
  if a.part=='queue-ablation':modes=[('binary',R,{'radixHeap':False}),('radix',R,{'radixHeap':True})]
  elif not a.only_current:modes.insert(0,('062',a.baseline.resolve(),{}))
  if trial%2:modes.reverse()
  for mode,source,extra in modes:
   dest=root/f'{case}-d{D}-{mode}-{trial}';dest.mkdir()
   if a.resume_storage:shutil.copytree(a.resume_storage,dest/'storage')
   fixture=R/'fixtures'/('fk6.json' if case=='fk6' else f'published/{case}.json')
   seconds=a.seconds or (1800 if a.part=='fk13' else 120)
   opt={'workers':4,'bits':32,'hashBits':16,'budgetBytes':(a.budget_mib or (3584 if a.part=='fk13' else 512))<<20,'scratchBytes':(a.scratch_mib or (2048 if a.part=='fk13' else 128))<<20,'spill':True,'resume':bool(a.resume_storage),'exportText':case!='fk6','hilbert':case!='fk6','progress':True,'progressIntervalMs':5000,'timeoutMs':seconds*1000,**extra}
   if a.reserve_mib is not None:opt['rowReserveBytes']=a.reserve_mib<<20
   if a.batch_pairs is not None:opt['batchPairs']=a.batch_pairs
   elif a.part=='fk13':opt['batchPairs']=128
   env=os.environ|{'FOMKYR_SOURCE':str(source),'TRIAL_OPTIONS':json.dumps(opt)}
   t=time.monotonic()
   with (dest/'console.log').open('w') as log:
    try:code=subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(fixture),str(D),str(dest)],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=seconds+30).returncode
    except subprocess.TimeoutExpired:code='watchdog'
   rp=dest/'report.json';r=json.loads(rp.read_text()) if rp.exists() else {};cps=[]
   for cp in dest.glob('storage/fomkyr/*/checkpoint-*.json'):
    try:cps.append(json.loads(cp.read_text())['payload'])
    except (ValueError,KeyError,OSError):pass
   cp=max(cps,key=lambda x:x['completedThroughDegree'],default={})
   record={'case':case,'degree':D,'mode':mode,'trial':trial,'status':r.get('status','no-report'),'elapsedSeconds':r.get('elapsedMs',0)/1000 if r else None,'outerSeconds':time.monotonic()-t,'completedThroughDegree':cp.get('completedThroughDegree',0),'rules':cp.get('basisSize',0),'censored':r.get('status')!='completed','exit':code,'directory':str(dest),'options':opt}
   records.append(record);(root/'trials.json').write_text(json.dumps(records,indent=2));print(json.dumps(record),flush=True)
(root/'protocol.json').write_text(json.dumps({'part':a.part,'sequential':True,'trials':a.trials,'sameCheckpoint':bool(a.resume_storage),'oldUsesNewOptions':False,'comparison':'full elapsed includes initialization and checkpoints; audit time excluded; Node filesystem adapter, not browser or Singular','timeoutIsCompletionTime':False},indent=2))
