# George development handoff

## 0.6 experimental — 2026-10-02

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

Live memory beside Computing reports allocated Wasm linear memory,
not browser RSS or live Lisp heap. EN/RU setting explanations use accessible
“?” controls. Worker count is the 32nd version-1 Share field; BigInt masks
preserve old token meanings.

### Evidence and commands

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
