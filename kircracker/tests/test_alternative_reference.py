"""Bounded controls imported/adapted from the alternative research package."""
from pathlib import Path
from unittest import TestCase
from copy import deepcopy
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'reference'))
from kircracker.grade_orbits06 import representatives,orbit_representative,subgroup_stabilizer
from kircracker.coset_pairing import inverse,discover
from kircracker.relative_upper06 import RelativeUpper06,verify_upper
from kircracker.rank_sandwich06 import compare
from kircracker.nichols_star07 import exact_low_degree,check_candidate_star
from kircracker.stabilizer_blocks import catalog,project_words


class AlternativeReference(TestCase):
    def test_inverse_grade(self):
        reps=representatives(14)
        self.assertEqual(len(reps),26)
        self.assertEqual(reps.index(orbit_representative(inverse(reps[19]))),18)
        self.assertEqual(len(subgroup_stabilizer((1,2,3,4,5,6))),24)

    def test_exact_symmetrizer_controls(self):
        for d,dim,kernel,contexts in [(2,20,5,5),(3,70,55,60),(4,220,405,495)]:
            value=exact_low_degree(d)
            self.assertEqual(value['restrictedOmegaRankLowerOverQ'],dim)
            self.assertEqual(value['exactRationalKernelDimension'],kernel)
            self.assertEqual(value['integerContextsChecked'],contexts)

    def test_vanishing_and_negative_control(self):
        square={'claim':'FK6_NICHOLS_STAR_CANDIDATE','degree':2,'terms':[[[1,1],1]]}
        nonzero={**square,'terms':[[[1,2],1]]}
        self.assertTrue(check_candidate_star(square)['isNicholsRelation'])
        self.assertFalse(check_candidate_star(nonzero)['isNicholsRelation'])
        with self.assertRaises(ValueError):check_candidate_star({**square,'degree':8})

    def test_quotient_sandwich_and_tampering(self):
        lower=discover(6,3,symmetry=True,seconds=20,max_entries=200000)[-1]
        upper=RelativeUpper06(include_q=True).through(3)
        result=compare(upper,lower,pair_seconds=20,max_pair_entries=200000)
        self.assertTrue(result['degreeEqualityCertifiedConditionalOnRelatorMembership'])
        self.assertFalse(result['allDegreeEqualityClaim'])
        diagnostic=compare(upper,lower,replay=False)
        self.assertFalse(diagnostic['degreeEqualityCertifiedConditionalOnRelatorMembership'])
        bad=deepcopy(upper);bad['modularDimension']+=1
        with self.assertRaises(ValueError):verify_upper(bad)
        bad=deepcopy(lower);bad['rankLowerBound']+=1
        with self.assertRaises(ValueError):compare(upper,bad,replay=False)
        with self.assertRaises(ValueError):compare({**upper,'degree':14,'includesQ':False},{**lower,'degree':14},replay=False)

    def test_independent_primes(self):
        lower=discover(6,2,symmetry=True,seconds=20,max_entries=200000)[-1]
        upper=RelativeUpper06(prime=31991,include_q=True).through(2)
        value=compare(upper,lower,pair_seconds=20)
        self.assertEqual(value['upperPrime'],31991)
        self.assertEqual(value['lowerPrime'],1000003)
        self.assertTrue(value['allOrbitsMatch'])

    def test_projector_catalogues(self):
        for grade in representatives(14)+representatives(15):
            value=catalog(grade)
            self.assertTrue(value['orthogonalityAndIdentityChecked'])
            self.assertEqual(value['orbitSize']*value['stabilizerSize'],24)
            self.assertFalse(value['rankOrHilbertClaim'])

    def test_projection_scope(self):
        value=project_words((1,2,3,4,5,6),[[(1,6),(1,6)]])
        self.assertFalse(value['nonzeroInQuotientClaim'])
        self.assertFalse(value['basisClaim'])
