"""FK6 restricted Nichols quantum symmetrizer, exact integer / modular certificates.

Research module. The five star edges are NOT a braided subspace. Every braid is
performed in the full 15-edge transposition braided vector space.

A 'complete' result is permitted only when the following independent checks pass:
  (a) every known relation context has exact integer Omega image zero;
  (b) the modular rank of known relation contexts is r;
  (c) the modular rank of the restricted Omega image is 5**d-r.
Then both rational bounds meet, proving equality over Q. No target Hilbert value
is read, and rank defects from partial batches never imply a new relation.
"""
from __future__ import annotations
from collections import defaultdict
from itertools import combinations, product
from pathlib import Path
import json
import hashlib

PRIME = 1_000_003
N = 6
EDGES = tuple(combinations(range(1, N + 1), 2))
STAR = tuple((i, N) for i in range(1, N))
_DATA = Path(__file__).resolve().parents[2] / "data" / "starQ-seed.json"


def _prime_check(p: int) -> None:
    if not isinstance(p, int) or p < 3 or p % 2 == 0:
        raise ValueError("The modulus must be an odd prime")
    i = 3
    while i * i <= p:
        if p % i == 0:
            raise ValueError("The modulus must be prime")
        i += 2


def transpose_edge(t: tuple[int, int], edge: tuple[int, int]) -> tuple[int, int]:
    a, b = t
    def apply(x: int) -> int:
        return b if x == a else a if x == b else x
    return tuple(sorted((apply(edge[0]), apply(edge[1]))))


def braid(word: tuple[tuple[int, int], ...], pos: int):
    first, second = word[pos], word[pos + 1]
    a, b = second
    x = first[1] if a == first[0] else first[0] if a == first[1] else a
    y = first[1] if b == first[0] else first[0] if b == first[1] else b
    sign = 1 if x < y else -1
    return (word[:pos] + (transpose_edge(first, second), first) + word[pos + 2:]), sign


def _reduced_braid_paths(n: int):
    start = tuple(range(n))
    paths = {start: ()}
    queue = [start]
    for v in queue:
        for pos in range(n - 1):
            nxt = list(v)
            nxt[pos], nxt[pos + 1] = nxt[pos + 1], nxt[pos]
            nxt = tuple(nxt)
            if nxt not in paths:
                paths[nxt] = paths[v] + (pos,)
                queue.append(nxt)
    return tuple(paths.values())


def omega(word, paths, *, max_image_words=1_000_000):
    result = defaultdict(int)
    for path in paths:
        transformed = word
        sign = 1
        for pos in path:
            transformed, s = braid(transformed, pos)
            sign *= s
        result[transformed] += sign
        if len(result) > max_image_words:
            raise ValueError("Omega image exceeded resource cap; no result certified")
    return {w: c for w, c in result.items() if c}


def sum_images(columns, polynomial):
    result = defaultdict(int)
    for word, coeff in polynomial.items():
        for out, c in columns[word].items():
            result[out] += coeff * c
    return {w: c for w, c in result.items() if c}


def rank_mod(columns, prime=PRIME):
    _prime_check(prime)
    pivots = {}
    for column in columns:
        col = {word: (int(c) % prime) for word, c in column.items() if int(c) % prime}
        while col:
            row = min(col)
            if row in pivots:
                scale = col[row]
                for key, val in pivots[row].items():
                    next_val = (col.get(key, 0) - scale * val) % prime
                    if next_val:
                        col[key] = next_val
                    else:
                        col.pop(key, None)
            else:
                inv = pow(col[row], prime - 2, prime)
                pivots[row] = {key: (val * inv) % prime for key, val in col.items()}
                break
    return len(pivots)


def check_internal_retract():
    # p: V6 -> V5 fixes the 10 internal edges and kills five star edges.
    for first in EDGES:
        for second in EDGES:
            output, _sign = braid((first, second), 0)
            if first[1] < 6 and second[1] < 6:
                if not (output[0][1] < 6 and output[1][1] < 6):
                    raise AssertionError("Internal edge braid leaves internal subspace")
            else:
                if output[0][1] < 6 and output[1][1] < 6:
                    raise AssertionError("A mixed braid projects to two internal edges")
    return 225


def known_fixture_relations(upto_degree: int):
    from .relative_upper06 import KNOWN_SHA256
    raw = _DATA.read_bytes()
    if hashlib.sha256(raw).hexdigest() != KNOWN_SHA256:
        raise ValueError('Star seed hash changed; relation provenance must be audited')
    data = json.loads(raw)
    rels = []
    for entry in data['relations']:
        if int(entry['degree']) > upto_degree:
            continue
        d = int(entry['degree'])
        polynomial = defaultdict(int)
        for digits, coeff in entry['primitive_relation']:
            letters = tuple(STAR[int(k)] for k in digits)
            if len(letters) != d:
                raise ValueError("Relation fixture has inconsistent degree")
            polynomial[letters] += int(coeff)
        polynomial = {w:c for w,c in polynomial.items() if c}
        if not polynomial:
            raise ValueError("Zero polynomial in fixture")
        rels.append((int(entry['id']), d, polynomial))
    return rels


def iter_contexts(degree: int, rels):
    for rid, rel_degree, polynomial in rels:
        for left_size in range(degree - rel_degree + 1):
            right_size = degree - rel_degree - left_size
            for left in product(STAR, repeat=left_size):
                for right in product(STAR, repeat=right_size):
                    contextual = defaultdict(int)
                    for middle, coefficient in polynomial.items():
                        contextual[left + middle + right] += coefficient
                    yield rid, {k:v for k,v in contextual.items() if v}


def exact_low_degree(degree: int, *, prime: int=PRIME):
    if degree not in (2,3,4):
        raise ValueError("Certified exhaustive prototype permits only degrees 2,3,4; higher degrees require a separate resource-bounded pairing engine")
    _prime_check(prime)
    checks = check_internal_retract()
    paths = _reduced_braid_paths(degree)
    columns = {w: omega(w, paths) for w in product(STAR, repeat=degree)}
    sym_rank = rank_mod(columns.values(), prime)
    rels = known_fixture_relations(degree)
    rank_context_columns = []
    contexts_checked = 0
    for rid, poly in iter_contexts(degree, rels):
        if sum_images(columns, poly):
            raise AssertionError(f"Fixture relation {rid} has nonzero integer Omega image")
        rank_context_columns.append(poly)
        contexts_checked += 1
    rel_rank = rank_mod(rank_context_columns, prime)
    complete = sym_rank + rel_rank == 5**degree
    return {
        'claim':'FK6_NICHOLS_STAR_LOW_DEGREE_SANDWICH',
        'degree':degree,
        'field':'Q',
        'modularPrime':prime,
        'braidedRetractionChecks':checks,
        'restrictedWordSpaceDimension':5**degree,
        'restrictedOmegaRankLowerOverQ':sym_rank,
        'knownStarIdealRankLowerOverQ':rel_rank,
        'integerContextsChecked':contexts_checked,
        'relationsUsed':len(rels),
        'completeAgainstKnownStarRelations':complete,
        'exactRationalKernelDimension':rel_rank if complete else None,
        'status':'EXACT_CERTIFIED' if complete else 'INCONCLUSIVE_PARTIAL_RANKS',
        'scope':'only displayed degree, not any all-degree finite-presentation assertion'
    }


def check_candidate_star(polynomial_json: dict, *, max_degree=7, max_terms=512, max_omega_terms=250_000):
    """Certify Nichols vanishing for an explicit star polynomial, NOT novelty.

    JSON: {"claim":"FK6_NICHOLS_STAR_CANDIDATE", "degree":2,
           "terms":[[[1,1],1], [[2,2],-1]]}
    Indices are 1..5, not 0..4. Every term must be homogeneous.
    A false result means a nonzero Omega image, not a degree/ideal claim.
    """
    if polynomial_json.get('claim') != 'FK6_NICHOLS_STAR_CANDIDATE':
        raise ValueError("Wrong candidate certificate type")
    degree = polynomial_json.get('degree')
    if not isinstance(degree,int) or not 1 <= degree <= max_degree:
        raise ValueError("Candidate degree is outside safe bound")
    terms = polynomial_json.get('terms')
    if not isinstance(terms,list) or not terms or len(terms)>max_terms:
        raise ValueError("Candidate term count outside safe bound")
    coeffs=defaultdict(int)
    for row in terms:
        if not isinstance(row,list) or len(row)!=2:
            raise ValueError("Malformed polynomial term")
        indices, coefficient=row
        if not isinstance(indices,list) or len(indices)!=degree or any(not isinstance(i,int) or i not in range(1,6) for i in indices):
            raise ValueError("Malformed star word")
        if not isinstance(coefficient,int):
            raise ValueError("Only exact integer coefficients are supported")
        coeffs[tuple(STAR[i-1] for i in indices)]+=coefficient
    coeffs={w:c for w,c in coeffs.items() if c}
    if not coeffs:
        raise ValueError("Candidate is identically zero in free tensor algebra")
    paths=_reduced_braid_paths(degree)
    total=defaultdict(int)
    for word,c in coeffs.items():
        for target,val in omega(word,paths,max_image_words=max_omega_terms).items():
            total[target]+=c*val
        if len(total)>max_omega_terms:
            raise ValueError("Candidate Omega image exceeded budget")
    image={key:c for key,c in total.items() if c}
    return {
        'claim':'FK6_NICHOLS_STAR_CANDIDATE_CHECK',
        'degree':degree,
        'nonzeroTensorPolynomial':True,
        'isNicholsRelation':not bool(image),
        'imageSupport':len(image),
        'checkedExactlyOver':'Z',
        'novelModuloKnownFKRelations':'NOT_CHECKED',
        'status':'NICHOLS_VANISHING_CERTIFIED' if not image else 'NONVANISHING_NICHOLS_IMAGE_CERTIFIED',
        'scope':'does not certify independence, minimality or completeness of any presentation'
    }
