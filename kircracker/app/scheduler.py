"""Memory-weighted independent block scheduler; no nested thread explosion."""
from __future__ import annotations
import contextlib,json,os,resource,signal,subprocess,sys,time
from pathlib import Path
from .util import ROOT,load,atomic_json,sha,json_hash,Incomplete,Invalid,Stopped
from .records import read_minor

def verifier_fingerprint():
 paths=['src/prefix_verify.cpp','app/records.py','app/native.py','app/worker.py']
 return json_hash({p:sha(ROOT/p) for p in paths})

def run_tasks(runner,tasks,kind):
 tasks=list(tasks);active={};done=[];errors=[];used=0;finger=verifier_fingerprint()
 # Account for retained Python arenas after candidate preparation instead of
 # pretending the coordinator is always a negligible fixed-size process.
 try:rss=int(Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
 except (OSError,ValueError,IndexError):rss=256*1024**2
 headroom=max(256*1024**2,rss+128*1024**2);budget=max(1,runner.memory-headroom)
 runner.event('block_memory_plan',coordinatorHeadroomMiB=headroom//1048576,workerBudgetMiB=budget//1048576)
 for t in tasks:t['fingerprint']=finger
 # Large jobs first, bounded both by total budget and process slots. Checkpoints
 # are complete and independently verified blocks, never partial matrix ranks.
 tasks.sort(key=lambda t:t['memoryBytes'],reverse=True)
 while tasks or active:
  if runner.stopping:
   for p in active:
    with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGTERM)
   limit=time.monotonic()+5
   while active and time.monotonic()<limit:
    for p in list(active):
     if p.poll() is not None:active.pop(p)
    time.sleep(.05)
   for p in active:
    with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGKILL)
   raise Stopped('interrupted; verified blocks retained')
  started=False
  if tasks and len(active)<runner.jobs:
   idx=next((i for i,t in enumerate(tasks) if t['memoryBytes']<=budget-used),None)
   if idx is None and not active:
    bad=tasks.pop(0);errors.append({'grade':bad.get('grade'),'error':'block estimate exceeds run budget','memoryEstimateBytes':bad['memoryBytes']});continue
   if idx is not None:
    t=tasks.pop(idx);out=Path(t['output']);out.parent.mkdir(parents=True,exist_ok=True);cached=False
    if out.exists():
     try:
      saved=load(out);mp=Path(t['minor']);cached=saved['passed'] and saved.get('verifierFingerprint')==finger and mp.exists() and saved['minorSHA256']==sha(mp)
      if kind=='discover':cached=cached and saved.get('taskBinding')==t['binding']
     except (KeyError,ValueError,OSError):cached=False
    if cached:
     done.append(saved);runner.event('block_reused',degree=t['degree'],rank=saved['rank'],grade=''.join(map(str,t.get('grade',[]))));continue
    tf=out.with_suffix('.task.json');atomic_json(tf,t);lf=out.with_suffix('.log').open('w');mem=t['memoryBytes']
    def limits(mem=mem):resource.setrlimit(resource.RLIMIT_AS,(mem,mem));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    env={**os.environ,'MALLOC_ARENA_MAX':'2','OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','PYTHONUNBUFFERED':'1'}
    p=subprocess.Popen([sys.executable,'-m','app.worker',kind,str(tf),str(out)],cwd=ROOT,env=env,stdout=lf,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
    runner.children.add(p);active[p]=(t,lf,time.monotonic(),None);used+=mem;started=True
    runner.event('block_started',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),rows=t.get('rows',t.get('rank')),reservedMiB=mem//1048576,activeWorkers=len(active))
  for p,(t,lf,start,term) in list(active.items()):
   wall=t.get('wallSeconds',0)
   if wall and time.monotonic()-start>wall:
    if term is None:
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGTERM)
     active[p]=(t,lf,start,time.monotonic())
    elif time.monotonic()-term>5:
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGKILL)
   if p.poll() is None:continue
   lf.close();used-=t['memoryBytes'];runner.children.discard(p);del active[p]
   if p.returncode:
    errors.append({'grade':t.get('grade'),'exit':p.returncode,'log':str(Path(t['output']).with_suffix('.log'))});runner.event('block_incomplete',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),exit=p.returncode)
   else:
    value=load(t['output'])
    if not value.get('passed'):raise Invalid('worker did not supply a checked result')
    done.append(value);runner.event('block_verified',degree=t['degree'],rank=value['rank'],deficit=value.get('candidateDeficit',0),remaining=len(tasks)+len(active))
  if not started:time.sleep(.1)
 return done,errors
