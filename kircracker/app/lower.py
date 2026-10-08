"""Candidate discovery and independently checked component lower bounds."""
from __future__ import annotations
from collections import defaultdict
import gc,json,os,struct,sys
from pathlib import Path
from .util import ROOT,load,sha,json_hash,atomic_json,Incomplete,Invalid
from .records import PERMS,INDEX,EDGES,EDGE,MASK,grade,inverse,conjugate,orbit,code,packed,unpacked,read_minor,state_words,state_info,check_minor
from .scheduler import run_tasks,verifier_fingerprint
MiB=1024**2

def seed_catalog(work,d):
 local=Path(work)/'lower'/f'd{d:02d}'/'catalog.json'
 bundled=ROOT/'data/minors'/f'd{d:02d}'/'catalog.json'
 if local.exists() and (not bundled.exists() or load(local)['rankLowerBound']>=load(bundled)['rankLowerBound']):return local
 if bundled.exists():return bundled
 raise Incomplete(f'degree-{d} lower witnesses missing; run that degree first')

def validate_catalog(path):
 path=Path(path);c=load(path);d=c['degree'];seen=set();total=0
 for b in c['blocks']:
  f=path.parent/b['file']
  if f.parent!=path.parent or sha(f)!=b['sha256']:raise Invalid('minor catalog hash/path')
  m,us,vs=read_minor(f)
  if m['degree']!=d or m['rank']!=b['rank']:raise Invalid('catalog rank/degree')
  g=check_minor(m,us,vs)
  if seen.intersection(g):raise Invalid('overlapping lower components')
  seen.update(g);total+=sum(g.values())
 if total!=c['rankLowerBound']:raise Invalid('catalog lower total')
 return c

def replay_catalog(runner,path,force=False):
 path=Path(path);c=validate_catalog(path);D=c['degree'];out=runner.work/'verified'/f'd{D:02d}';out.mkdir(parents=True,exist_ok=True);tasks=[]
 for i,b in enumerate(c['blocks']):
  p=path.parent/b['file'];m,_,_=read_minor(p);rank=m['rank'];dest=out/f'block-{i:02d}.json'
  if force:dest.unlink(missing_ok=True)
  # Verification holds one modular matrix, a narrow integer tile, and independent
  # polynomial/trie workspace. Resource overrun remains a failed/incomplete task.
  mem=max(256*MiB,rank*rank*8+192*MiB)
  tasks.append({'minor':str(p.resolve()),'sha256':b['sha256'],'degree':D,'rank':rank,'grade':m['grade'],'output':str(dest),'memoryBytes':mem,'threads':1})
 answers,errors=run_tasks(runner,tasks,'verify');grades={}
 for ans in answers:
  for g,n in ans['lowerGrades'].items():
   if g in grades:raise Invalid('duplicate verified lower grade')
   grades[g]=n
 result={'passed':not errors,'degree':D,'rankLowerBound':sum(grades.values()),'grades':grades,'checkedBlocks':len(answers),'requiredBlocks':len(tasks),'errors':errors,'catalog':str(path.resolve()),'catalogSHA256':sha(path),'fingerprint':verifier_fingerprint(),'entriesReplayed':sum(a.get('entriesReplayed',0) for a in answers)}
 atomic_json(out/'complete.json',result)
 if errors:raise Incomplete(f'degree-{D} lower replay incomplete; retry with more memory or fewer workers')
 if result['rankLowerBound']!=c['rankLowerBound']:raise Invalid('replayed rank mismatch')
 return result

def lower_prefix(runner,D,force=False):
 results=[]
 for d in range(D+1):
  p=seed_catalog(runner.work,d);out=runner.work/'verified'/f'd{d:02d}'/'complete.json'
  if not force and out.exists():
   x=load(out)
   if x.get('passed') and x.get('catalogSHA256')==sha(p) and x.get('fingerprint')==verifier_fingerprint():
    results.append(x);continue
  runner.event('lower_replay',degree=d)
  results.append(replay_catalog(runner,p,force=force))
 return results

def prepare_candidates(runner,D,mode='prepend'):
 if D<1 or D>22:raise Invalid('candidate degree must be 1..22')
 upper=runner.work/'upper/NICHOLS-only';state=upper/f'level-{D:03d}.krm';binding=load(upper/'binding.json')['binding'];info=state_info(state,binding)
 seed=seed_catalog(runner.work,D-1);catalog=validate_catalog(seed);out=runner.work/'candidates'/f'd{D:02d}';out.mkdir(parents=True,exist_ok=True)
 token=json_hash({'upperSHA256':sha(state),'seedSHA256':sha(seed),'degree':D,'dualMode':mode,'method':'one-generator-complementary-extension-v2-streamed'})
 old=out/'tasks.json'
 if old.exists():
  x=load(old)
  if x['binding']==token and all(sha(out/t['left'])==t['leftSHA256'] and sha(out/t['right'])==t['rightSHA256'] for t in x['tasks']):return x
 runner.event('candidate_words',degree=D,upperDimension=info['words'],message='Streaming representative upper words to disk')
 # Representative rows are written directly as fixed 16-byte words instead of
 # retained as Python byte objects.  At degrees 21/22 this removes a large and
 # unnecessary coordinator-memory multiplier.
 orbits={g:orbit(g) for g in PERMS};reps={min(orbits[g]) for g in PERMS};row_counts=defaultdict(int);buffers={};handles={};tmp_paths={}
 def emit(g,w):
  if g not in handles:
   key=''.join(map(str,g));tmp=out/(key+'.left.tmp');tmp.unlink(missing_ok=True);handles[g]=tmp.open('wb');tmp_paths[g]=tmp;buffers[g]=bytearray()
  v=code(w);buffers[g]+=struct.pack('<QQ',v&MASK,v>>64);row_counts[g]+=1
  if len(buffers[g])>=1<<20:handles[g].write(buffers[g]);buffers[g].clear()
 try:
  for w,_ in state_words(state,binding):
   u=bytes(EDGE[(a+1,6)] for a in reversed(w));g=grade(u)
   if g in reps:emit(g,u)
 finally:
  for g,h in handles.items():
   if buffers[g]:h.write(buffers[g])
   h.flush();os.fsync(h.fileno());h.close()
 left_files={}
 for g,tmp in tmp_paths.items():
  key=''.join(map(str,g));dest=out/(key+'.left');os.replace(tmp,dest);left_files[g]=dest
 duals={g:set() for g in row_counts};alphabet=[EDGE[e] for e in EDGES if e[1]<6 or e==(5,6)]
 for block in catalog['blocks']:
  meta,_,vs=read_minor(seed.parent/block['file']);basegrade=tuple(meta['grade'])
  for s0 in meta['transports']:
   s=tuple(s0);gi=conjugate(s,basegrade);translate=bytes([0]+[EDGE[tuple(sorted((s[a-1],s[b-1])))] for a,b in EDGES]+list(range(16,256)))
   allowed=[]
   for e in alphabet:
    a,b=EDGES[e-1];g=list(gi);g[a-1],g[b-1]=g[b-1],g[a-1]
    if tuple(g) in duals:allowed.append(('pre',e,tuple(g)))
    if mode=='both':
     g=tuple(b if x==a else a if x==b else x for x in gi)
     if g in duals:allowed.append(('post',e,g))
   if not allowed:continue
   for word in vs:
    w=word.translate(translate)
    for direction,e,g in allowed:
     if direction=='pre' and (not w or w[0]!=e):duals[g].add(bytes([e])+w)
     elif direction=='post' and (not w or w[-1]!=e):duals[g].add(w+bytes([e]))
  estimate=sum(len(v)*(96+D) for v in duals.values())
  if estimate>runner.memory//3:raise Incomplete('dual-candidate preparation exceeds its logical memory budget; raise --memory or use --dual-mode prepend')
  runner.event('candidate_seed_block',degree=D,grade=''.join(map(str,basegrade)),candidateDuals=sum(map(len,duals.values())))
 tasks=[]
 for g,nr in sorted(row_counts.items()):
  vs=sorted(duals[g]);key=''.join(map(str,g));l=left_files[g];r=out/(key+'.right');r.write_bytes(packed(vs));nv=len(vs)
  tasks.append({'degree':D,'prime':1000003,'grade':list(g),'transports':[list(v) for _,v in sorted(orbits[g].items())],'rows':nr,'duals':nv,'left':l.name,'right':r.name,'leftSHA256':sha(l),'rightSHA256':sha(r)})
  del duals[g]
 x={'degree':D,'binding':token,'mode':mode,'upperRelativeDimension':info['words'],'tasks':tasks,'streamedLeftRows':True};atomic_json(old,x);runner.event('candidates_ready',degree=D,blocks=len(tasks),representativeRows=sum(t['rows'] for t in tasks),candidateDuals=sum(t['duals'] for t in tasks));return x

def discover(runner,D,mode='prepend',seconds=0,only=None):
 c=prepare_candidates(runner,D,mode);candidate=runner.work/'candidates'/f'd{D:02d}';out=runner.work/'lower'/f'd{D:02d}';out.mkdir(parents=True,exist_ok=True);tasks=[]
 for t0 in c['tasks']:
  t=dict(t0);key=''.join(map(str,t['grade']));t.update({'left':str(candidate/t['left']),'right':str(candidate/t['right']),'minor':str(out/(key+'.kcb')),'output':str(out/(key+'.audit.json')),'seconds':seconds,'wallSeconds':(seconds+60) if seconds else 0})
  # Conservative admission estimate, and a genuine OS per-process address-space
  # ceiling. A larger actual requirement is reported as incomplete, never zero.
  t['memoryBytes']=max(384*MiB,8*t['rows']**2+128*t['duals']+320*MiB)
  t['binding']=json_hash({**t0,'candidateBinding':c['binding']})
  if not t['duals']:runner.event('no_dual_candidates',degree=D,grade=key);continue
  tasks.append(t)
 selected=tasks if only is None else [t for t in tasks if ''.join(map(str,t['grade']))==only]
 if only and not selected:raise Invalid('grade is not a nonempty representative at this degree')
 answers,errors=run_tasks(runner,selected,'discover');blocks=[];grades={}
 for t in tasks:
  p=Path(t['minor']);a=Path(t['output'])
  if not p.exists() or not a.exists():continue
  audit=load(a)
  if not audit.get('passed') or audit.get('verifierFingerprint')!=verifier_fingerprint() or sha(p)!=audit.get('minorSHA256'):continue
  m,us,vs=read_minor(p);part=check_minor(m,us,vs)
  if set(grades)&set(part):raise Invalid('discovery orbit overlap')
  grades.update(part);blocks.append({'file':p.name,'sha256':sha(p),'rank':m['rank'],'grade':m['grade'],'coveredGrades':len(part),'contribution':sum(part.values())})
 catalog={'degree':D,'prime':1000003,'blocks':blocks,'rankLowerBound':sum(grades.values()),'candidateUpper':c['upperRelativeDimension'],'errors':errors,'candidateBinding':c['binding'],'storedMatrices':False,'exactDimensionClaim':False,'completeCandidateCoverage':len(blocks)==len(tasks)}
 atomic_json(out/'catalog.json',catalog)
 if errors:raise Incomplete(f'degree-{D} discovery left {len(errors)} unfinished blocks; verified blocks retained')
 # The discovery process has already used the independent verifier; bind these
 # audits into the same aggregate format consumed by the assembly.
 aggregate={'passed':True,'degree':D,'rankLowerBound':sum(grades.values()),'candidateUpper':c['upperRelativeDimension'],'grades':{str(g):n for g,n in grades.items()},'checkedBlocks':len(blocks),'requiredBlocks':len(tasks),'catalog':str(out/'catalog.json'),'catalogSHA256':sha(out/'catalog.json'),'fingerprint':verifier_fingerprint(),'entriesReplayed':sum(x.get('entriesReplayed',0) for x in answers),'errors':[]}
 atomic_json(runner.work/'verified'/f'd{D:02d}'/'complete.json',aggregate);return aggregate


def discover_auto(runner,D,seconds=0,only=None):
 """Cheap family first; broaden only if the verified total still misses the upper model."""
 first=discover(runner,D,'prepend',seconds,only=only)
 if only is not None or first.get('rankLowerBound',0)>=first.get('candidateUpper',1):return first
 runner.event('candidate_escalation',degree=D,lower=first['rankLowerBound'],upper=first['candidateUpper'],message='Prepend family left a gap; retrying with both-sided extensions')
 return discover(runner,D,'both',seconds,only=None)
