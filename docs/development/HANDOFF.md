# George handoff

## George 0.5 memory64 — 2026-10-02

The current package/interface are **0.5.0 / 0.5**. The fourth backend is
**C / ECL O3 + LTO (memory64)**, with actual 64-bit pointers throughout
ECL, GMP and GC. The wasm32 C backend remains the default; there is no
paired memory64 speed assessment. The new assets contain no builder home
paths and retain conservative GC pointer spills, exact arithmetic and the
same Bergman data as the three existing engines.

Memory64 offers allowances through **16 GiB** and **No heap cap** (`0`).
The latter removes ECL's heap allowance, not the browser's 16 GiB maximum
for this single memory. Unsupported browsers disable this backend.
Wasm32 allowances reach **4095 MiB**; switching from a larger or uncapped
memory64 setting clamps the allowance. There is no measured universal
300 MiB reserve. Share links preserve these settings and the new pruning
checkbox while retaining old version-1 field defaults.

Executed checks: **79 unit tests**, **128 memory64 parity cases in Node
and ordinary Chromium**, both original sequential sessions (**37 exact
outputs per mode**), and **45 pruned cases in Node and Chromium**. The
pruning references were checked independently with native SBCL (45 cases)
and Singular (42). The real browser UI passes with all four backends at
root and `/george/`, including timeouts/restart, sharing, 16 GiB and no-cap
settings, mobile and blocked storage.

An ordinary browser worker holds **4.21875 GiB of live arrays** and
**4.352783203125 GiB of allocated Wasm memory**, surviving GC/root checks
and exact bignum arithmetic. Final engine hashes and evidence are recorded
in [memory64.json](validation/memory64.json). Allocated Wasm memory is not
live Lisp heap or browser RSS. Browser reference reports were rechecked
against every saved output after a timestamp-only Node report refresh;
both reference hashes are retained in that audit.

The submitted 15-generator/100-relation presentation completes degree 7
on memory64 with pruning and no heap cap: **695 elements**, byte-for-byte
native equality, **191.1875 MiB allocated Wasm**. On wasm32, repeated
off/on comparisons reduce allocation from **110.875 to 92.375 MiB**
(about **16.7%**) with the same output. These are memory observations;
concurrent builds/validation prevent a fair speed claim. Pruning is
optional and applies only to homogeneous, unweighted, noncommutative,
degreewise Gröbner basis jobs. **Do not restart the cancelled main
degree-eight run. Degrees 9–11 have not been checked on memory64.**

Rebuild with `npm run wasm:build:backends`, or use the isolated memory64
recipe in [BACKENDS.md](BACKENDS.md). The pinned Binaryen spill-pointer
stack helper requires the included i64 patch. The final release was
assembled through the equivalent pinned build and neutral-path AOT steps;
the combined fresh-build wrapper has not itself been run end to end.

Prepare the committed release and refresh `publish/main`,
`publish/gh-pages` and `build/publication/publish.sh` for the user's manual
push. Deployment continues from permitted `gh-pages`; publishing guidance
belongs in [DEPLOYMENT.md](DEPLOYMENT.md). No remote push is authorized by
the user's current preference to publish personally.

## George 0.4 backends and LHS parity — 2026-10-01

That package/interface were **0.4.0 / 0.4**. The default was
**C / ECL O3 + LTO**. More settings also offer **Lisp / ECL O3 + LTO** and
**Lisp / ECL O2**; labels state the actual compilation choices. Backend
selection is persisted and shared. Version-1 share field order/defaults
are preserved; the appended backend field defaults to standard for old links.

ECL compiles 763 existing functions and installs 163 aliases. Local
`ext:use-direct-C-call nil` and `notinline` declarations retain Bergman's
runtime `COPYD` changes. Two malformed legacy routines and later auxiliary
loads remain bytecode. The original mathematical routines were not rewritten.
All variants retain pointer spilling and identical `ecl.data`; the C/O3
assets are under `web/engine/compiled` and the Lisp/O3 assets under
`web/engine/optimized`. `npm run wasm:build:backends` rebuilds all three.

The paired ordinary-browser degree-four medians are 11.488 s (Lisp O2),
8.188 s (Lisp O3 + LTO), 0.310 s (C O2 comparison), and 0.223 s (C O3 + LTO).
The selected C backend returns the exact native 695-element degree-seven
output with median 10.765 s; one of three runs took 28.333 s under varying
desktop load. No paired degree-seven Lisp speed ratio is claimed.
**Degree eight was cancelled by the user; do not restart it.**

The final suite covers **128 cases** on each backend in Node and ordinary
Chromium, all exact successes: **384 browser runs**, **222 historical output
checks**, 3,664 critical ambiguities and 353 differential identities. Singular
checks all **96 LHS underlying algebras** with full generating-ideal equality,
plus eight printed commutative Hilbert series. A focused **19-case** audit
compares the three former failures and 16 boundary anchors with fresh native
SBCL, Singular, dimensions and printed Hilbert coefficients. The original
three expected failures are now required successes; the old failure fixture
was removed. All **74 unit tests** and the final UI audit pass.

Boundary fixes in `ports/common/behavior-patches.py` accept zero/one exponent
degree sums, make strict elimination comparisons return false on equal
words, hold the shorter word's terminator during unequal-length scans, and
scale the finite one-generator Hilbert numerator by its weight. These
boundary corrections apply to **both legacy and fixed modes**; the previous
algorithmic legacy branches remain. Native SBCL originally reproduced the
failures while Singular succeeded, motivating the fixes. Build native SBCL
in a fresh directory: saved cores contain absolute autoload paths and old
images from the former Downloads checkout are stale. The final oracle
launcher is `build/sbcl-oracle-fixed-v4-04-20261001/bin/clisp/unix/bergman`.

**Time limit (minutes)** defaults to **0 (unlimited)**. It is stored and shared,
works for form jobs and console commands after initialization, terminates
and resets the worker on expiry, and chunks long deadlines. Older links
restore unlimited time. Tests use `GEORGE_TEST_TIMEOUT_MS` (0 disables) and
browser `GEORGE_TEST_OVERALL_TIMEOUT_MS`. Backend parity workers run
concurrently in Chromium; their timings are not performance measurements.

The current package has new runtime hashes after the boundary fixes. The
paired timings above are retained as initial-0.4 evidence, not remeasured
speed ratios for the new assets. The existing C degree-seven share link was
rechecked on the final runtime and still matches the native 695-element
output. Full current evidence is in [compilation.json](validation/compilation.json),
[backend-parity.json](validation/backend-parity.json),
[lhs-singular.json](validation/lhs-singular.json), and
[backend-oracles.json](validation/backend-oracles.json).

Prepare the committed release for the user's manual publisher. Deployment
continues from the permitted `gh-pages` branch. Pages verification now
checks UI sources and every backend asset. Publishing instructions belong
in [DEPLOYMENT.md](DEPLOYMENT.md), not README. No remote write is authorized
by the user's current preference to publish personally.

## Runtime profiling and O2 release — 2026-10-01

The current engine uses freshly compiled O2 ECL/GMP/GC libraries and an O2
final link, with the conservative GC pointer spilling pass retained. The
original Bergman bytecode data is unchanged. The release excludes profiling
hooks. `ports/ecl/build.sh` now defaults to O2 and uses an identified,
optimization-specific cache; the previous O0 settings remain selectable.

The submitted 15-generator/100-relation example takes 9.635 seconds through
degree 4 in Chromium versus 17.541 seconds for the previous engine in the
current comparison, and 155.148 seconds through degree 6 (497 elements).
Native output equality is exact. O3 does not improve this example clearly;
native Wasm jumps help Node but lose to plain O2 in Chromium. Profiling
identifies the ECL interpreter/control flow as the main runtime cost, with
GC around 4–6% of the measured computations. Full unrestricted completion
is still not certified.

The selected engine passes 74 historical output checks, reader recovery,
51 independent algebra/resolution cases, large live allocations and real
browser cancellation/exhaustion/form recovery. All 53 current unit tests
pass. See [PERFORMANCE.md](PERFORMANCE.md) and
[performance.json](validation/performance.json) for hashes, exact timings,
scope and reproducible isolated build/profile commands. Earlier sections
describe older engine snapshots. Publication is still prepared locally
for the user's manual push; no remote publication was performed.

## Pages publication setup — 2026-10-01

Deployment now originates from **gh-pages**, matching the existing
`github-pages` environment's allowed branch. The workflow is copied onto
the static branch along with `web/` contents. A main-branch job updates that
tree automatically and explicitly dispatches the gh-pages workflow after
a token-generated push. A manual atomic push already triggers deployment
on gh-pages, so main skips staging when the exact tree is present.

The generated `publish.sh` checks prepared refs, pushes both branches and
waits for the gh-pages workflow and exact served release files. Full details
are in [DEPLOYMENT.md](DEPLOYMENT.md). There are no environment-setting
instructions added to README. No repository settings are changed.

The source archive includes the workflow. Publication must use fresh refs;
the preserved local `gh-pages` branch is historical. The user chose manual
publication after the initial SSH authentication failure. Prepare with
`node tools/prepare-publication.mjs --update --fast-forward`; the generated
script publishes the reviewed refs atomically without forcing remote branches.
The user runs it in their terminal and selects the Pages source in GitHub.
Keep credential details in private local notes. No remote write was performed
while preparing this release.

## George 0.3 interface update — 2026-10-01

The current package and visible interface version are 0.3.0 / 0.3.
Completion times now display locale-aware seconds with up to two decimal
places; internal durations remain milliseconds. The small Share button
copies a link and exposes a selectable fallback when clipboard access fails.

`web/src/share.js` encodes every form control plus preset, language and theme
using a versioned positional schema, omitted defaults, deflate compression
and URL-safe base64 in `#s=1z…` (or uncompressed `#s=1u…` when shorter or
compression is unavailable). Keep version-1 field order/defaults stable.
Decoded state is bounded to 1 MiB and checked before restoration. The link
overrides local saved settings, supports root and project paths, and does
not launch a calculation. It also restores links navigated to in the same
page. No external shortener or persistence service is required.

Existing locale/version assertions were updated; no additional test runs
were requested or executed for these interface edits. The memory report
below remains the evidence from the earlier 0.2.0-labelled memory build;
the engine binaries are unchanged by the interface update. These changes
have not been published.

## Memory update — 2026-10-01

The current local engine supports a 4 GiB Wasm address space and a selectable
Lisp heap under **More settings → Memory limit**: 512 MiB, 1 GiB, 2 GiB
(default), 3 GiB and 3.5 GiB. `buildJob` carries `memoryMiB`; the shared runner
sets ECL's heap limit without changing the portable Bergman session script.
Memory grows on demand. There is no fixed generator or relation count limit.

ECL's `EXT:STORAGE-EXHAUSTED` inherits from `SERIOUS-CONDITION`, so the old
`ERROR` handler missed it. The host now catches it and returns bridge status
2. The worker returns saved basis output as explicitly interrupted, and the
client releases that worker before the next command. Ordinary Lisp reader
errors still preserve their session. Interrupted series/resolutions are not
presented as completed results.

The bytecode runtime is `/tmp/george-memory-v2-runtime-20261001`; it was rebuilt
with the current sources and relinked with the existing validated ECL Wasm
library. The previous reader runtime was restored after an initial link, and
old engine assets remain under `build/engine-before-memory-20261001/`.
`web/engine/build.json` identifies the new assets and memory settings.

The latest measurements and scope are in `validation/memory.json` and
the memory section of VALIDATION.md. Earlier sections below describe the
September release and its retained evidence. These local memory changes have
not been published.

Updated 2026-09-30. The **Bergman → ECL → Wasm → HTML** MVP computes with the
real **bergman-1.001-fix** engine with fixed behavior by default and original
Bergman 1.001 behavior in legacy mode. George 0.2 includes the persistent console
and engine reader recovery. It has the validation runs listed below. The
former
single-letter adapter restriction is removed. The native idempotent-braid
resolution stall is fixed in default mode. Earlier prototype/demo-only
notes are superseded by this document.

## Read first

- [README](../../README.md): running, building and reproducing validation.
- [Source review](SOURCE-REVIEW.md): original and OCaml source findings,
  portability decisions and default-mode fixes.
- [Validation](VALIDATION.md): executed results, timings and limits.
- [Additional upstream tests](UPSTREAM-TESTS.md): pinned Singular/Plural,
  SymPy and GBNP presentations, oracle checks and adaptations.
- [Braid fix](BRAID-FIX.md): both native causes, independent algebraic
  certificate and conservative weighted homology reporting.
- [Reader fix](READER-FIX.md): readtable/RAISE restoration, cached bridge
  function, unavailable keyboard input and same-session recovery evidence.
- [Capability map](CAPABILITIES.md): original / OCaml / Singular / George.
- [User guide](../USER-GUIDE.md): source provenance and interface features.
- [Evidence manifest](validation/summary.json): retained reports and full
  local artifact paths, plus source hashes.

## Results

- All 37 historical outputs match in legacy mode; all 37 corrected references
  pass in default mode, on native SBCL, Node/Wasm and real Chromium.
- 51 unit tests; 20 extra original sessions, including one intentionally
  invalid backup; all 14 form presets.
- Eight native reader EOF checks; 23 consecutive failed commands in each
  Wasm mode, followed by successful computation and GC in the same session.
- Persistent console checks at root and project paths: retained settings/files,
  missing/no input, nested readers, help, completion, history and file shortcuts.
- All 24 upstream OCaml aliases; all five relevant active examples compared.
- 42 independent basis cases, 597 critical ambiguities, nine resolution cases
  and 560 identities d²=0 before augmentation. Singular/Plural, Hilbert
  dimensions and exact augmented matrix ranks provide additional checks.
- Ninety imported Q/F₂/F₅ cases from 17 pinned source files: native/Wasm
  equality, 3,379 exact critical ambiguities and three Singular reductions each.
  Thirty-nine commutative cases also pass SymPy Buchberger/F5B, and six
  Plural cases pass independent two-sided ideal and dimension checks.
  Ten original SymPy test functions execute separately.
- Browser stop/restart, responsiveness, 100 MB allocation / memory growth,
  exact integers, monoid augmentation and desktop/mobile rendering verified.
- Guide, eight guided examples, EN/RU, automatic/light/dark, local MathJax
  and persistence pass at `/` and `/george/`. No external requests or errors.
- Longer and overlapping generator names now work through both resolution
  stages, exact homology and the browser display. Twenty additional cases
  compare all structural terms with native SBCL and a single-letter renaming,
  and verify 258 full identities d²=0 before augmentation and 91 ambiguities.
- Twenty braid cases compare native and Wasm over Q/F₂/F₃/F₅/F₁₀₁,
  checking 860 full identities d²=0 and 220 critical ambiguities. An independent
  projectivity certificate proves the expected higher Tor groups vanish.
  Both browser paths verify the braid and the weighted cutoff notice,
  plus imported braid, Katsura, weighted and Lie-quotient presentations.

## Implementation map

`ports/ecl/build.sh` pins ECL and Emscripten. `build-bergman.sh` compiles
portable bytecode in an isolated build copy. `prelude.lisp` supplies the
reader and bytecode loader; `bridge.c` exposes the evaluator. The original
vendored source files remain unmodified; disposable upstream artifacts are
excluded as documented in VENDORED.md. `web/engine/build.json` identifies the
current generated engine.

`ports/common/behavior-patches.py` and `george-overlay.sl` hold dated fixes
with legacy branches. `anick-tensor.sl` supplies full-word comparison,
chain-identity merging and stable sorting for default safe-mode tensors.
The degreewise safe monomial comparator follows legacy switches dynamically.
The imported tests additionally repaired stale reduction signatures, inclusion
scheduling, redirected critical-pair contexts, structural units and
commutative process changes. All retain original branches in legacy mode.
See the source review for exact original defects and their reproducing cases.
`web/src/homology.js` reports only certified complete incoming-chain degrees;
unreported partial dimensions are retained as `truncatedBetti`.
`web/src/engine.js` manages session lifetimes;
`web/engine/runner.js` is shared by the worker and Node validation. Form jobs
start fresh; console evaluations retain state. Nonhomogeneous Anick jobs
complete the basis first, optionally shift augmentation, then compute a
resolution and exact ungraded homology.
`GEORGEWRITERESOLUTION` in the overlay exports versioned `resolution.jsonl`
directly from chain/tensor objects. `web/src/resolution-data.js` validates
generator indices and exact coefficient strings; chain keys are token arrays.
The codec is shared by homology, display and the independent differential
checker. See `docs/RESOLUTION-EXPORT.md` for the format and unit convention.
Legacy output and original `ANICKDISPLAY` are unchanged. Only ordinary
algebra Anick form jobs opt into this export; module procedures retain their
original outputs. `npm run test:resolution:names` reproduces the new corpus.

Never overwrite `web/engine/ecl.*` while a verification process is running:
its cached loader can otherwise encounter mismatched Wasm/data files. Two
such development runs failed initialization; both were discarded and rerun
against the final stable files.

## Reproduction and publication

All commands are local. There are no repository CI/Actions workflows.
Publish prebuilt `web/` on the `gh-pages` branch with the prepared publication
script, and select that branch's root in Settings → Pages. Run `npm run sources` after changes to keep
the downloadable source archives current. Stage new release files first:
the George archive includes tracked/staged files and excludes untracked
workspace drafts. Its ECL archive includes bundled
GMP and GC. Component notices are under `web/licenses/`; MathJax's notices and
asset hashes are under `web/vendor/mathjax/`.

The final engine runtime build is identified by `build/engine-build.json`.
This release compiled the patched Bergman runtime in
`/tmp/george-reader-02-v2-runtime-20260930` and relinked it with the previously
validated ECL Wasm library under `build/toolchain/ecl-wasm`. Both the bridge
Wasm code and bytecode/data now contain the reader fixes. Its native reference
is `build/sbcl-reader-02-v2-20260930/bin/clisp/unix/bergman`.
The user previously chose the validated toolchain after a neutral-path ECL
rebuild terminated before linking. That library rebuild was not resumed.
`ports/ecl/build.sh` and `link-wasm.sh` now contain the neutral-path changes;
that build has not been verified successfully. A future rebuild must rerun
the engine-dependent suites and refresh the evidence manifest.
Native reference builds, pinned oracle checkouts and detailed logs are under
`build/`, which is ignored. Small result reports are retained under
`docs/development/validation/`. The source-package setup script was exercised locally.
The earlier release was published by the user: live HTML and the engine
manifest matched local `gh-pages` commit `6bd9020`. The current fixes have not
been published; that Pages branch still holds the earlier release.

## Practical limits and future work

The audit establishes the listed compatibility and independent checks, not
universal correctness of every experimental Bergman routine. Degree limits,
finite versus truncated resolutions, the malformed backup and known
upstream issues are documented in the validation report. The parser's former
single-letter restriction is removed and must not be reintroduced.
The earlier idempotent-braid stall is resolved in default safe mode by fixing
mixed-degree monomial and complete tensor-word ordering. Its old native/Wasm
timeouts and legacy diagnostic remain as history in
`docs/development/validation/resolution-limits.json`. Reproduce the new matrix
with `npm run test:braid`. Legacy retains the original routines and its direct
safe-mode diagnostic; this fix does not change that behavior.
Weighted resolutions use a conservative bound on complete incoming chains;
some available ranks remain unreported until the degree limit is increased.
Chromium was verified; Firefox/Safari remain untested.

The user's todo items are completed and `todo.md` was removed as requested:
source-based guide, characteristic examples, translation/theme/MathJax checks,
clean layout, current feature matrix and Pages instructions/verification.
The guide lives in `web/src/guide.js`, examples in `tutorials.js`, and the
active locale/preferences modules are `i18n.js` and `preferences.js`.
MathJax is pinned at 4.1.3; `npm run ui:package` reproduces its local assets.
`npm run test:ui` starts its own servers and tests the root and project paths.

The former `i18n.js` and `setup-schema.js` drafts and paused `sl2js` experiment
were moved out of the release tree to the ignored local archive
`build/archive/initial-cleanup-20260930/`. The archive also holds removed
upstream filesystem remnants, generated documentation artifacts, logs and
unused editor backups. Its manifest records their paths and hashes.
The old drafts are not used by the current implementation. No account-site
repository is required for this project site; the README describes the
branch-based GitHub Pages publication.

The initial Git snapshot includes the validated application, original
sources, regression fixtures, small evidence reports and distributable
engine/source packages. Local toolchains, dependencies, detailed run logs,
archives and agent configuration are excluded.

The earlier interface and structural-export release is committed and published.
The current checkout is on `main`, tracking the published source branch. Contributor
cleanup: `tools/prepare-publication.mjs` creates clean `publish/main` and
`publish/gh-pages` histories, removes Claude co-author trailers and preserves
human authors and all original file trees. Its Pages tip contains the exact
committed `web/` tree. Original local refs remain available. The ignored
`build/publication/plan.json` / `publish.sh` record the guarded publication.
The cleaned histories were pushed; the public contributors API now returns
an empty list, although GitHub's interface may retain older cached data.
Do not publish an old history afterward and reintroduce removed trailers.

The previously deferred console work is now included in George 0.2. Its
JavaScript guards, automatic session restart after input EOF, and first-T
filter have been removed. Recovery is implemented in the Common Lisp reader
patches and ECL host; see READER-FIX.md. The source archive includes the new
console, its tests and unmodified Bergman help texts.

The rebuilt native reference is
`build/sbcl-reader-02-v2-20260930/bin/clisp/unix/bergman`; the rebuilt ECL
runtime is `/tmp/george-reader-02-v2-runtime-20260930`. The existing validated
Wasm ECL library was reused and relinked with the corrected bridge. Manifest
`web/engine/build.json` records the exact engine hashes and appVersion 0.2.0.

All checks in the evidence manifest were rerun against this release. The
collector's exact selections are in `build/validation/reader02-release-reports.json`.
`npm test` executes all 51 assertions with Node >=22.8 and
`--experimental-test-isolation=none`. The browser checks include the actual
current console/form interface, rather than the earlier isolated checkout.

The user published the prepared source and Pages branches. Both remote tips
match the release plan. A live check found that Pages still served the previous
release and no new deployment workflow had run yet. The new version needs a
Pages deployment before its live console checks can be completed. Existing-site
Chromium checks passed computations, responsiveness, cancellation and memory
growth; those checks do not certify the newly pushed version.

Machine-specific authentication instructions belong only in private local
notes. The public README describes generic hosting; the source archive must
contain the same sanitized documents. Original local refs remain available.
