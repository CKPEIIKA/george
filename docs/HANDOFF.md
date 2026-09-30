# George handoff

Updated 2026-09-30. The requested **Bergman → ECL → Wasm → HTML** MVP and
its local validation work are complete. The page now computes with the real
engine. Earlier prototype/demo-only notes are superseded by this document.

## Read first

- [README](../README.md): running, building and reproducing validation.
- [Source review](SOURCE-REVIEW.md): original and OCaml source findings,
  portability decisions and default-mode fixes.
- [Validation](VALIDATION.md): executed results, timings and limits.
- [Capability map](CAPABILITIES.md): original / OCaml / Singular / George.
- [Evidence manifest](validation/summary.json): retained reports and full
  local artifact paths, plus source hashes.

## Results

- All 37 historical outputs match in legacy mode; all 37 corrected references
  pass in default mode, on native SBCL, Node/Wasm and real Chromium.
- 29 unit tests; 20 extra original sessions, including one intentionally
  invalid backup; all 14 form presets.
- All 24 upstream OCaml aliases; all five relevant active examples compared.
- 42 independent basis cases, 597 critical ambiguities, nine resolution cases
  and 560 identities d²=0 before augmentation. Singular/Plural, Hilbert
  dimensions and exact augmented matrix ranks provide additional checks.
- Browser stop/restart, responsiveness, 100 MB allocation / memory growth,
  exact integers, monoid augmentation and desktop/mobile rendering verified.

## Implementation map

`ports/ecl/build.sh` pins ECL and Emscripten. `build-bergman.sh` compiles
portable bytecode in an isolated build copy. `prelude.lisp` supplies the
reader and bytecode loader; `bridge.c` exposes the evaluator. The original
vendored source files remain unmodified; disposable upstream artifacts are
excluded as documented in VENDORED.md. `web/engine/build.json` identifies the
current generated engine.

`ports/common/behavior-patches.py` and `george-overlay.sl` hold dated fixes
with legacy branches. `web/src/engine.js` manages session lifetimes;
`web/engine/runner.js` is shared by the worker and Node validation. Form jobs
start fresh; console evaluations retain state. Nonhomogeneous Anick jobs
complete the basis first, optionally shift augmentation, then compute a
resolution and exact ungraded homology.

Never overwrite `web/engine/ecl.*` while a verification process is running:
its cached loader can otherwise encounter mismatched Wasm/data files. Two
such development runs failed initialization; both were discarded and rerun
against the final stable files.

## Reproduction and publication

All commands are local. `todo.md` says not to use CI; the retained optional
Pages workflow only publishes prebuilt `web/`, and is manual. No push or
remote deployment was performed. Run `npm run sources` after changes to keep
the downloadable source archives current. Its ECL archive includes bundled
GMP and GC. Component notices are under `web/licenses/`.

The final engine runtime build is identified by `build/engine-build.json`.
Native reference builds, pinned oracle checkouts and detailed logs are under
`build/`, which is ignored. Small result reports are retained under
`docs/validation/`. The source-package setup script was exercised locally.
The hosted publication workflow itself has not been executed.

## Practical limits and future work

The audit establishes the listed compatibility and independent checks, not
universal correctness of every experimental Bergman routine. Degree limits,
finite versus truncated resolutions, the malformed backup and known
upstream issues are documented in the validation report. Nonhomogeneous
resolution/homology parser currently requires single-letter generators.
This is George's restriction; original Bergman supports longer names.
Chromium was
verified; Firefox/Safari remain untested.

Preserve `todo.md`: it contains separate UI/documentation wishes about a
user guide, translations, themes and MathJax, plus a publication question.
The unused `i18n.js` and `setup-schema.js` drafts and paused `sl2js` experiment
were moved out of the release tree to the ignored local archive
`build/archive/initial-cleanup-20260930/`. The archive also holds removed
upstream filesystem remnants, generated documentation artifacts, logs and
unused editor backups. Its manifest records their paths and hashes.
These UI wishes are not claimed implemented by this validation audit. Its
requested capability matrix is now in CAPABILITIES.md. To publish with the
optional workflow, push the repository, enable Pages with GitHub
Actions as the source, then run the manual pages workflow; it serves `web/`
from this repository, without a separate username.github.io repository.
The publication-only workflow follows the
[official Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The initial Git snapshot includes the validated application, original
sources, regression fixtures, small evidence reports and distributable
engine/source packages. Local toolchains, dependencies, detailed run logs,
archives and agent configuration are excluded. No remote push or publication
was performed.
