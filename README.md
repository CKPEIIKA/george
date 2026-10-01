```
GEORGE(1)                      George Manual                      GEORGE(1)
```

## NAME

**george** — Gröbner bases, Hilbert series and Anick resolutions in the
browser, *an interface to bergman*

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

**George** runs **bergman-1.001-fix** in the browser: the original bergman 1.001
with documented fixes enabled by default and original behavior in legacy mode. It computes
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

THIS SOFTWARE IS VIBE-CODED! The mathematics is bergman's own, and the interface is tested against the
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

**Memory**
: *More settings → Memory limit* allows 512 MiB to 3.5 GiB of Lisp heap,
  with 2 GiB selected by default. Memory grows as needed. The engine has a
  4 GiB Wasm ceiling; the remaining space serves files and host allocations.
  An exhausted heap returns saved basis output as partial and releases the
  worker. A larger limit does not guarantee completion of an unbounded basis.

**Output**
: The basis by degree, series, Betti tables, Anick differentials, the raw
  files and the bergman session.

**Share**
: The small *Share* button copies a compact link containing the presentation
  and all form settings, including the memory limit, language and theme.
  Opening the link restores them; press Compute to run the calculation.
  Computation times are displayed in seconds, with up to two decimal places.

**Legacy mode**
: `(SETLEGACYMODE T)` or the checkbox retains original bergman 1.001 behavior. The
  default mode applies documented fixes: the Poincaré–Betti file,
  nonhomogeneous reduction, critical-pair and inclusion handling, the
  itemwise degree limit, mode-sensitive monomial comparison and safe-mode
  Anick tensor ordering. `(SETLEGACYMODE NIL)` restores fixed mode.

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
| `npm run test:upstream` | 90 adapted Singular/Plural, SymPy and GBNP field cases; independent oracles |
| `npm run test:resolution:names` | long generator names, differentials |
| `npm run test:braid` | native/Wasm braid resolutions, full differentials, projectivity and weighted bounds |
| `npm run test:reader` | same-session recovery after missing files, EOF, stream redirection and syntax errors |
| `npm run test:browser`, `test:browser:regression` | Chromium suites |
| `GEORGE_LARGE_MEMORY=1 npm run test:browser` | Chromium allocation above 3 GiB, heap exhaustion, saved output and restart; requires a running local server |
| `npm run test:ui` | guide, EN/RU, themes, MathJax, `/george/` path |

## PUBLISHING

The workflow `.github/workflows/pages.yml` publishes the committed, prebuilt
`web/` directory whenever `main` is pushed. Enable it once in GitHub:
*Settings → Pages → Build and deployment → Source → GitHub Actions*.
Pushes then deploy automatically, without rebuilding ECL or running tests.
To redeploy the latest `main` manually, open
*Actions → Deploy George to GitHub Pages → Run workflow* and select `main`.
See [GitHub's Pages configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The existing branch-based setup is also supported:
*Settings → Pages → Deploy from a branch → gh-pages, /(root)*. In that mode,
publish the `web/` tree to `gh-pages`; pushing only `main` does not update the
site. The Actions source above removes that extra branch-publication step.

To prepare both source and site refs for a manual release, commit the intended
changes, then run `node tools/prepare-publication.mjs --update --fast-forward`.
Review `build/publication/plan.json` and execute `bash build/publication/publish.sh`
in your terminal. Its optional argument is the SSH key to load with `ssh-add`;
any passphrase is entered in the terminal. The script pushes both prepared
branches atomically and refuses outdated prepared refs. In fast-forward mode
it never forces a remote branch; a newer or diverged remote requires a fresh
preparation after fetching.

George 0.3 adds compact share links, computation times in seconds and the
selectable memory allowance up to 3.5 GiB. It includes the persistent Lisp
console introduced in 0.2: command completion, history,
original Bergman help, and session files. Missing files or unavailable keyboard
input now report errors in the engine without restarting the session. The
reader and streams recover after errors; variables and files remain available.

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
ECL, GMP and GC are compiled at `-O2`; `GEORGE_ECL_OPT=O0` selects the
previous library settings in a separate cache. The final link uses `-O2`
and retains the GC pointer spilling pass. See the
[performance assessment](docs/development/PERFORMANCE.md) for measurements
and isolated build/profiling commands.
Reference build: SBCL. Oracle tests: Singular 4.4.1, SymPy 1.14.0,
OCaml 5.3 and dune 3.17.2
(`python3 tools/setup-oracles.py` fetches pinned copies). `CHROMIUM` selects
the browser.

Imported fixture sources: `python3 tools/setup-upstream-tests.py`.
See [upstream test reproduction](docs/development/UPSTREAM-TESTS.md).

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

**George**: the George contributors.

## LICENSE

George's code: the Bergman General Public License or GPL-2.0-or-later.
bergman, ECL, GMP, the GC, Emscripten and MathJax keep their own licenses.
See *LICENSE.md*.

```
George 0.3.0                     2026-10-01                       GEORGE(1)
```
