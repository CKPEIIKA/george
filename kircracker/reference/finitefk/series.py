"""Exact finite-prefix manipulations. No rational-function guessing."""
from math import comb

def mul(a,b,D=None):
    if D is None:D=len(a)+len(b)-2
    out=[0]*(D+1)
    for i,x in enumerate(a):
        for j,y in enumerate(b):
            if i+j<=D:out[i+j]+=x*y
    return out

def divide(a,b,D=None):
    if not b or b[0]!=1:raise ValueError('Only unit-constant formal denominators')
    if D is None:D=len(a)-1
    if D>=len(a):raise ValueError('Cannot infer unknown numerator coefficients')
    q=[]
    for d in range(D+1):q.append(a[d]-sum(b[j]*q[d-j] for j in range(1,min(d,len(b)-1)+1)))
    return q

def qfactors(factors):
    out=[1]
    for k,m in factors:
        for _ in range(m):out=mul(out,[1]*k)
    return out

def known_hilbert():
    return {0:[1],1:[1],2:[1,1],3:qfactors([(2,2),(3,1)]),
            4:qfactors([(2,2),(3,2),(4,2)]),5:qfactors([(4,4),(5,2),(6,4)]),
            6:[1,15,125,765,3831,16605,64432,228855,755777,2347365,6916867]}

def connected_series(h,n,D):
    """H_n=sum_partitions product C_|block|, by support grading.
    H_{0}=1. All nonempty required input series must reach D; known finite
    polynomials are explicitly padded by the caller, not implicitly extrapolated.
    """
    C={}
    for m in range(1,n+1):
        if len(h[m])<=D:raise ValueError(f'H_{m} prefix too short')
        out=list(h[m][:D+1])
        for k in range(1,m):
            prod=mul(C[k],h[m-k],D);weight=comb(m-1,k-1)
            out=[a-weight*b for a,b in zip(out,prod)]
        C[m]=out
    return C

def analyze_fk6(prefix=None,provenance='Blasiak-Liu-Meszaros arXiv:1310.4112v2, Sec 2.1'):
    H=known_hilbert();data=H[6] if prefix is None else prefix
    if not data or data[0]!=1 or any(type(x) is not int or x<0 for x in data):raise ValueError('Nonnegative integer Hilbert prefix starting at one required')
    D=len(data)-1
    h={n:(v+[0]*(D+1))[:D+1] for n,v in H.items() if n<6};h[6]=data
    conn=connected_series(h,6,D);star=divide(data,H[5],D)
    return {'coefficientsThroughDegree':D,'inputSource':provenance,'inputHilbert':data,
            'starK15Hilbert':star,'connectedSixVertexHilbert':conn[6],
            'allDerivedDimensionsNonnegative':min(star+conn[6])>=0,
            'completeSeriesClaim':False,'finitenessClaim':False,
            'theoremsUsed':['graded vector-space product E6 = E(K1,5) tensor E5 (BLM Cor4.9)',
                             'support partition grading and disjoint-support tensor factors'],
            'noExtrapolation':True}
