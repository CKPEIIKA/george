# George — based on bergman

Gröbner bases, Hilbert and Poincaré–Betti series, Anick resolutions, module
Betti numbers and Hochschild homology in a static browser application.

The working engine runs **original Bergman 1.001 → ECL portable bytecode →
WebAssembly → a browser worker**. Arithmetic is exact over ℚ and prime
fields. Computations stay in your browser. Each form job gets a fresh session;
the console retains its session. Stop terminates the worker immediately.

## Run

```sh
npm ci
npm run serve
# Open http://127.0.0.1:8000/
```

The built `web/engine/ecl.{js,wasm,data}` files are included. Serve `web/`
over HTTP; opening `index.html` as a local file will not load a module worker.
No backend, external font service, SharedArrayBuffer or isolation headers
are required. Chromium is the browser verified for this release.

## Validation

See [the validation report](docs/VALIDATION.md) for exact coverage, timings,
artifact hashes and limitations, and [the source review](docs/SOURCE-REVIEW.md)
for the original and OCaml implementations.

```sh
npm test                         # parsing, validation, exact ranks, worker lifecycle
npm run wasm:test                # all 37 historical outputs in both modes
npm run test:examples            # all 14 form presets through the real engine
npm run sbcl:build
npm run sbcl:test:legacy
npm run sbcl:test
npm run test:extra               # remaining original executable sessions
npm run test:ocaml               # all 24 upstream aliases; export independent references
npm run test:algebra             # Singular, critical pairs, Hilbert dimensions, resolutions
npm run test:browser:regression  # full suites in Chromium, without DevTools
npm run test:browser             # UI, cancellation, restart, memory growth; needs serve
```

The oracle tests need Singular, OCaml 5.3 and dune 3.17.2. Native reference
builds need SBCL. On recent Linux x86_64, `python3 tools/setup-oracles.py`
extracts the exact SHA256-pinned Debian oracle packages into `build/oracles/`
without installing anything system-wide. Alternatively use your installed
tools. `CHROMIUM` selects a browser executable; the default is
`/usr/bin/chromium`. Generated logs and reports go under `build/validation/`.

## Rebuild and distribute

```sh
npm run wasm:build
npm run sources
```

The build needs Git, Python 3, a C/C++ toolchain, make, and standard Linux
build utilities. It downloads pinned ECL and Emscripten sources/tools under
`build/toolchain/`; subsequent builds reuse the toolchain. `JOBS` controls
build parallelism. `GEORGE_TOOLCHAIN` selects another toolchain directory.
ECL's Wasm GC requires the spill-pointers pass; do not remove it. The engine
manifest is `web/engine/build.json`.

`npm run sources` adds license notices and downloadable corresponding
sources under `web/`. Build and validation run locally, following the preference in `todo.md`.
The optional, manually triggered Pages workflow only publishes the prebuilt
`web/` directory. Source archives are included so that the uploaded site
contains its corresponding sources. No hosted workflow was run here.

## Input and results

Use integer-coefficient polynomial relations, for example `x^2-y^2, xy`.
Single-letter words such as `xyx` are accepted. Choose ℚ, 𝔽₂ or 𝔽ₚ,
a monomial order, optional positive weights, and a degree limit. Output
includes raw files and the exact Bergman session for reproduction.

Default mode fixes the documented PB-file, nonhomogeneous reduction and
itemwise degree-limit defects. **Legacy mode** restores the original
computational branches; all 37 stored 2007 CLISP outputs match byte for byte.
Portability adapters remain necessary on ECL. Historical PSL outputs have
some different sign conventions and are not the bytewise reference.

For an Anick resolution choose the augmentation sending generators to 0
(graded) or to 1 (monoid). The latter uses shifted generators `x = u + 1`.
Nonhomogeneous resolutions require a completed basis. George's additional
resolution/homology parser currently requires single-letter generators;
this is our restriction, not an original Bergman generator-name limit.
Their correct ungraded Betti numbers are in `homology.json`;
Bergman's raw internal-degree table is retained but is not a valid ungraded
answer. A degree limit does not prove global basis completeness. Some
presentations have infinite Gröbner bases; Stop remains available.

## Project layout

| Path | Purpose |
|---|---|
| `vendor/bergman-1.001/` | Original sources and regression fixtures; exclusions documented in VENDORED.md; build scripts never edit this tree |
| `ports/common/` | Dated, mode-aware source patches and overlay |
| `ports/ecl/` | Bytecode build, loader, C bridge and Wasm link |
| `ports/sbcl/` | Native Common Lisp reference |
| `web/` | Static application and real engine |
| `test/`, `tools/` | Unit tests, independent checkers, regression and browser tools |
| `docs/` | Source review, capability map, validation evidence and handoff |
| `build/` | Ignored local toolchains, builds, detailed logs and archived prototypes |

The shipped tree contains the working application and its reproducible
sources. Unconnected prototype UI files and the paused JavaScript compiler
were moved to an ignored local archive. Historical `.old` outputs and seven
original backup inputs remain as regression fixtures. Source archives,
component notices and prebuilt engine files are intentional release assets.

## Credits and license

Bergman was written by Jörgen Backelin, with Svetlana Cojocaru,
Alexander Podoplelov, Victor Ufnarovski and others. The names honor George
Bergman and his diamond lemma. Samuel Mimram's
[Bergman 2 / ocaml-alg](https://github.com/smimram/ocaml-alg) is the independent
OCaml reference and inspiration for the menu of example families.

George's own code is available under the Bergman General Public License or
GPL-2.0-or-later. Bergman, ECL, GMP, GC and Emscripten retain their respective
licenses. See [LICENSE.md](LICENSE.md). No OCaml or Singular implementation
is shipped in the browser engine.
