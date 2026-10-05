"""Graded finite-factor multiplication with verified lower/upper modules.
Counts are Python integers. This is offline proof processing, never normal-word
counting in the direct reducer. A fixed lex leading set is NOT Sn-invariant.
"""
from itertools import permutations
from collections import Counter
from finitefk.finite_model import FiniteStar
N=6;identity=tuple(range(1,N+1));perms=list(permutations(identity));ids={g:i for i,g in enumerate(perms)}
def compose(a,b):return tuple(a[x-1] for x in b)
def inverse(a):return tuple(a.index(i)+1 for i in identity)
def grade(word):
 p=list(identity)
 for a,b in word:p[a-1],p[b-1]=p[b-1],p[a-1]
 return ids[tuple(p)]
def cycle(g):
 seen=set();parts=[]
 for i in identity:
  if i in seen:continue
  j=i;k=0
  while j not in seen:seen.add(j);k+=1;j=g[j-1]
  parts.append(k)
 return tuple(sorted(parts,reverse=True))
classes=sorted(set(map(cycle,perms)));cl=[classes.index(cycle(g)) for g in perms];sizes=[cl.count(c) for c in range(len(classes))]
def lower_grades(c):
 row=Counter()
 for b in c['blocks']:
  g=inverse(tuple(b['permutationDegree']))
  for s in b['transports']:
   h=compose(compose(tuple(s),g),inverse(tuple(s)));row[ids[h]]+=len(b['words'])
 if sum(row.values())!=c['rankLowerBound']:raise ValueError('lower rank accounting')
 return row

def derive(lower,upper,*,independent_finite=True):
 D=len(lower)-1
 if len(upper)!=D+1:raise ValueError('upper/lower length')
 for d,(l,u) in enumerate(zip(lower,upper)):
  if any(l[g]<0 or l[g]>u[g] for g in range(720)):raise ValueError('inconsistent grade bounds at '+str(d))
 models={k:FiniteStar(k,max_degree=D,independent=independent_finite) for k in range(1,5)}
 model_checks={k:m.audit for k,m in models.items()}
 table=[[ids[compose(p,q)] for q in perms] for p in perms]
 def conv(A,B):
  C=[]
  for d in range(D+1):
   row=Counter()
   for j in range(d+1):
    if j>=len(A) or d-j>=len(B):continue
    for g,x in A[j].items():
     t=table[g]
     for h,y in B[d-j].items():row[t[h]]+=x*y
   C.append(row)
  return C
 series={k:[Counter(grade(w) for w in lev) for lev in m.basis]+[Counter()]*(D+1-len(m.basis)) for k,m in models.items()}
 E=[Counter({0:1})]+[Counter()] * D
 for k in range(1,5):E=conv(series[k],E)
 H=[Counter(grade(tuple((a,6 if b==5 else b) for a,b in w)) for w in lev) for lev in models[4].basis];H+=[Counter()]*(D+1-len(H))
 low=conv(conv(H,lower),E);high=conv(conv(H,upper),E);degrees=[]
 for d in range(D+1):
  # All conjugates have the same TRUE FK6 dimension. Each raw bound is valid;
  # max of lower bounds / min of upper bounds is stronger and still valid.
  lo=[max(low[d][i] for i in range(720) if cl[i]==c) for c in range(11)]
  hi=[min(high[d][i] for i in range(720) if cl[i]==c) for c in range(11)]
  if any(a>b for a,b in zip(lo,hi)):raise ValueError('conjugacy inconsistency')
  count=sum(sizes[c] for c in range(11) if (6-len(classes[c]))%2==d%2 and lo[c]==hi[c])
  possible={sum(s*v for s,v in zip(sizes,lo))}
  for c in range(11):
   if hi[c]>lo[c]:possible={x+sizes[c]*j for x in possible for j in range(hi[c]-lo[c]+1)}
  degrees.append({'possibleTotalDimensions':sorted(possible),'degree':d,'fullLower':sum(s*v for s,v in zip(sizes,lo)),'fullUpper':sum(s*v for s,v in zip(sizes,hi)),'compatibleGrades':360,'exactGrades':count,'lowerPerClass':lo,'upperPerClass':hi,'unresolvedClasses':[{'class':list(classes[c]),'lowerPerGrade':lo[c],'upperPerGrade':hi[c],'classSize':sizes[c]} for c in range(11) if lo[c]!=hi[c]],'relative':{'degree':d,'lower':sum(lower[d].values()),'upper':sum(upper[d].values()),'gap':[[list(perms[i]),upper[d][i]-lower[d][i]] for i in range(720) if upper[d][i]!=lower[d][i]]}})
 return {'throughDegree':D,'classes':[list(c) for c in classes],'classSizes':sizes,'degrees':degrees,'finiteFactorChecks':model_checks,'finiteModelIndependentSuffixDerivatives':independent_finite,'finiteDimensionsTheoremDependency':True,'method':'independent lower minors and original-identity upper module; graded H*M*E5; conjugacy lower-max/upper-min'}
