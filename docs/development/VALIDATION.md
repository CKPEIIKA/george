# Validation and verification

## fomkyr 0.3.0 integration — 2026-10-02

All four prebuilt shared/unshared wasm32/wasm64 modules match the imported
source archive. The C kernel is unchanged; George adapts the worker protocol,
progress, settings, timing units and localized results.

The release version is **0.6.0**; the experimental label appears only in
fomkyr's engine chooser entry. All **112 unit tests** pass:
[unit log](validation/fomkyr-unit-tests.log). They include release labels,
all-option sharing, exact asset hashes, parser/capability boundaries,
unfinished draft restoration and unshared cancellation.

- **Nine imported suites pass** in a staging copy: native, extra, actual Wasm,
  release, compatibility, integration, static-host unit tests, and both
  installer fixture suites. The native library is compiled locally from the
  imported source. Tests cover actual four-variant execution, independent
  Fraction checks, pruning negation, long-word compositions at degrees
  32/33/34/65/130, large exact Hilbert integers, unbounded completion proofs,
  deadline/cancellation, checkpoint corruption and cross-mode resume.
  OPFS in these Node suites is emulated, and is not browser evidence.
- **48 seeded LHS cases plus four anchors / 208 fomkyr runs** all pass against
  C/ECL and **52 independent bounded Singular checks**. Full FK ranks 3–6
  cover Q and characteristics 2/3/5/7/101, permutations, sign changes,
  reversal, pruning, heap/cache and batch options. FK degrees are 2–5,
  with rank 6 capped at 4. The submitted 15-generator presentation is tested
  at degrees 3 and 4, and the coefficient anchor produces an actual
  155-bit internal coefficient. All four shared/unshared widths pass mutual
  bounded ideal reductions, equal leading-word sets, exact Hilbert prefixes
  and **80,600 critical ambiguities**. See the
  [algebra report](validation/fomkyr-03/report.json).
- The production UI passes **eight real-browser scenarios**, Firefox 155
  and Chromium 153 at root/project URLs with and without isolation.
  Both widths, automatic unshared fallback, actual multicore OPFS, mode
  changes with checkpoint resume, legacy-link migration, all-option sharing,
  exact Hilbert display, long input words, blank-degree completion,
  cancellation/restart, progress/RAM/seconds and capability restrictions are
  covered. The final runs also check release branding, restoration of
  unfinished numeric drafts, clearing stale series when Hilbert output is
  disabled, and 390 px help controls in EN/RU. Firefox retains four lanes
  with `broker-exclusive`; Chromium
  uses direct file access or an explicitly selected broker. No external
  requests or page errors occur. Reports:
  [Firefox](validation/fomkyr-browser-firefox-03/report.json),
  [Chromium](validation/fomkyr-browser-chromium-03/report.json).
- Separate **Pages-style tests** serve without isolation response headers,
  use George's existing service worker and exercise actual fomkyr OPFS in
  wasm32 and memory64 at both root/project mounts. Two lanes remain available
  in Firefox. Reload preserves settings; only verified immutable kernel
  binaries enter the Cache API. Blocking service workers leaves fomkyr's
  unshared fallback available. Reports:
  [Firefox static host](validation/fomkyr-static-firefox-03/report.json),
  [Chromium static host](validation/fomkyr-static-chromium-03/report.json).

An initial validation attempt could not invoke the compiler from the command
sandbox; compilation and subprocess checks were rerun in the approved local
environment. The upstream installer fixtures require a `python` executable;
a staging-only alias to python3 supplies it without source changes. Browser
pilot failures coincided with temporary quota exhaustion; inactive George
profiles were moved into the workspace without deletion, and the complete
browser matrices above were rerun successfully. Pilot failures are not
reported as passes. No remote deployment is claimed.

Reproduce with `npm run test:fomkyr`, `npm run test:fomkyr:browser`,
`npm run test:static`, and the Firefox static-host variant
`node tools/validate-static-isolation.mjs OUTPUT --firefox`.
Per-computation validation deadlines remain at most 120 seconds.

## Earlier George 0.6 checks before fomkyr 0.3 — 2026-10-02

This section records the earlier Native NC integration. Current release
branding and backend checks are in the fomkyr section above.

All **97 unit tests** pass: [unit log](validation/unit-tests-06.log).
The static-host check uses no server isolation headers at either `/` or
`/george/`. The app installs its local service worker, then Native NC computes
with two workers in both wasm32 and memory64. Reload preserves settings,
both release labels are localized, no offline cache is created and no
external requests occur. With the service-worker API unavailable, Native is
disabled and Bergman remains usable: [report](validation/static-isolation-06.json).

The final [UI regression](validation/ui-06.json) passes at root and project
paths, including 390 px mobile layout, EN/RU, themes, MathJax, all four
Bergman backends, old Share defaults, timeouts and blocked storage.
The fresh [Native UI regression](validation/native-ui-06.json) passes worker
selection, persistence/Share, both widths, live memory, OPFS downloads,
capability restrictions, cancellation/resume and timeout/restart.

## Native NC integration — 2026-10-02

The initial George **0.6.0** integration used an explicitly selected `native` backend.
The Native NC 0.1.0 archive's manifest was checked before importing its
sources, tests and unchanged wasm32/wasm64 modules. MIT notices are retained.
The stale overlay installer was not applied; George uses a separate worker
and its existing configurable capability controls.

- **94 unit tests** pass: [log](validation/unit-tests-native.log). Native
  constraints, manifests, worker-count sharing (including bit 31 of the
  version-1 mask), cooperative cancellation and restart are covered.
- The appropriate imported **native, extra, Wasm and integration suites**
  pass in a staging copy. They include independent Fraction reductions,
  word encoding past 64 bits, actual 155-bit coefficients, prime fields,
  bounded allocation failure, cancellation and cross-width checkpoint resume.
  Historical result files and the original installer/browser harness were
  not used as current integration proof.
- **19 local parity cases / 38 Native runs**, wasm32/one worker and
  memory64/three workers: 16 FK LHS samples, two low-degree anchors and the
  155-bit-coefficient fixture. C/ECL and **19 bounded Singular
  checks** agree by mutual ideal membership and normal-word dimensions.
  **8658 critical ambiguities** pass across both widths. FK degrees are 2–4,
  with the reference 15-generator case bounded at 3; the coefficient anchor
  is bounded at 5. Full details: [native.json](validation/native.json).
- Actual isolated Chromium checks worker selection/persistence/Share,
  capability grey-out, EN/RU “?” help and file controls, exact OPFS text
  versus preview, automatic memory64 above 4095 MiB, live memory, stop/resume,
  configured timeout/restart, and returning to Bergman. Without isolation
  Native is disabled: [native-ui.json](validation/native-ui.json).
- **21 serial browser degree-7 trials** give 695-rule outputs with matching
  leading words and mutual reductions. An independent checker certifies
  **10250 ambiguities** through degree 7. Best measured Bergman median is
  **29.15 s**, Native/four workers **2.91 s** (**10.02×**); see
  [timings](validation/native-speed.json),
  [output-hash/leading-word audit](validation/native-leading-words.json)
  and [PERFORMANCE.md](PERFORMANCE.md) for scope and memory figures.

The browser test exposed a form stop/restart race: an old rejected run
could overwrite a replacement run's status. Form generations fix it.
Native cancellation also waits for OPFS handles to close, and already
closed workers terminate immediately. No kernel mathematics was changed.
Native output is degree bounded and its old tails are not globally
interreduced. No new main-case degree-8-or-higher run was made; bundled
degree-10 claims in the original backend archive were not independently rerun.

The reports above were produced before the 0.6 version bump; their recorded
versions and hashes are preserved. The mathematical Wasm modules are unchanged.
The full preceding UI audit is [ui-native.json](validation/ui-native.json).
Public evidence paths are normalized to repository-relative paths; timings,
versions, output hashes and runtime hashes are unchanged.

## Local 0.5 follow-up — 2026-10-02

The focused Fomin–Kirillov suite uses **16 LHS samples + 2 anchors**,
with full rank-3-to-6 presentations, variable permutations/signs,
Q/F2/F3/F5/F7, reversal, pruning and both behavior modes. Degree bounds
are **2–4**, with rank 6 capped at **3**. `npm run test:fk` runs it with a
30-second per-calculation watchdog (`GEORGE_TEST_TIMEOUT_MS` overrides it).
The definition follows [section 2 of Blasiak, Liu and Mészáros](https://arxiv.org/pdf/1310.4112).

All **18 native cases** agree byte for byte with all four engines (**72
engine runs**). Independent reduction certifies **4317 ambiguities** within
the bounds. Singular checks both generating-set memberships and normal-word
dimensions using **the same low degree bound**, rather than completing a
larger basis. The exact reference presentation has dimensions **1, 15,
125, 765** through degree 3. No high-degree or unrestricted result is claimed.
The initial harness failed because its Singular ring identifier collided
with the presentation generator `r`; synthetic oracle names fix that collision.
All engine/native results already agreed; no mathematics change was needed.

The full case forms, compiler identities and per-output hashes are in
[fomin-kirillov.json](validation/fomin-kirillov.json).

All **88 unit tests** pass ([log](validation/unit-tests-local05.log)). The actual browser UI checks the new memory64 /
**16077 MiB (15.7 GiB)** default, retained settings/Share behavior, configurable
task/setting grey-out, and live memory display on each of the four backends.
The [full UI report](validation/ui-local05.json) covers root and `/george/`,
mobile, blocked storage and a simulated browser without memory64 support.
After that run, fixed boolean settings were hardened to reject string
values such as `"false"`. This is the only source difference in that report;
the final 88-test log and a [focused browser check](validation/ui-capabilities-local05.json)
cover the stricter validation and the actual disabled/re-enabled controls.
All source hashes in the focused report match the final local sources.
Separate production-worker checks retain two 120 MiB arrays on wasm32 and
memory64 and confirm multiple memory updates arriving **while a synchronous
allocation is still pending**. GC roots and exact arithmetic pass. Values
describe allocated Wasm memory, not live Lisp heap or total browser RAM.
Streaming event sizes, pending-command flags and runtime hashes are retained
in [memory64](validation/memory-monitor-memory64.json) and
[wasm32](validation/memory-monitor-wasm32.json) reports.

These reports retain their original 0.5 identities as historical evidence.

## George 0.5 — 2026-10-02

That package was **0.5.0**. It added an explicitly selected
**C / ECL O3 + LTO (memory64)** engine to the three existing backends.
All four use identical Bergman data; the wasm32 C backend remains the
default. Final memory64 asset identities and report hashes are in
[memory64.json](validation/memory64.json).

| Executed check | Result |
|---|---|
| JavaScript unit tests | **79 passed**; [log](validation/unit-tests-05.log) |
| Memory64 LHS and anchors | **128 cases in Node + 128 in ordinary Chromium**, exact saved-output equality with the independently checked 0.4 reference |
| Memory64 sequential sessions | **37 exact outputs in fixed mode + 37 in legacy mode** |
| Monomial pruning | **45 cases off/on on each wasm32 backend** (270 Node runs), 135 browser pruned runs; memory64 adds 45 Node + 45 browser pruned runs; all outputs agree |
| Independent pruning references | Native SBCL checks all 45 cases; Singular checks generating-ideal membership in 42 noncommutative eligible cases |
| Above-4-GiB allocation | Production Chromium worker holds **36 × 120 MiB = 4.21875 GiB** live arrays; **4.352783203125 GiB** allocated Wasm; GC roots, arrays after GC and exact arithmetic pass; [report](validation/memory64-allocation.json) |
| Wasm32 highest allowance | 4095 MiB accepted; **3.75 GiB live arrays**, 3963.8125 MiB allocated Wasm, GC and arithmetic pass |
| Submitted presentation, memory64 | Degree 7, pruning on, no ECL heap cap: **695 elements**, exact native output, 191.1875 MiB allocated Wasm; [report](validation/memory64-mainDegree7.json) |
| Submitted presentation, wasm32 pruning | Repeated off/on/on/off runs: **110.875 → 92.375 MiB** allocated Wasm, about **16.7%** reduction, exact 695-element output in every run |
| Actual UI | Root and `/george/`, all four backends, memory64 16 GiB/no-cap calculations and Share links, wasm32 clamping, pruning persistence/sharing, timeouts/restart, EN/RU, mobile and blocked storage; no external requests |

Browser calculations run without a debugger. The new reports record final
engine hashes. Browser references were audited again against all raw
outputs after resuming Node reports changed report timestamps; old and
current reference-report hashes are recorded explicitly. The mathematical
cases, engine assets and output hashes agree.

The summary links the archived full reports, including
[Node parity](validation/memory64-node-parity.json),
[browser parity](validation/memory64-browser-parity.json),
[pruning references](validation/pruning-05.json), and
[UI checks](validation/ui-05.json). Sampled forms and individual output
hashes remain available in these reports.

Memory values above describe allocated linear memory, not browser RSS or
live Lisp heap, except the explicitly retained arrays. Timings gathered
during concurrent builds and validation are diagnostic; **no memory64
speed advantage is claimed**. No-cap removes ECL's allowance but this
engine still has a **16 GiB browser memory maximum**. The submitted
presentation has not been checked at degrees 9–11 in memory64. The
degree-eight run was cancelled. Degree-bounded results do
not certify unrestricted completion.

## George 0.4 — 2026-10-01

That package was **0.4.0**, with **C / ECL O3 + LTO** selected by
default and explicit **Lisp / ECL O2** and **Lisp / ECL O3 + LTO** alternatives.
All three use the same Bergman algorithms and bytecode data. The C backend
compiles existing functions through ECL; auxiliary bytecode remains.

| Executed check | Result |
|---|---|
| JavaScript unit tests | **74 tests passed** |
| Seeded LHS and anchors | **128 cases × three backends** in Node and Chromium; all succeed with exact output equality, **384 browser runs** |
| Singular LHS audit | All **96 sampled algebras**: 64 basis, 16 series and 16 resolution underlying algebras; full generating-ideal equivalence in every case, plus eight printed commutative Hilbert series |
| Focused independent oracles | **19 cases** (three former failures + 16 boundary anchors): native SBCL agrees with all three engines (**57 comparisons**), Singular checks the ideals, and normal-word counts check dimensions and printed Hilbert coefficients |
| Larger inputs | 16 generators/136 relations through degree 3 and 20 generators/210 relations through degree 2; backend equality and independently known quotient dimensions |
| Original sequential sessions | 37 output files in each mode for each backend, **222 exact file comparisons** |
| Independent parity certificates | **3,664 critical ambiguities** and **353 full differential identities** where checker order and degree bounds apply |
| UI and time limits | Root and `/george/`; unlimited default, timed infinite loops and restart in all three engines, EN/RU messages, fractional limits, form timeout, persistence, presets and share links; eight tutorials, mobile, blocked storage, themes, local MathJax and downloads |
| Current C degree-7 link | All shared settings restored through the actual local UI; 695-element output matches native byte for byte; no automatic start |
| Initial 0.4 C audit (historical assets) | 42 basis cases, 597 ambiguities and Singular reductions; nine resolutions with 560 d² identities; reader recovery, large live allocations, real exhaustion and saved-output recovery |

The design has 64 basis, 16 series and 16 resolution LHS samples, plus 32
anchors. Every pre-discretization LHS stratum is covered. Coordinates,
forms, outputs and final engine hashes are retained in
[backend-parity.json](validation/backend-parity.json). The three former
shared failures are fixed and now required to succeed; the previous expected
failure fixture has been replaced with positive oracle expectations.
Boundary corrections also repair the weighted one-generator Hilbert series.
The original vendor tree is unchanged, and all three backends use the same
patched package. Arithmetic/comparison boundary fixes apply in both modes.

Singular independently completes the original inputs and returned generating
sets in its own order. It checks that inputs eligible under the requested
bound lie in the returned ideal, and that every returned element belongs to
the full original ideal. It also checks full equivalence, which holds for all
96 samples. Letterplace bounds and omitted high-degree inputs are recorded
in [lhs-singular.json](validation/lhs-singular.json). This validates the
underlying algebra, not Anick differentials or every requested leading-term
order. Differential and ambiguity certificates are separate checks.
The focused native/Singular/dimension audit is in
[backend-oracles.json](validation/backend-oracles.json).

The app's time limit is in minutes and defaults to **0 (unlimited)**. It
applies separately to each calculation and console command after startup,
terminates the worker on expiry, and is preserved by settings and sharing.
Tests use a separate configurable watchdog; see [BACKENDS.md](BACKENDS.md).
The browser parity audit runs the three independent backend workers
concurrently for each case without a debugger. Its timings are diagnostic.

See [PERFORMANCE.md](PERFORMANCE.md) and
[compilation.json](validation/compilation.json) for compiler choices, source
hashes, current checks and historical timing evidence. The initial paired
0.4 timings and memory audits retain their original runtime identity;
they were not remeasured after the boundary corrections. The current
reference presentation still matches native through degree four in every
backend and through degree seven in the C share-link check. **No degree-eight
run was performed.** Degree bounds do not certify an unrestricted basis.

## Historical September audit

Release audit: **2026-09-30**. This is a working Bergman → ECL → Wasm → HTML
application running **bergman-1.001-fix**. Fixed behavior is the default;
legacy mode retains the original Bergman 1.001 behavior and version identity.
That audit used **George 0.2** (package version 0.2.0).
The reports below describe executed checks, with their scope. The September
audit describes the previous engine; the October update identifies and checks
the current memory-enabled build separately.

## George 0.3 interface changes — 2026-10-01

That interface release is **George 0.3** (package version 0.3.0).
It adds locale-aware seconds and compressed share links restoring the full
form, memory allowance, preset, language and theme. All 53 JavaScript unit
assertions passed on October 1. The engine was subsequently optimized as
described below; earlier audit results retain their original engine identity.

## Runtime optimization — 2026-10-01

The George 0.3 release engine uses fully rebuilt **O2 ECL/GMP/GC libraries**,
an O2 final link and the existing GC pointer spilling pass. Bergman's Lisp
bytecode is byte for byte unchanged from the memory update. Profiling hooks
are excluded from the release. See [PERFORMANCE.md](PERFORMANCE.md) and
[performance.json](validation/performance.json) for exact hashes, build
variants, measurements and checks on this engine.

The reference 15-generator, 100-relation presentation takes **9.635 seconds**
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

The reference presentation contains **15 generators and 100 quadratic
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
locally. Pages publication uses the prebuilt `web/` tree on a `gh-pages`
branch, as described in [DEPLOYMENT.md](DEPLOYMENT.md). The original checks
and source packaging used an isolated release checkout.
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
