#!/usr/bin/env python3
"""Exact missing-term recovery, finite FK-star controls, and adversarial tests.
No degree-23 inputs or dimensions are synthesized as a successful computation.
"""
from pathlib import Path
import sys,json,itertools,struct,subprocess,hashlib,shutil,math,copy,random,os
from fractions import Fraction
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools')]
from projected_chart import grade,sha,replay
O=Path(os.environ.get('KIR_BRIDGE_RESULTS',str(R/'results-local/degree23-bridge-local')))/'projected-tests';O.mkdir(parents=True,exist_ok=True);binding='a'*64

def pack(w):
 n=0
 for a in w:n=n*16+a
 return n

def frame(path,words,d,k):
 words=sorted(pack(w)if isinstance(w,tuple)else w for w in words)
 raw=b'KKRMAP01'+binding.encode()+struct.pack('<IIIIQQQ',d,k,2,0,0,len(words),0)+b''.join(w.to_bytes(16,'little')+struct.pack('<I',grade(w,d)) for w in words)
 h=1469598103934665603
 for x in raw:h=((h^x)*1099511628211)&((1<<64)-1)
 path.write_bytes(raw+struct.pack('<Q',h))

def library(path,k,relations):
 text=[f'{k} {len(relations)}']
 for p in relations:
  d=len(next(iter(p)));text.append(f'{d} {len(p)}')
  for w,c in p.items():text.append(' '.join(map(str,[c,*w])))
 path.write_text('\n'.join(text)+'\n')

def rank_q(rows):
 piv={}
 for r in rows:
  v={k:Fraction(x)for k,x in r.items()if x}
  while v:
   h=max(v);c=v[h]
   if h not in piv:piv[h]={k:x/c for k,x in v.items()};break
   for k,x in piv[h].items():
    z=v.get(k,Fraction(0))-c*x
    if z:v[k]=z
    else:v.pop(k,None)
 return len(piv)

def exact_dimension(k,d,rels,boundary=0,group=None):
 words=[w for w in itertools.product(range(k),repeat=d)if group is None or grade(pack(w),d)==group];idx={w:i for i,w in enumerate(words)};rows=[]
 for w in words:
  if boundary&(1<<w[0]):rows.append({idx[w]:1})
 for r in rels:
  n=len(next(iter(r)))
  if n>d:continue
  for l in range(d-n+1):
   for a in itertools.product(range(k),repeat=l):
    for b in itertools.product(range(k),repeat=d-n-l):
     first=a+next(iter(r))+b
     if first not in idx:continue
     rows.append({idx[a+w+b]:c for w,c in r.items()})
 return len(words)-rank_q(rows)

def run(name,words,k,d,rels,group,boundary=0,maxaux=10000,depth=1):
 fr=O/(name+'.krm');lib=O/(name+'.rel');frame(fr,words,d,k);library(lib,k,rels);out=O/name
 shutil.rmtree(out,ignore_errors=True)
 cmd=[str(R/'bin/kir-projected-relations'),str(fr),str(lib),binding,str(out),str(group),'30',str(512<<20),str(maxaux),'10000',str(depth),str(boundary),'all']
 q=subprocess.run(cmd,capture_output=True,text=True,timeout=45);(O/(name+'.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr);assert q.returncode==0,(name,q.stderr)
 cfg={'schema':'kir-projected-chart-1','namespace':'FINITE_TEST_STAR_OR_SYNTHETIC','frame':str(fr),'frameSHA256':sha(fr),'relations':str(lib),'relationsSHA256':sha(lib),'binding':binding,'group':group,'prefixKillMask':boundary,'trace':str(out/'projected.qpr'),'traceSHA256':sha(out/'projected.qpr'),'freeWords':str(out/'free-words.bin'),'freeWordsSHA256':sha(out/'free-words.bin'),'result':str(out/'RESULT.json')}
 (out/'MANIFEST.json').write_text(json.dumps(cfg))
 rec=replay(out/'MANIFEST.json',out/'receipt.json',60);return rec,json.loads((out/'RESULT.json').read_text()),out
rows=[]
# Boundary-free homogeneous relations on same permutation grade e: aa,bb,cc.
# No source is contained in [aa,bb]; subtracting the two cc contexts gives aa=bb.
rels=[{(2,2):1,(0,0):-1},{(2,2):1,(1,1):-1}];words=[(0,0),(1,1)]
old,_,_=run('hidden-identity-contained',words,3,2,rels,0,maxaux=0,depth=0)
new,diag,out=run('hidden-identity-projected',words,3,2,rels,0,depth=0)
assert old['rationalDimensionUpperBound']==2 and new['rationalDimensionUpperBound']==1
assert exact_dimension(3,2,rels,group=0)==1
rows.append(dict(case='hidden exact relation through missing cc',oldUpper=2,newUpper=1,trueDimension=1,passed=True))
# Dangerous even coefficient: a+2x=0 does NOT force a=0 over Q.
rels=[{(0,0):1,(2,2):2}]
v,_,_=run('even-exterior-not-zero',[(0,0)],3,2,rels,0,depth=0)
assert v['rationalDimensionUpperBound']==1 and v['replayedProjectedRelationRank']==0
rows.append(dict(case='even auxiliary coefficient retained over Q',upper=1,passed=True))
# A single auxiliary elimination creates a nonprimitive factor 3*a; primitive
# normalization over Q is legal, but erasing its origin or reducing 2*x mod2 is not.
rels=[{(0,0):1,(2,2):2},{(0,0):1,(2,2):-1}]
v,_,_=run('rational-projection-content',[(0,0)],3,2,rels,0,depth=0)
assert v['rationalDimensionUpperBound']==0
rows.append(dict(case='exact elimination and content normalization',upper=0,passed=True))
# Small true FK-star libraries: retain relations entirely on the selected spokes.
source=json.loads((R/'data/starQ-seed.json').read_text())['relations']
for k,d in [(3,5),(3,6),(4,5),(4,6)]:
 rels=[]
 for r in source:
  p={tuple(w):int(c)for w,c in r['primitive_relation']}
  if r['degree']<=d and all(all(a<k for a in w) for w in p):rels.append(p)
 # Square-free words beginning with the last generator span the cyclic quotient:
 # excluded prefixes are boundary zeros, excluded adjacent repeats are squares.
 words=[w for w in itertools.product(range(k),repeat=d)if w[0]==k-1 and all(w[j]!=w[j+1] for j in range(d-1))]
 groups=sorted({grade(pack(w),d)for w in words});records=[]
 # Four nonempty grades suffice for bounded controls; k3 includes all grades.
 if k==4:groups=sorted(groups,key=lambda g:-sum(grade(pack(w),d)==g for w in words))[:4]
 for g in groups:
  selected=[w for w in words if grade(pack(w),d)==g];name=f'star{k}-d{d}-g{g}'
  before,_,_=run(name+'-contained',selected,k,d,rels,g,boundary=(1<<(k-1))-1,maxaux=0,depth=0)
  after,stats,out=run(name+'-projected',selected,k,d,rels,g,boundary=(1<<(k-1))-1)
  actual=exact_dimension(k,d,rels,(1<<(k-1))-1,g)
  assert after['rationalDimensionUpperBound']>=actual
  records.append(dict(case=name,columns=len(selected),containedUpper=before['rationalDimensionUpperBound'],projectedUpper=after['rationalDimensionUpperBound'],independentExactDimension=actual,auxiliaryPivots=after['exactAuxiliaryPivots'],projectedRank=after['replayedProjectedRelationRank'],nativeSeconds=stats['seconds'],passed=True))
 rows.extend(records)
print('FINITE-STAR CHECKS COMPLETED',flush=True)
# Damage an accepted relation's source binding: replay must fail before a receipt.
p=O/'hidden-identity-projected';cfg=json.loads((p/'MANIFEST.json').read_text());bad=copy.deepcopy(cfg);bad['relationsSHA256']='0'*64;(p/'bad.json').write_text(json.dumps(bad));failed=False
try:replay(p/'bad.json',p/'BAD_RECEIPT.json')
except ValueError:failed=True
assert failed and not (p/'BAD_RECEIPT.json').exists();rows.append(dict(case='damaged relation binding rejected',passed=True))
# A trace byte mutation with a recomputed checksum is still not a proof: tests
# mathematical replay, not just file hash handling.
raw=bytearray((p/'projected.qpr').read_bytes());offset=8+64+20+2*16;raw[offset+4+16:offset+4+16+4]=(10000).to_bytes(4,'little');(p/'bad.qpr').write_bytes(raw);bad=copy.deepcopy(cfg);bad['trace']=str((p/'bad.qpr').resolve());bad['traceSHA256']=sha(p/'bad.qpr');(p/'bad-source.json').write_text(json.dumps(bad));failed=False
try:replay(p/'bad-source.json',p/'BAD_SOURCE_RECEIPT.json')
except ValueError:failed=True
assert failed and not (p/'BAD_SOURCE_RECEIPT.json').exists();rows.append(dict(case='forged context rejected even after rebinding hash',passed=True))
# Random exact rational systems on same-grade words; the first two rows
# express both auxiliaries in W, so the original chart really spans the quotient.
rng=random.Random(23023)
for trial in range(12):
 terms=[(i,i) for i in range(5)];chosen=terms[:3]
 huge=(1<<160)+13 if trial%3==0 else 1
 rr=[]
 for x in [3,4]:
  p={terms[x]:1};p.update({terms[j]:rng.randint(-3,3)*huge for j in range(3)})
  rr.append({w:c for w,c in p.items() if c})
 for i in range(trial%4):
  p={terms[j]:rng.randint(-4,4)*huge for j in range(5)}
  if any(p.values()):rr.append({w:c for w,c in p.items() if c})
 after,st,_=run(f'random-rational-{trial}',chosen,5,2,rr,0)
 true=exact_dimension(5,2,rr,group=0)
 assert true<=after['rationalDimensionUpperBound']<=3
 rows.append(dict(case=f'random-rational-{trial}',passed=True,columns=3,independentExactDimension=true,projectedUpper=after['rationalDimensionUpperBound'],maxCoefficientBits=st['maxCoefficientBits']))
# Packed-word boundary controls at the requested degree and beyond. They prove
# only a relation within the two-word test span, not a full FK23 component.
for d in (23,24,31):
 prefix=tuple([2]+[j%2 for j in range(d-3)])
 assert len(prefix)==d-2
 words=[prefix+(0,0),prefix+(1,1)]
 rr=[{(2,2):1,(0,0):-1},{(2,2):1,(1,1):-1}]
 rec,st,_=run(f'longword-{d}',words,3,d,rr,grade(pack(words[0]),d),depth=0)
 assert rec['rationalDimensionUpperBound']==1
 rows.append(dict(case=f'longword-{d}',passed=True,degree=d,projectedSpanUpper=1,fullFKComputation=False,nonzeroSpanWitness='map all three generators to one commuting indeterminate'))
(O/'summary.json').write_text(json.dumps(dict(passed=True,cases=rows,highDegreeResultClaimed=False),indent=2));print(json.dumps(rows,indent=2))
