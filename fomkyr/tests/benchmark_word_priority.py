#!/usr/bin/env python3
"""Sequential whole-process comparisons from untouched identical inputs.
A deadline is recorded as censored, never as a completion time. Tests/audits must
not run concurrently. This does not attempt FK6 degree16/17 or tune the field.
"""
from pathlib import Path
import argparse,json,subprocess,shutil,os,time,hashlib,statistics
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--part',choices=['regressions','fk14','fk15'],default='regressions');p.add_argument('--job',type=Path);p.add_argument('--trials',type=int,default=3);p.add_argument('--seconds',type=int);p.add_argument('--baseline-order',choices=['legacy','overlap','sparse'],default='legacy');a=p.parse_args();O=a.out.resolve();O.mkdir(parents=True,exist_ok=True);B=a.baseline.resolve()
if a.part!='regressions' and not a.job:p.error('--job required for a frozen FK checkpoint')
if not (B/'dist/fomkyr').is_file():p.error('build the supplied baseline first')
cases=[('q2','fixtures/published/affine-q-serre-q2.json',20),('q3','fixtures/published/affine-q-serre-q3.json',20),('onsager','fixtures/published/homogenized-q-onsager-q2.json',15),('sklyanin','fixtures/published/sklyanin-1-2-3.json',12),('lp1','fixtures/published/lp1.json',13)] if a.part=='regressions' else [('FK6','fixtures/fk6.json',14 if a.part=='fk14' else 15)]
def latest(job):
 rows=[]
 for f in job.glob('fomkyr/*/*-?.json'):
  try:
   x=json.loads(f.read_text());c=x['payload'];data=json.dumps(c,separators=(',',':')).encode();assert hashlib.sha256(data).hexdigest()==x['sha256'];rows.append(c)
  except (ValueError,KeyError,AssertionError,OSError):pass
 return max(rows,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)))
source=None
if a.job:
 a.job=a.job.resolve();source=latest(a.job)
 if source.get('partial') and source.get('pairPlanOrder') not in (None,0):p.error('job already has a saved plan; use original pre-adoption checkpoint')
 if source['completedThroughDegree']>=cases[0][2]:p.error('target already complete')
 (O/'input-checkpoint.json').write_text(json.dumps(source,indent=2))
records=[]
for case,fixture,D in cases:
 for rep in range(a.trials):
  modes=[('old',B,a.baseline_order),('word',R,'word')]
  if rep%2:modes.reverse()
  for mode,engine,order in modes:
   dest=O/f'{case}-d{D}-{mode}-{rep}'
   if dest.exists():raise SystemExit('Refusing to overwrite '+str(dest))
   if a.job:shutil.copytree(a.job,dest)
   cmd=[str(engine/'dist/fomkyr'),'-d',str(D),'-j4','--memory','3G' if a.job else '512M','--scratch','1024M' if a.job else '128M','--row-reserve','512M' if a.job else '64M','--large-row-workspaces','3' if a.job else '1','--shared-cache','128M' if a.job else '32M','--pair-order',order,'--plan-min-degree','12','--commit-reduction','full','--quiet']
   limit=a.seconds or (600 if a.part=='fk14' else 60 if a.part=='fk15' else 120)
   cmd+=['--time-limit',str(limit)]
   if a.job:cmd+=['--resume',str(dest),'--fk-gate']
   else:cmd+=['-i',str(R/fixture),'--workdir',str(dest)]
   t=time.perf_counter();cpu=os.times()
   try:q=subprocess.run(cmd,capture_output=True,text=True,timeout=limit+30);code=q.returncode;stdout=q.stdout;stderr=q.stderr
   except subprocess.TimeoutExpired as e:code='watchdog';stdout=(e.stdout or b'').decode() if isinstance(e.stdout,bytes) else e.stdout or '';stderr=(e.stderr or b'').decode() if isinstance(e.stderr,bytes) else e.stderr or ''
   wall=time.perf_counter()-t;end=os.times();(O/(dest.name+'.log')).write_text(stdout+'\nSTDERR\n'+stderr)
   result=json.loads(stdout) if stdout.strip().startswith('{') else {};cp=latest(dest);fg=cp.get('fkGate',result.get('fkGate',{}));gap=int(fg['upper'])-int(fg['lower']) if 'upper' in fg and 'lower'in fg else None
   row=dict(case=case,degree=D,mode=mode,order=order,trial=rep,exit=code,status='complete' if result.get('complete') else 'incomplete',elapsedSeconds=wall,childCPUSeconds=end.children_user+end.children_system-cpu.children_user-cpu.children_system,completedThroughDegree=cp['completedThroughDegree'],rules=cp['basisSize'],newRules=cp['basisSize']-source['basisSize'] if source else None,dimensionGap=gap,resolved=cp.get('resolvedOverlaps',result.get('resolvedOverlaps')),record=str(dest/'fomkyr'/cp['runKey']/'basis.gnb'),directory=str(dest),command=cmd,executableSHA256=hashlib.sha256((engine/'dist/fomkyr').read_bytes()).hexdigest())
   records.append(row);(O/'trials.json').write_text(json.dumps(records,indent=2));print(json.dumps(row),flush=True)
(O/'protocol.json').write_text(json.dumps(dict(completed=True,part=a.part,trials=a.trials,baseline=str(B),candidate=str(R),rotatingOrder=True,wholeProcessTimer=True,includesRestoreComputeCheckpointAndTeardown=True,copyCompileAuditExcluded=True,profileImported=bool(a.job),newIndependentDimensionCertificate=False,sourceJobUnmodified=True),indent=2))
