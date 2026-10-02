"""Bounded signature algorithm for homogeneous free algebras (research oracle).

Not the WASM production kernel. Exact Fraction coefficients; fair bimodule order
(total weighted degree, generator position, left degree-lex, right degree-lex).
Regular reductions only; zero-signature divisibility and singular criteria.
No claim of F5's implicit trivial-syzygy criterion or cover verification here.
The result must be compared to an independent ordinary GB in tests.
"""
from fractions import Fraction
from heapq import heappush, heappop
from dataclasses import dataclass
from collections import Counter
import sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from oracle import poly, clean, diff, scaled_context

@dataclass(frozen=True)
class Signature:
    left:tuple
    position:int
    right:tuple
    def context(self,a=(),b=()):
        return Signature(a+self.left,self.position,self.right+b)
    def key(self,degrees):
        return (len(self.left)+degrees[self.position]+len(self.right),self.position,len(self.left),self.left,self.right)
    def divides(self,t):
        return (self.position==t.position and len(self.left)<=len(t.left)
                and len(self.right)<=len(t.right)
                and (not self.left or t.left[-len(self.left):]==self.left)
                and t.right[:len(self.right)]==self.right)

@dataclass
class Label:
    p:dict
    signature:Signature

def complete(relations,D,*,syzygies=True,singular=True,max_tasks=500000):
    degrees=[r['degree'] for r in relations]
    G=[]; H=[]; pending=[]; serial=0; counts=Counter(); started=time.perf_counter()
    def key(s):return s.key(degrees)
    def put(p,s):
        nonlocal serial
        if key(s)[0]>D:return
        heappush(pending,(key(s),serial,p,s));serial+=1;counts['queued']+=1
    for i,r in enumerate(relations):put(poly(r),Signature((),i,()))
    known=set()
    def induced(g,w,j):return g.signature.context(w[:j],w[j+len(max(g.p)):])
    def reductions(p,s,only_top=False,equal=False):
        for w in ([max(p)] if only_top and p else sorted(p,reverse=True)):
            for g in G:
                lm=max(g.p)
                for j in range(len(w)-len(lm)+1):
                    if w[j:j+len(lm)]!=lm:continue
                    comparison=key(induced(g,w,j))
                    allowed = (comparison==key(s)) if equal else (comparison<key(s))
                    if allowed:
                        yield w,g,j
    def normal(p,s):
        p=clean(p)
        while True:
            found=next(reductions(p,s),None)
            if found is None:return p
            w,g,j=found;lm=max(g.p)
            p=diff(p,scaled_context(g.p,w[:j],w[j+len(lm):],p[w]/g.p[lm]));counts['reduction_steps']+=1
    def composition(f,g,leftf=(),rightf=(),leftg=(),rightg=()):
        sf=f.signature.context(leftf,rightf);sg=g.signature.context(leftg,rightg)
        if sf==sg:counts['singular_pairs']+=1;return
        signature=sf if key(sf)>key(sg) else sg
        if key(signature)[0]>D:return
        p=diff(scaled_context(f.p,leftf,rightf,1/f.p[max(f.p)]),scaled_context(g.p,leftg,rightg,1/g.p[max(g.p)]))
        put(p,signature)
    def pairs(f,g):
        u,v=max(f.p),max(g.p)
        for k in range(1,min(len(u),len(v))):
            if u[-k:]==v[:k]:composition(f,g,rightf=v[k:],leftg=u[:-k])
        for j in range(len(u)-len(v)+1):
            if u[j:j+len(v)]==v:composition(f,g,leftg=u[:j],rightg=u[j+len(v):])
    while pending:
        _,_,p,s=heappop(pending);counts['processed']+=1
        if counts['processed']>max_tasks:raise RuntimeError('Research task limit reached; result not certified')
        if syzygies and any(h.divides(s) for h in H):counts['syzygy_skips']+=1;continue
        if singular and s in known:counts['known_signature_skips']+=1;continue
        counts['regular_reductions']+=1;p=normal(p,s)
        if not p:
            H.append(s);counts['zero_reductions']+=1;continue
        if singular and next(reductions(p,s,only_top=True,equal=True),None) is not None:
            counts['singular_top_skips']+=1;continue
        c=p[max(p)];label=Label({w:v/c for w,v in p.items()},s)
        for g in G:
            pairs(label,g);pairs(g,label)
        pairs(label,label);G.append(label);known.add(s)
    counts.update(labelled_rules=len(G),zero_signatures=len(H))
    return [g.p for g in G],dict(counts),time.perf_counter()-started
