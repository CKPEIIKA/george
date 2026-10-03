# Guide and interface

The application's **User guide** tab is at `#guide`. It contains English and
Russian explanations, locally rendered equations, original source references
and buttons that load complete presentations. The maintained text is
[web/src/guide.js](../web/src/guide.js).

The guide is organized by implementation:

- **Bergman** (`#guide-bergman`): the existing introduction to presentations,
  fields, orders, results, Anick resolutions and the console, with a link to
  [a local copy of *Mathematical Computations Using Bergman*](../web/manual/bergman/manual.html).
- **bergman-fix** (`#guide-bergman-fix`): the default corrections and the
  purpose of Legacy mode.
- **Fomkyr** (`#guide-fomkyr`): supported presentations, completed-degree
  progress, memory and worker settings, checkpoints and exact Hilbert
  coefficients.
- **Shared examples** (`#guide-examples`): the common presentation format,
  with engine compatibility explained before the example buttons.

The subtitle's **more…** link opens the Fomkyr section directly. Engine
settings are under **Engine**; mathematical settings are under **More settings**.

The full Bergman manual and its four screenshots are preserved under
`web/manual/bergman/`, with the original notices and a source reference.
The manual link opens a separate tab so the current calculation can continue.

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
| Fomin–Kirillov FK6 | Exact tested 15-generator / 100-relation input; starts at degree 4 |
| Two bosonic oscillator modes | Homogenized canonical commutators; normal ordering through degree 6 |
| Euclidean Clifford algebra | Four gamma generators; ordered products through degree 6 |
| Angular momentum / sl₂ | Homogenized raising/lowering commutators through degree 6 |
| Four-dimensional Yang–Mills algebra | Four cubic covariant-derivative relations through degree 5 |

These supplement the fourteen original presets and six configurable families.
The first six reuse original Bergman inputs; the group and idempotent examples
are algebraic sanity cases. FK6 and the physics examples preserve the
generator and relation order from the Fomkyr 0.6.3 regression fixtures. Their
browser-ready presentations are in `web/src/tutorial-presentations.js`.
Oscillator, Clifford and sl₂ inputs retain a central homogenizing variable
`t`; specializing `t = 1` recovers the usual operator relations. The
Yang–Mills example uses the Euclidean metric and links to
[Connes and Dubois-Violette's defining presentation](https://arxiv.org/html/math-ph/0411062).
Loading an example sets its documented computational options and preserves
the computation engine selection.
Changing display language preserves the current presentation and output files.

## Sharing a presentation

Click **Share** beside Compute to copy a compact link. If clipboard access
is unavailable, select and copy the link shown below the buttons. The link
restores the generators, relation text, computation, field, order, weights,
degree limits, memory allowance, computation engine, advanced and module settings, preset
selection, language and theme. Shared settings take priority over the
recipient's saved form. Opening a link loads the form; press Compute to run it.

The state is stored in the link using a compact versioned schema and
[browser compression](https://compression.spec.whatwg.org/), without a
short-link service. Larger presentations produce longer links. Times are
displayed in seconds; Russian uses a decimal comma.

## Computation engines

**Engine → Computation engine** offers **Lisp / ECL O2**, **Lisp / ECL
O3 + LTO**, **C / ECL O3 + LTO**, its **memory64** variant, and **Fomkyr**.
The memory64 C/ECL engine is selected by default when supported; otherwise
the 32-bit C/ECL engine is selected.
It compiles Bergman's existing Lisp functions to C and then WebAssembly;
some auxiliary functions still run as Lisp bytecode. The two Lisp options
run the algebra routines as bytecode, with different compiler settings for
ECL and its libraries. These Bergman variants use the same algebraic algorithms.

Fomkyr is an independent C engine for homogeneous noncommutative Gröbner
bases on 1–16 generators, with unit weights and degree/left lexicographic
order. It supports exact rational arithmetic and prime fields, optional
exact Hilbert coefficients, shared multicore and local checkpoints.
Unsupported controls are disabled; the Lisp console requires Bergman.
Fomkyr's engine chooser entry remains experimental.

The selection is saved and included in Share links. Earlier links select
the original O2 backend. Changing engines starts a new console session.
Each computation submitted through the form starts in a fresh session.

## Memory

Large presentations can use **Engine → Memory limit**. The default
memory64 Bergman allowance is 16077 MiB (15.7 GiB); 32-bit engines default
to 2048 MiB and allow up to 4095 MiB. Memory64 offers allowances up to
16384 MiB and **No heap cap**. Removing the heap cap still leaves the
build's 16 GiB Wasm limit and the browser's available memory.

Fomkyr defaults to 3584 MiB when no allowance is supplied and permits up
to 14304 MiB. Its allowance includes the reduction pool, caches and shared
overflow workspace. Automatic addressing selects memory64 when needed;
the UI reports the effective limit if the browser falls back. Saved forms
and Share links retain their selected allowances.

Allocated Wasm memory is displayed beside progress. Browser and JavaScript
memory is additional. A larger allowance can advance a calculation further;
an unbounded basis may still exceed memory or take a long time. Saved output
after a memory failure is partial. Download session files before resetting
or changing a Bergman engine.

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
