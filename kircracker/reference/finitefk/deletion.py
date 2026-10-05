"""BLM's right action nabla, NOT core.right_derivative R.

(PQ)nabla_e=P(Q nabla_e)+(P nabla_{sigma_Q(e)})Q.
Every output word is a subsequence of its input; edge subalgebras are preserved.
Positive scalar chains imply NONZERO. Failed/zero chains never prove FK6 zero.
"""
from time import monotonic
from .core import edge,clean,reverse,deserialize,serialize,permutation_degree
from .budgeted import InconclusiveBudget

def derivative(poly,e,n,prune_squares=False):
    e,sg=edge(*e);out={}
    for w,c in poly.items():
        perm=list(range(n+1))
        for k in range(len(w)-1,-1,-1):
            x,y=perm[e[0]],perm[e[1]]
            a,b=w[k]
            if (min(x,y),max(x,y))==(a,b):
                v=w[:k]+w[k+1:]
                if not prune_squares or not any(v[i]==v[i+1] for i in range(len(v)-1)):
                    out[v]=out.get(v,0)+c*sg*(1 if x<y else -1)
            # sigma_(a b suffix) = (a b) sigma_suffix: swap values.
            ia=perm.index(a);ib=perm.index(b);perm[ia],perm[ib]=perm[ib],perm[ia]
    return clean(out)

def reference(poly,e,n,prune_squares=False):
    """Independent full-suffix recomputation; no incremental permutation state."""
    e,sg=edge(*e);out={}
    for w,c in poly.items():
        for k,q in enumerate(w):
            p=permutation_degree(w[k+1:],n);a,b=p[e[0]-1],p[e[1]-1]
            if q!=(min(a,b),max(a,b)):continue
            v=w[:k]+w[k+1:]
            if prune_squares and any(v[i]==v[i+1] for i in range(len(v)-1)):continue
            out[v]=out.get(v,0)+c*sg*(1 if a<b else -1)
    return clean(out)

def replay(poly,chain,n,*,max_terms=50000,seconds=20,prune_squares=True,independent=False):
    if n<2 or max_terms<1 or seconds<=0:raise ValueError('Invalid replay parameters')
    start=monotonic();peak=len(poly);fn=reference if independent else derivative
    for i,e in enumerate(chain):
        if monotonic()-start>seconds:raise InconclusiveBudget('Nabla time budget; no vanishing conclusion')
        poly=fn(poly,tuple(e),n,prune_squares)
        peak=max(peak,len(poly))
        if peak>max_terms:raise InconclusiveBudget('Nabla term budget; no vanishing conclusion')
    return poly,{'steps':len(chain),'peakTerms':peak,'seconds':monotonic()-start,'operator':'BLM nabla','pruneSquares':prune_squares}

def convert_R_witness(cert):
    """Pairing symmetry: reverse the input and reverse the entire R chain.
    Not an assertion that individual nabla and R operators are equal.
    """
    if cert.get('claim')!='NONZERO':raise ValueError('Expected positive R witness')
    ans={'claim':'NABLA_NONZERO','n':int(cert['n']),'polynomial':serialize(reverse(deserialize(cert['polynomial']))),'derivatives':list(reversed(cert['derivatives'])),'scalar':cert['scalar'],'conversion':'BLM Proposition3.5 and R=rev Delta rev; reverse input AND chain'}
    return ans

def check(cert,independent=False,**budgets):
    if cert.get('claim')!='NABLA_NONZERO':raise ValueError('Wrong claim')
    n=int(cert['n']);p=deserialize(cert['polynomial']);ch=cert['derivatives'];expected=int(cert['scalar'])
    if not expected or len({len(w) for w in p})!=1 or any(len(w)!=len(ch) for w in p):raise ValueError('Need nonzero homogeneous full-degree chain')
    if any(max(e)>n for w in p for e in w) or any(len(e)!=2 or not 1<=min(e)<max(e)<=n for e in ch):raise ValueError('Bad edge')
    q,info=replay(p,ch,n,independent=independent,**budgets)
    if q!={():expected}:raise ValueError('Nabla scalar mismatch')
    return {'passed':True,'claim':'NONZERO','degree':len(ch),'scalar':expected,**info}

def all_derivatives(poly,n,prune_squares=True,prune_squarefree=False):
    """Inverse suffix update produces every ambient derivative in one pass.
    The optional squarefree-block rule is only enabled for actual star words.
    """
    out={}
    for w,c in poly.items():
        inv=list(range(n+1))
        for k in range(len(w)-1,-1,-1):
            a,b=w[k];u,v=inv[a],inv[b];e=(min(u,v),max(u,v));sign=1 if u<v else -1
            z=w[:k]+w[k+1:]
            drop=prune_squares and any(z[i]==z[i+1] for i in range(len(z)-1))
            if not drop and prune_squarefree:
                if any(n not in q for q in z):raise ValueError('Squarefree-block pruning requires a star word')
                for size in range(2,min(n-1,len(z)//2)+1):
                    if any(z[j:j+size]==z[j+size:j+2*size] and len(set(z[j:j+size]))==size for j in range(len(z)-2*size+1)):
                        drop=True;break
            if not drop:
                d=out.setdefault(e,{});d[z]=d.get(z,0)+c*sign
            inv[a],inv[b]=inv[b],inv[a]
    return {e:p for e,d in out.items() if (p:=clean(d))}

def find_witness(poly,n,max_states=1000,max_terms=3000,seconds=10):
    """Budgeted DFS with memoization. Exhaustion is INCONCLUSIVE, not ZERO."""
    start=monotonic();states=0;seen=set();peak=0
    def go(p):
        nonlocal states,peak
        states+=1;peak=max(peak,len(p))
        if states>max_states or len(p)>max_terms or monotonic()-start>seconds:raise InconclusiveBudget('Nabla witness search budget')
        if not p:return None
        if set(p)=={()}:return [],p[()]
        key=tuple(sorted(p.items()))
        if key in seen:return None
        seen.add(key)
        ds=all_derivatives(p,n)
        for e,q in sorted(ds.items(),key=lambda v:(len(v[1]),max(map(abs,v[1].values())),v[0])):
            if len(q)>max_terms:continue
            z=go(q)
            if z is not None:ch,c=z;return [e]+ch,c
        return None
    try:z=go(poly)
    except InconclusiveBudget:z=None
    if z is None:return {'claim':'INCONCLUSIVE','states':states,'peakTerms':peak,'seconds':monotonic()-start,'notAVanishingTest':True}
    chain,c=z
    result={'claim':'NABLA_NONZERO','n':n,'polynomial':serialize(poly),'derivatives':[list(e) for e in chain],'scalar':str(c),'searchStates':states,'peakSearchTerms':peak,'searchSeconds':monotonic()-start}
    check(result);return result


def reference_all(poly,n):
    """All derivatives from separately recomputed suffix permutations."""
    out={}
    for w,c in poly.items():
        for k,(a,b) in enumerate(w):
            suffix=permutation_degree(w[k+1:],n)
            u=suffix.index(a)+1;v=suffix.index(b)+1;e=(min(u,v),max(u,v))
            word=w[:k]+w[k+1:]
            if any(word[i]==word[i+1] for i in range(len(word)-1)):continue
            row=out.setdefault(e,{});row[word]=row.get(word,0)+c*(1 if u<v else -1)
    return {e:p for e,row in out.items() if (p:=clean(row))}
