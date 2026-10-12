"""Exact central projectors for boundary-preserving permutation-grade sectors.

Projectors act on actual word spans; no lexicographic quotient basis is assumed
equivariant. They supply sparse group-algebra coefficients for a future native
block implementation and a bounded exact reference implementation now.
"""
from fractions import Fraction
from itertools import product
from .grade_orbits06 import ID6, subgroup_stabilizer, orbit
from .representation_blocks import IRREPS, class_index
from .core import perm_action
from .coset_pairing import prime_check


def compose(a,b):
    return tuple(a[i-1] for i in b)


def add(a,b,scale=1):
    out=dict(a)
    for g,c in b.items():
        v=out.get(g,0)+scale*c
        if v:out[g]=v
        else:out.pop(g,None)
    return out


def multiply(a,b):
    out={}
    for g,c in a.items():
        for h,d in b.items():
            k=compose(g,h);v=out.get(k,0)+c*d
            if v:out[k]=v
            else:out.pop(k,None)
    return out


def projectors(grade):
    """Orthogonal central rational projectors summing exactly to identity.

    For full S4 use its five rational irreducible characters. Smaller sector
    stabilizers have order <=8: enumerate their linear sign characters and
    retain the exact complementary block. Cyclic nonreal characters stay in a
    rational block; no splitting field or universal speedup is presumed.
    """
    group=subgroup_stabilizer(tuple(grade));order=len(group);out=[]
    if order==24:
        for name,(dim,chi) in IRREPS.items():
            ring={g:Fraction(dim*chi[class_index(g)],order) for g in group
                  if chi[class_index(g)]}
            out.append((name,ring))
    else:
        nonidentity=[g for g in group if g!=ID6]
        for values in product((0,1),repeat=len(nonidentity)):
            bits={ID6:0,**dict(zip(nonidentity,values))}
            if any(bits[compose(g,h)]!=(bits[g]^bits[h]) for g in group for h in group):
                continue
            name='linear-'+''.join(map(str,values))
            out.append((name,{g:Fraction(-1 if bits[g] else 1,order) for g in group}))
        remainder={ID6:Fraction(1)}
        for _,p in out:remainder=add(remainder,p,-1)
        if remainder:out.append(('rational-complement',remainder))
    total={}
    for _,p in out:total=add(total,p)
    if total!={ID6:Fraction(1)}:raise ValueError('Projectors do not sum to identity')
    for i,(_,p) in enumerate(out):
        if multiply(p,p)!=p:raise ValueError('Invalid idempotent')
        for _,q in out[:i]:
            if multiply(p,q) or multiply(q,p):raise ValueError('Projectors are not orthogonal')
    return group,out


def catalog(grade):
    grade=tuple(grade);group,blocks=projectors(grade)
    return {'claim':'EXACT_SECTOR_STABILIZER_PROJECTORS','grade':list(grade),
            'orbitSize':len(orbit(grade)),'stabilizerSize':len(group),
            'group':[list(g) for g in group],
            'blocks':[{'id':name,'groupAlgebraTerms':[
                {'permutation':list(g),'coefficient':str(c)} for g,c in sorted(p.items())]}
                      for name,p in blocks],
            'orthogonalityAndIdentityChecked':True,
            'quotientBasisCompletenessClaim':False,'rankOrHilbertClaim':False,
            'scope':'Exact rational group-algebra identities; speed depends on certified equivariant coordinates.'}


def project_words(grade,words,*,prime=None,max_terms=100000):
    """Project a bounded candidate word span with exact signed transports.

    Output spans each projected candidate space; independence is not asserted.
    Applying a projector does not prove that a vector is nonzero in a quotient.
    """
    from .core import permutation_degree
    grade=tuple(grade);group,blocks=projectors(grade)
    if type(max_terms)is not int or max_terms<1:raise ValueError('Positive term budget required')
    if not isinstance(words,(list,tuple)) or len(words)>max_terms:
        raise ValueError('A bounded candidate word sequence is required')
    if prime is not None:
        prime_check(prime)
        if len(group)%prime==0:raise ValueError('Characteristic divides stabilizer order')
    vectors=[];used=0
    for name,ring in blocks:
        columns=[]
        for word in words:
            word=tuple(tuple(e) for e in word)
            if (any(len(e)!=2 or any(type(a)is not int for a in e)
                    or not 1<=e[0]<e[1]<=6 for e in word)
                or permutation_degree(word,6)!=grade):
                raise ValueError('Invalid candidate word or sector')
            vector={}
            for g,c in ring.items():
                w,sign=perm_action(word,g)
                value=c*sign
                if prime is not None:
                    value=value.numerator*pow(value.denominator,-1,prime)%prime
                value=vector.get(w,0)+value
                if prime is not None:value%=prime
                if value:vector[w]=value
                else:vector.pop(w,None)
            used+=len(vector)
            if used>max_terms:raise ValueError('Projected term budget exhausted; no rank claim')
            columns.append([[list(map(list,w)),str(c)] for w,c in sorted(vector.items())])
        vectors.append({'id':name,'candidateColumns':columns})
    return {'claim':'PROJECTED_SECTOR_WORD_CANDIDATES','grade':list(grade),
            'field':'Q' if prime is None else f'F_{prime}',
            'projectors':catalog(grade),'blocks':vectors,'retainedTerms':used,
            'basisClaim':False,'nonzeroInQuotientClaim':False,'rankClaim':False}
