# Development

For browser usage, see the [user guide](../USER-GUIDE.md). For release preparation,
see [RELEASING.md](RELEASING.md).

## Architecture

```
bergman 1.001 (Standard Lisp)    vendor/bergman-1.001/   unmodified
        │
        ▼
Common Lisp build                ports/common/           patches, fixes, legacy mode
        │
        ▼
ECL bytecode / ECL Lisp→C       ports/ecl/
        │
        ▼
WebAssembly (Emscripten)         web/engine/ (32-bit and memory64 backends)
        │
        ▼
Web Worker ⇄ JavaScript UI       web/engine/worker.js, web/src/
        │
        ▼
static site (GitHub Pages)       web/ → gh-pages
```

Fomkyr has a separate C pipeline:

```
fomkyr/src/ + native/ → C11 + pthreads → standalone fomkyr CLI
          │
          └→ Clang O3/LTO → Wasm32/Wasm64 → George browser UI
```

## Commands

| Command | Checks |
|---|---|
| `npm test` | parsing, validation, exact ranks, worker lifecycle |
| `npm run wasm:test` | the 37 historical outputs, both modes |
| `npm run test:examples` | the 14 presets through the real engine |
| `npm run sbcl:build`, `sbcl:test`, `sbcl:test:legacy` | native SBCL reference |
| `npm run test:extra` | remaining original sessions |
| `npm run test:ocaml` | Bergman 2 aliases and references |
| `npm run test:algebra` | Singular, critical pairs, Hilbert dimensions |
| `npm run test:backends` | seeded Latin hypercube inputs/settings, exact parity across the four engines |
| `npm run test:native` | imported kernel tests, bounded FK parity against Bergman and Singular |
| `npm run test:native:browser` | alias for `test:fomkyr:browser` |
| `npm run test:fomkyr` | imported suites, 64 FK LHS samples, four anchors and 27 physics cases, all four fomkyr variants, C/ECL and bounded Singular |
| `npm run test:fomkyr:browser` | Firefox/Chromium, root/project paths, isolated/unshared execution, OPFS, resume, Share, long words and cancellation |
| `npm run fomkyr:build:native` | standalone C executable, portable O3/LTO |
| `npm run test:fomkyr:cli` | pthread CLI, partial checkpoints, native/Wasm resume and independent Hilbert authority checks |
| `npm run test:fomkyr:upgrade` | existing fomkyr 0.3 browser checkpoints resumed by the current engine; independent exact certificates |
| `npm run test:fk` | small Fomin–Kirillov LHS cases, all four engines, native SBCL and Singular; degrees 2–4 |
| `npm run test:fk6` | FK6 and a fixed-seed invertible generator scaling, degrees 1–8; all four fomkyr variants and bounded C/ECL/Singular comparisons |
| `npm run test:fk6:finite` | an independent random-coefficient FK6-shaped presentation, stopping at the proved finite bound, degree 6 |
| `npm run test:upstream` | 90 adapted Singular/Plural, SymPy and GBNP field cases; independent oracles |
| `npm run test:resolution:names` | long generator names, differentials |
| `npm run test:braid` | native/Wasm braid resolutions, full differentials, projectivity and weighted bounds |
| `npm run test:reader` | same-session recovery after missing files, EOF, stream redirection and syntax errors |
| `npm run test:browser`, `test:browser:regression` | Chromium suites |
| `GEORGE_LARGE_MEMORY=1 npm run test:browser` | Chromium allocation above 3 GiB, heap exhaustion, saved output and restart |
| `npm run test:ui` | guide, EN/RU, themes, MathJax, `/george/` path |

Long performance runs are separate from regression checks; see the
[benchmark suites](BENCHMARKS.md).

## Repository layout

| Path | Contents |
|---|---|
| `vendor/bergman-1.001/` | original sources and regression fixtures |
| `ports/common/` | dated patches, overlay, legacy mode |
| `ports/ecl/`, `ports/sbcl/` | Wasm engine build; native reference |
| `web/` | the site, the engine, local MathJax |
| `test/`, `tools/` | tests, checkers, build tools |
| `docs/` | user guide, resolution export format |
| `docs/development/` | validation, source review, handoff |
| `build/` | ignored: toolchains, builds, logs |

## Build environment

Node.js 22.8 or later is required for George tooling. Engine builds also use Git,
Python 3, a C toolchain and make. Downloaded toolchains and generated products stay
in the ignored `build/` directory; local reports stay in `local/`.

Bergman backend builds are described in [BACKENDS.md](BACKENDS.md); compiler and
profiling details are in [PERFORMANCE.md](PERFORMANCE.md). Fomkyr native builds
use its [own Makefile and manual](../../fomkyr/README.md).

Reference engines include SBCL, Singular, SymPy and OCaml Bergman 2.
`python3 tools/setup-oracles.py` installs the pinned oracle tools. `CHROMIUM`
selects the Chromium executable for browser checks.

Imported cases: `python3 tools/setup-upstream-tests.py`. See
[upstream test reproduction](UPSTREAM-TESTS.md) and
[validation coverage](VALIDATION.md).
