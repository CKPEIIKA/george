# Guide and interface

The application's **User guide** tab is at `#guide`. It contains English and
Russian explanations, locally rendered equations, original source references
and eight buttons that load complete presentations. The maintained text is
[web/src/guide.js](../web/src/guide.js).

## Original-source basis

| Guide section | Original Bergman material |
|---|---|
| Polynomial syntax and raw files | `src/inout.sl`: `ALGFORMINPUT`, algebraic output |
| Fields, weights, orders, bounds, strategies | `src/modes.sl` and the job builder's mode commands |
| Bases and Hilbert computations | `auxil/topproc.sl`, `src/hscomm.sl`, `src/hseries.sl` |
| Anick chains and Betti tables | `src/anick/doc/anick_part_doc.body.tex`, `anbetti.sl`, `aninterf.sl` |
| Module, factor-algebra, Hochschild conventions | `src/anick/bnminout.sl` and regression inputs |
| Reproducible examples | `tests/clisp/unix/clisp_list` and reference outputs |

Paths are relative to `vendor/bergman-1.001/`. Those files are included in the
source archive linked in About and the guide. The text also describes
George's added cancellation, fixed defaults and exact ungraded homology;
these are identified as additions to the original implementation.
Default algebra Anick jobs export chains and exact coefficients in
`resolution.jsonl`; the homology reader and display use whole generator
tokens. Longer and overlapping names are supported. The raw `result.anick`
file remains Bergman's original text. See [the export format](RESOLUTION-EXPORT.md).

## Guided examples

| Example | Controls explored |
|---|---|
| Commutative quotient | Basis and Hilbert series |
| Characteristic 2 | Reduction modulo 2; comparison with Q |
| Odd prime field | F₅ and prime-modulus validation |
| Weighted degree | Weights 1, 1, 2 and weighted bounds |
| Matrix order | Order matrix, variable order and leading monomials |
| Anick chains | Graded Betti table and differentials |
| Group relation x² = 1 | Augmentation to 1, shifted generators, ungraded homology |
| Idempotent x² = x | Itemwise completion, augmentation to 0, exact ungraded ranks |

These supplement the fourteen original presets and six configurable families.
The first six reuse original inputs; the last two are algebraic sanity cases.
Loading an example resets computational options to its documented settings.
Changing display language preserves the current presentation and output files.

## Language, theme and notation

English and Russian cover navigation, form settings, validation, result
explanations, guide and example descriptions. The initial language follows the
browser. Raw Bergman files and Lisp diagnostics retain their original text.
Theme supports automatic system preference and explicit light/dark choices.
Preferences persist when storage is available; blocked storage does not
prevent using the application.

MathJax 4.1.3 and its New Computer Modern SVG data are pinned and served under
`web/vendor/mathjax/`, including the required worker assets. Guide equations
need no CDN or font service. Rendering is serialized during language changes
and fails independently of the algebra engine. Notices, hashes and packaging
are in that directory and `tools/package-ui.mjs`. This follows MathJax's
[local-hosting](https://docs.mathjax.org/en/v4.1/web/hosting.html) and
[dynamic-content](https://docs.mathjax.org/en/v4.1/advanced/typeset.html) APIs.

Run `npm run test:ui` for the Chromium checks. See
[VALIDATION.md](development/VALIDATION.md) for results.
