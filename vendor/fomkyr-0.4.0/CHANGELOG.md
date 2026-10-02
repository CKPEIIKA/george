# 0.4.0

- Exact leading-word matching with a bounded immutable automaton and hash fallback.
- Homogeneous interior-overlap chain criterion, independently checked.
- Proved square/skew-commutation zero pruning before heap insertion.
- Checked monic quadratic-binomial pre-rewriting, exact big/nonmonic fallback.
- Stable cost-ordered task dispatch; commit order and re-reduction unchanged.
- Degree-keyed prefix groups and exact overlap-progress totals without a pair prepass.
- Sampled atomic activity, bounded UI updates, withdrawn rather than invented ETAs.
- Optional budgeted word-cache sizing; small default retained after exploratory tests.
- Independent native and serialized-WASM algebra/field matrix; matched old/new timings.
- No record-format change, added degree cap, new browser API, F4/F5, or modular guessing.

# 0.3.0 - capability fallbacks, static deployment and variable-length words

- Four built WASM variants: 32/64-bit, shared/unshared.
- Automatic non-isolated single-worker execution; explicit strict multicore mode.
- Actual memory/module probing and declared memory64-to-WASM32 fallback.
- Portable multicore OPFS with an exclusive I/O-owner worker and bounded mailboxes.
- Project-scoped optional isolation worker, existing-controller preservation, one-reload
  guard, relative assets and .nojekyll for static publishing.
- Existing George worker/pruning/field/order/memory/timeout/degree controls integrated.
- Optional exact monomial pruning, heap enablement/threshold, cache, hash, batch and
  scratch/Hilbert memory tuning.
- No fixed degree-20 word limit: compact short words plus long offset-based words;
  blank degree/null target requests completion without a user-selected bound.
- ABI 3 long-word records; reads old ABI 2 short-word checkpoints.
- Dynamic exact Hilbert limbs, full-GB completion certificate and longer certified
  prefixes only when mathematically justified.
- New executable fixture/feature-negation tests and independent long-word checks.
- Firefox/Chromium test matrix and CI supplied. Actual Firefox binary unavailable;
  Chromium navigation blocked. Neither is reported as passing browser validation.

# Changelog

## 0.2.0 - fomkyr

Renamed the specialized backend and installed backend key to `fomkyr`; ABI 2.
Added bounded atomic batch scheduling, serial ordered commits with current-basis
re-reduction, dynamic reducer-record caching, stable content-addressed OPFS checkpoints,
recoverable metadata slots, run locks and guarded cache management, hash-verified WASM
asset caching, C-based exact Hilbert coefficient calculation, and George controls/output.
Added independent Fraction verification of the batched WASM result, fault-injection
checkpoint tests, bounded Hilbert workspace tests, and a 1/2/4/8-lane benchmark.

Legacy `NativeEngine`/`dispatchNative` export aliases remain for source consumers; the new
George backend selector is `fomkyr`. Old namespace caches are not reused automatically.
Native CLI uses the previous scheduler as a reference path; the production JS/WASM host
uses the new queue. Degree 20 is supported but FK6 through degree 20 was not run.

## 0.1.0 - George Native NC

Historical source reports and degree-10 output are retained under `reference/0.1.0/`.
Their measurements are not presented as measurements of this release.
