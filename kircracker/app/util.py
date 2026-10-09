"""POSIX runner utilities. No silent recovery from an invalid proof/cache."""
from __future__ import annotations
import argparse,contextlib,fcntl,hashlib,json,os,re,resource,signal,subprocess,sys,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Incomplete(RuntimeError):pass
class Invalid(RuntimeError):pass
class Stopped(RuntimeError):pass

def sha(path:Path)->str:
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for x in iter(lambda:f.read(1<<20),b''):h.update(x)
 return h.hexdigest()
# Large inherited inputs stay out of git: the proof archive is a release asset,
# and these data files are extracted or derived from it byte for byte on first use.
PROOF_ARCHIVE='frontier-0.5.0.zip'
DERIVED={
 'base-through13.json':('kircracker-frontier/certificates/base-through13.json','973681645854498141e517a38952f030567a3ac2b8edfaaa73668720a5b2d42c'),
 'degree14-radical.json':('kircracker-frontier/certificates/nichols/degree14-radical.json','f223e6cb550d6ac25f140ca608e7c918778297ae631c9026f7ba8783633cd7bc'),
 'star14-leading-words.json':(None,'bbf2c7fa05cd7d56abb5812313745fefa45cf639fcc3f19693f24f633eb4c5a5'),
}
_archive_checked=None
def proof_archive()->Path:
 global _archive_checked
 p=Path(os.environ.get('KIRCRACKER_PROOF_ARCHIVE') or ROOT/'proof'/PROOF_ARCHIVE)
 expected=json.loads((ROOT/'proof/CONTENTS.json').read_text())['archiveSha256']
 if not p.is_file():
  raise Invalid(f'proof archive not found: {p}. It is not stored in git; download {PROOF_ARCHIVE} (sha256 {expected}) '
                'from the George release assets and place it there, or set KIRCRACKER_PROOF_ARCHIVE.')
 if _archive_checked!=p:
  if sha(p)!=expected:raise Invalid(f'proof archive {p} does not match its recorded sha256 {expected}')
  _archive_checked=p
 return p
def data_path(name:str)->Path:
 p=ROOT/'data'/name
 if name not in DERIVED or p.exists():return p
 import zipfile
 member,digest=DERIVED[name];archive=proof_archive();part=p.with_name(p.name+'.part')
 with zipfile.ZipFile(archive) as z:
  if member:part.write_bytes(z.read(member))
  else:
   if str(ROOT/'tools') not in sys.path:sys.path.insert(0,str(ROOT/'tools'))
   from derive_star14_index import MEMBER,index
   part.write_text(json.dumps(index(z.read(MEMBER)),indent=2)+'\n')
 if sha(part)!=digest:
  part.unlink();raise Invalid(f'{name} prepared from {archive} does not match its recorded sha256 {digest}')
 part.replace(p);return p
def json_hash(value)->str:return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def load(p):return json.loads(Path(p).read_text())
def atomic_json(p,value):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(prefix='.'+p.name+'.',dir=p.parent)
 try:
  with os.fdopen(fd,'w') as f:json.dump(value,f,indent=2,sort_keys=True);f.write('\n');f.flush();os.fsync(f.fileno())
  os.replace(tmp,p);d=os.open(p.parent,os.O_RDONLY);os.fsync(d);os.close(d)
 except BaseException:
  with contextlib.suppress(OSError):os.unlink(tmp)
  raise

def bytes_arg(s):
 if s=='auto':return 0
 m=re.fullmatch(r'([0-9]+(?:\.[0-9]+)?)([KMGT]i?B?|B)?',s,re.I)
 if not m:raise argparse.ArgumentTypeError('use auto, 24GiB, 24G, or a positive byte count')
 n=float(m[1]);suffix=(m[2] or 'B').upper();power={'B':0,'K':1,'M':2,'G':3,'T':4}[suffix[0]];v=int(n*(1024**power))
 if v<256*1024**2:raise argparse.ArgumentTypeError('budget must be at least 256 MiB')
 return v

def hardware():
 import math
 cpus=sorted(os.sched_getaffinity(0)) if hasattr(os,'sched_getaffinity') else list(range(os.cpu_count() or 1));physical=set()
 for c in cpus:
  p=Path(f'/sys/devices/system/cpu/cpu{c}/topology')
  try:physical.add(((p/'physical_package_id').read_text().strip(),(p/'core_id').read_text().strip()))
  except OSError:pass
 cpu_quota=len(cpus);cgroup=Path('/sys/fs/cgroup')
 try:
  membership=next(l.split(':',2)[2] for l in Path('/proc/self/cgroup').read_text().splitlines() if l.startswith('0::'))
  candidate=cgroup/membership.lstrip('/')
  if (candidate/'cpu.max').exists() or (candidate/'memory.max').exists():cgroup=candidate
 except (OSError,StopIteration):pass
 try:
  q,period=(cgroup/'cpu.max').read_text().split()
  if q!='max':cpu_quota=min(cpu_quota,max(1,math.ceil(int(q)/int(period))))
 except (OSError,ValueError):pass
 memory={}
 try:
  for l in Path('/proc/meminfo').read_text().splitlines():
   key,value=l.split(':',1);memory[key]=int(value.split()[0])*1024
 except (OSError,ValueError):pass
 total=memory.get('MemTotal',os.sysconf('SC_PHYS_PAGES')*os.sysconf('SC_PAGE_SIZE'));available=memory.get('MemAvailable',total)
 try:
  lim=(cgroup/'memory.max').read_text().strip()
  if lim!='max':
   lim=int(lim);used=int((cgroup/'memory.current').read_text());total=min(total,lim);available=min(available,max(0,lim-used))
 except (OSError,ValueError):pass
 # Shared hosts/containers: respect their available memory and CPU ceilings.
 auto_mem=int(min(total*.75,available*.85));auto_jobs=cpu_quota if cpu_quota<len(cpus) else max(1,len(cpus)-1)
 model='unknown'
 try:
  model=next(l.split(':',1)[1].strip() for l in Path('/proc/cpuinfo').read_text().splitlines() if l.startswith('model name'))
 except (OSError,StopIteration):pass
 return {'cpu':model,'affinityLogicalCPUs':len(cpus),'physicalCores':len(physical) or None,'effectiveCPUQuota':cpu_quota,'effectiveMemoryBytes':total,'currentlyAvailableBytes':available,'recommendedJobs':min(32,auto_jobs),'recommendedMemoryBytes':auto_mem}

def resolve_resources(memory,jobs):
 h=hardware();m=memory or h['recommendedMemoryBytes'];j=h['recommendedJobs'] if jobs=='auto' else int(jobs)
 if not 1<=j<=128:raise Invalid('jobs must be in 1..128')
 if m<256*1024**2:raise Incomplete('insufficient available memory; free some RAM')
 if m>h['effectiveMemoryBytes']*.92:raise Invalid('requested memory exceeds 92% of detected physical/cgroup memory; this guard prevents swapping/OOM by default')
 return m,j,h

@contextlib.contextmanager
def workspace_lock(work):
 work=Path(work);work.mkdir(parents=True,exist_ok=True);f=(work/'lock').open('a+')
 try:fcntl.flock(f.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:f.close();raise Invalid('workspace is active in another process')
 f.seek(0);f.truncate();f.write(str(os.getpid())+'\n');f.flush()
 try:yield
 finally:fcntl.flock(f.fileno(),fcntl.LOCK_UN);f.close()

class Runner:
 def __init__(self,work,memory,jobs,quiet=False,json_events=False):
  self.work=Path(work).resolve();self.memory=memory;self.jobs=jobs;self.quiet=quiet;self.json_events=json_events;self.children=set();self.start=time.monotonic();self.stopping=False;self.last_event=0
 def event(self,kind,**data):
  event={'type':kind,'elapsedSeconds':round(time.monotonic()-self.start,3),**data}
  self.work.mkdir(parents=True,exist_ok=True)
  with (self.work/'events.jsonl').open('a') as f:f.write(json.dumps(event,separators=(',',':'))+'\n')
  atomic_json(self.work/'status.json',event)
  if not self.quiet:
   if self.json_events:print(json.dumps(event,separators=(',',':')),file=sys.stderr,flush=True)
   else:
    msg=data.get('message',kind.replace('_',' '));details=' '.join(f'{k}={v}' for k,v in data.items() if k not in ['message','profile'] and not isinstance(v,(dict,list)))
    print(f'[{event["elapsedSeconds"]:8.1f}s] {msg}'+('  '+details if details else ''),file=sys.stderr,flush=True)
 def stop(self,*_):
  self.stopping=True
  for p in list(self.children):
   with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGTERM)
 def run(self,cmd,log,memory=None,seconds=0,cwd=None,parser=None):
  if self.stopping:raise Stopped('interrupted')
  memory=memory or self.memory;log=Path(log);log.parent.mkdir(parents=True,exist_ok=True)
  def limits():
   resource.setrlimit(resource.RLIMIT_AS,(memory,memory));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
  env={**os.environ,'MALLOC_ARENA_MAX':'2','OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','PYTHONUNBUFFERED':'1'}
  t=time.monotonic();last=None;tmpout=[]
  p=subprocess.Popen(list(map(str,cmd)),cwd=cwd or ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,start_new_session=True,preexec_fn=limits)
  self.children.add(p)
  # selectors avoid a blocking readline that would hide a user interrupt.
  import selectors
  sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);buffer='';timed=False;term_at=None
  with log.open('w') as f:
   while True:
    if (self.stopping or seconds and time.monotonic()-t>seconds) and term_at is None:
     term_at=time.monotonic();timed=not self.stopping
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGTERM)
    if term_at and time.monotonic()-term_at>10:
     with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGKILL)
    for key,_ in sel.select(.25):
     chunk=os.read(key.fd,65536).decode('utf-8','replace')
     if not chunk:sel.unregister(key.fileobj);continue
     buffer+=chunk
     while '\n' in buffer:
      line,buffer=buffer.split('\n',1);f.write(line+'\n');f.flush()
      try:obj=json.loads(line)
      except ValueError:continue
      last=obj
      if parser:parser(obj)
    if p.poll() is not None and not sel.get_map():break
   if buffer:f.write(buffer)
  self.children.discard(p);p.stdout.close();sel.close()
  if self.stopping:raise Stopped('interrupted; committed work retained')
  if timed:raise Incomplete('time limit; committed work retained')
  if p.returncode:raise Incomplete(f'child exit {p.returncode}; inspect {log}')
  return last,time.monotonic()-t
