#!/usr/bin/env python3
"""Rotating three-mode, cold actual-WASM regression trials. Run after deep timings.
Whole-process and engine clocks are both recorded. No clock is retroactively replaced.
"""
from pathlib import Path
import argparse,subprocess,time,json,hashlib,shutil
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,default=R/'results/0.7.1/regressions');p.add_argument('--trials',type=int,default=3);a=p.parse_args();O=a.out.resolve();O.mkdir(parents=True,exist_ok=True)
cases=[('q-serre-2','published/affine-q-serre-q2.json',20),('q-serre-3','published/affine-q-serre-q3.json',20),('q-onsager','published/homogenized-q-onsager-q2.json',15),('Sklyanin','published/sklyanin-1-2-3.json',10),('lp1','published/lp1.json',13),('FK6','fk6.json',11)]
rows=[]
for name,fixture,D in cases:
 for trial in range(a.trials):
  modes=['v70','v71-legacy','v71-overlap'];modes=modes[trial%3:]+modes[:trial%3]
  for mode in modes:
   source=a.baseline.resolve()if mode=='v70'else R;dest=O/f'{name}-{mode}-{trial}';assert not dest.exists(),dest
   cmd=[str(source/'dist/fomkyr'),'--wasm','-i',str(R/'fixtures'/fixture),'-d',str(D),'-j','4','--memory','512M','--workdir',str(dest),'--quiet','--time-limit','120']
   if name!='FK6':cmd+=['--hilbert','--export']
   if mode!='v70':cmd+=['--pair-order','overlap'if mode=='v71-overlap'else'legacy']
   start=time.perf_counter()
   try:q=subprocess.run(cmd,cwd=source,capture_output=True,text=True,timeout=150);exit=q.returncode;stdout=q.stdout;stderr=q.stderr
   except subprocess.TimeoutExpired as e:exit='watchdog';stdout=e.stdout or '';stderr=e.stderr or '';stdout=stdout.decode()if isinstance(stdout,bytes)else stdout;stderr=stderr.decode()if isinstance(stderr,bytes)else stderr
   wall=time.perf_counter()-start;(O/(dest.name+'.log')).write_text(stdout+'\nSTDERR\n'+stderr)
   try:res=json.loads(stdout)
   except ValueError:res={}
   record=next(dest.glob('fomkyr/*/basis.gnb'),None)
   row=dict(case=name,fixture=fixture,degree=D,mode=mode,trial=trial,command=cmd,exit=exit,complete=res.get('complete',False),completedThroughDegree=res.get('completedThroughDegree'),engineSeconds=res.get('elapsedMs',0)/1000,outerSeconds=wall,bits=res.get('bits'),shared=res.get('shared'),workers=res.get('workers'),basisSize=res.get('basisSize'),terms=res.get('terms'),pairPlan=res.get('pairPlan'),conditionalOnImportedFkDimensions=res.get('conditionalOnImportedFkDimensions',False),record=str(record)if record else None,recordSHA256=hashlib.sha256(record.read_bytes()).hexdigest()if record else None)
   rows.append(row);(O/'trials.json').write_text(json.dumps(rows,indent=2));print(json.dumps({k:row[k]for k in ['case','mode','trial','complete','engineSeconds','outerSeconds','basisSize']}),flush=True)
(O/'protocol.json').write_text(json.dumps(dict(trialsPerCaseMode=a.trials,modeOrderRotating=True,coldCheckpoints=True,sequential=True,runtime='four shared WASM32 workers, Node filesystem OPFS adapter',memoryMiB=512,field='Q',order='unchanged degleftlex, original generator declaration',newPlanMinimumDegree=12,gateEnabled=False,hilbertTextExport='on except FK6',primaryClock='whole process wall; engine clock separately retained',timeoutsCensored=True),indent=2))
