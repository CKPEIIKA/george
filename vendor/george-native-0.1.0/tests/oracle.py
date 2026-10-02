"""Independent, intentionally small Python/Fraction oracle, no kernel index reuse."""
from fractions import Fraction
from collections import defaultdict

def poly(rel):return {tuple(t['word']):Fraction(t['coefficient']) for t in rel['terms']}
def clean(p):return {w:c for w,c in p.items() if c}
def scaled_context(p,left=(),right=(),scale=1):return {left+w+right:c*scale for w,c in p.items()}
def diff(a,b):
    p=dict(a)
    for w,c in b.items():p[w]=p.get(w,0)-c
    return clean(p)
def normal(p,basis):
    p={w:Fraction(c) for w,c in p.items() if c}
    leaders=[max(g) for g in basis if g]
    steps=0
    while True:
        changed=False
        for w in sorted(p,reverse=True):
            for lm,g in zip(leaders,basis):
                for j in range(len(w)-len(lm)+1):
                    if w[j:j+len(lm)]==lm:
                        p=diff(p,scaled_context(g,w[:j],w[j+len(lm):],p[w]/g[lm]));changed=True;break
                if changed:break
            if changed:break
        if not changed:return p
        steps+=1
        if steps>100000:raise RuntimeError('Oracle reduction limit')
def criticals(basis,D):
    for f in basis:
        u=max(f)
        for g in basis:
            v=max(g)
            for k in range(1,min(len(u),len(v))):
                if len(u)+len(v)-k<=D and u[-k:]==v[:k]:
                    yield diff(scaled_context(f,right=v[k:],scale=Fraction(1,f[u])),scaled_context(g,left=u[:-k],scale=Fraction(1,g[v])))
            for j in range(len(u)-len(v)+1):
                if len(u)<=D and u[j:j+len(v)]==v:
                    yield diff(scaled_context(f,scale=Fraction(1,f[u])),scaled_context(g,left=u[:j],right=u[j+len(v):],scale=Fraction(1,g[v])))
def certify(basis,relations,D):
    for r in relations:
        if r['degree']<=D:assert normal(poly(r),basis)=={},'Input not in output ideal'
    count=0
    for c in criticals(basis,D):
        assert normal(c,basis)=={},'Unresolved critical pair'
        count+=1
    return count

def hilbert(leaders,n,D):
    """Finite forbidden-word automaton + integer DP. Never enumerates n**D words."""
    leaders=set(leaders);states={()}
    for w in leaders:
        states.update(w[:j] for j in range(1,len(w)))
    states=sorted(states);ids={w:i for i,w in enumerate(states)};trans=[]
    for s in states:
        row=[]
        for a in range(n):
            w=s+(a,)
            if any(w[-k:] in leaders for k in range(1,len(w)+1)):row.append(-1);continue
            while w not in ids:w=w[1:]
            row.append(ids[w])
        trans.append(row)
    vec=[0]*len(states);vec[ids[()]]=1;out=[1]
    for d in range(D):
        new=[0]*len(states)
        for i,c in enumerate(vec):
            if c:
                for j in trans[i]:
                    if j>=0:new[j]+=c
        vec=new;out.append(sum(vec))
    return out

def complete(relations,D):
    """Independent tiny degreewise Buchberger completion, for test cases only."""
    basis=[]
    def insert(p):
        r=normal(p,basis)
        if r:
            lc=r[max(r)]
            basis.append({w:c/lc for w,c in r.items()})
    for degree in range(1,D+1):
        for r in relations:
            if r['degree']==degree:insert(poly(r))
        older=list(basis)
        for f in older:
            u=max(f)
            for g in older:
                v=max(g)
                k=len(u)+len(v)-degree
                if 0<k<min(len(u),len(v)) and u[-k:]==v[:k]:
                    insert(diff(scaled_context(f,right=v[k:],scale=Fraction(1,f[u])),scaled_context(g,left=u[:-k],scale=Fraction(1,g[v]))))
    return basis
