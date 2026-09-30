# George — based on bergman

Gröbner bases, Hilbert and Poincaré–Betti series, Anick resolutions, module
Betti numbers and Hochschild homology in a static browser application.

## [Try George in your browser: ckpeiika.github.io/george](https://ckpeiika.github.io/george/)

Nothing to install. Computations run locally in your browser; nothing is sent
to a server.

## How it is built

George does not reimplement bergman. It runs the original program:

```
bergman 1.001  (Standard Lisp, J. Backelin et al., 1992–2007)
   │   vendor/bergman-1.001/        unmodified sources and 2007 test outputs
   ▼
Common Lisp build of bergman
   │   ports/common/                dated portability patches, George's fixes
   │                                and legacy mode (SETLEGACYMODE)
   ▼
ECL, Embeddable Common-Lisp
   │   ports/ecl/                   compiles bergman to portable bytecode
   ▼
Emscripten → WebAssembly
   │   web/engine/ecl.{wasm,data,js}
   ▼
Web Worker  ⇄  JavaScript interface
   │   web/engine/worker.js,  web/src/
   ▼
Static site on GitHub Pages     web/  → gh-pages branch

Checked against: bergman's 2007 CLISP and PSL outputs, a native SBCL build
(ports/sbcl/), Bergman 2 (OCaml) and Singular.
```

## Built with an LLM

Most of George's code (the ports, the WebAssembly build, the interface and
the test tools) was written with an AI assistant, Claude, from Anthropic,
under human direction. It is, frankly, vibe coded. bergman's algorithms are
not rewritten: George runs the original 1.001 sources, with a few documented
fixes that legacy mode switches off. The glue was tested against the
original software:

- in legacy mode, all 37 stored bergman 1.001 regression outputs are
  reproduced byte for byte;
- results are compared with a native SBCL build of bergman, with
  Bergman 2 (OCaml) and with Singular.

See the [validation report](docs/development/VALIDATION.md) for exactly what
was checked. Still, verify results that matter before relying on them.
Commits made with the assistant carry a `Co-Authored-By: Claude` trailer.

## Run

Local tooling requires Node.js 22.8 or newer.

```sh
npm ci
npm run serve
# Open http://127.0.0.1:8000/
```

The built `web/engine/ecl.{js,wasm,data}` files are included. Serve `web/`
over HTTP; opening `index.html` as a local file will not load a module worker.
No backend, external font service, SharedArrayBuffer or isolation headers
are required. Chromium is the browser verified for this release.

The **User guide** tab explains input and results from original bergman
sources and offers eight guided examples. Language supports English/Russian;
theme supports automatic, light and dark modes. Guide equations use local
MathJax. See [the interface guide](docs/USER-GUIDE.md).

## Validation

See [the validation report](docs/development/VALIDATION.md) for exact coverage,
timings, artifact hashes and limitations, and
[the source review](docs/development/SOURCE-REVIEW.md) for the original and OCaml
implementations. Development notes are in [docs/development](docs/development/).

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
npm run test:resolution:names    # longer names, native equality, full differential checks
npm run test:browser:regression  # full suites in Chromium, without DevTools
npm run test:browser             # UI, cancellation, restart, memory growth; needs serve
npm run test:ui                  # guide, EN/RU, themes, MathJax, examples and /george/ path
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
npm run ui:package
npm run sources
```

The build needs Git, Python 3, a C/C++ toolchain, make, and standard Linux
build utilities. It downloads pinned ECL and Emscripten sources/tools under
`build/toolchain/`; subsequent builds reuse the toolchain. `JOBS` controls
build parallelism. `GEORGE_TOOLCHAIN` selects another toolchain directory.
ECL's Wasm GC requires the spill-pointers pass; do not remove it. The engine
manifest is `web/engine/build.json`.

`npm run sources` adds license notices and downloadable corresponding
sources under `web/`. Build and validation run locally; this repository has
no custom CI workflows. Source archives accompany the prebuilt site.

For GitHub Pages, push the source branch and publish `web/` on this repository's
`gh-pages` branch:

```sh
git push -u origin main
git subtree push --prefix=web origin gh-pages
```

In Settings → Pages, select **Deploy from a branch**, **gh-pages**, **/(root)**,
then **Save**. See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
The project URL is
`https://CKPEIIKA.github.io/george/`; a separate account-site repository is
unnecessary. `npm run test:ui` checks the site at that `/george/` path locally.

## Input and results

Use integer-coefficient polynomial relations, for example `x^2-y^2, xy`.
Single-letter words such as `xyx` are accepted. Choose ℚ, 𝔽₂ or 𝔽ₚ,
a monomial order, optional positive weights, and a degree limit. Output
includes raw files and the exact bergman session for reproduction.

Default mode fixes the documented PB-file, nonhomogeneous reduction and
itemwise degree-limit defects. **Legacy mode** restores the original
computational branches; all 37 stored 2007 CLISP outputs match byte for byte.
Portability adapters remain necessary on ECL. Historical PSL outputs have
some different sign conventions and are not the bytewise reference.

For an Anick resolution choose the augmentation sending generators to 0
(graded) or to 1 (monoid). The latter uses shifted generators `x = u + 1`.
Nonhomogeneous resolutions require a completed basis. Longer and overlapping
generator names are supported; use explicit products such as `a*aa`.
Default Anick jobs export `resolution.jsonl` directly from chain objects,
with generator indices and exact coefficient strings. The homology reader
and resolution display use this export, so compact printed names cannot collide.
Their correct ungraded Betti numbers are in `homology.json`;
bergman's raw internal-degree table is retained but is not a valid ungraded
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
| `web/vendor/mathjax/` | Pinned local renderer, SVG glyph data and notices |
| `test/`, `tools/` | Unit tests, independent checkers, regression and browser tools |
| `docs/` | User guide and the resolution export format |
| `docs/development/` | Source review, capability map, validation evidence and handoff |
| `build/` | Ignored local toolchains, builds, detailed logs and archived prototypes |

The shipped tree contains the working application and its reproducible
sources. Unconnected prototype UI files and the paused JavaScript compiler
were moved to an ignored local archive. Historical `.old` outputs and seven
original backup inputs remain as regression fixtures. Source archives,
component notices and prebuilt engine files are intentional release assets.

## Credits

- **bergman**: Jörgen Backelin (principal author), with Svetlana Cojocaru,
  Alexander Podoplelov, Victor Ufnarovski and others. George runs their
  bergman 1.001. Both programs are named after **George Bergman**, whose
  diamond lemma underlies the method.
- **Bergman 2 / [ocaml-alg](https://github.com/smimram/ocaml-alg)**:
  Samuel Mimram. It is the independent OCaml reference, and George's menu of
  example families follows it.
- **[Singular](https://www.singular.uni-kl.de/)**: W. Decker, G.-M. Greuel,
  G. Pfister, H. Schönemann and the Singular team, including the Letterplace
  and Plural noncommutative extensions. It is an independent checker in the
  tests.
- **[ECL](https://ecl.common-lisp.dev/)**, Embeddable Common-Lisp: Daniel
  Kochmański, Marius Gerbershagen, Juan José García-Ripoll and contributors.
  It is the Lisp that runs bergman in the browser, together with its bundled
  **GMP** and **Boehm–Demers–Weiser garbage collector**.
- **[Emscripten](https://emscripten.org/)**, for WebAssembly;
  **[MathJax](https://www.mathjax.org/)**, for the mathematics in the guide;
  **[SBCL](https://www.sbcl.org/)**, for the native reference build.
- **Claude** (Anthropic), the AI assistant that wrote most of George's code
  (see *Built with an LLM*).

## License

George's own code is available under the Bergman General Public License or
GPL-2.0-or-later. bergman, ECL, GMP, the garbage collector, Emscripten and
MathJax keep their own licenses. See [LICENSE.md](LICENSE.md). No OCaml or
Singular code is shipped in the browser engine.
