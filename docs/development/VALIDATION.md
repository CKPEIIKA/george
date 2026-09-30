# Validation and verification

Release audit: **2026-09-30**. This is a working Bergman → ECL → Wasm → HTML
application. The reports below describe executed checks, with their scope.

## Results

| Layer | Executed result |
|---|---|
| JavaScript unit tests | 40 passed: parsing, validation, exact arithmetic, structural export, completion metadata, worker lifecycle, preferences, guide and locale coverage |
| Original 2007 CLISP regression | All 37 files match byte for byte in legacy mode, in native SBCL, Node/Wasm and Chromium/Wasm |
| Default-mode regression | All 37 expected files pass on the same engines; the PB file uses the corrected pre-2004 reference |
| Additional original sources | 20 sessions: 18 calculations, one mode-only smoke test, one expected rejection of a malformed backup; 23 output files match native Bergman |
| Form presets | All 14 pass through the production job builder and engine: 22 files match the bundled references exactly; one module basis matches as polynomials, with a differing Done marker |
| OCaml upstream | All 24 dune test aliases pass at the pinned revision |
| Shared OCaml cases | All five relevant active examples pass; Betti numbers and the aaa-chain words are compared with freshly executed native OCaml results |
| Independent basis checks | 42 cases pass: input reduction, 597 critical ambiguities, Singular mutual ideal membership, and known Hilbert dimensions where specified |
| Independent resolution checks | Nine cases pass 560 identities d²=0 over the quotient algebra, before augmentation; exact augmented ranks and d²=0 also pass |
| Longer generator names | 20 cases: native SBCL equality, all-term renaming equality, 258 full d² identities, 91 critical ambiguities, exact homology, overlapping names, Q/F₂/F₅/F₁₀₁, weights, reversed order and large rational coefficients |
| Browser behavior | Both historical suites, responsive main thread, stop/restart, exact 3⁴⁰, memory growth, form execution and monoid augmentation pass; no page errors |
| Guide and project-site UI | Root and `/george/` pass: all eight guided examples, EN/RU, state/file preservation, theme/system preference, persistence, blocked storage, 38 MathJax SVG expressions, mobile and downloads; no external requests or asset errors |

Small machine-readable evidence is retained in [validation/](validation/).
[summary.json](validation/summary.json) links the full local logs and records
source hashes; [engine.json](validation/engine.json) identifies the exact
three shipped engine files. Failed development runs are not release results.

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

## Browser and performance

Verified using Chromium 153.0.8010.52 on this Linux x86_64 workspace. The
complete historical suites took **5.1–6.3 seconds of computation** each
in the current run (6.2–7.9 seconds including startup). Measurements are in
[browser-regression.json](validation/browser-regression.json); timing varies
with machine load. These are entire-suite timings, not per-polynomial claims.

The Wasm heap starts at **64 MiB**. An explicit 100 MB Lisp array forced
memory growth to **123,011,072 bytes**, followed by GC and another exact
integer computation. While the full suite runs in its worker, a 20 ms main
thread timer continues firing. No isolation headers are used. Desktop and
390 px mobile screenshots were inspected; the ungraded Betti table uses
horizontal scrolling when needed.

Performance measurements use Chromium **without a DevTools connection**.
The separate Playwright run checks functionality and takes screenshots.
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

## Scope of confidence

These results establish regression compatibility for the shipped corpus
and agreement on the independent cases. They do not prove every original
experimental command, every admissible order or every input correct.

A bounded basis can be partial even when historical Bergman prints Done.
The UI states the bound; nonhomogeneous resolutions require a conservatively
completed basis. Homogeneous critical-pair certificates apply only through
the stated bound. A resolution reports homology only where an incoming
differential is available, unless its finite zero tail is certified.

The former single-letter restriction has been removed. Default algebra Anick
jobs read chain objects through a [structural export](../RESOLUTION-EXPORT.md).
The test `a*bc-a, ab*c-ab` on generators `a, ab, bc, c` retains both chains
whose compact original spelling is `abc`; its Betti numbers are 1, 2, 0.
Both static-site paths also exercise this case and underscore names through
the real form, file downloads and whole-token resolution display.

An exploratory idempotent-braid resolution, `a^2-a, b^2-b,
b*a*b-a*b*a`, stalled at internal degree 4 with single-letter names in native
SBCL as well as Wasm. It is recorded separately as a backend limitation,
not counted among successful resolution cases. The independent basis test
for that presentation passes. See the diagnostic record and handoff for
the [timeout evidence and reproduction paths](validation/resolution-limits.json).
The safe-mode default native run times out after 15 seconds and Wasm after
25 seconds. A direct legacy safe-mode session errors earlier; this diagnostic
does not establish identical behavior in all modes.
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
