"""Memory-weighted independent block scheduler; no nested thread explosion."""
from __future__ import annotations
import contextlib,json,os,resource,signal,subprocess,sys,time
from pathlib import Path
from .util import ROOT,load,atomic_json,sha,json_hash,memory_state,cgroup_dir,Incomplete,Invalid,Stopped
from .records import read_minor
from .native import library_paths

# A block yielded for host memory pressure is retried with exponential backoff,
# and stops being chosen for yields after this many attempts.
MAX_MEMORY_YIELDS=3

def verifier_fingerprint():
 paths=['src/prefix_verify.cpp','src/polynomial_workspace.hpp','src/modular_determinant.hpp','src/verified_lu.hpp','src/verified_lu.inc','src/pairing_limits.hpp','app/limits.py','app/records.py','app/native.py','app/worker.py','app/verified_cache.py']
 return json_hash({**{p:sha(ROOT/p)for p in paths},'verifierLibrarySHA256':sha(library_paths()[1])})

def audit_memory(task,rank):
 minor=Path(task['minor'])
 if minor.exists():
  retained,_,_=read_minor(minor)
  if retained['degree']==task['degree']and retained['grade']==task['grade']:rank=max(rank,retained['rank'])
 task['_auditRank']=rank
 return max(1024**3,4*rank*rank+4*1024**3)

def audit_reservation(task,rank,pid=None):
 # Admission and the process hard limit serve different purposes. Reserve the
 # dense matrix plus workspaces, and increase this from measured high water.
 allowance=int(os.environ.get('KIR_VERIFY_WORKSPACE_BYTES',str(1536*1024**2)))
 if allowance<256*1024**2:raise Invalid('verification workspace reservation below 256 MiB')
 predicted=4*rank*rank+allowance
 if pid:
  try:
   status=Path(f'/proc/{pid}/status').read_text().splitlines()
   peak=max(int(x.split()[1])*1024 for x in status if x.startswith(('VmRSS:','VmHWM:')))
   predicted=max(predicted,peak+512*1024**2)
  except (OSError,ValueError):pass
 return max(predicted,task.get('_reservationFloor',0))

def reservation(task,pid=None):
 if task['_workerKind']=='verify-pending':
  return audit_reservation(task,task['_auditRank'],pid)
 return task['memoryBytes']

def discovery_complete(receipt):
 # An accepted lower minor alone says nothing about unscanned candidates.
 return receipt.get('candidateColumnsExhausted')is True or receipt.get('fullCandidateRank')is True

def candidate_complete(task,candidate):
 # A discovery receipt before audit: every column scanned, or the rows are spent.
 return candidate.get('candidateColumnsExhausted')is True or candidate.get('candidateRank',candidate.get('rank'))==task['rows']

def retain_verified_minor(task,candidate,fingerprint):
 """A scan with no rank gain does not require replaying the same witness."""
 out,minor=Path(task['output']),Path(task['minor'])
 if not out.is_file()or not minor.is_file():return None
 old=load(out)
 if not old.get('passed')or old.get('verifierFingerprint')!=fingerprint or old.get('rank',0)<candidate['candidateRank']or old.get('minorSHA256')!=sha(minor):return None
 metadata,_,_=read_minor(minor)
 if metadata['degree']!=task['degree']or metadata['grade']!=task['grade']or metadata['prime']!=task['prime']or metadata['rank']!=old['rank']:return None
 saved={**old,'taskBinding':task['binding'],'candidateRows':task['rows'],'candidateColumns':task['duals'],'candidateDeficit':max(0,task['rows']-old['rank']),'fullCandidateRank':old['rank']>=task['rows'],'acceptedAuditReused':True,'additionalEntriesReplayed':0,'nextColumn':candidate['nextColumn'],'candidateColumnsExhausted':candidate['candidateColumnsExhausted']}
 atomic_json(out,saved)
 return saved

def run_tasks(runner,tasks,kind):
 tasks=list(tasks);active={};done=[];errors=[];used=0;finger=verifier_fingerprint();yields={}
 templates={str(t['output']):dict(t)for t in tasks}
 if len(templates)!=len(tasks):raise Invalid('Duplicate block outputs in scheduler')
 # Account for retained Python arenas after candidate preparation instead of
 # pretending the coordinator is always a negligible fixed-size process.
 try:rss=int(Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
 except (OSError,ValueError,IndexError):rss=256*1024**2
 headroom=max(256*1024**2,rss+128*1024**2);budget=max(1,runner.memory-headroom)
 # Yield only when the host falls well inside the slack left outside the worker
 # budget; a fixed threshold fires on small hosts as soon as the budget fills.
 cgroup=cgroup_dir();_,available=memory_state(cgroup)
 yield_floor=min(2*1024**3,max(256*1024**2,(available-budget)//2))
 runner.event('block_memory_plan',coordinatorHeadroomMiB=headroom//1048576,workerBudgetMiB=budget//1048576,memoryYieldFloorMiB=yield_floor//1048576)
 library=sha(library_paths()[0])if kind=='discover'else None
 for t in tasks:
  t['fingerprint']=finger;t['_workerKind']=kind
  if kind=='discover':
   t['stateBinding']=json_hash({k:t[k]for k in ['degree','rows','duals','prime','leftSHA256','rightSHA256']}|{'librarySHA256':library})
   t.setdefault('state',str(Path(t['output']).with_suffix('.'+t['stateBinding'][:16]+'.pair.state')))
   t.setdefault('checkpointBytes',getattr(runner,'scratch',48*1024**3)//max(1,len(tasks)))
   state=Path(t['state'])
   if not state.exists():
    # Journals are bound to the pairing library; a rebuild starts a new one.
    others=sorted(str(p)for p in state.parent.glob(Path(t['output']).stem+'.*.pair.state')if p!=state)
    if others:runner.event('discovery_journal_unbound',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),journals=others,message='Existing journals are bound to another pairing library or candidate family; this block starts at column 0. If the candidate words are unchanged, migrate one with tools/import_pair_state.py first.')
   pending=Path(t['output']).with_suffix('.discovery.json')
   if pending.exists():
    candidate=load(pending);accepted=load(t['output'])if Path(t['output']).exists()else{}
    valid=candidate.get('pendingVerification')and candidate.get('taskBinding')==t['binding']and Path(candidate.get('pending','')).is_file()
    accepted_current=(accepted.get('passed')is True and accepted.get('taskBinding')==t['binding']and accepted.get('verifierFingerprint')==finger and Path(t['minor']).is_file()and sha(Path(t['minor']))==accepted.get('minorSHA256'))
    if valid and sha(candidate['pending'])==candidate.get('pendingSHA256')and(candidate['candidateRank']>accepted.get('rank',0)or not accepted_current):
     t.update(_workerKind='verify-pending',pending=candidate['pending'],pendingSHA256=candidate['pendingSHA256'],memoryBytes=audit_memory(t,candidate['candidateRank']),threads=1,wallSeconds=0)
     # An interrupted scan left this candidate; without a deadline, continue it.
     if not t.get('seconds'):t['_resumeDiscovery']=True

 if kind=='discover':
  roots=set((runner.work/'lower').rglob('*.pair.state.parts'))if(runner.work/'lower').exists()else set()
  roots.update(Path(t['state']+'.parts')for t in tasks)
  usage={path:sum(f.stat().st_size for f in path.iterdir()if f.is_file()and not f.is_symlink())if path.exists()else 0 for path in roots}
  disk_limit=getattr(runner,'scratch',48*1024**3);remaining=max(0,disk_limit-sum(usage.values()))
  cache_reserve=0
  if os.environ.get('KIR_VERIFY_ENTRY_CACHE','0')=='1':
   from .verified_cache import DEFAULT_CACHE_BYTES
   cap=min(int(os.environ.get('KIR_VERIFY_CACHE_BYTES',str(DEFAULT_CACHE_BYTES))),max(0,remaining-512*1024**2)//max(1,2*len(tasks)))
   if cap<0:raise Invalid('negative verification cache allowance')
   for t in tasks:t['verificationCacheBytes']=cap
   cache_reserve=2*len(tasks)*cap
  share=max(0,remaining-cache_reserve)//max(1,len(tasks))
  for t in tasks:t['checkpointBytes']=max(1,min(t['checkpointBytes'],usage[Path(t['state']+'.parts')]+share))
  runner.event('checkpoint_disk_plan',retainedMiB=sum(usage.values())//1048576,limitMiB=disk_limit//1048576,remainingMiB=remaining//1048576,verificationCacheReserveMiB=cache_reserve//1048576)
 # Preserve the original discovery allowance when an audit is requeued.
 for t in tasks:
  template=templates[str(t['output'])]
  template.update(fingerprint=finger,_workerKind=kind)
  for name in ['state','stateBinding','checkpointBytes','verificationCacheBytes']:
   if name in t:template[name]=t[name]
 def requeue_discovery(t,delay=0,**data):
  again=dict(templates[str(t['output'])])
  if delay:again['_notBefore']=time.monotonic()+delay
  tasks.append(again);runner.event('discovery_requeued',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),delaySeconds=delay,**data)
 def finish(t,value,kind_event,**data):
  done.append(value);runner.event(kind_event,degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),**data)
  if kind!='discover'or discovery_complete(value):return
  # A verified partial scan is a valid lower minor but not a finished block.
  if t.get('_resumeDiscovery')and not runner.stopping:
   requeue_discovery(t,reason='audited an interrupted scan; resuming its journal',nextColumn=value.get('nextColumn'));return
  errors.append({'grade':t.get('grade'),'phase':'discover','error':'candidate columns not exhausted','rank':value.get('rank',0),'nextColumn':value.get('nextColumn')})
  runner.event('block_incomplete',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),rank=value.get('rank',0),nextColumn=value.get('nextColumn'),reason='scan stopped before the candidate columns were exhausted; verified minor retained')
 # Large jobs first, bounded both by total budget and process slots. Checkpoints
 # are complete and independently verified blocks, never partial matrix ranks.
 tasks.sort(key=reservation,reverse=True)
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
  for process,(task,_,_,_) in active.items():
   before=task.get('_reservedBytes',task['memoryBytes'])
   now=max(before,reservation(task,process.pid))
   task['_reservedBytes']=now;used+=now-before
  _,available=memory_state(cgroup)
  # Yielding the only worker cannot relieve pressure from outside this run.
  if available<yield_floor and len(active)>1 and not any(t.get('_memoryYield')for t,_,_,_ in active.values()):
   for process,(task,_,_,_) in reversed(list(active.items())):
    if task['_workerKind']=='discover'and yields.get(str(task['output']),0)<MAX_MEMORY_YIELDS:
     task['_memoryYield']=True;yields[str(task['output'])]=yields.get(str(task['output']),0)+1
     with contextlib.suppress(ProcessLookupError):os.killpg(process.pid,signal.SIGTERM)
     runner.event('discovery_memory_yield',grade=''.join(map(str,task.get('grade',[]))),availableMiB=available//1048576,floorMiB=yield_floor//1048576,attempt=yields[str(task['output'])])
     break
  if tasks and len(active)<runner.jobs:
   clock=time.monotonic();ready=[i for i,t in enumerate(tasks)if t.get('_notBefore',0)<=clock]
   # Admission also respects real host memory, so a yielded block is not
   # restarted into the pressure that stopped it. An idle run always admits.
   idx=next((i for i in ready if reservation(tasks[i])<=budget-used and(not active or available-reservation(tasks[i])>=yield_floor)),None)
   if idx is None and not active and ready:
    bad=tasks.pop(ready[0]);errors.append({'grade':bad.get('grade'),'error':'block estimate exceeds run budget','memoryEstimateBytes':bad['memoryBytes']});continue
   if idx is not None:
    t=tasks.pop(idx);out=Path(t['output']);out.parent.mkdir(parents=True,exist_ok=True);cached=False
    if out.exists():
     try:
      saved=load(out);mp=Path(t['minor']);cached=saved['passed'] and saved.get('verifierFingerprint')==finger and mp.exists() and saved['minorSHA256']==sha(mp)
      if t['_workerKind']=='discover':cached=cached and saved.get('taskBinding')==t['binding']and discovery_complete(saved)
      if t['_workerKind']=='verify-pending':cached=False
     except (KeyError,ValueError,OSError):cached=False
    if cached:
     finish(t,saved,'block_reused',rank=saved['rank']);continue
    tf=out.with_suffix('.'+t['_workerKind']+'.task.json');atomic_json(tf,t);lf=out.with_suffix('.'+t['_workerKind']+'.log').open('w');mem=t['memoryBytes']
    def limits(mem=mem):resource.setrlimit(resource.RLIMIT_AS,(mem,mem));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    env={**os.environ,'MALLOC_ARENA_MAX':'2','OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','PYTHONUNBUFFERED':'1'}
    if 'verificationCacheBytes'in t:
     env['KIR_VERIFY_ENTRY_CACHE']='1'
     env['KIR_VERIFY_CACHE_BYTES']=str(t['verificationCacheBytes'])
    p=subprocess.Popen([sys.executable,'-m','app.worker',t['_workerKind'],str(tf),str(out)],cwd=ROOT,env=env,stdout=lf,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
    t['_reservedBytes']=reservation(t)
    runner.children.add(p);active[p]=(t,lf,time.monotonic(),None);used+=t['_reservedBytes'];started=True
    runner.event('block_started',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),rows=t.get('rows',t.get('rank')),reservedMiB=t['_reservedBytes']//1048576,hardLimitMiB=mem//1048576,activeWorkers=len(active),verifiedLUCache=env.get('KIR_VERIFY_ENTRY_CACHE')=='1')
  for p,(t,lf,start,term) in list(active.items()):
   wall=t.get('wallSeconds',0)
   if wall and time.monotonic()-start>wall:
    if term is None:
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGTERM)
     active[p]=(t,lf,start,time.monotonic())
    elif time.monotonic()-term>5:
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGKILL)
   if p.poll() is None:continue
   lf.close();used-=t.get('_reservedBytes',t['memoryBytes']);runner.children.discard(p);del active[p]
   discovery=Path(t['output']).with_suffix('.discovery.json')
   value=None
   if not p.returncode:value=load(discovery if t['_workerKind']=='discover'and discovery.exists()else t['output'])
   if t.get('_memoryYield')and t['_workerKind']=='discover'and(p.returncode or not candidate_complete(t,value)):
    # The native scan saved its journal on SIGTERM; resume it later instead of
    # auditing a partial candidate while memory is short.
    requeue_discovery(t,delay=min(600,30*2**(yields[str(t['output'])]-1)),reason='memory yield; resuming from the saved journal');continue
   if p.returncode:
    logfile=Path(t['output']).with_suffix('.'+t['_workerKind']+'.log')
    tail=logfile.read_text(errors='replace')[-8192:]if logfile.exists()else''
    if t['_workerKind']=='verify-pending'and t['memoryBytes']<budget and any(x in tail for x in ['bad_alloc','memory allocation']):
     t['_reservationFloor']=t['memoryBytes']+256*1024**2;t.pop('_reservedBytes',None)
     t['memoryBytes']=min(budget,max(t['memoryBytes']+1024**3,t['memoryBytes']*3//2));tasks.append(t);runner.event('audit_memory_retry',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),reservedMiB=reservation(t)//1048576);continue
    errors.append({'grade':t.get('grade'),'exit':p.returncode,'phase':t['_workerKind'],'log':str(logfile)});runner.event('block_incomplete',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),exit=p.returncode)
   else:
    if value.get('pendingVerification'):
     retained=retain_verified_minor(t,value,finger)
     if retained is not None:
      finish(t,retained,'block_verified_minor_retained',rank=retained['rank'],nextColumn=value['nextColumn'],additionalEntriesReplayed=0);continue
     rank=value['candidateRank'];audit={**t,'_workerKind':'verify-pending','_auditRank':rank,'pending':value['pending'],'pendingSHA256':value['pendingSHA256'],'memoryBytes':audit_memory(t,rank),'threads':1,'wallSeconds':0}
     audit['_auditRank']=t['_auditRank']
     audit['fingerprint']=finger
     audit.pop('_reservedBytes',None);audit.pop('_memoryYield',None)
     tasks.append(audit);runner.event('block_awaiting_audit',degree=t['degree'],grade=''.join(map(str,t.get('grade',[]))),candidateRank=rank,verified=False,reservedMiB=audit['memoryBytes']//1048576);continue
    if not value.get('passed'):raise Invalid('worker did not supply a checked result')
    finish(t,value,'block_verified',rank=value['rank'],deficit=value.get('candidateDeficit',0),remaining=len(tasks)+len(active))
  if not started:time.sleep(.1)
 return done,errors
