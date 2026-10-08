"""Support-resolved structural tools for the five-edge FK6 star and T=S/(Q).

These commands deliberately separate leading-ideal/Anick information from actual
homology. The shipped degree-8 homology result is a bounded certificate target;
future degrees require differential construction, not Euler cancellation alone.
"""
from __future__ import annotations
import json, math
from pathlib import Path
from .util import ROOT, Invalid, atomic_json, sha


def _proofkit():
    import sys
    if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
    from proofkit.combinatorics import anick
    from proofkit.core import Budget
    return anick, Budget


def _leaders():
    p=ROOT/'data/star14-leading-words.json'
    with open(p) as f: d=json.load(f)
    return [tuple(r['leadingWord']) for r in d['rows']], d


def _restricted(k:int):
    if not 1<=k<=5: raise Invalid('support size must be 1..5')
    ls,_=_leaders()
    return [w for w in ls if set(w) <= set(range(k))]


def support_anick(k:int,D:int,seconds:float=0,max_terms:int=5_000_000):
    """Count Anick chains by exact set of star letters used.

    This intentionally works on the full fixed-order leading ideal and tracks the
    union-of-letters mask along each chain. It does NOT quotient the lex basis by S5;
    hence it remains valid even though the supplied Groebner basis is not S5-invariant.
    """
    if D<0 or D>17: raise Invalid('support Anick analysis is bounded to internal degree <=17 by the supplied star frontier')
    anick,Budget=_proofkit(); b=Budget(seconds,max_terms)
    leaders,_=_leaders(); r=anick(leaders,5,D,b)
    tails=[tuple(x) for x in r['graph']['tails']]; edges=r['graph']['edges']
    # State paths use the same convention as proofkit.combinatorics.anick:
    # C1 starts from a one-letter tail; traversing s->t appends tail[t].
    current={}
    for i,t in enumerate(tails):
        if len(t)==1:
            current[(1,i,1<<t[0])]=current.get((1,i,1<<t[0]),0)+1
    bymask=[{} for _ in range(D+1)]
    bymask[0][(0,0)]=1
    for hom in range(1,D+1):
        nxt={}
        for (deg,state,mask),c in current.items():
            if deg<=D:
                bymask[hom][(deg,mask)]=bymask[hom].get((deg,mask),0)+c
            for t in edges[state]:
                nt=tails[t]; nd=deg+len(nt)
                if nd>D: continue
                nm=mask
                for a in nt:nm|=1<<a
                key=(nd,t,nm);nxt[key]=nxt.get(key,0)+c
            b.check(len(current))
        current=nxt
    exact=[[0]*(D+1) for _ in range(D+1)]
    subsets={}
    for hom,row in enumerate(bymask):
        for (deg,mask),c in row.items():
            if mask.bit_count()==k:
                exact[hom][deg]+=c
                subsets.setdefault(format(mask,'05b'),0);subsets[format(mask,'05b')]+=c
    # Cross-check support partition against the full Anick count table.
    counts=[[int(x) for x in row] for row in r['counts']]
    for hom in range(D+1):
        for deg in range(D+1):
            total=sum(c for (dd,m),c in bymask[hom].items() if dd==deg)
            if total!=counts[hom][deg]: raise Invalid('support-mask Anick DP disagrees with full chain count')
    return {
      'schema':'kircracker-support-anick-v2','supportSize':k,'throughInternalDegree':D,
      'exactSupportChainCounts':[[str(x) for x in row] for row in exact],
      'aggregateChainCount':sum(map(sum,exact)),'subsetAggregateCounts':subsets,
      'fullNormalWordCounts':r['normalWordCounts'],'fullEulerCheck':r['eulerCheck'],
      'basisSHA256':sha(ROOT/'data/star14-leading-words.json'),
      'scope':'Exact support partition of Anick chain ranks for the supplied fixed-order degree-14 star leading ideal; not Tor dimensions or differential ranks.',
      'important':'No S5 invariance of the fixed lex Groebner basis is assumed; support masks are tracked on actual chain words.',
      'QEffect':'For internal degree <14, S and T=S/(Q) have the same algebra/bar homology. At degree >=14 quotient-specific differential/leading data are required for T.'
    }


def degree8_result():
    p=ROOT/'data/degree8-homology.json'
    with open(p) as f: d=json.load(f)
    r4,r5,r6=d['ranks']['d4'],d['ranks']['d5'],d['ranks']['d6']
    betti=[39,1185-r4,2215-r4-r5,1360-r5-r6,360-r6,20,5]
    alt=sum((1 if (p%2==0) else -1)*b for p,b in zip(range(2,9),betti))
    if betti!=d['betti_p2_to_p8'] or alt!=54: raise Invalid('degree-8 built-in certificate consistency failure')
    return {**d,'alternatingCoefficient':alt,'consistencyChecked':True,
            'interpretation':'The ranks reveal cycles/boundaries; the t^8 reciprocal-Hilbert coefficient is rank-independent and remains 54.'}


def support_formula():
    return {
      'schema':'kircracker-support-formula-v1',
      'algebra':'T=S/(Q), S=<a,b,c,d,e> actual five-edge star',
      'P_le2':'1 + 5*u*t/(1-u*t) + 10*u^2*t^3*(1+u*t)/((1-u*t)*(1-u^2*t^3))',
      'C_exact2':'10*u^2*t^3/((1-u*t)*(1-u*t-u^2))',
      'R_exact2':'10*u^4*t^5/((1-u*t)*(1-u*t-u^2)*(1-u^2*t^3))',
      'fullDiagonal':{'beta_p_p':'5 for p>=1','beta_2_3':10,'beta_p_p1':'20 for p>=3','c_p_p1':'10*(p-1)','rho_p_p1':'10*(p-3) for p>=3'},
      'reciprocalDecomposition':'1/H_T = 1-5*t/(1+t)+10*t^3/((1+t)*(1+t+t^2)) + Xi_{>=3}(t)',
      'nextTarget':'resolve exact-support 3, then 4, then the genuine five-letter residual Xi_5; do not infer Tor from chain Euler sums alone.'
    }
