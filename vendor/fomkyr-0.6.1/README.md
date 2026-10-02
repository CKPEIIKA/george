# fomkyr 0.6.1

A specialized direct-exact C/WASM backend for George: homogeneous noncommutative
Groebner bases, multicore reduction, recoverable OPFS storage and graded Hilbert
coefficients. Four prebuilt shared/unshared WASM32/WASM64 modules are included.

This is a **0.6.x polishing release focused on degree 12 and correctness**. It keeps
the production direct solver, compact integer and rational heaps, and the exact
arbitrary-precision fallback. No signature scheduler, speculative modular result,
change of input ordering, or finite-field replacement of Q is introduced.

The isolated degree-12 continuation finished in **132.563 s**; the same checkpoint
with rational compiled rewrites disabled hit a **240.238 s deadline** without
finishing. This is a single sequential ablation, not a measured median speedup.
Degree 13 still stalled in its bounded diagnostic probe.

## High-degree change

The existing compiled exact short-word identities can now run inside the rational
heap. This prevents the observed FK6 degree-12 arithmetic fallback stall in the
successful test, instead of merely shaving seconds off degrees 9-10. Every scalar
operation is checked; unsupported cases restart the original exact reducer.

Deep trials, including deadlines and incomplete runs, are retained under
`results/0.6.1/`. Read [the full report](docs/DEEP_DEGREES_AND_CORRECTNESS.md) and
[the release manifest](results/0.6.1/release-validation.json). The earlier
[0.6.0 report](docs/DIRECT_REWRITE_CACHE.md) and small-degree benchmarks are historical.
Do not substitute them for current high-degree evidence.

Defaults include:

```javascript
{
  arithmeticMode: 'exact',
  rationalHeap: true,
  compiledRewrites: true,
  rationalRewrites: true, // new: use the proved local identities in the rational heap
  rewriteDegree: 4,      // cache word length, NOT a bound on computation degree
  rewriteSupport: 8     // decline larger expansions, never truncate a polynomial
}
```

Use `rationalRewrites:false` for the isolated old-rational-path ablation. Existing
George controls for workers, monomial pruning, memory, field/order, degree, deadline,
Hilbert, storage and caches remain in effect. Arbitrary-length words and null/blank
maximal degree are retained. The 15,000,000,000-byte kernel ceiling is unchanged;
it does not bound browser RSS or make every active row fit memory.

## Stronger audits, explicit limits

The native field matrix has been corrected to actually pass each requested prime
to the kernel and assert the observed field. Seven compatible mathematical
presentations from George's upstream set are checked independently in Q,F2,F5,
including exact completion, critical compositions and canonical equality.

`tools/canonical_audit.py` independently checks and monic-tail-normalizes basis
records and compares canonical byte streams. Matching counts or leading words are
not accepted as proof of equality. Canonical normalization itself is explicitly
**not** a Groebner certificate; all bounded critical compositions are a separate
obligation. High-degree differential evidence does not become external validation.

Actual Singular/Bergman execution was unavailable in this environment. The new
`tools/check_george_oracles.mjs` is a strict runner for an initialized George
checkout, with source/engine hashes, matched field/order/degree and real external
computations. Missing tools return exit 77 with `externalVerified:false`.
Real Firefox/OPFS/GitHub Pages execution was not repeated here; actual four-variant
WASM and capability paths were tested in Node. Your deployed site was not modified.

## Reproduce the checks and deep profiles

```bash
bash tools/build.sh
bash tools/verify_061.sh
python3 tests/benchmark_deep.py --degree 12 --seconds 900 --trials 1 \
  --baseline /path/to/pristine/rebuilt/fomkyr-0.6.0 --out results/deep-comparison
```

Use `--resume-storage /path/to/degree11/storage --ablate-rational-rewrites`
instead of `--baseline` to compare the new switch from identical checkpoints.
The harness stores incomplete runs; do not divide a timeout by a completed time
and call it a measured completion-time speedup.

```bash
node --experimental-wasm-memory64 tools/check_george_oracles.mjs \
  --george /absolute/path/to/george --fk-degree 5 --out results/external-parity
```

Progress now identifies arithmetic tiers and problematic pairs from sparse live
snapshots. Stalled or invalidated historical forecasts are withdrawn. A current-
degree overlap fraction is not a whole-job runtime percentage. Reporting cost was
not separately benchmarked in this release.

## Install or upgrade the existing George frontend

From the unpacked `fomkyr/` directory:

```bash
python3 tools/install.py /absolute/path/to/george --dry-run
python3 tools/install.py /absolute/path/to/george
```

The installer validates source edits before writing, backs up changed source files with
`.before-fomkyr-0.6.1`, updates recognized earlier fomkyr overlays, and refuses required
source-shape mismatches. It preserves an existing George isolation service worker.
Current-style registry/worker/control integration and older source shapes are tested
with executable fixtures; this does not replace a full-checkout integration test.

Select **fomkyr**, **noncommutative**, **degleftlex**, and **Gröbner basis**. Use
homogeneous relations and unit generator degrees. Hilbert coefficients are an optional
output of this task; Bergman's Hilbert/Poincaré–Betti or resolution tasks are not synonyms.

For local testing with isolation headers:

```bash
python3 tools/serve.py --root /absolute/path/to/george/web --port 8765
```

To reproduce a static host with no COOP/COEP response headers:

```bash
python3 tools/serve.py --plain --root /absolute/path/to/george/web --port 8765
```

Open the reported localhost URL. `python3 tools/serve.py --root . --port 8765` also serves
the backend's standalone diagnostic at `/web/`; George remains the intended frontend.

## GitHub Pages and Firefox-oriented capability selection

All runtime assets are local relative URLs. The installer copies all four binaries,
worker modules, a root-scoped `fomkyr-isolation-worker.js`, and `.nojekyll` into George's
`web/` publishing tree. Publish that tree using the project's existing Pages workflow.
No server process, CDN runtime or external compute service is required.

Automatic execution selects the available path:

| Available capabilities | Actual computation path |
|---|---|
| Isolation + shared WASM; concurrent OPFS handles | Shared multicore, direct read cache misses |
| Isolation + shared WASM; only exclusive OPFS handles | Shared multicore, one exclusive I/O-owner worker |
| No isolation/shared memory | Real unshared module, one compute worker |
| OPFS denied/unavailable | Bounded RAM, explicit warning, no persistent checkpoint |
| Requested memory64 fails initialization | WASM32 with a lower reported memory limit, unless strict mode |

No user-agent/version sniffing is used. The engine actually constructs/instantiates its
memory/module and probes file-handle locking. The portable I/O path does not turn
multicore computation into single-core computation: only disk-cache misses are serviced
by the exclusive owner. This can still limit throughput and is not claimed as cost-free.

Shared memory requires browser isolation. Existing George isolation setup is preserved.
On a plain static installation, **Enable static-host multicore (one reload)** attempts
a project-scoped service worker. It never replaces an unrelated controller, does not
intercept cross-origin resources, and guards against reload loops. Save unsaved input
first. If isolation remains unavailable, automatic single-worker execution still works.

Use `execution: "multicore"` or `strictCapabilities: true` when a silent performance
fallback is undesirable. Every run reports actual bitness, CPU lanes, I/O mode, budget,
linear-memory size and warnings. See `docs/BROWSER_COMPATIBILITY.md` for the precise
browser-test status and deployment conditions.

## Degree: no fixed 20/31-word storage ceiling

A numeric maximal degree computes through that bound. **Leave George's maximal degree
blank**, or pass `null` to `compute`, to request completion without a user degree bound.
The run then ends at a proved complete finite GB, cancellation, deadline, resource error
or the representational boundary. An infinite GB need not finish.

Short words up to length 31 retain the compact four-bit representation in two `uint64_t`
values. Longer words use budgeted offset-based variable-length storage. This is a kernel,
checkpoint, parser and Hilbert-counter change, not merely deletion of a form validator.
Long words currently use the general exact reducer, not the short-word heap fast path.

The implementation still has **32-bit degree indices (maximum 4,294,967,294)** and
32-bit record sizes; finite hardware is not literally unbounded. Input expansion,
metadata and individual active rows must fit their workspace limits. There are still
at most 16 generators. See `docs/DEGREES_AND_TUNING.md`.

## Original George settings and extra tuning

The original controls remain authoritative for worker count, monomial pruning, memory,
time limit, maximal degree, Hilbert degree, field and generator-order reversal. Explicit
all-one weights are accepted. Homogeneous `quick`/`safe` low-terms settings have the same
meaning here because no lower-degree terms exist. Unsupported orders, nonhomogeneous
modes, Rabbit, Lisp execution and resolutions are rejected rather than silently emulated.

For fomkyr, **monomial pruning means exact zero-word/pair shortcuts**. It does not mean
Bergman's Lisp monomial-storage garbage collection. Turning it off retains ordinary
correct reduction and is useful for cross-checking. Pruning-on/off produced identical
binary bases in the independent-oracle FK6 degree-4 check.

Advanced controls expose sparse-heap enablement, minimum heap row length, reducer-cache
percentage, hash size, bounded pair batches, reduction scratch budget, Hilbert workspace,
and direct/portable file I/O. Their meanings and tradeoffs are documented; they are not
claimed to be copies of every Bergman option.

## Direct worker API

Call from a **dedicated worker**, not the page main thread: OPFS sync access and the
portable I/O mailbox are designed for that context.

```javascript
import {FomkyrEngine} from './engine/fomkyr/engine.js';

const engine = new FomkyrEngine({
  execution: 'auto', bits: 'auto', workers: 4,
  budgetBytes: 512 * 1024 * 1024,
  scratchBytes: 128 * 1024 * 1024,
  spill: true, resume: 'auto', ioMode: 'auto',
  monomialPruning: true, heapReduction: true, rationalHeap: true,
  compiledRewrites: true, rewriteDegree: 4, rewriteSupport: 8,
  cachePercent: 12, heapThreshold: 16,
  hilbert: true,
  onEvent: event => postMessage({event})
});
try {
  // Input fixture: ordered `variables` and homogeneous `relations` containing
  // {degree, terms:[{word:[generator indices], coefficient:"integer"}, ...]}.
  // 0 means the rational coefficient field, not a modular approximation.
  const result = await engine.compute(fixture, null, 0);
  postMessage({result});
} finally {
  await engine.close();
}
```

`compute(fixture, 20, 0)` remains a valid bounded request. Rational input coefficients
must first have denominators cleared; initial integers fit the signed 63-bit ABI.
Internal coefficients have arbitrary-precision fallback. Prime characteristics are
separate exact computations and are labelled in outputs/cache identity.

## Hilbert and physics scope

The engine counts normal words with a leading-word avoidance automaton, using dynamic
exact integer limbs. It does not enumerate all normal words. Results are decimal
strings; no count passes through a JavaScript floating-point number.

A prefix is certified through the completed GB degree. A higher Hilbert degree is
accepted only when unrestricted GB completion has been proved. No rational function is
fitted. A certified vanishing positive-degree component proves finite total dimension
for the supported degree-one-generated homogeneous algebra.

The release checks commuting/exterior, Fomin-Kirillov, homogenized Weyl/oscillator,
Clifford, sl2 and q-oscillator presentations over the labelled fields. It is not a gauge/Lorentz/trace projection, scalar-preserving general operator
normal-form API, Anick resolution or Betti-series implementation. See `docs/PHYSICS.md`.

## Memory and checkpoint boundaries

The kernel ceiling is **15,000,000,000 bytes**, page-rounded; WASM32 has its smaller
address-space ceiling. This is not a browser-process RSS limit. Host JS/JIT, OPFS/OS
caches, mailbox buffers and other tabs are outside that allocator. OS/browser OOM can
never be excluded by this library alone.

Every completed degree can create a checksummed checkpoint. Two alternating metadata
slots and per-record checksums permit recovery from the tested latest-checkpoint
corruptions. ABI-2 short-word checkpoints are readable; ABI-3 records support long words.
Resuming across shared/unshared, 32/64-bit and I/O modes is tested. An older 0.2 binary
must not read new ABI-3 checkpoints. A browser persistence request is not an external
backup. Active algebra caches are protected against deletion by the supplied UI.

A reducer row and basis metadata must still fit in RAM. There is no fully disk-based
reduction of one arbitrarily large row. Disk quota or scratch exhaustion can stop a run
safely rather than force completion. Hilbert workspace/output has separate limits;
optional Hilbert failure leaves the completed GB/checkpoint available.

## Build and reproduce checks

```bash
bash tools/build.sh                         # clang/lld; -O3 -flto
python3 tests/test_native.py
python3 tests/test_extra.py
node --experimental-wasm-memory64 tests/test_wasm.mjs
node --experimental-wasm-memory64 tests/test_fomkyr.mjs
node --experimental-wasm-memory64 tests/test_compatibility.mjs
node --experimental-wasm-memory64 tests/test_integration.mjs
node tests/test_static_host.mjs
python3 tests/test_installer.py
python3 tests/test_installer_modern.py
```

For real browsers on a host which permits browser execution:

```bash
python3 -m pip install playwright
python3 -m playwright install --with-deps firefox chromium
python3 tests/test_browsers.py --browser all
```

The CI definition is `.github/workflows/browser-compatibility.yml`. It was written but
not run remotely. Results from the current build are under `results/`; explicit failed
browser attempts are included, not omitted. Previous-version timings are segregated
under `results/v0.2.0/` and `reference/0.1.0/` and are not current performance claims.
