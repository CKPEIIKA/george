"""Proof-gated comparison of independent relative upper and lower rank certificates.

REQUIRED mathematical bridge (part of FK6 project proof obligations):
  1. L = C5/(C5 H_+) is the pairing-side left-ideal quotient;
  2. M = C5/(H_+ C5) is the modular upper-side right-ideal quotient;
  3. reversal identifies graded spaces L_d and M_d and sends grade g to g^-1;
  4. C5/(Q) maps to the Nichols star; Q is central/regular;
  5. the complementary pairing computes Nichols RELATIVE LOWER bounds.

No guessed Hilbert coefficient and no saved numeric rank alone can close a degree.
"""
from __future__ import annotations
from collections import defaultdict
from .coset_pairing import verify as verify_pairing, inverse
from .relative_upper06 import verify_upper
from .grade_orbits06 import representatives, orbit_representative, orbit, parity


def _check_lower_bounds(cert:dict):
    pairs=defaultdict(int);seen=set();d=cert['degree']
    for block in cert['blocks']:
        base=tuple(block['permutationDegree'])
        if base in seen:raise ValueError('Repeated base pairing grade')
        seen.add(base)
        size=len(block['words'])
        for s in block['transports']:
            from .coset_pairing import conjugate
            target=conjugate(tuple(s),base)
            if target in pairs:raise ValueError('Overlapping pairing grades')
            pairs[target]+=size
    if cert['rankLowerBound']!=sum(pairs.values()):
        raise ValueError('Incorrect lower-rank book-keeping')
    if any(parity(g)!=d%2 for g in pairs):raise ValueError('Wrong degree parity in pairing grades')
    return pairs


def compare(upper:dict, lower:dict, *,replay:bool=True,
            max_upper_candidates:int=1000000,max_upper_relation_rows:int=10000000,
            max_pair_entries:int=2000000,pair_seconds:float=120)->dict:
    """Attempt exact degree equality only; no statement about later degrees.

    `replay=False` is a DIAGNOSTIC mode only and its output cannot be used as a
    proof.  In particular, a match of saved dimensions is never authoritative.
    """
    if upper.get('claim')!='FK6_RELATIVE_MODULAR_UPPER_V1' or lower.get('claim')!='COMPLEMENTARY_COSET_MINOR':
        raise ValueError('Wrong upper or lower certificate type')
    if upper.get('ambientFK')!=6 or lower.get('ambientFK')!=6 or upper.get('targetField')!='Q' or lower.get('targetField')!='Q':
        raise ValueError('Only FK6 over Q is supported')
    d=upper['degree']
    if lower['degree']!=d:
        raise ValueError('Upper and lower degrees must match')
    if d>=14 and not upper['includesQ']:
        raise ValueError('For degree >=14 the upper bound must include the known Q relation')
    if replay:
        verify_upper(upper,max_candidates=max_upper_candidates,max_relation_rows=max_upper_relation_rows,seconds=pair_seconds)
        verify_pairing(lower,independent=True,max_entries=max_pair_entries,seconds=pair_seconds)
    upper_by_orbit={tuple(item['grade']):item for item in upper['orbits']}
    if len(upper_by_orbit)!=len(upper['orbits']):
        raise ValueError('Duplicate upper grade orbit')
    if set(upper_by_orbit)!=set(representatives(d)):
        raise ValueError('Upper rank must cover every S4 grade orbit, including zero blocks')
    pairing_grades=_check_lower_bounds(lower)
    rows=[];total_lower=0;total_upper=0
    for upper_rep in representatives(d):
        info=upper_by_orbit[upper_rep];upper_per_grade=info['dimension_mod_prime']
        if type(upper_per_grade)is not int or upper_per_grade<0:
            raise ValueError('Upper orbit dimension must be a nonnegative integer')
        osize=info['orbit_size']
        if osize!=len(orbit(upper_rep)):raise ValueError('Incorrect upper orbit length')
        # Upper grade g in M corresponds to pairing grade g^-1 in L.
        lower_rep=orbit_representative(inverse(upper_rep))
        values=[pairing_grades.get(g,0) for g in orbit(lower_rep)]
        if len(set(values))!=1:
            raise ValueError('Pairing has incomplete/inconsistent orbit transports')
        lower_per_grade=values[0]
        if lower_per_grade>upper_per_grade:
            raise ValueError('Inconsistent independent bounds: lower > upper at a grade orbit')
        attempted=False
        # Zero lower can reflect missing candidates; only positive minors count.
        if lower_per_grade:attempted=True
        elif 'orbitCoverage06' in lower:
            attempted=lower_rep not in {tuple(g) for g in lower['orbitCoverage06']['unattempted']}
        else:
            # Legacy v0.5 bundles do not encode whether a zero sector was attempted.
            attempted=False
        status='equal' if lower_per_grade==upper_per_grade else 'gap'
        rows.append({'upperGrade':list(upper_rep),'pairingGrade':list(lower_rep),
                     'orbitSize':osize,'upperPerGrade':upper_per_grade,
                     'certifiedLowerPerGrade':lower_per_grade,'gapPerGrade':upper_per_grade-lower_per_grade,
                     'status':status,'pairingAttempted':attempted})
        total_lower+=osize*lower_per_grade;total_upper+=osize*upper_per_grade
    if total_lower!=lower['rankLowerBound'] or total_upper!=upper['modularDimension']:
        raise ValueError('Incorrect aggregated rank from orbit certificates')
    pass_all=total_lower==total_upper
    return {'claim':'FK6_RELATIVE_RANK_SANDWICH_V1','degree':d,
            'upperPrime':upper['prime'],'lowerPrime':lower['prime'],
            'upperModularDimension':total_upper,'independentNicholsRelativeLower':total_lower,
            'remainingGap':total_upper-total_lower,'gradeOrbits':rows,
            'allOrbitsMatch':pass_all,'proofChecksReplayed':replay,
            'degreeEqualityCertifiedConditionalOnRelatorMembership':bool(pass_all and replay),
            'residualKernelFound':False,
            'status':('THEOREM_DEPENDENT_EQUAL' if pass_all and replay else
                      'INCONCLUSIVE' if replay else 'DIAGNOSTIC'),
            'allDegreeEqualityClaim':False,
            'relatorMembershipVerifiedHere':False,
            'structuralFactorizationVerifiedHere':False,
            'interpretation':('Equal bounds establish degree-wise injectivity, conditioned on verified relator membership and BLM module/pairing factorization.'
                    if pass_all and replay else 'A gap is inconclusive: it is NOT a nonzero Nichols kernel witness.'),
            'limitation':'No all-degree Nichols isomorphism, no conclusion above this degree.'}
