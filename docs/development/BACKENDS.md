# Browser backends in George 0.5

The interface offers these exact labels:

| UI label | Stable share ID | Assets | Execution |
|---|---|---|---|
| Lisp / ECL O2 | `standard` | `web/engine/` | Bergman bytecode; O2 ECL/GMP/GC |
| Lisp / ECL O3 + LTO | `optimized` | `web/engine/optimized/` | Same bytecode; O3 libraries and final link with LTO |
| C / ECL O3 + LTO | `compiled` | `web/engine/compiled/` | ECL compiles existing Lisp functions to C, then Emscripten produces Wasm; O3 + LTO |
| C / ECL O3 + LTO (memory64) | `memory64` | `web/engine/memory64/` | Same compiled functions, 64-bit pointers and GC words; O3 + LTO |

`compiled` is the default. The form and console use the chosen backend.
Changing it starts a new console session on the next command. An active
computation retains its worker until it completes or is stopped. Presets
preserve the choice; storage and new share links include it. Earlier share
links restore `standard`, the engine available when those links were made.

All variants use the same `ecl.data` package. The browser fetches that
package from the root engine directory. Standalone variant directories also
contain a copy so that Node validation tools can load them independently.
Each engine manifest records its compiler settings and asset hashes.

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
plus `memoryMiB: 0` for no ECL heap cap. This calls ECL's native
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
