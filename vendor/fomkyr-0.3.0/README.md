# fomkyr 0.3.0

A specialized, exact C/WASM backend for George: homogeneous noncommutative Gröbner
bases, shared-memory multicore reduction, recoverable browser storage and certified
Hilbert coefficients. Four prebuilt WASM modules are included. No Lisp/ECL runtime,
Emscripten filesystem or package installation is needed to deploy these modules.

**New in 0.3.0:** a genuinely unshared single-worker fallback; portable multicore OPFS
through an exclusive I/O owner; project-scoped static-host isolation support; original
George worker/pruning/degree controls; variable-length words instead of the degree-20
limit; an optional computation without a user-supplied degree bound; dynamically sized
exact Hilbert counters.

**Validation boundary:** actual shared/unshared WASM32/WASM64 execution and bounded
algebra tests passed in Node. Real Firefox execution is unverified: its binary was not
installed in the build environment. Chromium launched, but navigation was blocked by
`ERR_BLOCKED_BY_ADMINISTRATOR`. The ZIP includes executable Firefox/Chromium tests and a
CI workflow, not a claim that those browser tests passed. The live George site and a
complete current checkout were not deployed/tested. FK6 through degree 20 was not run.

## Install or upgrade the existing George frontend

From the unpacked `fomkyr/` directory:

```bash
python3 tools/install.py /absolute/path/to/george --dry-run
python3 tools/install.py /absolute/path/to/george
```

The installer validates source edits before writing, backs up changed source files with
`.before-fomkyr-0.3.0`, updates recognized earlier fomkyr overlays, and refuses required
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
  monomialPruning: true, heapReduction: true,
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

The release checks commuting and exterior algebras, FK examples and a homogenized
oscillator. It is not a gauge/Lorentz/trace projection, scalar-preserving general operator
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
