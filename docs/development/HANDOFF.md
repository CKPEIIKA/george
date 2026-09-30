# George handoff

Updated 2026-09-30. The **Bergman → ECL → Wasm → HTML** MVP computes with the
real **bergman-1.001-fix** engine with fixed behavior by default and original
Bergman 1.001 behavior in legacy mode. George 0.2 includes the persistent console
and engine reader recovery. It has the validation runs listed below. The
former
single-letter adapter restriction is removed. The native idempotent-braid
resolution stall is fixed in default mode. Earlier prototype/demo-only
notes are superseded by this document.

## Read first

- [README](../../README.md): running, building and reproducing validation.
- [Source review](SOURCE-REVIEW.md): original and OCaml source findings,
  portability decisions and default-mode fixes.
- [Validation](VALIDATION.md): executed results, timings and limits.
- [Additional upstream tests](UPSTREAM-TESTS.md): pinned Singular/Plural,
  SymPy and GBNP presentations, oracle checks and adaptations.
- [Braid fix](BRAID-FIX.md): both native causes, independent algebraic
  certificate and conservative weighted homology reporting.
- [Reader fix](READER-FIX.md): readtable/RAISE restoration, cached bridge
  function, unavailable keyboard input and same-session recovery evidence.
- [Capability map](CAPABILITIES.md): original / OCaml / Singular / George.
- [User guide](../USER-GUIDE.md): source provenance and interface features.
- [Evidence manifest](validation/summary.json): retained reports and full
  local artifact paths, plus source hashes.

## Results

- All 37 historical outputs match in legacy mode; all 37 corrected references
  pass in default mode, on native SBCL, Node/Wasm and real Chromium.
- 51 unit tests; 20 extra original sessions, including one intentionally
  invalid backup; all 14 form presets.
- Eight native reader EOF checks; 23 consecutive failed commands in each
  Wasm mode, followed by successful computation and GC in the same session.
- Persistent console checks at root and project paths: retained settings/files,
  missing/no input, nested readers, help, completion, history and file shortcuts.
- All 24 upstream OCaml aliases; all five relevant active examples compared.
- 42 independent basis cases, 597 critical ambiguities, nine resolution cases
  and 560 identities d²=0 before augmentation. Singular/Plural, Hilbert
  dimensions and exact augmented matrix ranks provide additional checks.
- Ninety imported Q/F₂/F₅ cases from 17 pinned source files: native/Wasm
  equality, 3,379 exact critical ambiguities and three Singular reductions each.
  Thirty-nine commutative cases also pass SymPy Buchberger/F5B, and six
  Plural cases pass independent two-sided ideal and dimension checks.
  Ten original SymPy test functions execute separately.
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
  Both browser paths verify the braid and the weighted cutoff notice,
  plus imported braid, Katsura, weighted and Lie-quotient presentations.

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
The imported tests additionally repaired stale reduction signatures, inclusion
scheduling, redirected critical-pair contexts, structural units and
commutative process changes. All retain original branches in legacy mode.
See the source review for exact original defects and their reproducing cases.
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
Publish prebuilt `web/` on the `gh-pages` branch with the prepared publication
script, and select that branch's root in Settings → Pages. Run `npm run sources` after changes to keep
the downloadable source archives current. Stage new release files first:
the George archive includes tracked/staged files and excludes untracked
workspace drafts. Its ECL archive includes bundled
GMP and GC. Component notices are under `web/licenses/`; MathJax's notices and
asset hashes are under `web/vendor/mathjax/`.

The final engine runtime build is identified by `build/engine-build.json`.
This release compiled the patched Bergman runtime in
`/tmp/george-reader-02-v2-runtime-20260930` and relinked it with the previously
validated ECL Wasm library under `build/toolchain/ecl-wasm`. Both the bridge
Wasm code and bytecode/data now contain the reader fixes. Its native reference
is `build/sbcl-reader-02-v2-20260930/bin/clisp/unix/bergman`.
The user previously chose the validated toolchain after a neutral-path ECL
rebuild terminated before linking. That library rebuild was not resumed.
`ports/ecl/build.sh` and `link-wasm.sh` now contain the neutral-path changes;
that build has not been verified successfully. A future rebuild must rerun
the engine-dependent suites and refresh the evidence manifest.
Native reference builds, pinned oracle checkouts and detailed logs are under
`build/`, which is ignored. Small result reports are retained under
`docs/development/validation/`. The source-package setup script was exercised locally.
The earlier release was published by the user: live HTML and the engine
manifest matched local `gh-pages` commit `6bd9020`. The current fixes have not
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
The current checkout is on `main`, tracking the published source branch. Contributor
cleanup: `tools/prepare-publication.mjs` creates clean `publish/main` and
`publish/gh-pages` histories, removes Claude co-author trailers and preserves
human authors and all original file trees. Its Pages tip contains the exact
committed `web/` tree. Original local refs remain available. The ignored
`build/publication/plan.json` / `publish.sh` record the guarded publication.
The cleaned histories were pushed; the public contributors API now returns
an empty list, although GitHub's interface may retain older cached data.
Do not publish an old history afterward and reintroduce removed trailers.

The previously deferred console work is now included in George 0.2. Its
JavaScript guards, automatic session restart after input EOF, and first-T
filter have been removed. Recovery is implemented in the Common Lisp reader
patches and ECL host; see READER-FIX.md. The source archive includes the new
console, its tests and unmodified Bergman help texts.

The rebuilt native reference is
`build/sbcl-reader-02-v2-20260930/bin/clisp/unix/bergman`; the rebuilt ECL
runtime is `/tmp/george-reader-02-v2-runtime-20260930`. The existing validated
Wasm ECL library was reused and relinked with the corrected bridge. Manifest
`web/engine/build.json` records the exact engine hashes and appVersion 0.2.0.

All checks in the evidence manifest were rerun against this release. The
collector's exact selections are in `build/validation/reader02-release-reports.json`.
`npm test` executes all 51 assertions with Node >=22.8 and
`--experimental-test-isolation=none`. The browser checks include the actual
current console/form interface, rather than the earlier isolated checkout.

The user published the prepared source and Pages branches. Both remote tips
match the release plan. A live check found that Pages still served the previous
release and no new deployment workflow had run yet. The new version needs a
Pages deployment before its live console checks can be completed. Existing-site
Chromium checks passed computations, responsiveness, cancellation and memory
growth; those checks do not certify the newly pushed version.

Machine-specific authentication instructions belong only in private local
notes. The public README describes generic hosting; the source archive must
contain the same sanitized documents. Original local refs remain available.
