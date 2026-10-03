#!/usr/bin/env python3
"""Alternating old/new cold trials at matched effective workspace sizes.
Run separately from heavy calculations or correctness tests. No timeout is a time
for completed computation. The current version selects sizes automatically; the
old version is given the same sizes explicitly for an algorithmic regression check.
"""
from pathlib import Path
import argparse,json,os,subprocess,time
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--trials',type=int,default=3)
a=p.parse_args();out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
cases=[('affine-q-serre-q2',20),('affine-q-serre-q3',20),('homogenized-q-onsager-q2',15),('sklyanin-1-2-3',10),('lp1',13),('fk6',11)]
rows=[];budget=512<<20
floor=lambda n:int(n)//65536*65536
for case,D in cases:
 for trial in range(a.trials):
  modes=[('063',a.baseline.resolve()),('064',R)]
  if trial%2:modes.reverse()
  for mode,source in modes:
   dest=out/f'{case}-d{D}-{mode}-{trial}';dest.mkdir(exist_ok=False)
   fixture=R/'fixtures'/('fk6.json' if case=='fk6' else f'published/{case}.json')
   options={'workers':4,'bits':32,'budgetBytes':budget,'hashBits':16,'spill':True,'resume':False,
    'hilbert':case!='fk6','exportText':case!='fk6','progress':True,'progressIntervalMs':5000,'timeoutMs':180000,'batchPairs':32}
   if mode=='064':options.update(memoryPolicy='auto',scratchBytes=None,rowReserveBytes=None)
   else:options.update(scratchBytes=floor(budget*4/7),rowReserveBytes=floor(budget/7))
   env=os.environ|{'FOMKYR_SOURCE':str(source),'TRIAL_OPTIONS':json.dumps(options)}
   t=time.monotonic()
   with (dest/'console.log').open('w') as log:
    try:code=subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(fixture),str(D),str(dest)],cwd=R,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=225).returncode
    except subprocess.TimeoutExpired:code=124
   report=json.loads((dest/'report.json').read_text()) if (dest/'report.json').exists() else {}
   row=dict(case=case,degree=D,mode=mode,trial=trial,code=code,status=report.get('status','external-termination'),
    elapsedSeconds=report.get('elapsedMs',0)/1000,outerSeconds=time.monotonic()-t,options=options,directory=str(dest))
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2));print(json.dumps(row),flush=True)
(out/'protocol.json').write_text(json.dumps(dict(sequential=True,alternating=True,trials=a.trials,ordinaryWorkspaceMatched=True,
 currentAutomaticPolicy=True,oldExplicitMatchingProfile=True,coldRuns=True,sharedWasm32=True,workers=4,
 environment='Node filesystem OPFS adapter; not browser or Singular',timed='initialization, computation, checkpoints; Hilbert/text included except FK6',
 failedRuns='retained and excluded from completed-time ratios'),indent=2))
