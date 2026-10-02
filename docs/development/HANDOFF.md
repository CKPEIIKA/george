# George development handoff

## fomkyr 0.6.1, compact lists and bounded FK6 matrices — 2026-10-03

The production core is now fomkyr 0.6.1. The four shared/unshared wasm32/
memory64 binaries match the supplied archive byte for byte. All 694 imported
files match that archive, including the stale embedded 0.6.0 manifest; the
fresh import audit records every actual hash. Original 0.6.0 and older trees
and their evidence are retained. George stays 0.6.0, with experimental shown
only in the fomkyr chooser. Bergman memory64/16077 MiB remains the global default.

The 0.6.1 host awaits all batch lanes before checking the local result and
exposes exact rational compiled rewrites, enabled by default. George retains
its progress phases, degree-start/completed-prefix handling, seconds, RAM,
OPFS downloads, cancellation and checkpoint adapters. There are no George C
kernel patches. New rational heap/rewrite/cache controls have EN/RU help and
persist in drafts and Share links under Engine. Mathematical settings remain
under More settings. Automatic worker selection uses reported logical CPUs
minus one, clamped to 1–32; explicit counts cover 1–32 and unshared mode uses one.

Relations start expanded in a foldable preview. Both relations and each basis
degree wrap in compact groups by polynomial term count, preserving original
numbers. A power's base and exponent occupy one wrapping unit. Whole selected
expressions copy original source syntax, and partial superscripts serialize
with carets. Real FK6 output passes 32 Chromium/Firefox layout checks across
two themes, four widths and two root font sizes; desktop/mobile crops were
inspected.

Fresh verification passes 132 unit tests, 25 imported suites, 95 comparison
cases / 380 actual Wasm runs / 95 bounded Singular checks, and 105,376 certified
critical ambiguities. The expanded FK Latin hypercube has 64 samples and 24
dimensions. Eight production UI scenarios, both Pages-style isolation matrices
and eight old-checkpoint extensions from 0.3/0.4 pass. Native tests use fresh
Clang O3/LTO and UBSan builds; production Wasm binaries are imported prebuilt.
The compiled-Wasm staging harness gives its thirteen engine jobs and twelve
Python certificates individual two-minute limits, with aggregate time allowed
to finish. Vendored tests remain unchanged. The fresh small-case Singular run
used generic arithmetic fallback; subsequent large degree matrices and resource
benchmarks load and verify its packaged arithmetic modules explicitly.

`npm run test:fk6` checks eight bounds of the submitted presentation and eight
bounds of a seeded invertible generator scaling: 16 cases / 64 Wasm runs / 16
completed Singular oracles. The scaled form is graded-isomorphic and varies
exact rational coefficients. The original degree-9 Singular attempt is censored
at 120 seconds. `npm run test:fk6:finite` retains the independently randomized
coefficient presentation through its first proved zero in degree 6, dimension
678; it stops there. The two profiles have separate recorded fixtures and
reports. Degree 1 uses the empty linear ideal prefix for Singular/Bergman,
whose initial-degree behavior would otherwise compute degree 2. Fomkyr receives
the full quadratic input. Hilbert prefixes use independent BigInt normal-word
dynamic programming. Exact critical-pair certificates cover distinct bases
through degree 4; higher-degree tests compare membership and leading words.

The redundant full baseline repeat was stopped at the user's request. Its
partial 0.6.1 cold samples through degree 7 are retained as interrupted
diagnostics. Existing Bergman/SBCL/Singular measurements and resource plots
remain valid with their original versions and conditions. Future
`npm run benchmark:fk6` measures updated fomkyr only, on both growing forms
at bounds 1–9 and with controlled/default-batch worker probes. Each job is
capped at 120 seconds; audits and plotting follow all measurements. A full
baseline repeat requires `--all-backends`. CPU is process-tree core-seconds;
physical memory is sampled PSS, with browser baseline recorded separately. See
[VALIDATION.md](VALIDATION.md), [BACKENDS.md](BACKENDS.md) and
[PERFORMANCE.md](PERFORMANCE.md) for evidence and conditions.

Release preparation packages the full corresponding sources, commits the
integration, and refreshes `build/publication/publish.sh` plus the prepared
`publish/main` and `publish/gh-pages` refs. Deployment originates on the permitted
`gh-pages` branch. The user publishes with
`bash build/publication/publish.sh PATH_TO_SSH_KEY`; preparation performs no
remote push. The existing local preview is served at `http://127.0.0.1:8000/`.

## fomkyr 0.4.0 upgrade and settings layout — 2026-10-02

The production backend is now fomkyr 0.4.0, with all 293 imported manifest
entries verified and all four prebuilt Wasm modules unchanged. Original
sources/tests/docs and MIT notice are in `vendor/fomkyr-0.4.0/`.
Older versions and their measured reports remain intact. George stays 0.6.0;
experimental appears only in the fomkyr chooser. The global backend default
stays Bergman memory64/16077 MiB.

The user requested mathematical settings under More settings and runtime
settings inside a separate collapsed Engine submenu. The optional fomkyr Hilbert
checkbox is outside Engine. `fomkyr-options.js` exposes the new default-on
matcher, chain criterion, eager pruning, quadratic rewrite and cost scheduling,
plus cache/index budgets and live-progress interval in seconds. Existing
explicit saved/Share choices are preserved. The new word cache default is
256; matcher budget is automatic; progress interval is one second.

New upstream activity events are mapped to George's compact degree tooltip,
without an ETA. The host sets its completed-degree tracker before checkpoint
phase publication. Existing cancellation, OPFS downloads, public elapsed
seconds and legacy migration remain adapted. ABI-3 checkpoint compatibility
is demonstrated in actual browsers from 0.3 wasm32 to 0.4 memory64 over Q/F101.

All 119 unit tests, 15 imported suites, 79 algebra cases / 316 Wasm runs /
79 Singular checks / 96,172 certified ambiguities, eight UI scenarios,
both Pages-style browser matrices and four old-checkpoint checks pass.
The native physics test's missing modulus argument is corrected only in
staging and documented. No core patch or fresh Wasm compilation is claimed.
See [VALIDATION.md](VALIDATION.md#fomkyr-040-upgrade--2026-10-02)
and [BACKENDS.md](BACKENDS.md#fomkyr-040--2026-10-02).

The new checkpoint check runs with `npm run test:fomkyr:upgrade`. Other
build/validation/publication commands remain as below. A matched cold-browser
comparison against 0.3 is recorded in [PERFORMANCE.md](PERFORMANCE.md);
all jobs remain bounded by 120 seconds. The old degree-2–8 plot is retained
with its original 0.3 label and runtime hashes.

## Degree progress and defaults follow-up — 2026-10-02

`web/src/degree-progress.js` interprets engine events without using a timer or
requested bound to infer progress. Active degrees show an ellipsis, completed
degrees a checkmark. Tooltip text includes the completed prefix and actual
pair/reduction/basis counters; checkpoint, Hilbert and export phases are
explicit. Updates arrive after batches, so one long batch can hold a counter
steady. The C kernel and four Wasm modules remain unchanged.

`tools/validate-fomkyr-progress.mjs` checks the actual UI and OPFS with bounds
12 and 11. Fresh memory64 Chromium runs reach degree 11 after 47–48 seconds,
both with the completed degree-10 prefix of 2155 rules. Resumed runs reach
the same unfinished degree in about one second. Firefox using the submitted
wasm32/3584 MiB/pruning-off/Hilbert-on settings reproduces this at the degree-10
boundary with 1451 degree-9 rules. The expensive observed degree is cancelled;
no completed degree-11/12 timings or projections are established. Evidence
is in [VALIDATION.md](VALIDATION.md#degree-progress-and-fomkyr-defaults--2026-10-02).

Fresh fomkyr jobs now enable pruning as well as disk, resume and heap, and
disable optional Hilbert counting. Explicit preferences and Share settings
are retained. The form remembers pruning across temporary invalid input and
backend switches; its disabled visual state does not overwrite that choice.
Global backend selection and the Bergman memory64 default are preserved.
All 117 unit tests and the Chromium/Firefox UI and Pages-style checks pass;
the earlier 112-test/208-run mathematical integration evidence is retained
below with its original hashes. Runtime changes here concern host events and
defaults; no mathematical kernel rebuild is claimed.

## Local fomkyr 0.3.0 integration — 2026-10-02

The paused backend upgrade is now completed using `vendor/fomkyr-0.3.0/`.
All four shared/unshared wasm32/wasm64 modules are imported unchanged; only
George host adapters change. The UI calls the engine **fomkyr** and migrates
old `native` saved forms/Share links. The old registry entry and assets remain
available for historical reproduction but are absent from the selector.
Version is 0.6.0; only fomkyr's chooser label says experimental. These changes
are included in the local release commit; remote publication is a user action.

`web/src/fomkyr-options.js` validates persistent, shareable runtime options,
with localized help controls. The original form controls field/order/reversal,
unit weights, workers, pruning, GB/Hilbert degree, memory and time limit.
Blank degree requests completion; ABI-3 long words remove the old fixed
degree-20 limit. Hilbert coefficients render as exact decimal strings.
The memory64/15.7 GiB Bergman default is preserved.

Nine imported suites pass. All 48 FK LHS cases and four anchors pass C/ECL
and Singular comparisons across four actual fomkyr variants: **208 runs,
52 Singular cases, 80,600 critical ambiguities**. Firefox/Chromium production
UI checks pass at root/project mounts, isolated/unshared modes, and separate
Pages-style hosts using the existing isolation worker. Firefox retains four
compute lanes through the exclusive I/O-owner broker. Reports and commands
are in [VALIDATION.md](VALIDATION.md#fomkyr-030-integration--2026-10-02).
All **112 unit tests** pass: [log](validation/fomkyr-unit-tests.log).

`npm run test:fomkyr`, `npm run test:fomkyr:browser` and
`bash tools/build-fomkyr-backend.sh` are the current commands. Existing
`test:native` aliases point to the new validator. New runtime assets enter
the publication verifier, and source packaging includes the MIT notice.
Release preparation refreshes both source archives and the component notices,
then regenerates publication refs and `build/publication/publish.sh` with
`node tools/prepare-publication.mjs --update --fast-forward`. Deployment still
originates on the permitted `gh-pages` branch. No remote push is performed
during preparation.

## Earlier 0.6 integration before fomkyr 0.3 — 2026-10-02

George 0.6 integrates Native NC 0.1.0 as an experimental independent C
backend. Sources, tests, fixtures and MIT notices are in
`vendor/george-native-0.1.0/`. The shipped wasm32/wasm64 modules are unchanged;
`web/engine/native/` adapts the host protocol, workers and result downloads.
Source archive provenance and per-asset hashes are in its `build.json`.

The default remains Bergman memory64 with 16077 MiB (15.7 GiB). Unsupported
browsers fall back to C wasm32/2048 MiB. Existing preferences and old Share
links retain their settings. The five backend labels describe the actual
Lisp/ECL or C implementation and compiler options.

### Native capabilities

Homogeneous noncommutative Gröbner bases, degree-left-lex, 1–16 generators,
a required degree bound 1–20, rational or supported prime fields, bounded
input integers and arbitrary precision internal arithmetic. Unsupported tasks,
settings and the Lisp console are disabled. Capability policy is configurable
in `web/src/native-capabilities.js` and `backend-capabilities.js`.

The memory budget is 128–14304 MiB; a fresh API job uses 512 MiB. Above
4095 MiB Native selects wasm64. `nativeWorkers` is persisted/shared: 0 chooses
up to four workers, and 1–32 selects an explicit count. The shared scratch
budget is divided among workers. Monomial pruning is automatic.

Output is a primitive, degree-bounded basis. Earlier polynomial tails are
not globally interreduced; the UI and exported files state this. Large
outputs have previews and full OPFS downloads. Stop signals shared memory
and waits for disk handles to close before restart. Form run generations
prevent an old cancelled result from overwriting a replacement run.

### Browser integration

`web/src/start.js` prepares static-host isolation before loading the app.
`web/isolation-worker.js` adds COOP/COEP, reloads a first visit once and
revalidates network assets without an offline cache. It supports root and
project-directory deployment. Native requires isolation, SharedArrayBuffer
and OPFS; Bergman remains available if these are unavailable.
`npm run serve:native` supplies isolation headers directly for local work.

Live status uses compact memory, degree and time icons with hover/focus/tap
help in EN/RU. Memory reports allocated Wasm linear memory, including the
reserved scratch pool, rather than browser RSS or live object memory.
Elapsed time updates every 250 ms in seconds and includes engine startup.
Native host events distinguish degree start, progress and completion, including
restored checkpoints. Bergman Anick degree announcements are forwarded when
printed; other computations show a dash until a degree is reported.
Timers stop on completion, errors, time limits and cancellation.
Public Native result metadata uses `elapsedSeconds`; the UI displays seconds.
EN/RU setting explanations use accessible
“?” controls. Worker count is the 32nd version-1 Share field; BigInt masks
preserve old token meanings.

### Evidence and commands

The subsequent degree-2–8 resource comparison contains 56 serial cold runs:
all browser engines, Native in Firefox, native Bergman/SBCL and native
Singular/Letterplace. Remaining jobs have a 120-second cold wall cap;
the figure censors the two earlier long degree-6 pilots using their sampled
traces. CPU is measured in core seconds, and physical RAM is peak process-tree
PSS above the pre-engine baseline. Native Chromium uses four workers;
Firefox's storage fallback uses one. Every completed degree-8 run returns
990 elements, and all 52 completed runs have matching leading-word sets.
This is a consistency check, not a new full critical-pair certificate.
Reproduction commands, caveats and artifacts are in
[PERFORMANCE.md](PERFORMANCE.md#cpu-and-physical-ram-through-degree-8--2026-10-02).
The subsequent fomkyr 0.3.0 import and expanded tests are completed in the
section above; this section records the earlier 0.6 integration.

Pre-version-bump integration evidence includes 94 unit tests, imported
native/extra/Wasm/integration suites, 19 local cases across two Native widths,
C/ECL and 19 Singular checks, and 8658 certified ambiguities. Low-degree FK
LHS cases cover ranks 3–6 and several fields without expensive completion.

The reference 15-generator/100-relation presentation through degree 7 gives
695 rules. Three serial trials per seven configurations yield a best Bergman
cold median of 29.15 s and Native wasm32/four workers of 2.91 s (10.02×).
All leading words and mutual reductions agree; 10250 ambiguities pass
independently. Native allocates 177.625 MiB versus pruned Bergman's 92.375 MiB
at the tested 512 MiB budget. This does not establish a memory saving or
performance/capacity at degrees 8–11.

See [VALIDATION.md](VALIDATION.md), [PERFORMANCE.md](PERFORMANCE.md) and the
archived reports in `validation/`. Their original versions and hashes remain
intact; public machine paths are normalized to repository-relative paths.

- `npm test`: unit checks.
- `npm run test:static`: isolation and Native on a Pages-like host at both mount paths.
- `npm run test:fk`: four Bergman engines, native SBCL and bounded Singular.
- `npm run test:native`: imported suites and local C/ECL/Singular parity.
- `npm run test:native:browser`: Native UI plus controlled timing.
- `bash tools/build-native-backend.sh`: rebuild modules while preserving the host adapter.

Full-task ECL validators use `BERGMAN_BACKENDS`. Native is validated by ideal
membership, critical pairs and dimensions rather than byte equality of tails.
The fresh Native build wrapper has not yet been run end to end; the packaged
modules and a host compilation of the source were tested.

### Publication

Prebuilt assets and source archives are published from the permitted
`gh-pages` branch. `main` stages the static tree automatically; only the
`gh-pages` workflow uses the deployment environment. The prepared publisher
checks exact source/site refs and waits for asset verification after pushing.
Instructions and authentication options are in [DEPLOYMENT.md](DEPLOYMENT.md).
