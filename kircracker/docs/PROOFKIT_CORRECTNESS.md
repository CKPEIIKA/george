# Mathematical and certificate boundaries

## 1. Oracle faithfulness

A frozen record stream plus SHA256 fixes the bytes. It does not prove they generate the
original ideal. To use ambient normal forms as equality coordinates through D, one needs:
(i) genuine original-ideal relations; (ii) confluence/completion through D; (iii) the exact
field and admissible order. Input reduction alone gives only I_input subset <G>.
Input reduction plus critical confluence does not prove <G> subset I_input. Use recorded
original-ideal provenance, a valid dimension sandwich, or a separately audited certificate.

`init --through D` records a declaration. Every downstream statement retains that binding.
The package never elevates a profile digest, earlier AI assertion, or a filename to a proof.
The preexisting Q/radical data are polynomial input data here, not a newly replayed proof
of FK infinitude, centrality or primitive behavior.

## 2. Direct coproduct

The action uses directed edges x_ji=-x_ij. In the braided tensor algebra,

    (u tensor v)(x tensor 1) = u*(grade(v).x) tensor v.

Expand primitive generator coproducts and collect a fixed split. The implementation
selects left positions and transports their letters by the product grade of earlier right
positions. Each factor is then reduced in the frozen ambient basis. Reducing grouped left
polynomials before grouping/reducing the right factor avoids an unnecessary Cartesian
product of separate term normal forms. The result is the exact tensor-coordinate residual.

Zero reduced slices establish primitive behavior relative to a faithful ambient oracle.
A derivative radical calculation is not substituted for those slices. If a job exhausts
its resources, it is INCOMPLETE, not zero. The direct code is compared with separately
implemented sequential tensor multiplication, and all original quadratic coproducts and
derivative images vanish in independent small FK normal-form controls.

## 3. Actual star extraction and acceptance

Reference extraction scans words in increasing degree/lex order, retaining those whose
ambient NF images are independent. A dependence produces a new star relation with that
word as leading term; its remaining words are smaller. Processing every irreducible
candidate yields the actual subalgebra kernel in that degree. This is bounded linear
algebra on the subalgebra map, not a guess from square-zero generators.

For an externally produced candidate G, every g in G is checked to have zero ambient NF.
Hence candidate relations belong to the actual star kernel. Words avoiding LM(G) span the
candidate algebra, so the actual star dimension is at most their count. The BLM graded
factorization gives the star Hilbert coefficients from the faithful ambient basis and
the known finite complementary algebra. Equality forces the spanning words independent,
and thus completeness through the bound. No claim of an algebra tensor-product factorization
or normality of a graph-complement ideal is made.

GNB files use primitive integer representatives; relations.jsonl uses monic rationals.
Earlier raw native tails are not assumed reduced. Interreduction is performed when the
canonical option is enabled, and the output metadata states which convention was used.

## 4. The two-sided quotient by Q

In degree d, (Q)_d inside S is spanned by uQv for normal u,v with total degree d-degQ.
Normal words span S in the relevant lower degrees, so this is a complete spanning list,
even if Q is noncentral or a zero divisor. Exact NF and echelon calculation give a basis
and every context's coordinates.

A candidate quotient relation is checked for membership in this span modulo S. Conversely,
each original star relation and Q reduces to zero in the candidate. The number of candidate
normal words is compared with dim(S_d)-rank((Q)_d). Equality establishes the candidate GB
for the actual quotient in each checked degree. No Nichols equality, centrality or regularity
hypothesis is required. A deliberate zero-divisor control checks this point.

## 5. Nichols kernels and characters

Full mode forms the complete scalar-derivative pairing map on a bounded normal-word space
and computes its exact nullspace. For a quadratic FK algebra this gives the canonical Nichols
kernel in that degree. It does not replace a huge ambient basis by a selected lower minor
and pretend that the nullspace is complete.

Image mode computes actual columns u -> NF(uQ), an exact independent basis for their span,
and optional S6 matrices. It sets isEntireNicholsKernel=false. Membership in the full pairing
radical, an independent upper bound on the whole kernel and matrix rank could together close
that statement; that full proof chain is not automatically imported here.

The adjacent transposition action is computed in explicit ambient NF coordinates. Complete
character traces over conjugacy classes are decomposed with the exact Murnaghan-Nakayama
character table. Orthogonality is checked for all 11 irreducible S6 characters. Matching
characters alone does not identify two concrete subspaces. The explicit multiplication map
and its intertwining matrices are stronger data, but still need a verified whole-kernel bound
or full-kernel calculation for the equality requested by the user.

## 6. Genealogy and symmetries

Appending a rule records its actual parent descriptors. In a parallel batch, the descriptor
must be copied from the correct task, not whatever task happened to leave its metadata in
lane zero. The supplied adapter does this before coordinator re-reduction/commit.

Stored raw parents are not, by themselves, a derivation certificate: subsequent reduction
steps and compiled rewriting provenance are separate. The reference Python completion does
store full contextual subtraction traces and independently expands them. The native hook
records genealogy only, plus record checksum/word identity. Restored/missing history is labelled.

A vertex or leaf permutation can change which monomial is largest. The set of leading words
of a fixed-order GB therefore need not be stable under S6 or S5. Full polynomial orbits and
joint word-pattern motifs are reported as orbit analysis, not as a valid equivariant quotient
of the original computation graph. No finite family/induction is inferred from pattern counts.

## 7. Anick ranks

For a minimal obstruction antichain, use states consisting of letters and proper obstruction
suffixes. There is an edge u->v when uv has exactly one obstruction occurrence, at its end.
Initial states are letters. Paths count Anick chains. A degree-bounded shortest-path exploration
avoids constructing transitions that cannot contribute at the requested internal degree.

C0 is the augmentation generator; C1 consists of the alphabet; C2 of minimal obstructions.
The output c_(p,d) uses this homological indexing. Independent forbidden-word dynamic programming
checks H(t)*sum_(p,d)(-1)^p c_(p,d)t^d = 1 through the requested degree. Tests include the
one-generator cubic obstruction and 150 seeded random antichains.

This identity is an Euler characteristic for a (usually nonminimal) resolution, not a calculation
of homology. It does not show which generators are cancelled by actual differentials. Ranks,
Betti numbers, PBW formulas and all-degree closed products remain distinct assertions.

## Primary references

- J. Blasiak, R. I. Liu and K. Mészáros, Subalgebras of the Fomin–Kirillov algebra:
  https://arxiv.org/html/1310.4112v2 (gradings and complementary-graph factorization).
- Bergman manual: https://servus.math.su.se/bergman/manual.html (Anick chains/resolutions;
  note the traditional indexing shift).
- T. Gateva-Ivanova, Algebras defined by Lyndon words and Artin–Schelter regularity,
  Transactions AMS Series B 9 (2022):
  https://www.ams.org/btran/2022-09-22/S2330-0000-2022-00089-3/viewer/
- George current public README, accessed through public web retrieval:
  https://raw.githubusercontent.com/CKPEIIKA/george/main/README.md

The repository documentation describes existing Anick exports and warns that fomkyr's
stored tails are not globally interreduced. This extension can consume its record stream;
it does not claim to replace those existing resolution/differential tools.
