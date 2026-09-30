# George handoff

Updated 2026-09-30. The **Bergman → ECL → Wasm → HTML** MVP computes with the
real engine and has the completed validation runs listed below. The former
single-letter adapter restriction is removed. The native idempotent-braid
resolution stall is fixed in default mode. Earlier prototype/demo-only
notes are superseded by this document.

## Read first

- [README](../../README.md): running, building and reproducing validation.
- [Source review](SOURCE-REVIEW.md): original and OCaml source findings,
  portability decisions and default-mode fixes.
- [Validation](VALIDATION.md): executed results, timings and limits.
- [Braid fix](BRAID-FIX.md): both native causes, independent algebraic
  certificate and conservative weighted homology reporting.
- [Capability map](CAPABILITIES.md): original / OCaml / Singular / George.
- [User guide](../USER-GUIDE.md): source provenance and interface features.
- [Evidence manifest](validation/summary.json): retained reports and full
  local artifact paths, plus source hashes.

## Results

- All 37 historical outputs match in legacy mode; all 37 corrected references
  pass in default mode, on native SBCL, Node/Wasm and real Chromium.
- 41 unit tests; 20 extra original sessions, including one intentionally
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
- Twenty braid cases compare native and Wasm over Q/F₂/F₃/F₅/F₁₀₁,
  checking 860 full identities d²=0 and 220 critical ambiguities. An independent
  projectivity certificate proves the expected higher Tor groups vanish.
  Both browser paths verify the braid and the weighted cutoff notice.

## Implementation map

`ports/ecl/build.sh` pins ECL and Emscripten. `build-bergman.sh` compiles
portable bytecode in an isolated build copy. `prelude.lisp` supplies the
reader and bytecode loader; `bridge.c` exposes the evaluator. The original
vendored source files remain unmodified; disposable upstream artifacts are
excluded as documented in VENDORED.md. `web/engine/build.json` identifies the
current generated engine.

`ports/common/behavior-patches.py` and `george-overlay.sl` hold dated fixes
with legacy branches. `anick-tensor.sl` supplies full-word comparison,
chain-identity merging and stable sorting for default safe-mode tensors.
The degreewise safe monomial comparator follows legacy switches dynamically.
`web/src/homology.js` reports only certified complete incoming-chain degrees;
unreported partial dimensions are retained as `truncatedBetti`.
`web/src/engine.js` manages session lifetimes;
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
the downloadable source archives current. Stage new release files first:
the George archive includes tracked/staged files and excludes untracked
workspace drafts. Its ECL archive includes bundled
GMP and GC. Component notices are under `web/licenses/`; MathJax's notices and
asset hashes are under `web/vendor/mathjax/`.

The final engine runtime build is identified by `build/engine-build.json`.
The braid fix compiled the patched Bergman runtime in
`/tmp/george-braid-final-runtime-20260930` and relinked it with the previously
validated ECL Wasm library under `build/toolchain/ecl-wasm`. The Wasm code
hash is unchanged; the bytecode/data contains the fixes. Its native reference
is `build/sbcl-braid-final-20260930/bin/clisp/unix/bergman`.
The user previously chose the validated toolchain after a neutral-path ECL
rebuild terminated before linking. That library rebuild was not resumed.
`ports/ecl/build.sh` and `link-wasm.sh` now contain the neutral-path changes;
that build has not been verified successfully. A future rebuild must rerun
the engine-dependent suites and refresh the evidence manifest.
Native reference builds, pinned oracle checkouts and detailed logs are under
`build/`, which is ignored. Small result reports are retained under
`docs/development/validation/`. The source-package setup script was exercised locally.
The earlier release was published by the user: live HTML and the engine
manifest matched local `gh-pages` commit `6bd9020`. The braid fix has not
been published; that Pages branch still holds the earlier release.

## Practical limits and future work

The audit establishes the listed compatibility and independent checks, not
universal correctness of every experimental Bergman routine. Degree limits,
finite versus truncated resolutions, the malformed backup and known
upstream issues are documented in the validation report. The parser's former
single-letter restriction is removed and must not be reintroduced.
The earlier idempotent-braid stall is resolved in default safe mode by fixing
mixed-degree monomial and complete tensor-word ordering. Its old native/Wasm
timeouts and legacy diagnostic remain as history in
`docs/development/validation/resolution-limits.json`. Reproduce the new matrix
with `npm run test:braid`. Legacy retains the original routines and its direct
safe-mode diagnostic; this fix does not change that behavior.
Weighted resolutions use a conservative bound on complete incoming chains;
some available ranks remain unreported until the degree limit is increased.
Chromium was verified; Firefox/Safari remain untested.

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

The earlier interface and structural-export release is committed and published.
The current braid fix is on `fix/anick-braid`. Review it, merge into `main`,
then publish the committed `web/` tree using the README's subtree command.
The unrelated untracked `web/src/console-commands.js` and `web/src/lisp.js`
drafts are preserved outside this fix and its source package.
No remote publication was performed during the braid work.
`npm test` uses `--experimental-test-isolation=none` (Node >=22.8): in this restricted
workspace the isolated Node 24 runner only reported successful file processes,
while the nonisolated run actually executes and reports all 41 assertions.
