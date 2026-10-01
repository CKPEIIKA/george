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

## Sharing a presentation (George 0.3)

Click **Share** beside Compute to copy a compact link. If clipboard access
is unavailable, select and copy the link shown below the buttons. The link
restores the generators, relation text, computation, field, order, weights,
degree limits, memory allowance, all advanced and module settings, preset
selection, language and theme. Shared settings take priority over the
recipient's saved form. Opening a link loads the form; press Compute to run it.

The state is stored in the link using a compact versioned schema and
[browser compression](https://compression.spec.whatwg.org/), without a
short-link service. Larger presentations produce longer links. Times are
displayed in seconds, with up to two decimal places; Russian uses a decimal
comma, for example **302,49 с**.

## Memory

Large presentations can use **More settings → Memory limit**. The default
Lisp heap limit is 2 GiB, and the largest choice is 3.5 GiB. Allocations grow
on demand; the 4 GiB Wasm ceiling also includes engine and file storage.
If the Lisp heap is exhausted, George displays saved basis output as partial
and releases the worker. A larger allowance can advance the calculation
further, but an unbounded basis can still exceed memory or take a long time.

The console starts with a 2 GiB allowance. To enlarge that console session,
evaluate `(ext:set-limit 'ext:heap-size 3758096384)` for 3.5 GiB. A memory
failure resets the session; download files you want to retain before a large
console calculation.

## Console

The **Console** tab evaluates Lisp in the current Bergman session. Enter
runs a complete form, Shift+Enter inserts a line, Ctrl+Enter submits incomplete
input, Tab completes a command, and ↑ recalls earlier commands. History is
saved when browser storage is available.

`(help)` lists commands; `?simple` or `(help simple)` displays Bergman's
original help. **Run the current computation** writes `input.bg` and executes
the presentation form's commands. `(files)` lists session files;
`(show "input.bg")` prints one. A file-based computation uses explicit names,
for example `(simple "input.bg" "out.gb")`.

Missing input files and commands that require keyboard input report an error.
The engine recovers without restarting: existing variables, settings and files
remain available. A new presentation-form computation starts a fresh session,
as does **Stop** before the next command. Errors during parsing or algebra
computation can leave partial algebra data; clear it with `(clearring)` before
loading replacement input.

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
