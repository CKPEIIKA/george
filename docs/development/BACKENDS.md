# Browser backends in George 0.6

## fomkyr 0.4.0 — 2026-10-02

The active fomkyr runtime now uses the unmodified four prebuilt modules from
`vendor/fomkyr-0.4.0/`. The archive SHA-256 is
`d6feec734d25a1901d2cb3c582caa150d0e91bdfb22b541f1c2da06e9739c20a`;
all 293 manifest entries were verified before import. The original sources,
tests, fixtures, reports and MIT notices remain intact, alongside the older
versions. `web/engine/fomkyr/build.json` records the current runtime hashes.
George remains version 0.6.0.

This core adds an exact leading-word matcher with a budgeted hash fallback,
a homogeneous chain criterion, earlier proved-zero pruning, checked monic
quadratic rewrites and cost-ordered dispatch with deterministic commits.
New jobs enable these optimizations. The word cache defaults to 256 entries;
the matcher budget is automatic (the smaller of memory/16 and 64 MiB).
Their localized controls, budgets and progress interval are saved/shared.
Existing explicit choices are preserved. Hilbert counting remains off for
new GB-only jobs. No browser F4/F5 or modular reconstruction is claimed.

Mathematical settings remain directly under **More settings**. Runtime
settings, including backend, memory, workers and fomkyr tuning, are grouped
in the separate collapsed **Engine** submenu. The optional fomkyr Hilbert calculation
is a mathematical setting outside that submenu. The global Bergman
memory64/15.7 GiB default and capability restrictions are unchanged.

The worker adapts upstream live progress to George's degree/count tooltip.
Sampled activity can arrive during a synchronous Wasm reduction; it reports
actual counters, not an estimated remaining time. A host fix sets the
completed-degree tracker before publishing the checkpoint phase. Public
timing remains in seconds. ABI-3 records and algebra identities are unchanged:
actual 0.3 wasm32 browser checkpoints resume in 0.4 memory64 in both browsers.
The four Wasm modules and C kernel have no George modifications; a native C
build, imported suites and actual packaged modules were checked separately.
The Wasm rebuild wrapper was not run end to end.

Correctness, browser and checkpoint evidence is in
[VALIDATION.md](VALIDATION.md#fomkyr-040-upgrade--2026-10-02).
The sections below retain historical versions and conditions.

The interface offers these exact labels:

| UI label | Stable share ID | Assets | Execution |
|---|---|---|---|
| Lisp / ECL O2 | `standard` | `web/engine/` | Bergman bytecode; O2 ECL/GMP/GC |
| Lisp / ECL O3 + LTO | `optimized` | `web/engine/optimized/` | Same bytecode; O3 libraries and final link with LTO |
| C / ECL O3 + LTO | `compiled` | `web/engine/compiled/` | ECL compiles existing Lisp functions to C, then Emscripten produces Wasm; O3 + LTO |
| C / ECL O3 + LTO (memory64) | `memory64` | `web/engine/memory64/` | Same compiled functions, 64-bit pointers and GC words; O3 + LTO |
| fomkyr / C O3 + LTO (experimental) | `fomkyr` | `web/engine/fomkyr/` | Independent homogeneous NC kernel, shared/unshared wasm32/wasm64, portable OPFS and exact Hilbert coefficients |

`memory64` is the default, with a 16077 MiB allowance (15.7 GiB rounded to
whole MiB). If memory64 is unsupported, a fresh form selects `compiled`
and 2048 MiB. Saved settings and old Share defaults are preserved.
The form and console use the chosen backend.
Changing it starts a new console session on the next command. An active
computation retains its worker until it completes or is stopped. Presets
preserve the choice; storage and new share links include it. Earlier share
links restore `standard`, the engine available when those links were made.

All four Bergman variants use the same `ecl.data` package. The browser fetches that
package from the root engine directory. Standalone variant directories also
contain a copy so that Node validation tools can load them independently.
Each engine manifest records its compiler settings and asset hashes.

## fomkyr 0.3.0 — 2026-10-02

Sources, fixtures, tests, original docs and MIT notices are retained under
`vendor/fomkyr-0.3.0/`. The imported archive SHA-256 is
`1f616fa6f448c0c3b6feafc9a52a959474c9b61e26ab43a35aa591c3033061f0`.
All four shipped shared/unshared wasm32/wasm64 modules match the archive;
`web/engine/fomkyr/` adapts the George dispatcher, progress, public timing and
localized results. The C kernel is unchanged. `build.json` records all
runtime asset hashes and the upstream version.

The public backend ID is `fomkyr`. Its dedicated worker does not load ECL.
Old `native` form preferences and Share links migrate at form restoration.
The legacy registry entry and old assets remain for reproducible historical
measurements; the selector exposes only fomkyr. The main form controls field,
order, generator reversal, unit weights, workers, pruning, degree, memory and
timeout. Unsupported tasks, orders, nonhomogeneous modes, output formats,
legacy behavior and the Lisp console are disabled or rejected.

The supported class is homogeneous two-sided NC Gröbner bases, degree-left
lex, up to 16 generators, Q or a supported prime field. Input integers fit
±(2^62−1); internal arithmetic is arbitrary precision. There is no fixed
word-length-20 restriction: long words use ABI-3 variable-length records.
Degree indices still have a 32-bit representational limit. Blank maximal
degree requests completion; it does not promise termination or infinite
memory. The kernel allowance is 128–14304 MiB, with a 512 MiB fresh API default.

Automatic execution probes actual capabilities. Shared multicore uses direct
concurrent OPFS handles when supported, or a portable exclusive I/O-owner
worker otherwise. Non-isolated pages load a genuinely unshared module with
one compute lane. Denied OPFS can use bounded RAM; lock contention never
silently switches to a separate RAM computation. Memory64 initialization can
fall back to wasm32 with an explicit warning and effective-budget report.
Cancellation waits for file handles to close, with a termination fallback
for an unshared synchronous reduction. Completed checkpoints are verified
before reuse across bitness, worker count and storage modes.

`web/src/fomkyr-options.js` validates persisted tuning and maps it to engine
options. Settings and Share links contain execution, addressing, spill/resume,
Hilbert output, heap reduction, cache, hash, batches, scratch/Hilbert workspace
and I/O mode. Existing version-1 Share fields and defaults retain their order;
the options JSON is appended as field 33. Unknown keys and invalid ranges
are rejected before worker execution.

Exact Hilbert output uses decimal strings and a bounded normal-word avoidance
automaton. Higher prefixes require a proved complete basis. Optional counting
failure preserves the completed GB. This does not implement Bergman's
Hilbert/Poincaré–Betti task, Anick resolutions or physics projections.
Degree progress, allocated Wasm memory and elapsed seconds use George's
existing compact status icons. Public metadata exports `elapsedSeconds`.

`npm run test:fomkyr` runs nine imported suites in a staging copy, then 48
seeded FK LHS cases plus four anchors, with four actual WASM variants per
case, independent exact critical-pair/ideal checks, C/ECL and Singular.
`npm run test:fomkyr:browser` exercises the production UI in Firefox and
Chromium, with isolated and plain hosts at root and project paths.
`npm run test:static` checks existing automatic service-worker isolation on
a Pages-style host. `bash tools/build-fomkyr-backend.sh` rebuilds all four
modules and updates their checksum table while retaining George's adapters.

## ECL compilation

`ports/ecl/aot.lisp` loads the existing adapted Bergman sources in the
Common Lisp environment and recovers function definitions. The selected
build compiles **763 functions**, installs **163 aliases**, and reads **18
source modules**. Bergman's mathematical routines are unchanged by this
compilation step.

Bergman's `COPYD` changes function definitions when modes change. Each
compiled function therefore has local `ext:use-direct-C-call nil` and
`notinline` declarations for the recovered symbols. Both are needed:
disabling direct C calls alone still lets ECL fold aliases to their initial
definitions. Global proclamations alone do not retain the required dispatch.
These declarations preserve runtime mode switching while removing most
bytecode interpretation overhead.

Two routines with malformed calls in their original legacy branches,
`instableMaybeReduceRedor` and `stableMaybeReduceRedor`, retain their existing
bytecode implementation. Further auxiliary modules loaded later can also
use bytecode. The C backend is therefore a mixture of compiled functions
and bytecode. It is not a separate implementation of the mathematics.

The final link retains `--spill-pointers`, exact GMP arithmetic and the existing
Emscripten jump handling. The linear-memory maximum is 4 GiB for the three
32-bit variants and 16 GiB for memory64. It contains
no profiling hooks or fast-math flags.

## Memory64 and memory allowances

The memory64 port uses `-sMEMORY64=1` throughout ECL, GMP, GC and the final
link. `ports/ecl/wasm64-unknown-emscripten.cross_config` selects 64-bit
`long`, fixnum representation and pointer sizes. The bundled GC's
Emscripten word size and alignment follow the actual pointer size.
Wasm32 lowering (`MEMORY64=2`) is not used.

Pinned Binaryen revision `fc6a7977cccea66c7d78f3d86eb0cdac9f37cbdb`
needs `ports/ecl/binaryen-memory64-stack.patch`: its spill-pointer pass
already uses 64-bit pointer slots, but its shared stack helper originally
only accepted i32. The patch adds i64 stack subtraction and restoration.
Pointer spills remain enabled for ECL's conservative garbage collector.
The host Binaryen tools use O1; the guest engine uses O3 + LTO.

The memory64 option is disabled in browsers that cannot validate this
build's 16 GiB memory64 declaration. Settings allow 6, 8, 12 and 16 GiB,
15.7 GiB by default, plus `memoryMiB: 0` for no ECL heap cap. This calls ECL's native
`EXT:SET-LIMIT` with zero, including its error-handling safety area.
It does not remove the browser's memory limit. The current
[WebAssembly JavaScript API](https://webassembly.github.io/spec/js-api/#implementation-defined-limits)
sets a 16 GiB runtime maximum per memory64 memory; resources can run out
earlier. Multiple memories would require allocator/GC changes here.

The wasm32 heap allowance now reaches 4095 MiB. Exactly 4096 MiB does not
fit its unsigned 32-bit heap-size argument. There is no measured universal
300 MiB reserve: heap allowance and total linear memory are different
quantities. Selecting wasm32 after an uncapped or larger memory64 setting
clamps the allowance to 4095 MiB. Older Share links keep their defaults.

Optional monomial pruning emits `SETREDUCTIVITY NIL` for unweighted,
homogeneous, noncommutative degreewise Gröbner basis jobs. It restores
reductivity before clearing the ring. Resolutions, weights, itemwise and
rabbit jobs cannot enable it. Native and Singular checks remain independent
of engine parity. Degree-seven results do not establish degree-eleven capacity.

## Rebuild

### Adding another engine

`web/src/backend-capabilities.js` applies a backend descriptor's optional
`capabilities` to the actual form and validates the same restrictions in
job construction. Current Bergman descriptors omit restrictions. The
reusable `QUADRATIC_BASIS_CAPABILITIES` profile is a starting point for a
homogeneous quadratic basis engine; no unbuilt backend is exposed in the UI.

```js
capabilities: {
  choices: {task: ['gb'], ring: ['noncomm'], field: ['0', 'p'],
    order: ['degleftlex']},
  fixedSettings: {weights: '', legacy: false, strategy: 'default',
    nonhomog: 'degreewise', lowterms: 'quick', outmode: 'ALG',
    monomialPruning: false},
  homogeneous: true,
  relationDegrees: [2],
  console: false,
}
```

`choices` filters radio/select alternatives; `fixedSettings` assigns the
required value and greys out that control. Unsupported tasks show a note.
Switching back to a full backend enables those settings again. Relation
restrictions use ordinary degree and are checked even for direct jobs.
Add `ncpbh` to `choices.task` to support the existing noncommutative series
task; `hilbert` is the commutative task. Profiles may allow other degrees,
fields and modes instead. This policy does not detect a specific physics
problem or prove that an arbitrary quadratic presentation is Fomin–Kirillov.

A descriptor may also specify `worker`, a module-worker URL relative to
`web/src/engine.js`. If omitted, the existing ECL worker is used. A new
worker implements the existing init/run protocol and consumes the job's
input files/settings; that engine and its job adapter remain future work.
Memory progress uses `{id, event: {type: 'memory', bytes}}` and describes
allocated linear memory. A worker without Lisp evaluation declares
`console: false`, which disables the console UI and rejects evaluation.

### Runtime compilation

The full build uses the pinned ECL and Emscripten revisions, a single
Bergman package, and separate library builds:

```sh
npm run wasm:build:backends
```

`GEORGE_BACKEND_BUILD_DIR` can select an unused absolute build directory.
The default is a fresh directory under `/tmp`. Installing a variant checks
its asset hashes, matching bytecode data, absence of profiling hooks, and
the compiler settings claimed by its UI label.

Individual experiments, after creating the ordinary runtime, are also
supported. Supply the runtime path from `build/engine-build.json` and use
unused absolute destinations:

```sh
GEORGE_PROFILE=0 GEORGE_LTO=1 GEORGE_LINK_OPT=-O3 \
  bash tools/build-runtime-variant.sh O3 /tmp/george-lisp-lto /tmp/your-runtime
GEORGE_LTO=1 GEORGE_LINK_OPT=-O3 \
  bash tools/build-aot-variant.sh /tmp/george-c-lto /tmp/your-runtime /tmp/george-lisp-lto/prefix
```

The isolated memory64 build supplies the pinned, patched Binaryen tools
and uses a neutral path for ECL's compiled function metadata:

```sh
npm run wasm:build:memory64 -- /tmp/george-memory64-build /tmp/your-runtime
node tools/install-runtime-variant.mjs /tmp/george-memory64-build/compiled memory64
```

The release assets were produced through the equivalent pinned build,
runtime path neutralization and final AOT steps. The combined fresh-build
wrapper has not itself been executed end to end. It checks its pinned
archive and patch inputs; the installer checks actual Wasm pointer width,
maximum, asset hashes and compiler declarations.

## George 0.5 checks

The new engine passes **128 reference parity cases** in Node and ordinary
Chromium, **37 original outputs per behavior mode**, and **45 pruning
cases** in both Node and Chromium. The pruning references include native
SBCL (45 cases) and Singular (42). The final UI audit covers all four
engines. All **79 unit tests** pass.

An ordinary browser worker retains **4.21875 GiB** of live arrays with
GC root and exact arithmetic checks, using **4.352783203125 GiB** of total
allocated Wasm. The submitted degree-seven job with pruning and no cap
matches all **695** native basis elements on memory64. No paired memory64
timing comparison or degree-nine-to-eleven run has been made.
See [memory64.json](validation/memory64.json) and
[VALIDATION.md](VALIDATION.md) for final engine identities and scope.

## Backend parity suite

The focused Fomin–Kirillov suite runs separately with `npm run test:fk`.
It uses **16 seeded LHS cases** with ranks 3–6, fields Q/F2/F3/F5/F7,
generator permutations and signs, both behavior modes, reversal and
pruning settings. Degree bounds are 2–4; rank 6 is capped at 3. Two anchors
cover rational E3 through degree 4 and the exact reference presentation
through degree 3. The input definition follows
[Blasiak, Liu and Mészáros, section 2](https://arxiv.org/pdf/1310.4112).

All **18 cases** match native SBCL byte for byte in all four engines
(**72 engine runs**). Singular checks two-way ideal membership and
normal-word dimensions at the same explicit Letterplace degree bound;
the independent checker verifies **4317 critical ambiguities** within
the bounds. No unrestricted completion is claimed. Singular names are
mapped to synthetic identifiers to avoid collisions such as the presentation's
generator `r` with a ring identifier. The default watchdog is 30 seconds
per calculation and is configurable with `GEORGE_TEST_TIMEOUT_MS`.

The default design uses a seeded Latin hypercube with **64 basis samples**,
**16 series samples**, and **16 Anick resolution samples**. Every continuous
dimension visits each stratum once before discretization. The seed is
`0x47454f34`; the report retains every coordinate and resulting form.
Categorical balance can change after validity constraints are applied.

Dimensions include ring, field, generator and relation counts, degree,
weights, relation shape, large integer coefficients, monomial order,
reversed variables, safe/quick handling, legacy/fixed behavior, output format,
and memory allowance. The design covers Q/F2/F5/F7, all nine UI order choices,
one to four generators, degree bounds four to six, and 512–3584 MiB allowances.
Small sampled presentations use powers and bounded quadratic inputs. They
do not simulate the growth of arbitrary large presentations.

Successful-result sampling uses these explicit constraints:

- Legacy samples are weighted homogeneous; legacy retains known original
  nonhomogeneous defects.
- Nonhomogeneous samples use degree-compatible orders and idempotent or
  mixed quadratic relations.
- Resolution samples use degree-left-lex, the independent checker's order.
- Monoid augmentation uses fixed mode, which implements that extension.

Eight tutorials, five module/factor/Hochschild examples, and the submitted
15-generator, 100-relation presentation through degree four add 14 anchors.
Two additional commuting square-zero presentations have **16 generators and
136 relations** through degree three, and **20 generators and 210 relations**
through degree two. Their quotient dimensions are independently known
binomial coefficients. These contribute **112 cases** before the boundary
anchors described below.
All three backends also run both original sequential regression sessions,
37 exact output files per session. Form samples use fresh workers, matching
the UI; console regression sessions retain their state.

The three shared failures discovered by the initial LHS run are now
required successes. Singular confirms their ideals; native SBCL and all
three browser backends agree after correcting one-generator degree sums
and elimination comparisons on equal words and words of different lengths.
`test/fixtures/backend-oracles.json` pins these jobs and their expected
normal-word dimensions. Sixteen boundary anchors cover every commutative
one-generator order over Q/F2/F5 and weighted elimination in both modes,
bringing the suite to **128 cases**. The boundary audit also checks printed
Hilbert coefficients, including weighted one-generator series.

Every case must succeed with byte-for-byte output equality. Unexpected
errors and timeouts fail the suite. The default test watchdog is 60 seconds;
set `GEORGE_TEST_TIMEOUT_MS` to change it, or to `0` to disable it. Browser
replay also accepts `GEORGE_TEST_OVERALL_TIMEOUT_MS`; its default overall
watchdog is disabled when the per-case watchdog is disabled. Independent
ambiguity and differential certificates supplement parity where their
orders and degree bounds apply. Parity does not prove unrestricted
correctness or completion of a degree-bounded basis.

The app has a separate **Time limit (minutes)** setting. Its default is
**0 (unlimited)**, and positive limits apply after worker initialization to
each calculation or console command. Reaching a limit terminates the worker;
the next command starts a fresh session. This setting is persisted and
shared. Earlier share links restore unlimited time. Long deadlines are
scheduled in chunks to avoid the browser timer's integer overflow.

Singular checks all **96 LHS underlying algebras**, including the algebras
used in series and resolution samples. Both generating sets are completed
in Singular's own order. Inputs within the requested weighted bound must
lie in the returned ideal, and every returned element must lie in the full
original ideal. Full ideal equivalence is also recorded separately. This
avoids treating included or omitted high-degree inputs as a false mismatch.
Every Letterplace degree bound is recorded. This check
does not validate resolution differentials; those have separate certificates.
The focused oracle audit compares the three former failures and sixteen
boundary cases with freshly built native SBCL, Singular and normal-word
counts, and checks the printed Hilbert coefficients.

```sh
npm test
node tools/validate-backends.mjs build/validation/backend-parity 64
node tools/validate-backends-browser.mjs build/validation/backend-parity/report.json build/validation/backend-parity-browser
node tools/validate-lhs-singular.mjs build/validation/backend-parity/report.json
# Build SBCL in a fresh directory; its saved autoload paths are absolute.
ports/sbcl/build.sh vendor/bergman-1.001 build/sbcl-oracle
node tools/validate-backend-oracles.mjs build/validation/backend-parity/report.json build/sbcl-oracle/bin/clisp/unix/bergman
npm run test:ui
GEORGE_LARGE_MEMORY=1 npm run test:browser
```

The browser replay uses ordinary Chromium workers at `/george/` and compares
each output with the corresponding Node result. Three independent workers
run the backends concurrently for each case; timings are diagnostic only.
It attaches no debugger.
An interrupted replay can resume using `--resume`: it checks runtime hashes,
the unchanged reference report, and every saved output before replaying the
missing pairs. The final audit requires **384 successful browser runs**;
shared failures are no longer treated as passing tests.
The separate memory/cancellation checks use Playwright; their timings are
functional diagnostics and are excluded from performance comparisons.
Detailed release evidence is in [compilation.json](validation/compilation.json),
[backend-parity.json](validation/backend-parity.json), and
[PERFORMANCE.md](PERFORMANCE.md).
