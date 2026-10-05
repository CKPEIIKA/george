"""FK-only structural decomposition and exact small-degree rank oracle.

Rows are original contextual defining relations, NOT Nichols-derivative rows.
One (permutation degree, support partition) representative is solved per S_n orbit.
This computes finite homogeneous spaces, not a full Groebner basis. It is a toy
certificate oracle and future scheduler reference; raw word enumeration is bounded.
"""
from __future__ import annotations
from collections import Counter,defaultdict
from fractions import Fraction as Q
from itertools import combinations,product
from math import factorial
from time import perf_counter
from .core import relations,permutation_degree,support_partition,perm_action

class ResourceLimit(RuntimeError):pass

def key(w,n):return permutation_degree(w,n),support_partition(w,n)

def cycle_lengths(p,block):
    unseen=set(block);lens=[]
    while unseen:
        x=min(unseen);y=x;d=0
        while y in unseen:
            unseen.remove(y);d+=1;y=p[y-1]
        if y!=x:raise ValueError('Permutation does not preserve the support block')
        lens.append(d)
    return tuple(sorted(lens,reverse=True))

def orbit_type(k):
    p,blocks=k
    return tuple(sorted((len(b),cycle_lengths(p,b)) for b in blocks))

def orbit_size(typ):
    n=sum(s for s,cy in typ);den=1
    for multiplicity in Counter(typ).values():den*=factorial(multiplicity)
    for size,cy in typ:
        if sum(cy)!=size:raise ValueError('Invalid orbit type')
        for length,multiplicity in Counter(cy).items():den*=length**multiplicity*factorial(multiplicity)
    if factorial(n)%den:raise ValueError('Orbit denominator is not integral')
    return factorial(n)//den

class ExactRows:
    """Sparse rational elimination, with optional explicit relation provenance."""
    def __init__(self):self.pivots={};self.operations=0;self.input_rows=0
    def add(self,row):
        self.input_rows+=1;p={w:Q(c) for w,c in row.items() if c}
        while p:
            k=max(p);a=p[k]
            if k not in self.pivots:
                self.pivots[k]={w:c/a for w,c in p.items()};return True
            for w,c in self.pivots[k].items():
                self.operations+=1;v=p.get(w,0)-a*c
                if v:p[w]=v
                else:p.pop(w,None)
        return False
    def reduce(self,row):
        p={w:Q(c) for w,c in row.items() if c};out={}
        while p:
            k=max(p);a=p[k]
            if k not in self.pivots:out[k]=p.pop(k);continue
            for w,c in self.pivots[k].items():
                v=p.get(w,0)-a*c
                if v:p[w]=v
                else:p.pop(w,None)
        return out


def degree_oracle(n,d,*,symmetry=True,max_words=100000,max_rows=200000):
    """Exact dimension from the entire degree-d ideal component over Q.

    All positions of every homogeneous quadratic input are used. Resource limits
    return an error, not a guessed rank or dimension. A partial row sample is not
    a lower bound on quotient dimension and is never accepted here.
    """
    if not 2<=n<=6 or d<0:raise ValueError('Supported research range n=2..6, d>=0')
    es=tuple(combinations(range(1,n+1),2));rs=relations(n);m=len(es)
    row_count=(d-1)*len(rs)*m**(d-2) if d>=2 else 0
    if m**d>max_words or row_count>max_rows:raise ResourceLimit('Finite-rank oracle exceeds explicit enumeration budget')
    start=perf_counter();bykey=defaultdict(list);wordkeys={};bytype=defaultdict(list)
    for w in product(es,repeat=d):
        k=key(w,n);wordkeys[w]=k;bykey[k].append(w)
    for k in bykey:bytype[orbit_type(k)].append(k)
    selected={min(keys) if symmetry else k for keys in bytype.values() for k in (keys if not symmetry else keys[:1])}
    spaces={k:ExactRows() for k in selected};selections={t:min(keys) for t,keys in bytype.items()}
    visited=0
    if d>=2:
        for at in range(d-1):
            for left in product(es,repeat=at):
                for right in product(es,repeat=d-at-2):
                    for rel in rs:
                        visited+=1;first=next(iter(rel));k=wordkeys[left+first+right]
                        if k not in spaces:continue
                        row={left+w+right:c for w,c in rel.items()}
                        if any(wordkeys[w]!=k for w in row):raise AssertionError('Defining relation not homogeneous in structural sector')
                        spaces[k].add(row)
    assert visited==row_count
    data=[];total=0;represented_rows=0
    for typ,keys in sorted(bytype.items()):
        rep=selections[typ];multiplicity=orbit_size(typ)
        assert multiplicity==len(keys),(typ,multiplicity,len(keys))
        dim=len(bykey[rep]);rank=len(spaces[rep].pivots);h=dim-rank
        assert all(len(bykey[k])==dim for k in keys)
        if not symmetry:assert all(len(spaces[k].pivots)==rank for k in keys)
        total+=multiplicity*h;represented_rows+=multiplicity*spaces[rep].input_rows
        data.append({'orbitType':[[s,list(cy)] for s,cy in typ],
          'representativePermutation':list(rep[0]),'representativeSupport':[list(b) for b in rep[1]],
          'multiplicity':multiplicity,'columnsPerSector':dim,'rankPerSector':rank,'dimensionPerSector':h,
          'originalRelationRowsPerSector':spaces[rep].input_rows,'rowOperationsPerRepresentative':spaces[rep].operations})
    assert represented_rows==row_count
    return {'claim':'EXACT_FK_DEGREE_DIMENSION','field':'Q','ambientFK':n,'degree':d,'dimension':total,
      'method':'all original homogeneous contextual rows, exact rational elimination; signed S_n sector transport' if symmetry else 'all original homogeneous contextual rows, each structural sector eliminated independently',
      'symmetryEnabled':symmetry,'rawWords':m**d,'rawContextRows':row_count,
      'sectors':len(bykey),'orbitRepresentatives':len(bytype),
      'eliminatedRows':sum(s.input_rows for s in spaces.values()),
      'rowOperations':sum(s.operations for s in spaces.values()),'orbits':data,'seconds':perf_counter()-start,
      'originalIdealNotNicholsQuotient':True,'globallyCompleteBasisClaim':False}


def check_oracle(report,*,uncompressed=False):
    if report.get('claim')!='EXACT_FK_DEGREE_DIMENSION' or report.get('field')!='Q':raise ValueError('Not a supported verified oracle')
    new=degree_oracle(report['ambientFK'],report['degree'],symmetry=not uncompressed,max_words=1000000,max_rows=1500000)
    for k in ['dimension','rawWords','rawContextRows','sectors','orbitRepresentatives','orbits']:
        if new[k]!=report[k]:
            # only arithmetic operation counters in full replay may differ because ordering is identical normally
            raise ValueError('Oracle does not replay: '+k)
    return {'passed':True,'dimension':new['dimension'],'degree':new['degree'],'fullSectorReplay':uncompressed}


def symmetry_preserves_inputs(n):
    rs=relations(n);S=ExactRows()
    for r in rs:S.add(r)
    checked=0
    for i in range(1,n):
        p=list(range(1,n+1));p[i-1],p[i]=p[i],p[i-1]
        for r in rs:
            out={}
            for w,c in r.items():
                v,s=perm_action(w,tuple(p));out[v]=out.get(v,0)+s*c
            if S.reduce(out):raise AssertionError('Permutation does not preserve defining ideal')
            checked+=1
    return checked
