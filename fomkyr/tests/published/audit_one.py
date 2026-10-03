#!/usr/bin/env python3
"""Independent exact Python/Fraction Buchberger audit; no native engine or matcher.
Runs in a separate process under a parent timeout. JSON is atomically updated at
checkpoints so a timeout never looks like a completed certificate.
"""
from pathlib import Path
from fractions import Fraction
import argparse,heapq,json,time,sys,hashlib
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('name');ap.add_argument('--run');ap.add_argument('--run-dir',type=Path);ap.add_argument('--degree',type=int);ap.add_argument('--engine',type=Path,default=P/'work/fomkyr');ap.add_argument('--out',type=Path);a=ap.parse_args()
sys.path.insert(0,str(a.engine/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
# This parser only decodes the record format. Arithmetic and completion below
# are independent of both WASM and the engine's old Python completion oracle.
f=json.loads((P.parents[1]/'fixtures'/'published'/(a.name+'.json')).read_text());rd=a.run_dir.resolve() if a.run_dir else P/'runs'/(a.run or a.name)
checkpoints=[json.loads(p.read_text())['payload'] for p in rd.glob('storage/fomkyr/*/checkpoint-*.json')]
cp=max(checkpoints,key=lambda c:c['completedThroughDegree']);D=min(cp['completedThroughDegree'],a.degree or 10**6)
binpath=next(rd.glob('storage/fomkyr/*/basis.gnb'))
basis=list(records(binpath,D,len(f['variables'])))
rels=[{tuple(t['word']):Fraction(t['coefficient']) for t in r['terms']} for r in f['relations'] if r['degree']<=D]
out=a.out or P/'audits'/((a.run or a.name)+f'-d{D}.json');out.parent.mkdir(exist_ok=True)
t0=time.monotonic();info={'case':a.name,'run':a.run or a.name,'degree':D,'requestedRunDegree':json.loads((rd/'report.json').read_text()).get('requestedDegree',f['testDegree']) if (rd/'report.json').exists() else f['testDegree'],'engineCompletedThroughDegree':cp['completedThroughDegree'],'rules':len(basis),'status':'running','independentGroebnerCertificate':False,'engineInvoked':False,'arithmetic':'Python fractions.Fraction','stages':[]}
def save(stage,**kwargs):
 info['stages'].append({'stage':stage,'seconds':time.monotonic()-t0,**kwargs}); info['elapsedSeconds']=time.monotonic()-t0
 tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(info,indent=2)+'\n');tmp.replace(out)

def monic(row):
 if not row:return {}
 lm=max(row);c=row[lm];return {w:Fraction(v,c) for w,v in row.items() if v}

class Reducer:
 def __init__(self,gs):
  self.rules=[];self.cache={};self.steps=0
  for g in gs:
   if not g:continue
   lm=max(g); assert all(len(w)==len(lm) for w in g)
   lc=Fraction(g[lm]);self.rules.append((lm,tuple((w,Fraction(c)/lc) for w,c in g.items() if w!=lm)))
 def match(self,w):
  if w in self.cache:return self.cache[w]
  ans=None
  for u,tail in self.rules:
   for j in range(len(w)-len(u)+1):
    if w[j:j+len(u)]==u:ans=(w[:j],w[j+len(u):],tail);break
   if ans is not None:break
  if len(self.cache)<200000:self.cache[w]=ans
  return ans
 def nf(self,row):
  data={w:Fraction(c) for w,c in row.items() if c};heap=[(tuple(-a for a in w),w) for w in data];heapq.heapify(heap);res={}
  while heap:
   _,w=heapq.heappop(heap);c=data.pop(w,None)
   if c is None:continue
   rule=self.match(w)
   if rule is None:res[w]=c;continue
   left,right,tail=rule;self.steps+=1
   if self.steps>5000000:raise RuntimeError('independent reduction work limit, not a completed audit')
   for v,b in tail:
    ww=left+v+right;assert ww<w
    old=data.get(ww,0);val=old-c*b
    if val:
     data[ww]=val
     if not old:heapq.heappush(heap,(tuple(-a for a in ww),ww))
    else:data.pop(ww,None)
  return res

def sub(a,b):
 p=dict(a)
 for w,c in b.items():
  v=p.get(w,0)-c
  if v:p[w]=v
  else:p.pop(w,None)
 return p

def context(p,l=(),r=(),scale=1):return {l+w+r:scale*c for w,c in p.items()}
def compositions(gs,degree=None,bound=D,include=True):
 for f in gs:
  u=max(f)
  for g in gs:
   v=max(g)
   for k in range(1,min(len(u),len(v))):
    d=len(u)+len(v)-k
    if d<=bound and (degree is None or d==degree) and u[-k:]==v[:k]:
     yield sub(context(f,r=v[k:],scale=1/Fraction(f[u])),context(g,l=u[:-k],scale=1/Fraction(g[v])))
   if include:
    for j in range(len(u)-len(v)+1):
     if len(u)<=bound and (degree is None or len(u)==degree) and u[j:j+len(v)]==v:
      # Include even self-compositions; counted transparently, zero-cost checks.
      yield sub(context(f,scale=1/Fraction(f[u])),context(g,l=u[:j],r=u[j+len(v):],scale=1/Fraction(g[v])))

def hseries(gs,n,bound):
 # Simple prefix/suffix avoidance automaton, no reuse of C tables.
 leaders=set(map(max,gs));states={()}
 for w in leaders:
  for k in range(1,len(w)):states.add(w[:k])
 states=sorted(states);index={s:i for i,s in enumerate(states)};edges=[]
 for s in states:
  row=[]
  for c in range(n):
   w=s+(c,)
   if any(w[-len(v):]==v for v in leaders if len(v)<=len(w)):row.append(-1);continue
   while w not in index:w=w[1:]
   row.append(index[w])
  edges.append(row)
 counts=[0]*len(states);counts[index[()]]=1;hs=[1]
 for _ in range(bound):
  nxt=[0]*len(states)
  for i,c in enumerate(counts):
   if c:
    for j in edges[i]:
     if j>=0:nxt[j]+=c
  counts=nxt;hs.append(sum(counts))
 return hs

try:
 can,checks=canonicalize(basis)
 coeffbits=max((abs(c).bit_length() for row in basis for c in row.values()),default=0)
 info['canonicalSHA256']=canonical_digest(can,f['variables'],0,D)
 info['maxStoredIntegerCoefficientBits']=coeffbits
 hs=hseries(basis,len(f['variables']),D); info['computedHilbert']=list(map(str,hs))
 if f.get('expectedHilbert') is not None:
  expected=f['expectedHilbert'][:D+1];assert list(map(str,hs))==expected,'Published Hilbert series mismatch'
  info['publishedHilbertAgrees']=True
 else:info['publishedHilbertAgrees']=None
 rp=rd/'report.json'
 if rp.exists():
  rr=json.loads(rp.read_text()).get('result',{}).get('hilbert',{})
  if rr:
   exp=rr.get('coefficients'); assert exp is None or list(map(str,hs))==exp[:D+1],'WASM/Python Hilbert mismatch'
 save('record checks, normalization, independent Hilbert',**checks)
 reduced=Reducer(basis)
 for r in rels:assert not reduced.nf(r),'Input not in computed ideal'
 ct=0
 for comp in compositions(basis):
  assert not reduced.nf(comp),'Unresolved critical composition'
  ct+=1
 info['criticalCompositions']=ct;info['criticalChecksThroughDegree']=D
 save('all bounded overlap/inclusion compositions passed',compositions=ct,steps=reduced.steps)
 # Independently construct a basis exclusively from original input and criticals.
 gs=[];nr=Reducer(gs)
 def insert(row):
  global nr
  rem=nr.nf(row)
  if rem:gs.append(monic(rem));nr=Reducer(gs)
 for d in range(1,D+1):
  for r in rels:
   if len(next(iter(r)))==d:insert(r)
  old=list(gs)
  for comp in compositions(old,degree=d,bound=D,include=False):insert(comp)
  if d>=max(f['definingDegrees']):save('independent completion frontier',completedDegree=d,independentRules=len(gs))
 # Full equality, not just a leading-word or digest comparison.
 rg=Reducer(gs)
 for g in basis:assert not rg.nf(g),'Computed row is not in independent input ideal'
 for g in gs:assert not reduced.nf(g),'Independent row not in computed ideal'
 # Independently check oracle compositions too; mutual membership alone isn't GB proof.
 c2=0
 for c in compositions(gs):assert not rg.nf(c),'Independent incomplete basis';c2+=1
 info|={'status':'passed','independentGroebnerCertificate':True,'independentRules':len(gs),'independentCriticalCompositions':c2,'idealMembershipBothDirections':True}
 save('independent completion, both inclusions and compositions passed')
except Exception as e:
 info|={'status':'failed','error':repr(e)};save('failed');raise
print(json.dumps({k:info[k] for k in ('case','degree','status','independentGroebnerCertificate','elapsedSeconds')}))
