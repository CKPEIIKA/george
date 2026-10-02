# George development handoff

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
