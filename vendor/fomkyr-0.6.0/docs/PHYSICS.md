# What the physics-facing outputs mean

For A = K<generators>/(homogeneous relations), fomkyr returns relations forming a GB
through D and h_d = dim_K A_d for d<=D. A higher finite coefficient prefix is
allowed after the entire GB has been proved complete. This counts independent algebra elements of each
word degree after the *supplied* relations have been imposed. It is not automatically a
Hilbert-space energy degeneracy, a gauge-singlet operator count or a trace quotient.

## Included examples and checks

- Polynomial algebra in two generators: commuting relation, h_d=d+1. This is a small
  bosonic/commuting-symbol sanity check, implemented via an associative presentation.
- Exterior algebra in three generators: anticommutation and squares zero give
  [1,3,3,1], total dimension 8. This is a fermionic-algebra example, not a full Clifford
  algebra with nonzero scalar squares (that would be nonhomogeneous).
- Homogenized oscillator: generators t,b,a with ab-ba=t^2, at=ta, bt=tb. Normal words
  t^i b^j a^k give h_d=(d+1)(d+2)/2. Specializing t=1 yields [a,b]=1, but the returned
  *graded* Hilbert series belongs to the three-generator homogeneous algebra, not to
  the original ungraded presentation without that qualification.
- FK3: [1,3,4,3,1], dimension 12. FK6: published/input reference coefficients through
  degree 7 are reproduced: [1,15,125,765,3831,16605,64432,228855]. Exact Q is preserved.
  Fresh tests of the new scheduler are bounded; no FK6 degree-20 result is asserted.

This is useful for testing proposed homogeneous operator relations, detecting additional
relations produced by critical overlaps, and measuring graded growth of the presented
algebra. Small PBW-type examples check both rewrite consistency and the expected count.
Changing the coefficient field is a separate algebraic experiment, not a substitute for
an exact rational calculation.

## What is deliberately not bundled into this count

In EFT applications, constructing independent physical operators requires handling
symmetries and redundancies such as integration by parts and equations of motion.
Henning et al. provide a concrete Hilbert-series framework for such counts [1]. Generic
associative-algebra word counting is only one ingredient and does not do that projection
by itself. Trace identities/cyclic equivalence are also not ordinary two-sided algebra
relations in general. Encoding them as arbitrary zero polynomials could compute the wrong
quotient. No claim about a particular Beijing group's workflow is made here.

No multigrading by charges/field types, Lorentz/gauge representation decomposition,
Anick resolution, Betti numbers or Poincaré series is implemented in 0.3.0. Hilbert and
Betti series are different invariants. Deducing one from another would require hypotheses
that are not established by a finite prefix; in particular this release does not assume
that the presented algebra is Koszul. Unsupported Bergman resolution jobs are rejected.

Automata methods are established for noncommutative Hilbert-series computation, including
multigraded modules and truncated cases [2]. Our narrower implementation computes only a
unit-weight coefficient prefix. A finite list of coefficients is never fitted and
reported as a proved global rational function.

## Feature priorities after large-case profiling

First retain independently checkable GB output and Hilbert coefficients with degree/field
metadata. A useful next physics extension would be multigrading *when all supplied
relations are homogeneous for the proposed grading*. A trace quotient, invariant-theory
layer, scalar-preserving operator normal forms or a resolution engine should be separate
features with separate correctness tests, rather than a new label on the current output.

[1] Henning, Lu, Melia, Murayama, Hilbert series and operator bases with derivatives in
effective field theories (2015), https://arxiv.org/abs/1507.07240
[2] La Scala, Tiwari, Multigraded Hilbert Series of noncommutative modules (2017; rev. 2018),
https://arxiv.org/abs/1705.01083
