#!/usr/bin/env python3
"""Cold, rotating-order source-matched benchmark; no changes to the input order.
A deadline is censored, not a completion time. No full degree16 computation.
"""
from pathlib import Path
import argparse,json,time,subprocess,statistics,shutil
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--trials',type=int,default=3);p.add_argument('--wasm',action='store_true');a=p.parse_args();O=a.out.resolve();O.mkdir(parents=True,exist_ok=True)
cases=[('q2',R/'fixtures/published/affine-q-serre-q2.json',20),('q3',R/'fixtures/published/affine-q-serre-q3.json',20),('Sklyanin',R/'fixtures/published/sklyanin-1-2-3.json',10),('lp1',R/'fixtures/published/lp1.json',13),('FK6',R/'fixtures/fk6.json',11)]
rows=[]
for name,f,D in cases:
 for t in range(a.trials):
  modes=[('baseline',a.baseline.resolve(),[]),('full',R,['--commit-reduction','full']),('delta',R,['--commit-reduction','delta'])];modes=modes[t%3:]+modes[:t%3]
  for mode,source,extra in modes:
   job=O/f'{name}-{mode}-{t}'
   if job.exists():raise SystemExit(f'Refuse to reuse {job}; use a fresh --out')
   cmd=[str(source/'dist/fomkyr')]+(['--wasm']if a.wasm else [])+['-i',str(f),'-d',str(D),'-j','4','--memory','512M','--scratch','128M','--row-reserve','64M','--large-row-workspaces','1','--pair-order','legacy','--scheduler','cooperative','--quantum-ms','250','--lookahead','128','--max-lookahead','512','--checkpoint-seconds','30','--quiet','--time-limit','90','--workdir',str(job)]+extra
   start=time.perf_counter()
   try:q=subprocess.run(cmd,cwd=source,capture_output=True,text=True,timeout=110);status=q.returncode;stdout=q.stdout;stderr=q.stderr
   except subprocess.TimeoutExpired as e:status=124;stdout=(e.stdout or b'').decode() if isinstance(e.stdout,bytes) else (e.stdout or '');stderr=str(e)
   outer=time.perf_counter()-start
   (O/(job.name+'.log')).write_text(stdout+'\nSTDERR\n'+stderr)
   try:out=json.loads(stdout)
   except ValueError:out={}
   cp=[]
   for file in job.glob('fomkyr/*/*-?.json'):
    try:c=json.loads(file.read_text())['payload'];cp.append(c)
    except (KeyError,ValueError):pass
   last=max(cp,key=lambda c:(c.get('completedThroughDegree',0),c.get('sequence',0)),default={})
   row=dict(case=name,degree=D,fixture=str(f),mode=mode,trial=t,native=not a.wasm,exit=status,complete=bool(out.get('complete')),outerSeconds=outer,engineSeconds=out.get('elapsedSeconds',out.get('elapsedMs',0)/1000),completedThroughDegree=out.get('completedThroughDegree',last.get('completedThroughDegree')),rules=out.get('basisSize'),terms=out.get('terms'),commit=out.get('commit'),record=str(next(job.glob('fomkyr/*/basis.gnb'))) if list(job.glob('fomkyr/*/basis.gnb')) else None,command=cmd)
   if status or not row['complete']:raise RuntimeError(row)
   rows.append(row);(O/'trials.json').write_text(json.dumps(rows,indent=2));print(json.dumps({k:v for k,v in row.items() if k not in ('command','commit')}),flush=True)
summary=[]
for name,_,D in cases:
 c=dict(case=name,degree=D)
 for m in ['baseline','full','delta']:
  group=[r for r in rows if r['case']==name and r['mode']==m];v=[r['outerSeconds'] for r in group];c[m]=dict(median=statistics.median(v),min=min(v),max=max(v),trials=len(v))
  if m!='baseline':c[m]['medianCommitNFSeconds']=statistics.median(r['commit']['normalFormMicroseconds']/1e6 for r in group)
 c['fullOverDelta']=c['full']['median']/c['delta']['median'];summary.append(c)
(O/'summary.json').write_text(json.dumps(dict(complete=True,clock='whole process cold wall time; internal commit microseconds separately reported; cooperative 4threads; exact Q gate off',cases=summary),indent=2));print(json.dumps(summary,indent=2))
