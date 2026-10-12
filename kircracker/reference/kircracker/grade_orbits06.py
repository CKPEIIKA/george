"""S4-conjugation grades for FK6 complementary star pairings (1-based labels).

This is an exact finite combinatorial module. It deliberately does not identify
algebraic normal words with a group-stable basis: symmetry is applied to actual
words and to pairing minors, never to an assumed lexicographic Groebner basis.
"""
from __future__ import annotations
from itertools import permutations
from functools import lru_cache
from .coset_pairing import conjugate, inverse

ID6: tuple[int,...] = (1,2,3,4,5,6)
S4: tuple[tuple[int,...],...] = tuple(tuple(p)+(5,6) for p in permutations(range(1,5)))


def valid_perm(g:tuple[int,...], n:int=6)->bool:
    return len(g)==n and all(type(i)is int for i in g) and set(g)==set(range(1,n+1))


def parity(g:tuple[int,...])->int:
    """0 even, 1 odd; no dependence on the number of occupied letter types."""
    if not valid_perm(g):raise ValueError('Invalid permutation')
    return sum(a>b for i,a in enumerate(g) for b in g[i+1:])%2


@lru_cache(maxsize=None)
def orbit(g:tuple[int,...])->tuple[tuple[int,...],...]:
    if not valid_perm(g,6):raise ValueError('Not an S6 permutation')
    return tuple(sorted({conjugate(s,g) for s in S4}))


@lru_cache(maxsize=None)
def orbits()->tuple[tuple[tuple[int,...],...],...]:
    used=set();result=[]
    for g in permutations(range(1,7)):
        if g in used:continue
        one=orbit(g)
        if any(h in used for h in one):raise AssertionError('Overlapping group-grade orbits')
        used.update(one);result.append(one)
    if len(used)!=720 or len(result)!=52:raise AssertionError('Incorrect S4 grading partition')
    if (sum(parity(o[0])==0 for o in result),sum(parity(o[0])==1 for o in result))!=(26,26):
        raise AssertionError('Expected 26 even and 26 odd orbits')
    return tuple(result)


def representatives(degree:int)->tuple[tuple[int,...],...]:
    if not isinstance(degree,int) or degree<0:raise ValueError('Nonnegative degree needed')
    return tuple(o[0] for o in orbits() if parity(o[0])==degree%2)


def orbit_for(g:tuple[int,...])->dict[tuple[int,...],tuple[int,...]]:
    """Each target grade -> a witness S4 perm transporting source grade there."""
    if not valid_perm(g):raise ValueError('Invalid grade')
    result={}
    for s in S4:result.setdefault(conjugate(s,g),s)
    if tuple(sorted(result))!=orbit(g):raise AssertionError('Incomplete transport')
    return result


def orbit_representative(g:tuple[int,...])->tuple[int,...]:
    return orbit(g)[0]


def expected_orbit_coverage(degree:int)->set[tuple[int,...]]:
    return set(representatives(degree))


def grade_pairs_for_representative(g:tuple[int,...]):
    """Check inverse pairing convention before allocating any matrix.

    Pairing(u,v) is potentially nonzero only if grade(v)=inverse(grade(u)).
    """
    return g,inverse(g)


def subgroup_stabilizer(g:tuple[int,...])->tuple[tuple[int,...],...]:
    if not valid_perm(g):raise ValueError('Invalid grade')
    return tuple(s for s in S4 if conjugate(s,g)==g)
