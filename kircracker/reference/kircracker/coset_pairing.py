"""Complementary-coset pairing: BLM Algorithm 4.12, certificate-first prototype.

No completion. A full-rank minor gives independent coset classes, not a basis
unless an independent upper bound matches. Original signed braiding is retained.
L=star/(star*proper_star^+), dual side clique-plus-one-edge/(...*clique^+).
Reversal identifies L with the previous right-module M for dimension purposes.
"""
from itertools import combinations, permutations
from collections import defaultdict
from time import monotonic
from math import isqrt
from .core import permutation_degree, left_derivative, perm_action
from .sectors import ResourceLimit

def inverse(p):
    out=[0]*len(p)
    for i,j in enumerate(p,1):out[j-1]=i
    return tuple(out)

def conjugate(g,x):
    gi=inverse(g)
    return tuple(g[x[gi[j]-1]-1] for j in range(len(g)))

def grade_orbit(grade,n):
    out={}
    for perm in permutations(range(1,n-1)):
        g=tuple(perm)+(n-1,n);out.setdefault(conjugate(g,grade),g)
    return out

def expanded_words(cert):
    n=cert['ambientFK'];left=[];right=[]
    for b in cert['blocks']:
        us=[tuple(map(tuple,w)) for w in b['words']];vs=[tuple(map(tuple,w)) for w in b['dualWords']]
        transports=b.get('transports',[list(range(1,n+1))])
        for g in transports:
            left.extend(perm_action(w,tuple(g))[0] for w in us)
            right.extend(perm_action(w,tuple(g))[0] for w in vs)
    return left,right

def prime_check(p):
    if type(p)is not int or not 2<=p<=2147483647 or any(p%i==0 for i in range(2,isqrt(p)+1)):raise ValueError('A prime is required')

class Pairing:
    """Integer pairing <u,v>=epsilon(v nabla_u) with memoized subsequences.
    A cached zero is a pairing evaluation, never an assertion v=0 in FK6.
    """
    def __init__(self,n,*,seconds=60,max_calls=2000000,max_cache=250000):
        self.n=n;self.deadline=monotonic()+seconds;self.max_calls=max_calls;self.max_cache=max_cache;self.calls=0;self.hits=0;self.cache={};self.perms={():tuple(range(1,n+1))}
    def perm(self,w):
        v=self.perms.get(w)
        if v is None:
            v=permutation_degree(w,self.n)
            if len(self.perms)<self.max_cache:self.perms[w]=v
        return v
    def evaluate(self,u,v):
        self.calls+=1
        if self.calls>self.max_calls or (self.calls&1023)==0 and monotonic()>self.deadline:raise ResourceLimit('Pairing budget exhausted; no dimension/vanishing conclusion')
        if len(u)!=len(v):return 0
        if not u:return 1
        k=(u,v)
        if k in self.cache:self.hits+=1;return self.cache[k]
        if self.perm(u)!=inverse(self.perm(v)):return 0
        if any(w[i]==w[i+1] for w in (u,v) for i in range(len(w)-1)):return 0
        # nabla deletes only: suffix-conjugation reconstructed incrementally.
        a,b=u[0];perm=list(range(self.n+1));s=0
        for j in range(len(v)-1,-1,-1):
            x,y=perm[a],perm[b]
            if v[j]==(min(x,y),max(x,y)):
                s+=(1 if x<y else -1)*self.evaluate(u[1:],v[:j]+v[j+1:])
            c,d=v[j];ic=perm.index(c);id=perm.index(d);perm[ic],perm[id]=perm[id],perm[ic]
        if len(self.cache)<self.max_cache:self.cache[k]=s
        return s

def independent_pair(u,v,n):
    """Separate prefix-twisted derivative implementation; no DP/index reuse."""
    q={v:1}
    for e in reversed(u):q=left_derivative(q,e)
    return q.get((),0)

def word_json(words):return [[list(e) for e in w] for w in words]
def word_read(words,n,d):
    out=[tuple(tuple(e) for e in w) for w in words]
    if len(set(out))!=len(out):raise ValueError('Repeated words')
    if any(len(w)!=d or any(type(a)is not int or type(b)is not int or not 1<=a<b<=n for a,b in w) for w in out):raise ValueError('Invalid word')
    return out

def minor_rank(matrix,p):
    """Selected original row indices and pivot columns form a nonsingular minor."""
    basis={};selected=[]
    for i,r in enumerate(matrix):
        v={j:a%p for j,a in enumerate(r) if a%p}
        while v:
            j=min(v);c=v[j]
            if j not in basis:
                c=pow(c,-1,p);basis[j]={k:a*c%p for k,a in v.items()};selected.append(i);break
            for k,a in basis[j].items():
                b=(v.get(k,0)-c*a)%p
                if b:v[k]=b
                else:v.pop(k,None)
    return selected,list(basis)

def determinant_mod(matrix,p):
    n=len(matrix)
    if any(len(r)!=n for r in matrix):raise ValueError('Square matrix required')
    a=[[v%p for v in r] for r in matrix];det=1
    for j in range(n):
        k=next((k for k in range(j,n) if a[k][j]),None)
        if k is None:return 0
        if k!=j:a[k],a[j]=a[j],a[k];det=-det
        c=a[j][j];det=det*c%p;inv=pow(c,-1,p)
        for i in range(j+1,n):
            factor=a[i][j]*inv%p
            if factor:
                for k in range(j,n):a[i][k]=(a[i][k]-factor*a[j][k])%p
    return det%p

def discover(n,D,*,prime=1000003,max_entries=2000000,max_calls=5000000,max_cache=500000,seconds=120,on_degree=None,seed=None,symmetry=False,max_candidates=1000000):
    if type(n)is not int or type(D)is not int or not 3<=n<=6 or not 0<=D<=30:raise ValueError('Prototype n=3..6 and degree=0..30')
    if any(type(v)is not int or v<1 for v in [max_entries,max_calls,max_candidates]) or type(max_cache)is not int or max_cache<0 or seconds<=0:raise ValueError('Positive budgets and nonnegative cache required')
    prime_check(prime);start=monotonic();e=(n-1,n)
    star=tuple((i,n) for i in range(1,n));dual=tuple(combinations(range(1,n),2))+(e,)
    left=[()];right=[()];certificates=[];first=0
    if seed is not None:
        if seed.get('claim')!='COMPLEMENTARY_COSET_MINOR' or seed.get('ambientFK')!=n or seed.get('degree',-1)>=D:raise ValueError('Invalid seed')
        first=seed['degree']+1
        left,right=expanded_words(seed)
        # Seeds are merely candidate words. Every new degree has its own
        # independent minor; no unverified seed rank is accepted as evidence.
    for d in range(first,D+1):
        if d:
            if len(star)*len(left)+len(dual)*len(right)>max_candidates:raise ResourceLimit('Candidate word budget; no dimension conclusion')
            left=sorted({(g,)+w for g in star for w in left if not w or g!=w[0]})
            right=sorted({(g,)+w for g in dual for w in right if not w or g!=w[0]})
        P=Pairing(n,seconds=max(.001,seconds-(monotonic()-start)),max_calls=max_calls,max_cache=max_cache)
        L=defaultdict(list);R=defaultdict(list)
        for w in left:L[P.perm(w)].append(w)
        for w in right:R[inverse(P.perm(w))].append(w)
        selected=[];seen=set()
        for grade in sorted(L):
            if grade in seen or not R.get(grade):continue
            orbit=grade_orbit(grade,n) if symmetry else {grade:tuple(range(1,n+1))}
            seen.update(orbit);selected.append((grade,orbit))
        cost=sum(len(L[k])*len(R.get(k,[])) for k,orbit in selected)
        if cost>max_entries or monotonic()-start>seconds:raise ResourceLimit('Candidate pairing matrix budget; no zero or completeness conclusion')
        chosenL=[];chosenR=[];blocks=[];nonzero=0
        for grade,orbit in selected:
            ws=L[grade];vs=R.get(grade,[])
            if not vs:continue
            a=[[P.evaluate(u,v)%prime for v in vs] for u in ws]
            nonzero+=sum(bool(v) for row in a for v in row)
            rows,cols=minor_rank(a,prime)
            if not rows:continue
            mat=[[a[i][j] for j in cols] for i in rows]
            det=determinant_mod(mat,prime);assert det
            us=[ws[i] for i in rows];vs2=[vs[j] for j in cols]
            for g in orbit.values():
                chosenL.extend(perm_action(w,g)[0] for w in us)
                chosenR.extend(perm_action(w,g)[0] for w in vs2)
            blocks.append({'permutationDegree':list(grade),'words':word_json(us),'dualWords':word_json(vs2),'matrixModPrime':mat,'determinantModPrime':det,'transports':[list(g) for g in orbit.values()]})
        cert={'claim':'COMPLEMENTARY_COSET_MINOR','ambientFK':n,'degree':d,'prime':prime,'targetField':'Q','rankLowerBound':len(chosenL),'quotient':'star_(n-1)/(star_(n-1)*star_(n-2)^+), left quotient; reversal preserves dimensions','blocks':blocks,
              'generation':{'rowCandidates':len(left),'columnCandidates':len(right),'unblockedEntries':len(left)*len(right),'evaluatedEntries':cost,'nonzeroEntries':nonzero,'pairingCalls':P.calls,'cachedPairs':len(P.cache),'cacheHits':P.hits,'maxBlock':max((len(x['words']) for x in blocks),default=0),'elapsedSeconds':monotonic()-start},
              'boundaryPreservingSymmetry':symmetry,'symmetryGroupOrder':len(list(permutations(range(1,n-1)))) if symmetry else 1,'basisOrExactDimensionClaim':False,'FKEqualsNicholsAssumed':False,'knownCoefficientUsedToSelectWords':False}
        certificates.append(cert);left=chosenL;right=chosenR
        if on_degree:on_degree(cert)
    return certificates

def verify(cert,*,independent=True,max_entries=2000000,seconds=120):
    if cert.get('claim')!='COMPLEMENTARY_COSET_MINOR' or cert.get('targetField')!='Q':raise ValueError('Unsupported certificate')
    n,d,p=cert['ambientFK'],cert['degree'],cert['prime'];prime_check(p)
    if type(n)is not int or not 3<=n<=6 or type(d)is not int or not 0<=d<=30:raise ValueError('Invalid algebra/degree')
    e=(n-1,n);star=set((i,n) for i in range(1,n));dual=set(combinations(range(1,n),2))|{e}
    P=Pairing(n,seconds=seconds);start=monotonic();rank=0;grades=set();count=0
    for b in cert['blocks']:
        grade=tuple(b['permutationDegree'])
        if len(grade)!=n or set(grade)!=set(range(1,n+1)):raise ValueError('Invalid permutation grade')
        transports=b.get('transports',[list(range(1,n+1))])
        if not transports:raise ValueError('No transported block')
        for g in transports:
            g=tuple(g)
            if len(g)!=n or set(g)!=set(range(1,n+1)) or g[-2:]!=(n-1,n):raise ValueError('Transport does not preserve the chosen two graphs')
            dest=conjugate(g,grade)
            if dest in grades:raise ValueError('Overlapping transported grades')
            grades.add(dest)
        us=word_read(b['words'],n,d);vs=word_read(b['dualWords'],n,d)
        if not us or len(us)!=len(vs) or any(set(w)-star for w in us) or any(set(w)-dual for w in vs):raise ValueError('Wrong quotient support/square shape')
        count+=len(us)**2
        if count>max_entries:raise ResourceLimit('Certificate replay matrix budget')
        if any(P.perm(w)!=grade for w in us) or any(inverse(P.perm(w))!=grade for w in vs):raise ValueError('Wrong orthogonality block')
        matrix=[]
        for u in us:
            if monotonic()-start>seconds:raise ResourceLimit('Certificate replay deadline')
            matrix.append([(independent_pair(u,v,n) if independent else P.evaluate(u,v))%p for v in vs])
        if matrix!=b['matrixModPrime']:raise ValueError('Pairing matrix mismatch')
        det=determinant_mod(matrix,p)
        if not det or det!=b['determinantModPrime']:raise ValueError('Nonzero determinant not established')
        rank+=len(us)*len(transports)
    if type(cert['rankLowerBound'])is not int or rank!=cert['rankLowerBound']:raise ValueError('Wrong certified rank')
    return {'passed':True,'claim':'RELATIVE_DIMENSION_LOWER_BOUND','n':n,'degree':d,'value':rank,'entriesReplayed':count,'independentPrefixDerivative':independent,'exactDimensionEstablished':False}
