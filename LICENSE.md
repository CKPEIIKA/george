# Licensing

This is the maintainers' reading of the licenses involved, not legal advice.

## George's own code

Everything written for George is Copyright © 2026 the George contributors.
That covers George's code in `web/`, `tools/`, `test/`, `ports/` and `docs/`.
Third-party engine components and `web/vendor/mathjax/` retain their own licenses.
Adapted upstream validation fixtures retain the source licenses recorded in
`test/fixtures/upstream-cases.json` and `licenses/UPSTREAM-TESTS.txt`.
You may use, modify and redistribute it under **either** of:

- the **Bergman General Public License** (`licenses/BGPL.txt`), or
- the **GNU General Public License, version 2 or (at your option) any later
  version** (`licenses/GPL-2.0.txt`).

Why both:

- bergman's license requires, in §2(b), that any distributed work which
  contains bergman or a derivative of it be licensed "on terms identical to
  those contained in this License Agreement". The George site and its engine
  contain bergman. George is therefore offered under the BGPL, and anyone may
  redistribute the application under the BGPL. Imported validation fixtures
  retain their separate upstream licenses.
- The GPL-2.0-or-later option keeps George's own code reusable in
  GPL-licensed projects. In particular, that includes Samuel Mimram's
  ocaml-alg and Bergman 2, which are declared GPL-2.0.

## bergman 1.001

`vendor/bergman-1.001/` is Copyright © 1992–2006 Jörgen Backelin and others,
under the Bergman General Public License (`vendor/bergman-1.001/doc/copyright`,
also in `licenses/BGPL.txt`). It is vendored unmodified.
`web/vendor/bergman/helptexts` is an unmodified copy of bergman's help file
(`doc/helptexts`), which the console's help displays.

- **Modified files (§2a).** The builds patch copies of bergman files for
  portability and documented fixes (`ports/common/` and `ports/ecl/`). Each patched copy gets a dated
  notice saying what was changed.
- **Behaviour changes.** These are in `ports/common/behavior-patches.py` and `ports/common/george-overlay.sl`, a
  derivative of bergman under the BGPL, with a dated list of the changes.
  Legacy mode, `(SETLEGACYMODE T)`, switches them off.
- **Object code (§3a).** The WebAssembly engine contains bergman compiled for
  ECL. It is distributed together with its complete corresponding source,
  this repository, and the site links to it.

## Bergman 2 (ocaml-alg)

George contains no code from ocaml-alg, which is GPL-2.0.

- The example families under "Start from" follow the selection Bergman 2
  offers.
- Their relations are standard presentations: exterior and symmetric
  algebras, Knuth's plactic relations, the Coxeter presentation of the
  symmetric group, and words *x yⁱ x* and a Sklyanin-type cubic. They were
  written for George from their mathematical definitions.
- Bergman 2 is credited in the interface and in the README.

## Components of the engine

The WebAssembly engine statically links:

| Component | License |
|---|---|
| ECL (Embeddable Common-Lisp) | LGPL-2.1-or-later |
| GMP 4.2.1, bundled with ECL | LGPL-2.1-or-later |
| Boehm–Demers–Weiser garbage collector, bundled with ECL | MIT-style permissive license |
| Emscripten runtime | MIT or University of Illinois/NCSA |

The Bergman and George source and build scripts are in this repository.
`ports/ecl/build.sh` fetches the exact ECL revision (including GMP and GC).
`tools/package-sources.sh` packages corresponding George/Bergman and ECL
source archives beside the static site, together with component notices.
The engine can be rebuilt and relinked with a modified ECL. The build records
its dependency revisions in `web/engine/build.json`.

ECL is the Lisp system that bergman runs on, as PSL and CLISP were for
bergman's own distributions: bergman's Linux distribution shipped it inside
PSL images. George treats ECL the same way, as the platform, and keeps it
under its own license.

## Mathematical renderer

MathJax 4.1.3 and its New Computer Modern SVG data are distributed under
Apache-2.0. Original component notices and the license accompany them in
`web/vendor/mathjax/`. The package versions and integrity values are pinned
in `package-lock.json`; `tools/package-ui.mjs` copies the needed browser
components. The combined renderer's required SRE worker and rule data are
included locally under the same upstream component license.

## Build tools and text fonts

- **UI text fonts** use locally available families and browser fallbacks.
  MathJax's mathematical glyphs are included as SVG data and served locally.
- **SBCL and the Emscripten SDK** are build tools only.
