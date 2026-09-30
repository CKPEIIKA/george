```
GEORGE(1)                      George Manual                      GEORGE(1)
```

## NAME

**george** — Gröbner bases, Hilbert series and Anick resolutions in the
browser, *based on bergman*

## TRY IT

### [→ ckpeiika.github.io/george](https://ckpeiika.github.io/george/)

No installation. Everything runs in your browser; nothing is sent to a server.

## SYNOPSIS

```
npm ci && npm run serve        open http://127.0.0.1:8000/
npm test                       unit tests
npm run test:ui                browser checks: examples, EN/RU, themes, /george/
npm run wasm:build             rebuild the engine
npm run sources                refresh the source archives beside the site
```

## DESCRIPTION

**George** runs the original **bergman 1.001** in the browser. It computes
Gröbner bases in free associative and commutative algebras over ℚ, 𝔽₂ and
𝔽ₚ, Hilbert and Poincaré–Betti series, Anick resolutions, Betti numbers of
algebras and modules, and Hochschild homology. Arithmetic is exact.

## ARCHITECTURE

```
bergman 1.001 (Standard Lisp)    vendor/bergman-1.001/   unmodified
        │
        ▼
Common Lisp build                ports/common/           patches, fixes, legacy mode
        │
        ▼
ECL bytecode                     ports/ecl/
        │
        ▼
WebAssembly (Emscripten)         web/engine/ecl.{wasm,data,js}
        │
        ▼
Web Worker ⇄ JavaScript UI       web/engine/worker.js, web/src/
        │
        ▼
static site (GitHub Pages)       web/ → gh-pages
```

## DISCLAIMER

George was written largely by an LLM (Claude, Anthropic): it is vibe coded.
The mathematics is bergman's own, and the glue is tested against the
original: in legacy mode all 37 stored bergman outputs match byte for byte,
and results are compared with a native SBCL build, Bergman 2 and Singular
(*docs/development/VALIDATION.md*). Check results that matter.

## USAGE

**Input**
: Relations with integer coefficients, e.g. `x^2-y^2, xy`. Single letters
  may be juxtaposed: `xyx`.

**Settings**
: Field, monomial order, weights and degree limit. Every bergman mode is
  under *More settings*.

**Output**
: The basis by degree, series, Betti tables, Anick differentials, the raw
  files and the bergman session.

**Legacy mode**
: `(SETLEGACYMODE T)` or the checkbox reproduces bergman 1.001 exactly. The
  default mode applies documented fixes: the Poincaré–Betti file,
  nonhomogeneous reduction and the item-wise degree limit.

**Anick**
: Augmentation *graded* (x ↦ 0) or *monoid* (x ↦ 1). Ungraded Betti numbers
  are in `homology.json`, chains in `resolution.jsonl`
  (*docs/RESOLUTION-EXPORT.md*).

**Guide**
: The *User guide* tab, with eight guided examples. English/Russian,
  light/dark.

## COMMANDS

| Command | Checks |
|---|---|
| `npm test` | parsing, validation, exact ranks, worker lifecycle |
| `npm run wasm:test` | the 37 historical outputs, both modes |
| `npm run test:examples` | the 14 presets through the real engine |
| `npm run sbcl:build`, `sbcl:test`, `sbcl:test:legacy` | native SBCL reference |
| `npm run test:extra` | remaining original sessions |
| `npm run test:ocaml` | Bergman 2 aliases and references |
| `npm run test:algebra` | Singular, critical pairs, Hilbert dimensions |
| `npm run test:resolution:names` | long generator names, differentials |
| `npm run test:browser`, `test:browser:regression` | Chromium suites |
| `npm run test:ui` | guide, EN/RU, themes, MathJax, `/george/` path |

## PUBLISHING

```
git push -u origin main
git subtree push --prefix=web origin gh-pages
```

Then *Settings → Pages → Deploy from a branch → gh-pages, /(root)*.

## FILES

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

## ENVIRONMENT

Node.js 22.8 or later. Engine build: Git, Python 3, a C toolchain and make;
the toolchain goes to `build/toolchain/` (`GEORGE_TOOLCHAIN`, `JOBS`).
Reference build: SBCL. Oracle tests: Singular, OCaml 5.3 and dune 3.17.2
(`python3 tools/setup-oracles.py` fetches pinned copies). `CHROMIUM` selects
the browser.

## BUGS

A degree limit does not prove a basis complete, and some presentations have
infinite bases (use *Stop*). bergman's raw internal-degree Betti table is not
valid for nonhomogeneous relations. PSL-era outputs differ in sign
conventions. Only Chromium is verified.

## SEE ALSO

[Bergman 2](https://smimram.github.io/ocaml-alg/bergman/),
[Singular](https://www.singular.uni-kl.de/),
[ECL](https://ecl.common-lisp.dev/),
*docs/USER-GUIDE.md*, *docs/development/*

## AUTHORS

**bergman**: Jörgen Backelin (principal author), Svetlana Cojocaru,
Alexander Podoplelov, Victor Ufnarovski and others. The name honours
George Bergman and his diamond lemma.

**Bergman 2 / [ocaml-alg](https://github.com/smimram/ocaml-alg)**:
Samuel Mimram. It is the OCaml reference, and George's example families
follow it.

**Singular**: W. Decker, G.-M. Greuel, G. Pfister, H. Schönemann, with the
Letterplace and Plural extensions. It is the independent checker.

**ECL**: D. Kochmański, M. Gerbershagen, J. J. García-Ripoll and
contributors, with GMP and the Boehm–Demers–Weiser GC.

**Emscripten**, **MathJax**, **SBCL**.

**George**: written with Claude (Anthropic).

## LICENSE

George's code: the Bergman General Public License or GPL-2.0-or-later.
bergman, ECL, GMP, the GC, Emscripten and MathJax keep their own licenses.
See *LICENSE.md*.

```
George 0.1.0                     2026-09-30                       GEORGE(1)
```
