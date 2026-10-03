# Additional upstream algebra tests

The fixture [upstream-cases.json](../../test/fixtures/upstream-cases.json)
records 30 presentations, each run over Q, F₂ and F₅: 90 field cases.
Its 17 source files have immutable revision URLs, SHA256 values, source
licenses, locations and explicit adaptation notes. The small release report
is retained in validation/upstream.json (generated locally).

The final run passed all 90 native/Wasm cases and 3,379 exact critical
ambiguities: 78 complete-basis certificates and 12 bounded certificates.
All three Singular reductions passed for every case, alongside 39 SymPy
comparisons, six separate Plural quotients and ten original SymPy functions.

## Sources

| Project | Pinned release | Presentations | Coverage |
|---|---|---:|---|
| [Singular](https://github.com/Singular/Singular/tree/fc93f43aefd9c6fa6a606ce46eb9f34864d8baee/Tst/Letterplace) | 4.4.1 | 9 | Monomial, exterior, shift/inverse and braid Letterplace cases |
| [Singular Plural](https://github.com/Singular/Singular/tree/fc93f43aefd9c6fa6a606ce46eb9f34864d8baee/Tst/Plural) | 4.4.1 | 2 | Finite two-sided quotients of U(sl₂) and U(so₃) |
| [SymPy](https://github.com/sympy/sympy/blob/16fa855354eb7bcabd3fe10993841e03b1382692/sympy/polys/tests/test_groebnertools.py) | 1.14.0 | 13 | Elimination presentations, curves, minimum polynomial, Katsura and cyclic systems |
| [GAP GBNP](https://github.com/gap-packages/gbnp/tree/6e7171d90aa1ea803029ae0d290b688899965785/tst) | 1.1.0 | 6 | Commutativity, polynomial gcd, Mora, weights and sl₂ quotients |

These are adapted algebra presentations, not execution of the entire
Singular or GBNP software suites. The GBNP comparisons use recorded upstream
bases, normal forms and dimensions. SymPy additionally executes ten original
reference test functions with Buchberger and F5B.

## Independent checks

Each case uses the production form job builder, native SBCL and the shipped
ECL/Wasm engine, with exact basis-file equality. An independent JavaScript
checker reduces the input and every critical overlap/inclusion in the stated
scope using exact fractions or prime-field arithmetic.

Singular performs three reductions: inputs in the Bergman basis, the Bergman
basis in Singular's basis, and Singular's basis in the Bergman basis.
Commutative cases additionally compare with freshly computed SymPy bases:
Buchberger and F5B must agree, the ideals must agree, the supplied Bergman
basis must satisfy SymPy's critical pairs, and normal-monomial counts must
agree. Plural separately computes the finite two-sided PBW quotients and
checks ideal equality and vector-space dimension.

Complete cases check every final ambiguity without a degree cutoff. Bounded
cases certify overlaps only through their specified degree. Generator order,
weighted order and bounds are matched explicitly in the oracle adapter.
The real browser form also runs selected braid, Katsura, weighted GBNP and
sl₂ quotient cases at both `/` and `/george/`.

## Adaptations and cutoff findings

The rational block of Plural's so₃ example originally demonstrates a left
ideal. This fixture uses the same presentation as a two-sided quotient and
computes a fresh `twostd` oracle. Its algebraic-number block is excluded.
SymPy's lexicographic input presentations are reused under George's graded
lexicographic order, with a fresh oracle in that order. Characteristic-zero
expected outputs are applied only to the fields listed in each fixture.

For the weighted GBNP example, the explanatory comment omits the term
`y^4*x`; the actual upstream test output includes it. The fixture uses the
test output and certifies the weighted normal-word counts independently.
GBNP uses ordinary degree-lex ordering with weighted truncation, while
Bergman uses weighted degree-lex ordering. Both bases are certified in their
own orders and must reduce mutually to zero. Their weighted normal-word
counts through degree 16 must agree. Singular receives extra word positions
for its internal shifts and an explicit weighted `degBound=16`.

The inverse-shift presentation `d*x-x*d-d, t*x-1, x*t-1` is bounded at degree
4 in its original test. A larger Letterplace cutoff discovers the additional
degree-4 relation `2*t*d*d*t+d*d*t-t*d*d` from a degree-5 overlap. A comparison
at the original cutoff must not silently substitute the larger completion.
Nonhomogeneous higher-degree overlaps can produce lower-degree relations;
a bounded certificate is not a complete-basis certificate.

## Reproduction

```sh
python3 tools/setup-upstream-tests.py
BERGMAN_SBCL=build/sbcl-reference/bin/clisp/unix/bergman \
  npm run test:upstream
```

Install SymPy 1.14.0 and the pinned Singular oracle from
`tools/setup-oracles.py`. The runner retains inputs, native/Wasm outputs,
Singular scripts, SymPy inputs, timings and a machine-readable report under
`build/validation/`. An oracle error, timeout, missing source, nonzero
remainder or mismatched output must fail validation.

The imported cases exposed additional default-mode repairs in
`ports/common/behavior-patches.py`; see [SOURCE-REVIEW.md](SOURCE-REVIEW.md).
The unmodified Bergman 1.001 sources and all original legacy branches remain
available in **bergman-1.001-fix**.
