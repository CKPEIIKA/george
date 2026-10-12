# Relative quotient checks and sector symmetry

Kircracker includes bounded independent reference tools for the star quotient,
complementary Nichols pairing and exact sector projectors. The native dimension
pipeline and its checkpoint formats remain separate.

## Degree-wise quotient comparison

Let `S=C5`, `H=C4`, and let `Q` be the supplied degree-14 primitive. The upper
model is the relative right module

```
M_Q = S/(H^+ S + Q S).
```

The complementary Nichols pairing uses the opposite quotient `S/(S H^+)`.
Reversal sends permutation grade `g` to `g^-1`. The comparison uses all 26 S4
grade orbits of the relevant parity, including zero upper blocks.

For each orbit, independently replayed integer pairing minors give a rational
lower bound. The modular relation calculation gives a rational upper bound,
conditional on the recorded relation membership and structural factorization.
If every bound matches, the relative quotient and its Nichols image agree in
that degree under those dependencies. Repeating the check for a complete degree
prefix gives the corresponding finite-degree `FK6/(Q) -> B6` comparison. This
does not establish equality in all degrees.

```
./kircracker relative-upper-reference --degree 4 --with-q -o upper4.json
./kircracker quotient-check --upper upper4.json --lower lower4.json -o check4.json
```

`lower4.json` must be a `COMPLEMENTARY_COSET_MINOR` certificate, containing
actual selected words, dual words, modular matrices/determinants and signed S4
transports. A table of dimensions alone is insufficient. The reference format
is described by `reference/kircracker/coset_pairing.py`; the high-degree native
pipeline keeps its compact `.kcb` format and native integer replay.

Upper and lower primes may differ: both certify inequalities over Q. The
default comparison replays both sides. `--diagnostic` reads counts and never
marks equality certified. A positive gap is `INCONCLUSIVE`, not a discovered
kernel vector. Matched output is labelled `THEOREM_DEPENDENT_EQUAL` and lists
the proof obligations not replayed by this command.

The upper reference CLI is limited to degrees 0–14, with candidate/relation-row
budgets, a 120-second upper-stage deadline and 1 GiB address-space allowance by
default. The comparison has independent upper/lower replay stages, each using
`--seconds`. Exhaustion supplies no dimension. These commands are calibration
and independent audit tools; they do not replace the disk-backed high-degree
calculation.

## Independent Nichols oracle

```
./kircracker nichols-star-low --degree 4
./kircracker nichols-star-candidate candidate.json
```

The low-degree oracle constructs the full 15-edge transposition braiding and
restricted quantum symmetrizer with exact integer relation-context checks.
Its exhaustive scope is degrees 2–4. Five star edges are not closed under
braiding; outputs use all ambient edges.

Candidate format:

```
{"claim":"FK6_NICHOLS_STAR_CANDIDATE","degree":2,"terms":[[[1,1],1]]}
```

Indices 1–5 denote `x16,...,x56`; coefficients are integers. The bounded candidate
checker accepts degrees <=7 and proves only Nichols vanishing/nonvanishing.
It does not prove a candidate nonzero modulo FK relations or prove minimality.
Exhaustive factorial symmetrization is unsuitable for high-degree work.

## Stabilizer projectors

```
./kircracker sector-orbits --degree 22
./kircracker sector-projectors --grade 123456 -o identity-projectors.json
./kircracker sector-projectors --grade 123456 --words words.json --prime 1000003
```

`words.json` is an array of words represented by oriented edge pairs, for example
`[[[1,6],[1,6]]]`. Each word must have the selected permutation grade. The command
projects literal candidate spans with exact signed transports and preserves
their sector. It does not presume that a lexicographic quotient basis is stable
under relabelling. Output columns may be dependent or zero in the quotient.

The boundary-preserving group is S4. Additional splitting uses the stabilizer
of the selected grade. Identity grade has five rational S4 central projectors.
Smaller stabilizers use their linear sign characters and an exact complementary
rational block. Projector orthogonality and their sum to identity are checked
in the rational group algebra. Nonreal characters remain grouped in rational
blocks; no splitting-field assumption is made.

The 26 orbit representatives in either parity have stabilizer orders
`1:9, 2:8, 3:3, 4:2, 6:2, 8:1, 24:1`. Therefore nine representatives admit no
further stabilizer splitting. A native sparse projected rank implementation
still requires certified equivariant actions and joint rank witnesses; the
projector catalogue alone is not a measured acceleration of h22.

The imported `representation_blocks.py` additionally supplies bounded exact
S4 character/Young-projector and equivariant generator-map reference controls.
Its complete-basis constructor retains the independently known degree<=10
restriction. A partial lower minor cannot be used as a complete representation.

## Source and proof binding

`data/starQ-seed.json` retains only necessary relation/provenance fields from
the alternative seed. Its pinned SHA256 is checked by both upper and
symmetrizer oracles. Its 248 primitive polynomials match the retained relative
presentation after reversal and scalar normalization. Replay of a hash-bound
modular model does not itself prove membership or all-degree completeness of
that presentation. Original relation traces, the regular/primitive Q evidence
and finite-factor/coideal arguments remain explicit dependencies.

These additions are standalone reference features. They do not change browser
engines, native high-degree kernels, active jobs or checkpoint bindings.
