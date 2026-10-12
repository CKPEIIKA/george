"""Degree-local, grade-orbit complementary pairing discovery for Kircracker 0.6.

This module takes a PREVIOUS-degree coset minor as a word-generation seed.
It NEVER accepts a prior rank as proof of a new rank. Every new nonzero minor
is independently replayable with kircracker.coset_pairing.verify.

VERY IMPORTANT DIRECTION CONVENTION:
  pairing rows live in L=S/(S H_+) (left-ideal quotient);
  modular upper lives in M=S/(H_+ S) (right-ideal quotient).
Reversal maps M to L as graded vector spaces and INVERTS group grade.
Thus compare pairing grade g with modular upper grade g^{-1}, not g.
"""
from __future__ import annotations
from itertools import combinations
from time import monotonic
from collections import defaultdict
from .grade_orbits06 import orbit_for, representatives, orbit_representative, parity
from .coset_pairing import (Pairing,prime_check,expanded_words,word_json,word_read,
                            determinant_mod,minor_rank,conjugate,inverse,verify as verify_coset)
from .core import perm_action, permutation_degree
from .sectors import ResourceLimit


def _right_grade(w):return inverse(permutation_degree(w,6))


def _grow_selected(seed:dict,grade:tuple[int,...],max_candidates:int):
    if seed.get('claim')!='COMPLEMENTARY_COSET_MINOR' or seed.get('ambientFK')!=6:
        raise ValueError('Seed must be existing FK6 complementary-coset minor')
    d=seed.get('degree')
    if type(d)is not int or d<0:raise ValueError('Seed must have a degree')
    if grade not in representatives(d+1):raise ValueError('Required canonical orbit representative of next degree')
    left_prev,right_prev=expanded_words(seed)
    star=tuple((i,6) for i in range(1,6))
    dual=tuple(combinations(range(1,6),2))+((5,6),)
    # The previous certificate provides candidate words only. It does NOT
    # certify that they generate all cosets or the next homogeneous component.
    L=set();R=set();rg=inverse(grade)
    for w in left_prev:
        for e in star:
            if w and e==w[0]:continue
            z=(e,)+w
            if permutation_degree(z,6)==grade:L.add(z)
    for w in right_prev:
        for e in dual:
            if w and e==w[0]:continue
            z=(e,)+w
            if permutation_degree(z,6)==rg:R.add(z)
    if len(L)+len(R)>max_candidates:
        raise ResourceLimit('Candidate budget exceeded; no zero or rank conclusion')
    return sorted(L),sorted(R)


def discover_sector(seed:dict, grade:tuple[int,...], *,prime:int=1000003,
                    max_entries:int=1500000, max_candidates:int=15000,
                    max_cache:int=500000,max_calls:int=5000000,seconds:float=120,
                    independent_replay:bool=True):
    """Return a *partial orbit lower bound*, even if the rank is small/zero.

    A zero result is not a vanishing proof. Certificates are source-compatible
    with the v0.5 verification API and can be merged across disjoint orbits.
    """
    prime_check(prime)
    if seconds<=0 or min(max_entries,max_candidates,max_calls)<1 or max_cache<0:
        raise ValueError('Invalid resource budget')
    start=monotonic();grade=tuple(grade)
    if grade not in representatives(seed['degree']+1):
        raise ValueError('Canonical grade of the correct degree parity required')
    us,vs=_grow_selected(seed,grade,max_candidates)
    if len(us)*len(vs)>max_entries:
        raise ResourceLimit('Pairing entries exceed budget; no rank or vanishing claim')
    P=Pairing(6,seconds=seconds,max_calls=max_calls,max_cache=max_cache)
    a=[]
    for u in us:
        if monotonic()-start>seconds:raise ResourceLimit('Pairing time budget')
        a.append([P.evaluate(u,v)%prime for v in vs])
    rows,cols=minor_rank(a,prime)
    transports=orbit_for(grade)
    if rows:
        mat=[[a[i][j] for j in cols] for i in rows]
        det=determinant_mod(mat,prime)
        if not det:raise AssertionError('Selected minor is singular')
        block={'permutationDegree':list(grade),'words':word_json([us[i] for i in rows]),
               'dualWords':word_json([vs[i] for i in cols]),
               'matrixModPrime':mat,'determinantModPrime':det,
               'transports':[list(t) for t in transports.values()]}
        blocks=[block]
    else:blocks=[]
    total=len(rows)*len(transports)
    cert={'claim':'COMPLEMENTARY_COSET_MINOR','ambientFK':6,'degree':seed['degree']+1,
          'prime':prime,'targetField':'Q','rankLowerBound':total,
          'quotient':'star_(n-1)/(star_(n-1)*star_(n-2)^+), left quotient; reversal preserves dimensions',
          'blocks':blocks,'boundaryPreservingSymmetry':True,'symmetryGroupOrder':24,
          'basisOrExactDimensionClaim':False,'FKEqualsNicholsAssumed':False,
          'knownCoefficientUsedToSelectWords':False,
          'orbitDiscovery06':{'baseGrade':list(grade),'orbitSize':len(transports),
              'sourceSeedDegree':seed['degree'],'rowCandidates':len(us),'columnCandidates':len(vs),
              'evaluatedEntries':len(us)*len(vs),'pivotRankPerGrade':len(rows),
              'elapsedSeconds':round(monotonic()-start,3),
              'zeroMeansInconclusive':True,
              'rightModuleUpperGradeConvention':'inverse(baseGrade)'}}
    if independent_replay:
        verify_coset(cert,independent=True,max_entries=max_entries,seconds=max(seconds,30))
    return cert


def merge_sectors(items:list[dict],degree:int)->dict:
    """Merge separately discovered disjoint S4 orbits, without filling missing orbits.

    The returned certificate is in the existing v0.5 schema; replay it before
    treating rankLowerBound as authoritative. Even full orbit coverage need not
    mean candidate/basis completeness.
    """
    expected=set(representatives(degree));seen=set();blocks=[];rank=0;primes=set()
    for item in items:
        if item.get('claim')!='COMPLEMENTARY_COSET_MINOR' or item.get('ambientFK')!=6 or item.get('degree')!=degree:
            raise ValueError('Incompatible degree or certificate')
        sec=item.get('orbitDiscovery06')
        if not isinstance(sec,dict):raise ValueError('Not an orbit discovery certificate')
        g=tuple(sec['baseGrade'])
        if g not in expected or g in seen:raise ValueError('Duplicate or illegal sector')
        seen.add(g);primes.add(item['prime']);blocks.extend(item['blocks']);rank+=item['rankLowerBound']
    if len(primes)!=1:raise ValueError('Single prime is required for a combined certificate')
    result={'claim':'COMPLEMENTARY_COSET_MINOR','ambientFK':6,'degree':degree,'prime':next(iter(primes)),
            'targetField':'Q','rankLowerBound':rank,
            'quotient':'star_(n-1)/(star_(n-1)*star_(n-2)^+), left quotient; reversal preserves dimensions',
            'blocks':blocks,'boundaryPreservingSymmetry':True,'symmetryGroupOrder':24,
            'basisOrExactDimensionClaim':False,'FKEqualsNicholsAssumed':False,'knownCoefficientUsedToSelectWords':False,
            'orbitCoverage06':{'attempted':len(seen),'all':len(expected),'complete':seen==expected,
                'unattempted':[list(g) for g in sorted(expected-seen)],
                'warning':'Complete orbit coverage is NOT proof of full rank'}}
    return result
