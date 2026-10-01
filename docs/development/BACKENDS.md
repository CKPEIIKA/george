# Browser backends in George 0.4

The interface offers these exact labels:

| UI label | Stable share ID | Assets | Execution |
|---|---|---|---|
| Lisp / ECL O2 | `standard` | `web/engine/` | Bergman bytecode; O2 ECL/GMP/GC |
| Lisp / ECL O3 + LTO | `optimized` | `web/engine/optimized/` | Same bytecode; O3 libraries and final link with LTO |
| C / ECL O3 + LTO | `compiled` | `web/engine/compiled/` | ECL compiles existing Lisp functions to C, then Emscripten produces Wasm; O3 + LTO |

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

The final link retains `--spill-pointers`, exact GMP arithmetic, the existing
Emscripten jump handling, and the 4 GiB linear-memory maximum. It contains
no profiling hooks or fast-math flags.

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
binomial coefficients. The default suite therefore has **112 cases**.
All three backends also run both original sequential regression sessions,
37 exact output files per session. Form samples use fresh workers, matching
the UI; console regression sessions retain their state.

The generated matrix exposed three shared limitations. They remain in the
suite and are pinned to complete job hashes in
`test/fixtures/backend-limitations.json`:

- `lhs-gb-021`: a weighted noncommutative elimination case reaches the
  five-second watchdog in every backend. This verifies the observed timeout,
  not a proof of nontermination.
- `lhs-series-002` and `lhs-series-014`: one-generator matrix-order Hilbert
  calculations return the same NIL/NUMBER error in every backend.

Every other case must succeed and have byte-for-byte output equality.
Unexpected failures, changed error messages, and unexpected success of a
known limitation fail the suite. Normal cases have a 60-second timeout;
workers are terminated on timeout and partial logs are retained. Independent
ambiguity and differential certificates supplement parity where their
orders and degree bounds apply. Parity does not prove unrestricted
correctness or completion of a degree-bounded basis.

```sh
npm test
node tools/validate-backends.mjs build/validation/backend-parity 64
node tools/validate-backends-browser.mjs build/validation/backend-parity/report.json build/validation/backend-parity-browser
npm run test:ui
GEORGE_LARGE_MEMORY=1 npm run test:browser
```

The browser replay uses ordinary Chromium workers at `/george/` and compares
each output with the corresponding Node result. It attaches no debugger.
An interrupted replay can resume using `--resume`: it checks runtime hashes,
the unchanged reference report, and every saved output before replaying the
missing pairs. The executed 0.4 audit uses a 110-case batch and a two-case
large-input batch, with **336 browser runs**, **109 successful cases**, two
shared error cases and one shared timeout case. The first browser attempt
hit its overall time cap after 286 completed comparisons; the verified
resume completed the remaining 44.
The separate memory/cancellation checks use Playwright; their timings are
functional diagnostics and are excluded from performance comparisons.
Detailed release evidence is in [compilation.json](validation/compilation.json),
[backend-parity.json](validation/backend-parity.json), and
[PERFORMANCE.md](PERFORMANCE.md).
