"""Exact original/Nichols namespace separation and component interval assembly."""
from __future__ import annotations
from collections import Counter
import ctypes as C,sys,time,zipfile
from pathlib import Path
from .util import ROOT,sha,load,json_hash,atomic_json,Invalid,Incomplete,data_path,proof_archive
from .records import PERMS,INDEX,compose
sys.path.insert(0,str(ROOT/'reference'))
from finitefk.finite_model import FiniteStar

def cycle(g):
 seen=set();parts=[]
 for i in range(1,7):
  if i in seen:continue
  j=i;n=0
  while j not in seen:seen.add(j);n+=1;j=g[j-1]
  parts.append(n)
 return tuple(sorted(parts,reverse=True))
CLASSES=sorted(set(map(cycle,PERMS)));CLASS=[CLASSES.index(cycle(g)) for g in PERMS];SIZES=[CLASS.count(i) for i in range(11)]
TABLE=None

def conv(A,B,D,jobs):
 global TABLE
 if TABLE is None:TABLE=(C.c_uint16*(720*720))(*(INDEX[compose(p,q)] for p in PERMS for q in PERMS))
 lib=C.CDLL(str(ROOT/'bin/libconvolve.so'));fn=lib.kc_convolve;fn.argtypes=[C.POINTER(C.c_uint64)]*3+[C.c_int,C.POINTER(C.c_uint16),C.c_int];fn.restype=C.c_int
 vals=[]
 for matrix in [A,B]:
  flat=[0]*((D+1)*720)
  for d,row in enumerate(matrix[:D+1]):
   for g,x in row.items():
    if type(x)is not int or x<0 or x>2**64-1:raise Invalid('counter overflow or invalid dimension')
    flat[d*720+int(g)]=x
  vals.append((C.c_uint64*len(flat))(*flat))
 out=(C.c_uint64*((D+1)*720))();rc=fn(vals[0],vals[1],out,D,TABLE,min(32,jobs))
 if rc:raise Invalid(f'group convolution failed/overflow ({rc})')
 return [{g:int(out[d*720+g]) for g in range(720) if out[d*720+g]} for d in range(D+1)]

def factors(runner,D):
 p=runner.work/'proof/factors.json';finger=json_hash({str(f.relative_to(ROOT)):sha(f) for f in (ROOT/'reference/finitefk').glob('*.py')})
 if p.exists():
  old=load(p)
  if old.get('fingerprint')==finger and old['throughDegree']>=D:return [[{int(k):v for k,v in row.items()} for row in old[name][:D+1]] for name in ['H','E5']]
 runner.event('finite_factors',message='Rebuilding known finite factors independently')
 def gr(w):
  p=list(range(1,7))
  for a,b in w:p[a-1],p[b-1]=p[b-1],p[a-1]
  return INDEX[tuple(p)]
 series={};checks={};models={}
 for k in range(1,5):
  m=FiniteStar(k,max_degree=D,independent=True);models[k]=m;checks[k]=m.audit;series[k]=[dict(Counter(gr(w) for w in lev)) for lev in m.basis];series[k]+=[{}]*(D+1-len(series[k]))
 E=[{0:1}]+[{} for _ in range(D)]
 for k in range(1,5):E=conv(series[k],E,D,runner.jobs)
 H=[dict(Counter(gr(tuple((a,6 if b==5 else b) for a,b in w)) for w in lev)) for lev in models[4].basis];H+=[{}]*(D+1-len(H))
 atomic_json(p,{'fingerprint':finger,'throughDegree':D,'H':H,'E5':E,'checks':checks,'knownFiniteDimensionTheoremsUsed':True})
 return H,E

def proof_base(runner,force=False):
 proof=runner.work/'proof';proof.mkdir(exist_ok=True);legacy=proof/'legacy';key=json_hash({'archive':sha(proof_archive()),'bridge':sha(ROOT/'tools/proof_bridge.py'),'auditSource':sha(ROOT/'src/exact_quotient_audit.cpp'),'polynomial':sha(data_path('degree14-radical.json')),'library':sha(data_path('base-through13.json'))});out=proof/'Q'
 p=out/'accepted.json'
 if not force and p.exists():
  v=load(p)
  if v.get('passed') and v.get('binding')==key and sha(out/'replay.json')==v['reportSHA256']:return v
 if not (ROOT/'bin/exact-quotient-audit').exists():raise Incomplete('GMP audit executable missing: run make proof-tools')
 runner.event('proof_base',message='Replaying inherited nonzero-Q and radical certificates')
 archive=proof_archive()
 # Exact bytes are refreshed when the archive changes; no executable in the ZIP
 # is invoked. Only the locally built audit and trusted Python tools are used.
 marker=legacy/'source.json'
 if not marker.exists() or load(marker).get('sha256')!=sha(archive):
  import shutil
  if legacy.exists():shutil.rmtree(legacy)
  legacy.mkdir()
  with zipfile.ZipFile(archive) as z:
   for info in z.infolist():
    path=Path(info.filename)
    if path.is_absolute() or '..' in path.parts:raise Invalid('unsafe inherited archive path')
   z.extractall(legacy)
  atomic_json(marker,{'sha256':sha(archive)})
 actual=legacy/'kircracker-frontier'
 if sha(actual/'certificates/nichols/degree14-radical.json')!=sha(data_path('degree14-radical.json')) or sha(actual/'certificates/base-through13.json')!=sha(data_path('base-through13.json')):raise Invalid('inherited proof does not bind the active Q polynomial/library')
 last,secs=runner.run([sys.executable,ROOT/'tools/proof_bridge.py',actual,out,str(min(32,runner.jobs))],proof/'Q-replay.log')
 if not last or not last.get('passed'):raise Invalid('inherited nonzero/radical proof replay failed')
 v={'passed':True,'binding':key,'reportSHA256':sha(out/'replay.json'),'seconds':secs,'externalSpecialistReview':False,'scope':'computational checks plus the inherited written operator/Hopf/coideal arguments'};atomic_json(p,v);return v

def assemble(runner,D,lower,upperN,upperE,withQ=True):
 H,E5=factors(runner,D)
 lows=[{int(g):n for g,n in v['grades'].items()} for v in lower]
 N=[{int(g):n for g,n in row.items()} for row in upperN['grades']]
 E=[{int(g):n for g,n in row.items()} for row in upperE['grades']]
 if len(lows)!=D+1:raise Invalid('missing lower prefix')
 for d in range(D+1):
  if any(lows[d].get(g,0)>N[d].get(g,0) for g in range(720)):raise Invalid(f'relative lower exceeds Nichols upper in degree {d}')
 L=conv(conv(H,lows,D,runner.jobs),E5,D,runner.jobs);UN=conv(conv(H,N,D,runner.jobs),E5,D,runner.jobs);UE=conv(conv(H,E,D,runner.jobs),E5,D,runner.jobs)
 if withQ and D>=14:
  # Q nonzero and pairing-radical membership alone do not prove primitivity.
  # Every lower Hopf-kernel degree must first be independently closed.
  for d in range(14):
   for c in range(11):
    lo0=max(L[d].get(g,0) for g in range(720) if CLASS[g]==c)
    hi0=min(UE[d].get(g,0) for g in range(720) if CLASS[g]==c)
    if lo0!=hi0:raise Invalid('minimal Hopf-kernel prerequisite not closed below degree 14')
 degrees=[];exactThrough=-1
 for d in range(D+1):
  lo=[max(L[d].get(g,0) for g in range(720) if CLASS[g]==c) for c in range(11)]
  hn=[min(UN[d].get(g,0) for g in range(720) if CLASS[g]==c) for c in range(11)]
  hi=[min(UE[d].get(g,0) for g in range(720) if CLASS[g]==c) for c in range(11)]
  el=list(lo)
  if d>=14 and withQ:
   prev=degrees[d-14]
   if not prev['exact']:raise Invalid('Q-injection correction requires an exact low-degree profile')
   el=[x+y for x,y in zip(lo,prev['upperPerPermutation'])]
  if any(a>b or a>c for a,b,c in zip(lo,hn,hi)) or any(a>b for a,b in zip(el,hi)):raise Invalid('graded bounds inconsistent; no output authorized')
  eq=el==hi and (d<14 or withQ);eqN=lo==hn
  if eq and exactThrough==d-1:exactThrough=d
  entry={'degree':d,'originalLower':sum(x*y for x,y in zip(el,SIZES)),'originalUpper':sum(x*y for x,y in zip(hi,SIZES)),'nicholsLower':sum(x*y for x,y in zip(lo,SIZES)),'nicholsUpper':sum(x*y for x,y in zip(hn,SIZES)),'lowerPerPermutation':el,'upperPerPermutation':hi,'nicholsLowerPerPermutation':lo,'nicholsUpperPerPermutation':hn,'exact':eq,'nicholsExact':eqN,'exactCompatibleGrades':sum(SIZES[c] for c in range(11) if (6-len(CLASSES[c]))%2==d%2 and el[c]==hi[c]),'relativeLower':sum(lows[d].values()),'relativeNicholsUpper':sum(N[d].values()),'relativeOriginalUpper':sum(E[d].values())}
  degrees.append(entry)
 inherited=load(ROOT/'data/inherited-profile18.json')
 for d in range(min(18,D)+1):
  if withQ and degrees[d]['exact'] and degrees[d]['upperPerPermutation']!=inherited['dimensionsPerClass'][d]:raise Invalid(f'computed degree {d} disagrees with inherited profile')
 report={'schema':'kircracker-run-result-v1','field':'Q','requestedDegree':D,'exactThroughDegree':exactThrough,'status':'EXACT_IN_PROJECT_PROOF_CHAIN' if exactThrough==D else 'BOUNDS_ONLY','degrees':degrees,'classes':[list(c) for c in CLASSES],'classSizes':SIZES,'inheritedQProofReplayed':withQ,'upperOriginalSHA256':sha(runner.work/'upper/FK-original'/f'through-{D:02d}.json'),'upperNicholsSHA256':sha(runner.work/'upper/NICHOLS-only'/f'through-{D:02d}.json'),'lowerCatalogSHA256':[x['catalogSHA256'] for x in lower],'mathematicalDependencies':'Original-identity proofs, exact derivative minors, finite subalgebra factorization, inherited Q nonzero/primitive and quotient-coideal arguments. Not externally reviewed or proof-assistant formalized.','fullGroebnerBasisComputed':False,'noHigherFKEqualsNicholsAssumption':True}
 atomic_json(runner.work/'results'/f'degree-{D:02d}.json',report);runner.event('degree_result',degree=D,status=report['status'],lower=degrees[-1]['originalLower'],upper=degrees[-1]['originalUpper'],exactGrades=degrees[-1]['exactCompatibleGrades']);return report
