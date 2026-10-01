# Validation and verification

Release audit: **2026-09-30**. This is a working Bergman → ECL → Wasm → HTML
application running **bergman-1.001-fix**. Fixed behavior is the default;
legacy mode retains the original Bergman 1.001 behavior and version identity.
That audit used **George 0.2** (package version 0.2.0).
The reports below describe executed checks, with their scope. The September
audit describes the previous engine; the October update identifies and checks
the current memory-enabled build separately.

## George 0.3 interface changes — 2026-10-01

The current interface version is **George 0.3** (package version 0.3.0).
It adds locale-aware seconds and compressed share links restoring the full
form, memory allowance, preset, language and theme. All 53 JavaScript unit
assertions passed on October 1. The engine was subsequently optimized as
described below; earlier audit results retain their original engine identity.

## Runtime optimization — 2026-10-01

The current release engine uses fully rebuilt **O2 ECL/GMP/GC libraries**,
an O2 final link and the existing GC pointer spilling pass. Bergman's Lisp
bytecode is byte for byte unchanged from the memory update. Profiling hooks
are excluded from the release. See [PERFORMANCE.md](PERFORMANCE.md) and
[performance.json](validation/performance.json) for exact hashes, build
variants, measurements and checks on this engine.

The submitted 15-generator, 100-relation presentation takes **9.635 seconds**
through degree 4, versus **17.541 seconds** on the preceding engine in the
same current Chromium measurement series (medians of three runs). Through
degree 6 it takes **155.148 seconds**, saving 497 basis elements. Both outputs
match native SBCL byte for byte. These are degree-bounded computations.
The earlier 50-second measurement below was under different conditions and
is not used to calculate this improvement.

The optimized release also passes all **74 historical outputs**, **46 Wasm
reader error/recovery cases** plus eight native EOF checks, **42 independent
basis cases with 597 ambiguities**, and **nine resolution cases with 560
d² identities**. A Node allocation stress check holds 3.125 GiB of live
arrays; forced heap exhaustion preserves saved basis output and permits
same-runtime recovery. Current browser behavior results are recorded in
the performance report. The full September upstream and UI suite has not
been rerun in its entirety against this engine.

## Memory update — 2026-10-01

The engine now links with a **4 GiB Wasm maximum** and offers a Lisp heap
allowance of **512 MiB to 3.5 GiB**, with **2 GiB** selected by default.
Memory still starts at 64 MiB and grows on demand. The previous build used
ECL's 1 GiB heap default and Emscripten's 2 GiB maximum; 3 GiB was not a hard
limit. See the [Emscripten memory setting](https://emscripten.org/docs/tools_reference/settings_reference.html#maximum-memory)
and the explicit setting in `ports/ecl/link-wasm.sh`.

| Check on the rebuilt engine | Executed result |
|---|---|
| JavaScript unit tests | 53 assertions passed |
| Historical Node/Wasm suites | All 37 outputs match in each mode, 74 total |
| Reader recovery | Eight native EOF checks and 23 failures in each Wasm mode, followed by same-session computation and GC |
| Chromium large allocation | 27 live arrays hold 3,397,386,240 bytes (3.164 GiB); actual Wasm memory grows to 3,624,861,696 bytes; access, GC and exact arithmetic pass |
| Heap exhaustion | A real 128 MiB limit failure returns saved basis output, releases the worker and permits the next command |
| Form and language handling | The actual form displays the interrupted basis and memory status in EN/RU, retains the setting and computes successfully after restart |

The submitted presentation contains **15 generators and 100 quadratic
relations** over Q. In Chromium without a debugger, its degree-4 run takes
**50.093 seconds** and matches the native output: 100, 76 and 89 basis
elements in degrees 2, 3 and 4 (265 total).
Its degree-6 browser run is stopped by the assessment's ten-minute time
limit while the interface still displays Computing; no memory failure is
reported. A separate commuting square-zero presentation with **16 generators
and 136 relations** completes through degree 3 in **20.505 seconds**, with
136 degree-2 basis elements. Both successful browser runs use the actual
form and persist the 3.5 GiB setting.

Native SBCL completes through degree 8 in **94.873 seconds**, with **990**
basis elements: 100, 76, 89, 95, 137, 198 and 295 in degrees 2–8. Its peak
resident memory is **1,151,536 KiB**, about 1.10 GiB. This is a measurement of
the 64-bit native process, not an ECL/Wasm memory prediction. A native run
with a 512 MiB heap exhausts it while processing degree 8. An unrestricted
native run with a 3.5 GiB allowance is stopped externally after 300 seconds,
having saved degrees through 8. **The complete unrestricted basis is not
certified.** The input counts alone do not determine the resource requirement.

The memory assessment's engine hashes, source hashes, measurements and local report
paths are recorded in [memory.json](validation/memory.json). Instrumented
degree-4 and degree-6 browser runs timed out after ten minutes; they are
retained as diagnostics and excluded from normal-browser timing claims.
The wider September algebra, upstream, resolution and UI audit below has
not been rerun in full against these new engine hashes.

## September release results

| Layer | Executed result |
|---|---|
| JavaScript unit tests | 51 passed: parsing, validation, exact arithmetic, structural export, complete incoming-chain bounds, worker lifecycle/error recovery, console editor/help, preferences, guide and locale coverage |
| Reader recovery | Eight native EOF checks and 23 consecutive failed commands in each Wasm mode; variables/files survive, and the same session computes successfully afterward and survives GC |
| Persistent console UI | Both `/` and `/george/`: eight error/recovery cases each, retained settings/files, first `T`, original help, completion, history, and current-computation/file shortcuts |
| Original 2007 CLISP regression | All 37 files match byte for byte in legacy mode, in native SBCL, Node/Wasm and Chromium/Wasm |
| Default-mode regression | All 37 expected files pass on the same engines; the PB file uses the corrected pre-2004 reference |
| Additional original sources | 20 sessions: 18 calculations, one mode-only smoke test, one expected rejection of a malformed backup; 23 output files match native Bergman |
| Form presets | All 14 pass through the production job builder and engine: 22 files match the bundled references exactly; one module basis matches as polynomials, with a differing Done marker |
| OCaml upstream | All 24 dune test aliases pass at the pinned revision |
| Shared OCaml cases | All five relevant active examples pass; Betti numbers and the aaa-chain words are compared with freshly executed native OCaml results |
| Independent basis checks | 42 cases pass: input reduction, 597 critical ambiguities, Singular mutual ideal membership, and known Hilbert dimensions where specified |
| Imported upstream cases | 90 native/Wasm cases over Q/F₂/F₅ from 17 pinned Singular/Plural, SymPy and GBNP source files; 3,379 exact critical ambiguities and three Singular reductions per case; 39 SymPy Buchberger/F5B comparisons, six independent Plural quotients and ten original SymPy test functions |
| Independent resolution checks | Nine cases pass 560 identities d²=0 over the quotient algebra, before augmentation; exact augmented ranks and d²=0 also pass |
| Longer generator names | 20 cases: native SBCL equality, all-term renaming equality, 258 full d² identities, 91 critical ambiguities, exact homology, overlapping names, Q/F₂/F₅/F₁₀₁, weights, reversed order and large rational coefficients |
| Idempotent braid | 20 native/Wasm cases: 860 full d² identities, 220 critical ambiguities, dimension 6 and independent projectivity certificates over Q/F₂/F₃/F₅/F₁₀₁; direct degreewise and two-stage runs, monoid augmentation, overlapping names, weights and reversed order |
| Browser behavior | Both historical suites, responsive main thread, stop/restart, exact 3⁴⁰, memory growth, form execution and monoid augmentation pass; no page errors |
| Guide and project-site UI | Root and `/george/` pass: all eight guided examples, braid and weighted homology cutoff, EN/RU, state/file preservation, theme/system preference, persistence, blocked storage, 38 MathJax SVG expressions, imported braid/Katsura/weighted/Lie cases, mobile and downloads; no external requests or asset errors |

Small machine-readable evidence is retained in [validation/](validation/).
[summary.json](validation/summary.json) links the full local logs and records
source hashes; [engine.json](validation/engine.json) identifies the September
engine files. Failed development runs are not release results.

Before the initial commit, repository cleanup archived 43 unused prototype
and disposable upstream files locally. All 29 unit tests and both 37-output
Node/Wasm suites were rerun successfully against the cleaned tree. Production
browser sources and the engine were subsequently rebuilt for structural
resolution export; the evidence manifest records their current hashes and
the cleaned vendor tree. Local build/dependency directories
and the archive are ignored, while the seven tested backup inputs are retained.

## Original corpus coverage

`tests/clisp/unix/clisp_list` is run as the original sequential session,
including inherited modes. Its 37 outputs cover commutative and
noncommutative bases, fields, weights, matrix/elimination orders, series,
Anick and module computations, factor algebras, Hochschild homology,
interrupt strategies and MINR. The PB change is the one intended difference
between historical and corrected reference outputs.

The extra runner covers `anick_5`, `anick_w`, `simp_w_max`, `homog_c`, `tst`,
the mode-only `homog`, all seven editor-backup inputs containing
ALGFORMINPUT, and all seven sessions separated by dashed lines in
`skipcdeg` / `skipcdegall`. Streams are explicitly closed with CLEARRING
before comparison, including Anick output streams.

`lin_nc~` contains undeclared uppercase **X**. Both native and Wasm reject
it; their diagnostics differ. The browser's parser rejects it before Lisp
execution. This is an explicit negative test, not a successful calculation.
Files that contain only test labels or historical outputs are not executable
tests. Upstream run logs, deleted filesystem remnants, generated LaTeX
artifacts and unused editor backups are excluded from the release tree.
The seven executable backup inputs remain as intentional regression fixtures.

`nhom` has an empty historical result. Running it through the original
stable degreewise path exhausted the native heap. Its actual presentation
xy−z, yz−x, zx−y is verified in the corrected itemwise path against Singular
and **all** final critical ambiguities. The presentation is retained intact.
No failure is hidden by replacing its relations.

The old CLISP/PSL outputs have historical differences. Legacy byte equality
means the stored **2007 CLISP run**, not equality of banners, timings, memory
images or every Lisp platform's sign convention.

## OCaml and independent oracles

The reference is `smimram/ocaml-alg` revision
`365708af85d2faa50250414247179b3bc2bd13df`, built using OCaml 5.3.0 and dune
3.17.2. The five active examples are:

- `anick0`: exterior algebra on three generators; H₀…H₉ agree.
- `anick1`: aaa chains; all seven displayed chain levels agree exactly.
- `anick2`: x³+y³+z³−xyz; H₀…H₅ agree.
- `anick3`: x²−1 with a free second generator and monoid augmentation;
  H₀…H₁₀ agree.
- `mirai`: its original four-relation nonhomogeneous presentation, matching
  its reversed character order. H₀…H₃ agree. A generated reference program
  adds only a call to upstream's Betti routine; the original example itself
  prints a resolution and contraction. George certifies the finite zero tail.

All 24 upstream aliases include unrelated category, automata and rewriting
APIs. Their successful execution validates the reference checkout; George
does not claim to implement those APIs or expose Mirai's contracting homotopy.
The seven commented algebra presentations and all six web example families
are additionally included in basis checks.

Singular **4.4.1** is used independently: commutative standard bases and
Letterplace two-sided bases, with matching variable order and degree bound
12. Mutual ideal membership checks both directions. The quantum-plane case
also runs Plural's `nc_algebra(2,0)` and checks quotient dimension 6. An
example comes directly from the installed `freegb.lib` source.

The separate JavaScript checker uses exact BigInt fractions or prime-field
arithmetic. It checks all overlaps and inclusions through degree 6 in the
homogeneous cases, and every final ambiguity in the nonhomogeneous cases.
It is validation code and does not provide the production Gröbner engine.
There are twelve seeded cases (seed 731), Q/F₂/F₅ comparisons, a coefficient
larger than 2⁵³, known symmetric/exterior Hilbert dimensions, and additional
prime-field resolutions. Singular process errors, timeouts, error diagnostics
and nonzero remainders fail the runner.

The [additional upstream suite](UPSTREAM-TESTS.md) records all adaptations
and source digests. Of its 90 field cases, 78 certify every final critical
ambiguity and 12 certify a stated degree bound. The weighted GBNP example
uses a different reference monomial order, so each basis is certified in its
own order, with mutual reductions and weighted dimensions through degree 16.
An inverse-shift example demonstrates that higher-degree nonhomogeneous
critical pairs can generate lower-degree relations; its original cutoff is
matched explicitly rather than treated as a complete-basis certificate.
These tests exposed the inclusion, stale-signature, redirected-pointer and
commutative mode defects documented in [SOURCE-REVIEW.md](SOURCE-REVIEW.md).
Original legacy branches and vendored sources remain unchanged.

## Browser and performance

Verified using Chromium 153.0.8010.52 on this Linux x86_64 workspace. The
complete historical suites took **15.88–16.07 seconds of computation** each
in the current run (19.29–19.74 seconds including startup). Measurements are in
[browser-regression.json](validation/browser-regression.json); timing varies
with machine load. These are entire-suite timings, not per-polynomial claims. This
run was on a loaded workspace; the six additional normal-browser cases
took 0.18–1.97 seconds of computation each, matching native outputs exactly.
They cover Katsura 4, Singular braid, weighted GBNP, the sl₂ quotient and
two braid resolutions. The instrumented form timed out at two and five
minutes, while the exact
form payload passed Node/Wasm and the normal-browser form completed in
2.3 seconds. The final UI runner therefore drives actual DOM input/change/
click events without a debugger, then attaches Playwright after
computations finish
for screenshots. The instrumented failures are retained as development
diagnostics and are not release results.

The Wasm heap starts at **64 MiB**. An explicit 100 MB Lisp array forced
memory growth to **123,011,072 bytes**, followed by GC and another exact
integer computation. While the full suite runs in its worker, a 20 ms main
thread timer continues firing. No isolation headers are used. Desktop and
390 px mobile screenshots were inspected; the ungraded Betti table uses
horizontal scrolling when needed.

Performance measurements use Chromium **without a DevTools connection**.
The UI runner drives the real form without a debugger and uses Playwright
only for screenshots after all computations finish. Mobile testing sets a
390px CSS viewport through the CDP Emulation domain without enabling the
Runtime, Debugger or Profiler domains; mobile calculations run normally.
Debugger attachment can change Wasm compilation/tiering and distort timings;
see [V8's compilation documentation](https://v8.dev/docs/wasm-compilation-pipeline).
The link uses O2 and the required spill-pointers pass; the ECL Wasm library
retains upstream's O0 configuration. Further compiler optimization needs a
fresh GC and arithmetic audit, not just a changed flag.

## Reproduction

Commands and prerequisites are in [README.md](../../README.md). Run
`npm run test:ocaml` before `npm run test:algebra`, and start `npm run serve`
before `npm run test:browser`. `test:browser:regression` starts its own server.
The exact optional Debian oracle packages and SHA256 values are in
`tools/oracle-packages.json`; `tools/setup-oracles.py` was executed successfully.
Unit tests use the [Node test isolation option](https://nodejs.org/download/release/latest-jod/docs/api/cli.html#--experimental-test-isolationmode)
to execute all assertions in one process; local tooling requires Node >=22.8.

The pinned ECL/SDK build and link were executed locally, reusing the native
and cross toolchains after their initial builds. All builds and checks run
locally. Repository CI/Actions workflows were removed. Pages publication uses
the prebuilt `web/` tree on a `gh-pages` branch, as described in the README.
The user deferred concurrent console changes; browser checks and source
packaging use the isolated release checkout `/tmp/george-release-20260930`.
The shared workspace retains those edits for a later release.
Project-site compatibility was
verified locally at `/george/`, including worker/Wasm paths and MIME types.

The UI report is [ui.json](validation/ui.json). It executes six original
guided examples with exact reference equality and two augmentation cases
with Betti numbers 1, 1, 0, 0, 0. Language changes preserve all form fields and
raw files, including across a reload. Rapid language changes retypeset the
guide serially. An original preset's edited degree bound also survives
reload; a pre-existing restoration defect was fixed. Desktop/Russian/dark and
mobile/English/light screenshots were inspected under the report's local
artifact directory. MathJax's required v4 worker assets are bundled locally;
failed development runs with missing worker assets are not release evidence.
Both mount paths also compute imported Singular braid, SymPy Katsura,
weighted GBNP and Lie quotient cases, and the idempotent braid with overlapping names
and a weighted monoid case. The latter verifies that only H₀…H₂ are reported
and that the interface explains the cutoff.

## Scope of confidence

These results establish regression compatibility for the shipped corpus
and agreement on the independent cases. They do not prove every original
experimental command, every admissible order or every input correct.

A bounded basis can be partial even when historical Bergman prints Done.
The UI states the bound; nonhomogeneous resolutions require a conservatively
completed basis. Homogeneous critical-pair certificates apply only through
the stated bound. Nonhomogeneous homology requires a complete incoming chain
space, unless its finite zero tail is certified. With maximum generator
weight W and maximum proper relation-tail degree bounded by t, C_(n+1)
fits within W+n*t. Reported Betti numbers use this conservative bound;
unreported partial ranks remain under `truncatedBetti` in `homology.json`.

The former single-letter restriction has been removed. Default algebra Anick
jobs read chain objects through a [structural export](../RESOLUTION-EXPORT.md).
The test `a*bc-a, ab*c-ab` on generators `a, ab, bc, c` retains both chains
whose compact original spelling is `abc`; its Betti numbers are 1, 2, 0.
Both static-site paths also exercise this case and underscore names through
the real form, file downloads and whole-token resolution display.

The idempotent-braid resolution, `a^2-a, b^2-b, b*a*b-a*b*a`, now terminates
in native and Wasm default safe mode. Two original shortcuts mishandled
mixed-degree monomials and complete tensor words; both are corrected in
build copies. The new twenty-case matrix checks full differentials and uses
an independent augmentation projector to prove higher Tor vanishes.
See [BRAID-FIX.md](BRAID-FIX.md), [braid.json](validation/braid.json) and
the [retained diagnostic history](validation/resolution-limits.json).
Legacy preserves the original routines and its earlier safe-mode error.

The console evaluates supplied Lisp forms and file-based jobs; it does not
implement an interactive stdin dialogue across separate submissions. Use the
presentation form for algebraic input. Console jobs also have a Stop button.
Relations entered in the form have integer coefficients; rational arithmetic
is used internally. Tests of a finite selection of prime fields do not
certify every prime. Firefox and Safari have not been exercised here.

Default mode fixes the specific defects listed in
[SOURCE-REVIEW.md](SOURCE-REVIEW.md); it is not a claim that all historical
Bergman bugs have been discovered. Each fix has a legacy branch and a dated
source notice. Vendored original files are not modified by the build.
