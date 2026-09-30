# Capability and verification map

This table separates upstream features from what was exercised in this audit.
Sources: original `vendor/bergman-1.001/src` and `auxil/topproc.sl`, pinned
OCaml `src/algebra.ml`, `src/field.ml`, `tools/bergman/bergmanjs.ml`, and the
installed Singular `freegb.lib` / Plural interface. See
[SOURCE-REVIEW.md](SOURCE-REVIEW.md) and [VALIDATION.md](VALIDATION.md).

| Capability | Original Bergman 1.001 | OCaml Bergman browser | Singular used here | George and verification |
|---|---|---|---|---|
| Commutative Gröbner bases | Yes | Not its browser presentation model | `std` | Original suite + exact checker + Singular |
| Free associative Gröbner bases | Yes | Yes | Letterplace `twostd` | Original suite + all six families + Singular |
| Exact characteristic-zero coefficients | Exact integer/rational routines | `Field.Float`; native examples use restricted `Field.Int` | Q | ECL/GMP; >2⁵³ coefficient and exact independent checks |
| Prime fields | Characteristic 2 and odd-prime domains | Not exposed by the reviewed browser | F₂, F₅ | Original field cases; independent bases and resolutions |
| Weights and matrix/elimination orders | Yes | Degree orders in reviewed browser | Matched degree order in this audit | Historical weighted/matrix/elimination cases; no claim that every order was independently certified |
| Hilbert / Poincaré–Betti series | Yes | Not the original PB interface | Dimension check for selected quotients | Historical files, known exterior/symmetric dimensions and corrected PB output |
| Anick resolution | Yes | Yes | Not used as resolution oracle | Five shared OCaml cases, plus exact d² and field tests |
| Augmentation generators → 1 | No direct setting | Yes | Not used | Default-mode variable shift; OCaml x²−1 and Mirai comparisons |
| Nonhomogeneous ungraded Betti numbers | Internal-degree routine is insufficient | Yes | Not used | Exact augmented matrix ranks; finite-tail/bound metadata |
| Modules / factor algebras / Hochschild | Original procedures | Not exposed in the reviewed browser | Not used in this audit | Historical equality and isolated form presets |
| Contracting homotopy inspection | Internal Anick machinery | Native Mirai test prints one | Not used | Not exposed or compared as a separate product feature |
| Legacy output compatibility | Reference implementation | Independent algorithm and conventions | Independent algorithm and conventions | All 37 stored CLISP outputs match in legacy mode |
| Browser responsiveness / cancellation | Native program | Reviewed callback is synchronous | Native executable used | Worker, immediate termination and restart verified |

The full OCaml library contains much more than its Bergman browser. All 24
native test aliases ran; unrelated categorical and rewriting APIs are not
part of George. Likewise this table describes the use of Singular in this
project, not the full scope of Singular/Plural.
