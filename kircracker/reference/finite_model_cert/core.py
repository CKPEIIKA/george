"""Exact FK-specific calculus. No Groebner completion or fitted relations.

Convention: oriented generators x_ij=-x_ji; positive pairs i<j are stored.
R_e(PQ)=P R_e(Q)+R_e(P) s_e(Q) (the right operator in
Barligea 2001.04597v2, Sec.4.2). This equals rev(Delta_e(rev(P))).
It is NOT the alternate right operator nabla in Blasiak-Liu-Meszaros.
A nonzero constant derivative chain is a nonvanishing certificate.
Failure to find one is NEVER a zero certificate for FK6.
"""
from __future__ import annotations
from dataclasses import dataclass
from itertools import combinations
from typing import Iterable

Edge=tuple[int,int]
Word=tuple[Edge,...]
Poly=dict[Word,int]

def edge(i:int,j:int)->tuple[Edge,int]:
    if i==j or min(i,j)<1:raise ValueError('Use distinct positive vertex labels')
    return ((i,j),1) if i<j else ((j,i),-1)

def clean(p:Poly)->Poly:return {w:c for w,c in p.items() if c}
def add(*polys:Poly)->Poly:
    ans:Poly={}
    for p in polys:
        for w,c in p.items():ans[w]=ans.get(w,0)+c
    return clean(ans)
def scale(p:Poly,c:int)->Poly:return {w:c*v for w,v in p.items() if c*v}
def mul(p:Poly,q:Poly)->Poly:
    out:Poly={}
    for w,a in p.items():
        for v,b in q.items():out[w+v]=out.get(w+v,0)+a*b
    return clean(out)
def X(i:int,j:int)->Poly:
    e,s=edge(i,j);return {(e,):s}
def monomial(*es:Edge)->Poly:
    w=[];c=1
    for i,j in es:e,s=edge(i,j);w.append(e);c*=s
    return {tuple(w):c}
def reverse(p:Poly)->Poly:return {tuple(reversed(w)):c for w,c in p.items()}

def transposition_action(w:Word,e:Edge)->tuple[Word,int]:
    a,b=e;out=[];sg=1
    def sw(i):return b if i==a else a if i==b else i
    for i,j in w:
        q,t=edge(sw(i),sw(j));out.append(q);sg*=t
    return tuple(out),sg

def perm_action(w:Word,perm:tuple[int,...])->tuple[Word,int]:
    out=[];sg=1
    for i,j in w:q,t=edge(perm[i-1],perm[j-1]);out.append(q);sg*=t
    return tuple(out),sg

def right_derivative(p:Poly,e:Edge)->Poly:
    e,orientation=edge(*e);ans:Poly={}
    for w,c in p.items():
        for k,q in enumerate(w):
            if q==e:
                v,s=transposition_action(w[k+1:],e);z=w[:k]+v
                ans[z]=ans.get(z,0)+orientation*s*c
    return clean(ans)

def left_derivative(p:Poly,e:Edge)->Poly:
    """Independent prefix-loop version; rev L rev = R is tested."""
    e,orientation=edge(*e);ans:Poly={}
    for w,c in p.items():
        for k,q in enumerate(w):
            if q==e:
                v,s=transposition_action(w[:k],e);z=v+w[k+1:]
                ans[z]=ans.get(z,0)+orientation*s*c
    return clean(ans)

def apply_chain(p:Poly,chain:Iterable[Edge])->Poly:
    for e in chain:p=right_derivative(p,e)
    return p

def relations(n:int)->list[Poly]:
    if n<2:raise ValueError('n>=2 required')
    es=list(combinations(range(1,n+1),2));out=[]
    for e in es:out.append({(e,e):1})
    for a,b in combinations(es,2):
        if set(a).isdisjoint(b):out.append({(a,b):1,(b,a):-1})
    for i,j,k in combinations(range(1,n+1),3):
        a,b,c=(i,j),(j,k),(i,k)
        out.extend([{(a,b):1,(b,c):-1,(c,a):-1},
                    {(b,a):1,(c,b):-1,(a,c):-1}])
    return out

def permutation_degree(w:Word,n:int)->tuple[int,...]:
    # Right multiplication by (i j): swap images of i,j.
    p=list(range(1,n+1))
    for i,j in w:p[i-1],p[j-1]=p[j-1],p[i-1]
    return tuple(p)

def support_partition(w:Word,n:int)->tuple[tuple[int,...],...]:
    parent=list(range(n+1))
    def find(i):
        while i!=parent[i]:i=parent[i]
        return i
    for i,j in w:parent[find(j)]=find(i)
    blocks={}
    for i in range(1,n+1):blocks.setdefault(find(i),[]).append(i)
    return tuple(sorted(tuple(v) for v in blocks.values()))

def serialize(p:Poly)->list[dict]:
    return [{'word':[list(e) for e in w],'coefficient':str(c)} for w,c in sorted(p.items())]
def deserialize(rows:list[dict])->Poly:
    out={}
    for r in rows:
        w=tuple(tuple(map(int,e)) for e in r['word']);c=int(r['coefficient'])
        if any(i>=j or i<1 for i,j in w):raise ValueError('Expected canonical positive edges')
        out[w]=out.get(w,0)+c
    return clean(out)
def show(p:Poly)->str:
    if not p:return '0'
    return ' + '.join(f'{c}*'+('*'.join(f'x{i}{j}' for i,j in w) or '1') for w,c in sorted(p.items()))

def check_witness(witness:dict)->dict:
    if witness.get('claim')!='NONZERO':raise ValueError('Only NONZERO certificates supported')
    n=int(witness['n']);p=deserialize(witness['polynomial']);chain=[tuple(e) for e in witness['derivatives']]
    if any(max(e)>n for w in p for e in w) or any(min(e)<1 or max(e)>n or e[0]==e[1] for e in chain):raise ValueError('Bad vertex')
    target=int(witness['scalar']);ans=apply_chain(p,chain)
    if not target or ans!={():target}:raise ValueError(f'Nonvanishing certificate failed: got {ans}, expected {target}')
    return {'passed':True,'claim':'NONZERO','n':n,'degree':len(chain),'scalar':str(ans[()]),'method':'exact braided derivatives; no Groebner calculation'}

class SearchBudget(Exception):pass

def find_witness(p:Poly,n:int,max_states:int=3000,max_terms:int=10000)->dict:
    """Bounded DFS. A negative result is only INCONCLUSIVE, never ZERO."""
    if n<2 or max_states<1 or max_terms<1:raise ValueError('Positive search budgets and n>=2 required')
    es=list(combinations(range(1,n+1),2));states=0;seen=set();max_seen=0
    def go(q):
        nonlocal states,max_seen
        states+=1;max_seen=max(max_seen,len(q))
        if states>max_states or len(q)>max_terms:raise SearchBudget
        if not q:return None
        if set(q)=={()}:return [],q[()]
        k=tuple(sorted(q.items()))
        if k in seen:return None
        seen.add(k);choices=[]
        for e in es:
            r=right_derivative(q,e)
            if r:choices.append((len(r),max(map(abs,r.values())),e,r))
        choices.sort(key=lambda t:(t[0],t[1],t[2]))
        for _,_,e,r in choices:
            got=go(r)
            if got is not None:ch,c=got;return [e]+ch,c
        return None
    try:ans=go(p)
    except SearchBudget:ans=None
    if ans is None:return {'claim':'INCONCLUSIVE','states':states,'maxTerms':max_seen,'reason':'No nonzero derivative chain found within this search; does not establish vanishing in FK6.'}
    chain,c=ans
    result={'claim':'NONZERO','n':n,'polynomial':serialize(p),'derivatives':[list(e) for e in chain],'scalar':str(c),'states':states,'maxTerms':max_seen}
    check_witness(result);return result
