# Actual Anick differentials and graded Betti numbers

Select **Compute → Anick resolution** with Fomkyr in George, or run:

```sh
./dist/fomkyr -i presentation.bg -d 8 --memory 1G --anick --workdir resolution-job
```

The implementation is part of Fomkyr's C kernel, shared by the native CLI and
all four Wasm variants. Python, Kircracker and Bergman are not runtime dependencies.

## Scope and output

Inputs have the same restrictions as Fomkyr's algebra completion: homogeneous
relations, 1–16 generators of degree one, degree-left-lex order, and Q or a prime
field. The augmentation sends every generator to zero. Linear relations are
eliminated from the generating space before constructing chains.

The internal-degree bound D limits both chains and reported Betti numbers.
All homological degrees contributing to internal degrees at most D are included.
No homological cutoff can silently omit an incoming differential. Values above
D are uncomputed, even if the displayed table contains a zero near its edge.
An unbounded CLI completion uses its final completed degree for the resolution;
choose an explicit `-d` for a larger resolution range.

Outputs:

- `resolution.jsonl`: every right-module differential, with exact rational
  coefficient strings, whole-token generator indices and chain identities.
- `betti.json`: chain counts, augmented differential ranks, incoming ranks and
  actual graded Betti numbers of the original algebra.
- `betti.csv`: the same numerical data in tabular form.
- `result.anick`: a display table; column p and row r contain beta(p,p+r).
  Blank cells are outside the internal-degree bound; dashes are computed zeros.

The structural format is [George resolution v1](../../docs/RESOLUTION-EXPORT.md).
Its differential record degree is p−1. A header-only resolution explicitly
marked `emptyResolution:true` represents the algebra k after all generators
have been eliminated. It does not represent an uncalculated differential.

The Anick complex generally is not minimal. After augmentation the program
computes exact ranks rho(p,d) in the requested coefficient field and reports

    beta(p,d) = chain_count(p,d) - rho(p,d) - rho(p+1,d).

These are actual Tor dimensions, unlike the separate `--poincare` task, whose
coefficients are Betti numbers of the associated monomial algebra. Constructing
a minimal free resolution is not required and is not claimed.

## Construction and correctness checks

The minimal leading-obstruction graph is shared with the monomial counter.
Paths through D are materialized with their parent chains and tails. The
counter independently supplies the expected number of paths; any discrepancy
is an error. The full polynomial tails of the saved Gröbner relations enter
the differential computation.

For a chain c=parent·tail, its differential is formed from parent tensor tail,
subtracting the contracting lift of its image under the previous differential.
The lift repeatedly cancels its leading tensor word using a unique chain
extension. Each cancellation must strictly decrease the word. The differential
and lift construction is the standard right-module Anick induction; the C
implementation is independently written. The mathematical construction and
exactness argument are described in Theorem 3.3 of
[Musson-Leymarie, *On Anick resolution*](https://www.adyaml.com/files/research/MussonLeymarie_2023-On_Anick_resolution.pdf).

Every constructed full differential is checked to satisfy d²=0 in the algebra,
before augmentation. Sparse elimination of the constant coefficients then uses
Fomkyr's arbitrary-precision rational arithmetic or the selected prime field.
There is no unverified modular-to-Q rank inference. The JavaScript host checks
the Euler/Hilbert inverse identity when both prefixes are available.

Checking d² alone would not prove exactness. Exactness relies on the complete
chain frontier, the certified Gröbner prefix and the contracting-lift induction.
If completion used assumed external dimensions, the same dependencies remain
attached to the Betti result. Series counting does not independently prove them.

## Resources and validation

The first implementation uses one coordinator for resolution construction and
rank elimination; the existing worker setting controls Gröbner completion.
Both persistent differential data and temporary arithmetic are byte-budgeted.
Materializing chains can be much larger than merely counting them. Exhaustion
or cancellation fails the requested resolution task while retaining its completed
Gröbner checkpoint; it does not report a zero homology table.

The browser/API also accepts `anick:true`, `anickDegree`, `anickBudgetBytes` and
`anickOutputBudgetBytes`. Defaults use the completed degree, at most 256 MiB
of extra kernel workspace, and a 32 MiB serialized output allowance. Coefficient
size and sparsity affect practical limits; no FK-sized run is promised.

`tests/test_anick.py` checks full differentials with an independent rational
normalizer and compares Betti numbers against an independently constructed
normalized bar complex. It includes monomial, nonmonomial, linear, large
rational and prime-field examples, long words, cancellation, and resource errors.
`tools/validate-fomkyr-anick.mjs` checks four Wasm variants, native/Wasm CLI,
George dispatch, verified Q lifting, and Bergman parity on completed controls.
