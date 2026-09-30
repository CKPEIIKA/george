# George handoff

Updated 2026-09-30. The **Bergman → ECL → Wasm → HTML** MVP computes with the
real engine and has the completed validation runs listed below. The former
single-letter adapter restriction is removed. An additional exploratory
backend issue remains in Practical limits. Earlier prototype/demo-only
notes are superseded by this document.

## Read first

- [README](../../README.md): running, building and reproducing validation.
- [Source review](SOURCE-REVIEW.md): original and OCaml source findings,
  portability decisions and default-mode fixes.
- [Validation](VALIDATION.md): executed results, timings and limits.
- [Capability map](CAPABILITIES.md): original / OCaml / Singular / George.
- [User guide](../USER-GUIDE.md): source provenance and interface features.
- [Evidence manifest](validation/summary.json): retained reports and full
  local artifact paths, plus source hashes.

## Results

- All 37 historical outputs match in legacy mode; all 37 corrected references
  pass in default mode, on native SBCL, Node/Wasm and real Chromium.
- 40 unit tests; 20 extra original sessions, including one intentionally
  invalid backup; all 14 form presets.
- All 24 upstream OCaml aliases; all five relevant active examples compared.
- 42 independent basis cases, 597 critical ambiguities, nine resolution cases
  and 560 identities d²=0 before augmentation. Singular/Plural, Hilbert
  dimensions and exact augmented matrix ranks provide additional checks.
- Browser stop/restart, responsiveness, 100 MB allocation / memory growth,
  exact integers, monoid augmentation and desktop/mobile rendering verified.
- Guide, eight guided examples, EN/RU, automatic/light/dark, local MathJax
  and persistence pass at `/` and `/george/`. No external requests or errors.
- Longer and overlapping generator names now work through both resolution
  stages, exact homology and the browser display. Twenty additional cases
  compare all structural terms with native SBCL and a single-letter renaming,
  and verify 258 full identities d²=0 before augmentation and 91 ambiguities.

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
`GEORGEWRITERESOLUTION` in the overlay exports versioned `resolution.jsonl`
directly from chain/tensor objects. `web/src/resolution-data.js` validates
generator indices and exact coefficient strings; chain keys are token arrays.
The codec is shared by homology, display and the independent differential
checker. See `docs/RESOLUTION-EXPORT.md` for the format and unit convention.
Legacy output and original `ANICKDISPLAY` are unchanged. Only ordinary
algebra Anick form jobs opt into this export; module procedures retain their
original outputs. `npm run test:resolution:names` reproduces the new corpus.

Never overwrite `web/engine/ecl.*` while a verification process is running:
its cached loader can otherwise encounter mismatched Wasm/data files. Two
such development runs failed initialization; both were discarded and rerun
against the final stable files.

## Reproduction and publication

All commands are local. There are no repository CI/Actions workflows.
Publish prebuilt `web/` on the `gh-pages` branch with the documented subtree
command, and select that branch's root in Settings → Pages. Run `npm run sources` after changes to keep
the downloadable source archives current. Its ECL archive includes bundled
GMP and GC. Component notices are under `web/licenses/`; MathJax's notices and
asset hashes are under `web/vendor/mathjax/`.

The final engine runtime build is identified by `build/engine-build.json`.
For this handoff, the user explicitly chose to finalize the current validated
engine (`build/ecl-runtime-20260930-162718-13`). The later neutral-path ECL
rebuild terminated before linking and did not replace the shipped files.
`ports/ecl/build.sh` and `link-wasm.sh` now contain the neutral-path changes;
that build has not been verified successfully. A future rebuild must rerun
the engine-dependent suites and refresh the evidence manifest.
Native reference builds, pinned oracle checkouts and detailed logs are under
`build/`, which is ignored. Small result reports are retained under
`docs/development/validation/`. The source-package setup script was exercised locally.
The live hosted site has not been deployed; its project path was tested locally.

## Practical limits and future work

The audit establishes the listed compatibility and independent checks, not
universal correctness of every experimental Bergman routine. Degree limits,
finite versus truncated resolutions, the malformed backup and known
upstream issues are documented in the validation report. The parser's former
single-letter restriction is removed and must not be reintroduced.
An exploratory nonhomogeneous idempotent-braid resolution stalled at internal
degree 4 in native SBCL with single-letter generators, as well as Wasm;
this is separate from token export. See `docs/development/validation/resolution-limits.json`
for timeouts and the retained local reproduction paths. Its Gröbner basis
passes the independent checks. Do not describe this resolution as verified.
The safe-mode default native run exits 124 after 15 seconds; Wasm exits 124
after 25 seconds. A direct legacy safe-mode session errors earlier and is
retained separately. A temporary full-word leading-tensor selection prototype
also timed out and was discarded; it is not in the source or engine.
Next backend investigation should trace chain construction and `anDIFF` /
`andiINTEG` around internal degree 4, using the retained native reproducer.
Chromium was
verified; Firefox/Safari remain untested.

The user's todo items are completed and `todo.md` was removed as requested:
source-based guide, characteristic examples, translation/theme/MathJax checks,
clean layout, current feature matrix and Pages instructions/verification.
The guide lives in `web/src/guide.js`, examples in `tutorials.js`, and the
active locale/preferences modules are `i18n.js` and `preferences.js`.
MathJax is pinned at 4.1.3; `npm run ui:package` reproduces its local assets.
`npm run test:ui` starts its own servers and tests the root and project paths.

The former `i18n.js` and `setup-schema.js` drafts and paused `sl2js` experiment
were moved out of the release tree to the ignored local archive
`build/archive/initial-cleanup-20260930/`. The archive also holds removed
upstream filesystem remnants, generated documentation artifacts, logs and
unused editor backups. Its manifest records their paths and hashes.
The old drafts are not used by the current implementation. No account-site
repository is required for this project site; the README describes the
branch-based GitHub Pages publication.

The initial Git snapshot includes the validated application, original
sources, regression fixtures, small evidence reports and distributable
engine/source packages. Local toolchains, dependencies, detailed run logs,
archives and agent configuration are excluded.

The interface and structural-export changes are included in the finalized
release commit. A local `gh-pages` branch is prepared from the committed `web/`
tree; the user can publish it with `git push origin main gh-pages`, then choose
`gh-pages` and `/(root)` in Settings → Pages. No remote publication was performed.
`npm test` uses `--experimental-test-isolation=none` (Node >=22.8): in this restricted
workspace the isolated Node 24 runner only reported successful file processes,
while the nonisolated run actually executes and reports all 40 assertions.
