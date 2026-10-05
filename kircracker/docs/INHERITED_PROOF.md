# A degree-14 nonzero primitive in the quadratic FK6 algebra: computational proof package

## Status and interpretation

This document gives an exact computational proof argument, with replayable input
and checks. It has not been reviewed by an independent specialist, formalized in a
proof assistant, or accepted for publication. It makes no priority claim. In view of
the conjectural status in the literature, independent mathematical and code review
is essential before presenting it as an established external result.

The decisive new statement is **Q != 0 in the ORIGINAL quadratic FK6 algebra over Q**.
It is proved by a representation, not by assuming a five-generator presentation is
the actual star. Combined with the separately replayed minimal Hopf-kernel evidence,
it selects the nonzero branch of the previous report and yields infinitude.

No scalar from a published Hilbert table is used to certify this nonzero class. No
finite-field rank is used in the nonzero representation check: it uses exact GMP
rationals, with a separate Python Fraction replay of the detecting normal form.

## 1. Fixed objects

Let E be the algebra over Q with positive generators x_ij, 1<=i<j<=6, the conventional
orientation x_ji=-x_ij, and the original 100 quadratic FK relations:

- x_ij^2=0;
- x_ij*x_kl=x_kl*x_ij for disjoint pairs;
- x_ij*x_jk-x_jk*x_ik-x_ik*x_ij=0, i<j<k;
- x_jk*x_ij-x_ik*x_jk-x_ij*x_ik=0, i<j<k.

These give the standard connected graded braided Hopf algebra and a canonical
surjection pi:E -> B to its transposition Nichols algebra. The kernel is the full
scalar braided-pairing radical [1]. Ordinary degree and product permutation grade
are distinct gradings and are both used below.

Let a_i=x_(i,6), i=1,...,5, and T=Q<a_1,...,a_5>. The explicit polynomial Q is the
134-term degree-14 element in `certificates/nichols/degree14-radical.json`.
All its coefficients are +/-1; every monomial has identity S6 product grade.
The file/hash binding is repeated in `certificates/representation/Q-nonzero.json`.
Index 0 in machine files means a_1, not a different algebraic generator.

## 2. A representation lemma (no dimension assumptions)

For 1<=i<j<=5, let s_ij permute a_i and a_j, and define on the FREE star algebra

    delta_ij(a_i) = -a_i*a_j,
    delta_ij(a_j) =  a_j*a_i,
    delta_ij(a_k) = 0  (k != i,j),
    delta_ij(PQ) = delta_ij(P) Q + s_ij(P) delta_ij(Q).

**Lemma.** Suppose J is a homogeneous two-sided ideal of T which contains all a_i^2,
is stable under all leaf permutations, and is stable under the ten delta_ij. Then
W=T/J admits an E-module structure given by

    rho(x_(i,6)) = left multiplication by a_i,
    rho(x_ij) = delta_ij,  j<=5.

**Proof.** Stability makes the maps well-defined. The mixed FK triangles and mixed
disjoint commutations are exactly the displayed skew-Leibniz and generator equations.
The star squares act by zero because a_i^2 belongs to J.

For the remaining, leaf-only, relations, covariance is

    s delta_e s^(-1) = epsilon(s,e) delta_(s(e)),

where epsilon is the orientation sign of the permuted edge. Check this on the free
star generators and extend it by the defining skew-Leibniz rule. For a composition,

    delta_c delta_d(PQ)
      = delta_c delta_d(P) Q
        + s_c delta_d(P) delta_c(Q)
        + delta_c s_d(P) delta_d(Q)
        + s_c s_d(P) delta_c delta_d(Q).

For each FK quadratic leaf relation R=sum lambda_cd delta_c delta_d, all s_c*s_d
are the same permutation, say s_R. The two middle terms cancel identically, by the
signed covariance. Therefore

    R(PQ) = R(P)Q + s_R(P)R(Q).

For a triangle or disjoint relation, R(a_i)=0 literally in T. For a square relation,

    delta_ij^2(a_i)=a_i*a_j^2-a_j^2*a_i,
    delta_ij^2(a_j)=a_j*a_i^2-a_i^2*a_j,

and the remaining generator values are zero. Hence every R(a_i) is in the ideal of
the star squares. Induction on words shows every leaf-only R acts as zero on T/J.
All 100 original relations are satisfied, proving the lemma.

The finite signed covariance, cross-term cancellation and generator equations are
recorded in `evidence/0.3/operator-representation-identities.json`. The script also
checks 33,100 supplementary full-relation/vector evaluations and 500 Leibniz tests.
Those samples are NOT the all-degrees justification; the skew-derivation induction is.

It is enough to check four adjacent leaf permutations and delta_12: adjacent
transpositions generate S5, and covariance transports delta_12 to every delta_ij.

## 3. The quotient which detects Q

The certificate supplies 28,727 homogeneous polynomials G in five generators, through
degree 14, and defines the truncated ideal

    J = <G> + T_(>=15),
    W = T/J.

The binary coefficient file is `certificates/representation/star14.gnb`, containing
3,487,727 integral terms. Its monomial order is degree-left-lex a_5>...>a_1.

Two statements must not be confused:

1. If G is only a basis of some convenient over-algebra, NF_G(Q)!=0 says nothing
   by itself about original FK6 nonvanishing.
2. If that quotient also satisfies the representation lemma, NF_G(Q)!=0 DOES detect
   an original FK6 class, because rho is a homomorphism from the original algebra.

The independent rational verifier checks:

- All five square relations are present.
- Leaders are a strict antichain; all proper overlap compositions through degree 14
  reduce exactly to zero. **430,522 compositions** are checked, without the producer's
  chain criterion, inferred dimensions, or special short-word rewrites.
- All four adjacent-permutation images of all 28,727 rows reduce to zero.
- delta_12 of every row of degree <=13 reduces to zero.
  The last two bullets total **130,620 closure checks**.
- Q has an exact nonzero normal form with **42 terms**.

The omitted delta images of degree-14 rows have degree 15, already zero in W.
Multiplication/derivation of the truncation ideal cannot decrease degree. A proof of
closure on ideal generators extends to every contextual multiple by skew-Leibniz and
permutation stability.

Checking critical pairs only through degree 14 suffices for THIS truncated quotient.
All higher words vanish by truncation, and homogeneous rewriting never changes degree.
Thus G gives exact normal forms in W at every surviving degree; no all-degree
completion of the untruncated five-generator presentation is asserted.

Let lambda extract the coefficient of the irreducible word

    a1 a2 a1 a5 a1 a2 a1 a3 a4 a3 a5 a3 a4 a3.

The computed normal form satisfies

    lambda(rho(Q)(1)) = 1.

The independent Python tuple-word/Fraction reducer, using a different divisor-order
policy and no C matching/arithmetic, returns the same 42-term rational polynomial.
It also rechecks selected nontrivial closure expressions. Complete closure and
critical-pair validation use the separate GMP implementation, not the original
fomkyr normal-form implementation that generated the candidate G.

By the representation lemma, rho is defined on original E. Therefore rho(Q)(1)!=0
implies **Q!=0 in E**. This does not claim W=E or that a finite representation makes
E finite. It does not require trusting the producer's claim that G was derived from
original relations. This is precisely why the additional closure checks are decisive.

## 4. Separate radical and low-degree evidence

The existing full-radical checker is rerun on the same hash-bound Q. It uses all
ambient deletion derivatives, not a chosen sample. Exact identities in the known
finite proper four-edge star are used to normalize intermediate states. Its finite
model is independently rebuilt with an alternate derivative implementation and the
published finite-dimensional structure. The checker explores 12,959 nonzero
projectively normalized states and 105,185 derivative edges, without reaching a
nonzero scalar. Thus pi(Q)=0.

The original identity-library/upper computation and independent pairing-minor
certificates are also rerun. They prove that E_d -> B_d is injective for d<14, and
that the degree-14--16 kernel dimensions are at most 1,15,125 respectively. The
Nichols quotient dimensions are

    dim B14 = 346652739,
    dim B15 = 850296015,
    dim B16 = 2031123359.

These statements are not inferred from the nonzero W representation alone. They
are separately supplied by `tools/replay_nichols.py`, with all original-identity,
minor and upper-model checks. The extension of the coideal freeness/factorization
argument to B, including ordinary reversal and support grading, is written out in
the retained `docs/THEOREM.md`; it is part of the proof obligations and should be
reviewed independently, not cited as a theorem explicitly stated in [1].

The important ingredients in that extension are: the proper finite algebras embed
in B by their known nondegenerate ambient pairings; images of edge subalgebras remain
coideals; the graded minimum-degree coproduct proof of [1, Theorem 4.1] still applies;
and the support partitions used for the complementary-factor argument survive the
braid symmetrizer. No all-degree equality E=B is assumed.

## 5. Infinitude from the minimal Hopf kernel

Let K=ker pi. K is a homogeneous braided Hopf ideal. Since K_d=0 for d<14 and Q is
in K14, every reduced coproduct component of Q lies in a bidegree where pi tensor pi
is injective. Consequently

    Delta(Q)=Q tensor 1 + 1 tensor Q.

Q is now known nonzero and its product-permutation grade is the identity. Hence
its self-braiding is the ordinary flip, so the two terms in its coproduct commute
in the braided tensor product.

If m>=2 were the first exponent with Q^m=0, the bidegree (14,14(m-1)) component of
Delta(Q^m) would be m Q tensor Q^(m-1), which is nonzero over Q. This contradiction
proves Q^m!=0 for every m. Different powers have different ordinary degrees.

**Conclusion of the checked argument: E6 is infinite-dimensional, and the natural
map E6 -> B is not injective.** This does NOT prove the Nichols algebra B itself is
infinite-dimensional. The dimension and higher kernel of B remain separate issues.

The same infinitude follows for E_n, n>=6: inclusion of the first six vertices has
a retraction killing all generators involving other vertices, so E6 embeds in E_n.

## 6. Exact original dimensions through degree 16

For k<14 and Y in E_k, the bidegree (k,14) part of Delta(YQ) is Y tensor Q. No other
summand involving the Q in the first factor can have first degree k<14. Therefore
Y -> YQ is injective on E_k. In particular, E_0 Q,E_1 Q,E_2 Q have dimensions 1,15,125
and lie in K14,K15,K16. They fill the independently verified upper kernel bounds.
Hence

    dim E14 = 346652740,
    dim E15 = 850296030,
    dim E16 = 2031123484.

The full permutation-graded kernel profile in those degrees equals that of E0,E1,E2
shifted by 14. It supplies exact original-FK degree-14--16 gate targets, not merely
the Nichols values. Computing these dimensions does not construct the full
15-generator original-order degree-16 Groebner basis.

## 7. A further algebraic consequence: Q is central

K14 is one-dimensional and S6-stable. Thus g(Q)=chi(g)Q for a one-dimensional
character. For each original generator x_e, Qx_e is in the one-dimensional
K15 component of permutation grade e, spanned by x_e Q. Write

    Qx_e = alpha_e x_e Q.

Compare coproduct components. Bidegree (1,14) gives alpha_e=1. Bidegree (14,1)
gives chi(e)=1. The relevant tensors are nonzero because x_e and Q are nonzero.
Thus Q commutes with all fifteen generators and every transposition fixes it.
Therefore Q is a nonzero **central, S6-invariant primitive element**.

The subalgebra Q[Q] is polynomial. The usual graded minimum-degree coproduct
argument, applied to this coideal subalgebra, makes E free as a Q[Q]-module:
choose graded representatives for C=E/QE; multiplication Q[Q] tensor C -> E is
surjective by degree induction. In a supposed relation choose the minimum Q-power,
apply a homogeneous dual functional selecting that power to the first coproduct
factor, and project the second factor to C. Every positive second Q-power dies;
minimum degree leaves the chosen nonzero coefficient, a contradiction. This is
an explicit application of the argument in [1, Theorem 4.1], not an assertion that
all arbitrary subalgebras are free.

Accordingly

    H_E(t) = H_C(t)/(1-t^14),  C=E/(Q),

as formal Hilbert series. C surjects onto B and agrees with B through degree16 by
the checked dimension comparison. **C=B in higher degrees is NOT established**.
No exact h17,h18,h19,h20 is claimed from this formula alone.

## 8. Dependency boundary and independent review

The nonzero certificate in sections 2--3 needs no conjectural dimension statement
or Nichols equality. It is a finite quotient representation check with exact Q
coefficients. The infinitude and centrality conclusions additionally use the
replayed radical, low-degree injectivity and kernel-size evidence, plus the stated
braided-Hopf arguments. All those dependencies are retained for review.

A code bug or a failure in the stated structural extension could invalidate a
claimed conclusion; tests and two implementations are not proof-assistant
formalization. No external expert or author confirmation is claimed. The source
literature still treats these as conjectural questions [1,2]. This package should
be treated as an explicit computational proof submission for independent scrutiny,
not as evidence that the literature has already accepted the result.

No fresh Singular/Bergman, real Firefox/OPFS or live-site execution occurred. The
candidate star basis was generated using the supplied native fomkyr 0.6.5; its
correctness for this purpose is then verified by independent code. The original
15-generator full degree-14--16 basis was not completed. Native proof generation
timings are diagnostics, not benchmark speedup claims.

## Reproduce

```bash
bash tools/build.sh
bash tools/build_representation.sh
python3 tools/verify_nonzero.py --threads 4 --out evidence/local-nonzero.json
python3 tools/replay_nichols.py --threads 4 --out evidence/local-nichols.json
python3 tools/resolve_fork.py --nonzero evidence/local-nonzero.json \
  --nichols evidence/local-nichols.json --out evidence/local-resolution.json
```

GMP development headers/libraries are required for the new independent verifier.
It dynamically links GMP; no copied GMP implementation is included. The basis
format is a fixed little-endian compact integer format described in the verifier.
Unsupported encodings, corrupted records, incomplete budgets, nonzero critical
remainders and failed closure checks are rejected; no failure is a zero certificate.

## Primary references

[1] J. Blasiak, R. I. Liu, K. Meszaros, *Subalgebras of the Fomin-Kirillov algebra*,
Propositions3.1--3.5, discussion of Conjecture3.7, Theorem4.1 and Theorem4.8.
https://arxiv.org/html/1310.4112v2

[2] I. Angiono, *Nichols algebras* (2025 survey), Example2.11.
https://arxiv.org/html/2510.03124v1

Statements proved by the present finite computations and algebraic deductions
are distinguished from the established results cited in [1]. No priority or
peer-review status is asserted for the present argument.
