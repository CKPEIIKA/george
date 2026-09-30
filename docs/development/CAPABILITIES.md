# Capability and verification map

This table separates upstream features from what was exercised in this audit.
Sources: original `vendor/bergman-1.001/src` and `auxil/topproc.sl`, pinned
OCaml `src/algebra.ml`, `src/field.ml`, `tools/bergman/bergmanjs.ml`, and the
installed Singular `freegb.lib`, `homolog.lib`, `nchomolog.lib` / Plural interface. See
[SOURCE-REVIEW.md](SOURCE-REVIEW.md) and [VALIDATION.md](VALIDATION.md).

| Capability | Original Bergman 1.001 | OCaml Bergman browser | Singular / Plural | George and verification |
|---|---|---|---|---|
| Commutative Gröbner bases | Yes | Not its browser presentation model | `std` | Original suite + exact checker + Singular |
| Free associative Gröbner bases | Yes | Yes | Letterplace `twostd`, with explicit degree bound; Plural also handles solvable polynomial algebras | Original suite + all six families + Singular |
| Exact characteristic-zero coefficients | Exact integer/rational routines | `Field.Float`; native examples use restricted `Field.Int` | Q | ECL/GMP; >2⁵³ coefficient and exact independent checks |
| Prime fields | Characteristic 2 and odd-prime domains | Not exposed by the reviewed browser | F₂, F₅ | Original field cases; independent bases and resolutions |
| Weights and matrix/elimination orders | Yes | Degree orders in reviewed browser | Matched degree order in this audit | Historical weighted/matrix/elimination cases; no claim that every order was independently certified |
| Hilbert / Poincaré–Betti series | Yes | Not the original PB interface | Commutative `hilb` and `vdim`; no original PB-interface comparison | Historical files, known exterior/symmetric dimensions and corrected PB output |
| Anick resolution | Yes | Yes | Commutative free resolutions via `res`; not used as an Anick oracle | Five shared OCaml cases, plus exact d² and field tests |
| Augmentation generators → 1 | No direct setting | Yes | Not used | Default-mode variable shift; OCaml x²−1 and Mirai comparisons |
| Nonhomogeneous ungraded Betti numbers | Internal-degree routine is insufficient | Yes | Not used | Exact augmented matrix ranks; finite-tail/bound metadata |
| Modules / homological algebra | Right/left and two-module procedures | Not exposed in the reviewed browser | `syz`, `res`, `homolog.lib`; `nchomolog.lib` provides Hom/Ext over GR-algebras | Historical equality and isolated module presets; these Singular methods are not compared |
| Factor-algebra / Hochschild homology | Original procedures | Not exposed in the reviewed browser | No matched Hochschild task used | Historical equality and isolated factor/Hochschild presets |
| Generator names | Longer names supported | Browser parser accepts single characters | Longer identifiers supported | Longer and overlapping names in input, Anick chains, nonhomogeneous/monoid homology and display; structural export |
| Contracting homotopy inspection | Internal Anick machinery | Native Mirai test prints one | Not used | Not exposed or compared as a separate product feature |
| Legacy output compatibility | Reference implementation | Independent algorithm and conventions | Independent algorithm and conventions | All 37 stored CLISP outputs match in legacy mode |
| Browser responsiveness / cancellation | Native program | Reviewed callback is synchronous | Native executable used | Worker, immediate termination and restart verified |

The full OCaml library contains much more than its Bergman browser. All 24
native test aliases ran; unrelated categorical and rewriting APIs are not
part of George. Likewise this table describes the use of Singular in this
project, not the full scope of Singular/Plural. A Singular resolution over a
commutative polynomial ring is not an interchangeable oracle for an Anick
resolution over a free associative quotient. Its library scopes are explicit
in the inspected installed source headers; its core commands are described
in the [official Singular manual](https://www.singular.uni-kl.de/ftp/pub/Math/Singular/src/4-1-1/singular.pdf).

## Interface coverage

George now provides a guide based on original sources, eight guided examples
in addition to the original presets/families, EN/RU controls and explanations,
automatic/light/dark themes, local MathJax and raw-file downloads. These were
verified in Chromium at both the server root and a `/george/` project path.
See [USER-GUIDE.md](../USER-GUIDE.md).
