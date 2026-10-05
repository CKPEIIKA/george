#!/usr/bin/env python3
"""Bounded same-frontier tests; DRY-RUN by default. Never modifies the source job.

Policies are tested from one frozen snapshot, not a sequentially advancing job.
An active saved plan is authoritative: incompatible policy experiments are refused.
Native POSIX lockf matches the solver's fcntl locking; do not snapshot a live browser
OPFS job through this helper. Copy/metadata/hash costs are excluded from trial time.
"""
from pathlib import Path
import argparse,contextlib,fcntl,hashlib,json,os,shutil,subprocess,time,sys
R=Path(__file__).resolve().parents[1]
def best(job):
 rows=[]
 for p in job.glob('fomkyr/*/*-?.json'):
  try:
   e=json.loads(p.read_text());c=e['payload'];raw=json.dumps(c,separators=(',',':'),ensure_ascii=False)
   if e.get('schema')!=2 or hashlib.sha256(raw.encode()).hexdigest()!=e.get('sha256'):continue
   basis=p.parent/'basis.gnb'
   if c.get('abi')not in [3,4,5] or not isinstance(c.get('diskBytes'),int) or basis.stat().st_size<c['diskBytes']:continue
   if c.get('partial') and 'frontier' not in c:continue
   rows.append((c,p))
  except (OSError,ValueError,KeyError):continue
 if not rows:raise ValueError('No valid native-compatible checkpoint found')
 return max(rows,key=lambda x:(x[0]['completedThroughDegree'],bool(x[0].get('partial')),x[0].get('sequence',0)))
def prefix_hash(file,size):
 h=hashlib.sha256()
 with file.open('rb')as f:
  while size:
   b=f.read(min(4<<20,size))
   if not b:raise IOError('Basis shorter than checkpoint')
   h.update(b);size-=len(b)
 return h.hexdigest()
def clonefile(src,dst):
 # Linux CoW when available; otherwise make an independent byte copy. NO hardlinks.
 try:
  with open(src,'rb')as a,open(dst,'wb')as b:fcntl.ioctl(b.fileno(),0x40049409,a.fileno())
  shutil.copystat(src,dst);return dst
 except OSError:return shutil.copy2(src,dst)
@contextlib.contextmanager
def read_lock(job):
 p=job/'cli.lock';f=None
 try:
  if p.exists():
   f=p.open('rb');fcntl.lockf(f,fcntl.LOCK_SH|fcntl.LOCK_NB)
  yield
 finally:
  if f:f.close()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--job',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--engine',type=Path,default=R/'dist/fomkyr');p.add_argument('--degree',type=int,default=16);p.add_argument('--seconds',type=int,default=60);p.add_argument('--repeats',type=int,default=2);p.add_argument('--workers',type=int,default=6);p.add_argument('--memory',default='26G');p.add_argument('--scratch',default='12228M');p.add_argument('--shared-cache',default='2G');p.add_argument('--run',action='store_true');p.add_argument('--stopped-native-job',action='store_true');p.add_argument('--case',choices=['ordering','arenas','commit','all'],default='ordering');p.add_argument('--order',choices=['legacy','overlap','sparse','word'],default='overlap');p.add_argument('--reserve',default='3584M');p.add_argument('--arenas',type=int,default=3);a=p.parse_args()
 if not 1<=a.seconds<=3600 or not 1<=a.repeats<=10 or not 1<=a.workers<=32:p.error('invalid bounded duration, repetition or worker count')
 job=a.job.resolve();out=a.out.resolve();engine=a.engine.resolve()
 if out==job or job in out.parents:p.error('output must be outside the source job')
 cp,cpfile=best(job)
 if a.degree<cp.get('currentDegree',cp['completedThroughDegree']):p.error('target below current degree')
 modes=[]
 if a.case in ['ordering','all']:modes+=[dict(name='order-'+x,order=x,reserve=a.reserve,arenas=a.arenas,commit='full') for x in ['legacy','overlap','sparse','word']]
 if a.case in ['arenas','all']:modes+=[dict(name='arena-3x3584',order=a.order,reserve='3584M',arenas=3,commit='full'),dict(name='arena-4x2560',order=a.order,reserve='2560M',arenas=4,commit='full')]
 if a.case in ['commit','all']:modes+=[dict(name='commit-'+x,order=a.order,reserve=a.reserve,arenas=a.arenas,commit=x) for x in ['full','delta']]
 saved=cp.get('pairPlanOrder') if cp.get('partial') else None;orderids={'legacy':0,'overlap':1,'sparse':2,'word':3}
 if saved is not None and any(orderids[m['order']]!=saved for m in modes):p.error('Current degree already has an active saved pair plan. Use matching --order/--case or an original pre-adoption checkpoint; changing the flag cannot honestly compare its current-degree order.')
 if cp['completedThroughDegree']>=a.degree:p.error('requested degree already completed')
 cmds=[]
 for m in modes:
  dest=out/(m['name']+'-0')
  cmd=[str(engine),'--resume',str(dest),'-d',str(a.degree),'-j',str(a.workers),'--memory',a.memory,'--scratch',a.scratch,'--row-reserve',m['reserve'],'--large-row-workspaces',str(m['arenas']),'--shared-cache',a.shared_cache,'--fk-gate','--pair-order',m['order'],'--plan-min-degree','12','--commit-reduction',m['commit'],'--time-limit',str(a.seconds),'--checkpoint-seconds','15','--progress-seconds','2']
  cmds.append(dict(mode=m,command=cmd))
 plan=dict(sourceJob=str(job),target=a.degree,completedSourceDegree=cp['completedThroughDegree'],sourceSequence=cp.get('sequence'),sourceResolved=cp.get('resolvedOverlaps',0),sourceSavedPlan=saved,repeats=a.repeats,dryRun=not a.run,modes=cmds,criterion='durable normal-word deficit decrease per outer/CPU second, not CPU occupancy alone; some modes can do expensive work without finding a leader in a short window',importsDimensionAuthority=True)
 if not a.run:print(json.dumps(plan,indent=2));return
 if not a.stopped_native_job:p.error('--run requires --stopped-native-job; live OPFS/browser snapshotting is unsupported')
 if not engine.is_file():p.error('build the patched native engine first')
 if out.exists():p.error('refusing to overwrite an earlier matrix; use a fresh --out')
 out.mkdir(parents=True);seed=out/'_seed'
 with read_lock(job):
  again,file2=best(job)
  if again!=cp:raise RuntimeError('Source changed before obtaining lock; retry after stopping it')
  before=prefix_hash(cpfile.parent/'basis.gnb',cp['diskBytes']);shutil.copytree(job,seed,copy_function=clonefile)
  assert best(job)[0]==cp
  assert prefix_hash(seed/'fomkyr'/cp['runKey']/'basis.gnb',cp['diskBytes'])==before
 plan['sourceBasisPrefixSHA256']=before;(out/'protocol.json').write_text(json.dumps(plan,indent=2));rows=[]
 for t in range(a.repeats):
  ms=cmds[t%len(cmds):]+cmds[:t%len(cmds)]
  for cfg in ms:
   m=cfg['mode'];dest=out/f"{m['name']}-{t}";shutil.copytree(seed,dest,copy_function=clonefile);cmd=list(cfg['command']);cmd[cmd.index('--resume')+1]=str(dest);cmd+=['--telemetry',str(dest/'telemetry.json')]
   t0=time.perf_counter();r0=os.times()
   with (dest/'session.stdout').open('w')as stdout,(dest/'session.stderr').open('w')as stderr:
    try:q=subprocess.run(cmd,stdout=stdout,stderr=stderr,timeout=a.seconds+90);rc=q.returncode
    except subprocess.TimeoutExpired:rc='watchdog'
   elapsed=time.perf_counter()-t0;r1=os.times();latest,_=best(dest);result=dest/'fomkyr'/latest['runKey']/'native-result.json';res=json.loads(result.read_text()) if result.exists() else {};h=latest.get('fkGate',{});upper=h.get('upper');lower=h.get('lower');deficit=int(upper)-int(lower) if upper is not None and lower is not None else None
   row=dict(mode=m,trial=t,exit=rc,outerSeconds=elapsed,childCPUSeconds=(r1.children_user+r1.children_system-r0.children_user-r0.children_system),complete=res.get('complete',False),completedThroughDegree=latest['completedThroughDegree'],durableResolved=latest.get('resolvedOverlaps',res.get('resolvedOverlaps')),newRules=latest['basisSize']-cp['basisSize'],dimensionGap=deficit,commit=res.get('commit'),rowMemoryPeaks=res.get('rowMemoryPeaks'),record=str(dest/'fomkyr'/latest['runKey']/'basis.gnb'))
   # Exact original prefix remains untouched in every successor. This is not a
   # fresh high-degree Groebner certificate, just a transactional integrity check.
   assert prefix_hash(Path(row['record']),cp['diskBytes'])==before;row['sourcePrefixPreserved']=True;rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2));print(json.dumps(row),flush=True)
 (out/'finished.json').write_text(json.dumps(dict(finished=True,runs=len(rows),fullTargetRequired=False,sourceJobUnmodified=True),indent=2))
if __name__=='__main__':main()
