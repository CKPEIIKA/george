#!/usr/bin/env python3
"""Cold actual-WASM benchmark. Run separately from tests/other computations.
Whole-process wall time includes proof JSON loading, compilation/startup, output,
and teardown. The engine timer is recorded separately, never substituted silently.
"""
from pathlib import Path
import argparse,json,subprocess,time,shutil,hashlib,statistics,os
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);p.add_argument('--trials',type=int,default=3);p.add_argument('--out',type=Path,default=R/'results/0.6.6/paired-wasm');a=p.parse_args();O=a.out.resolve();O.mkdir(parents=True,exist_ok=True)
cases=[('q-serre-2',20,'published/affine-q-serre-q2.json','hilbert/q-serre-2-pbw.json'),('q-serre-3',20,'published/affine-q-serre-q3.json','hilbert/q-serre-3-pbw.json'),('Sklyanin',12,'published/sklyanin-1-2-3.json','hilbert/sklyanin-pbw.json'),('FK6',11,'fk6.json','hilbert/fk6-kirillov.json')]
trials=[]
for name,D,fixture,policy in cases:
 for n in range(a.trials):
  modes=['baseline065','ordinary066','closure066'];modes=modes[n%3:]+modes[:n%3]
  for mode in modes:
   root=a.baseline.resolve() if mode=='baseline065' else R;exe=root/'dist/fomkyr';out=O/f'{name}-{mode}-{n}';shutil.rmtree(out,ignore_errors=True)
   cmd=[str(exe),'--wasm','-i',str(R/'fixtures'/fixture),'-d',str(D),'-j','4','--memory','512M','--workdir',str(out),'--batch-pairs','128','--quiet','--hilbert','--export']
   if mode=='closure066':cmd+=['--assume-hilbert',str(R/'fixtures'/policy)]
   start=time.perf_counter();q=subprocess.run(cmd,cwd=root,capture_output=True,text=True,timeout=240);outer=time.perf_counter()-start
   (O/(out.name+'.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr)
   if q.returncode:raise RuntimeError((mode,name,q.returncode,q.stderr[-2000:]))
   result=json.loads(q.stdout);assert result['complete'] and result['completedThroughDegree']==D
   binfile=out/'fomkyr'/result['runKey']/'basis.gnb'
   row=dict(case=name,degree=D,fixture=str(R/'fixtures'/fixture),mode=mode,trial=n,outerSeconds=outer,engineSeconds=result['elapsedMs']/1000,bits=result['bits'],shared=result['shared'],workers=result['workers'],basisSize=result['basisSize'],terms=result['terms'],record=str(binfile),recordSHA256=hashlib.sha256(binfile.read_bytes()).hexdigest(),dispatched=result['scheduler']['dispatchedPairs'],closureEvents=result.get('hilbertClosureEvents',[]),conditional=result.get('conditionalOnExternalDimensions',False),output=str(out))
   trials.append(row);(O/'trials.json').write_text(json.dumps(trials,indent=2));print(json.dumps(row),flush=True)
summary=[]
for name,D,_,_ in cases:
 row=dict(case=name,degree=D)
 for mode in ('baseline065','ordinary066','closure066'):
  t=[x['outerSeconds'] for x in trials if x['case']==name and x['mode']==mode];row[mode]=dict(medianSeconds=statistics.median(t),rangeSeconds=[min(t),max(t)])
 row['ordinaryOverAssisted']=row['ordinary066']['medianSeconds']/row['closure066']['medianSeconds'];summary.append(row)
(O/'summary.json').write_text(json.dumps(dict(completed=True,protocol='three-mode rotating-order cold actual-WASM executions, four workers, Q; whole-process wall time; verification done afterwards',cases=summary),indent=2));print(json.dumps(summary,indent=2))
