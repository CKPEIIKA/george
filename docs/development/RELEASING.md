# Preparing a release

## Routine update

Finish source, version, defaults and interface changes before starting release
checks. Regenerate `web/engine/fomkyr/build.json` with
`node tools/fomkyr-manifest.mjs` when its recorded assets change.

```sh
npm run release:check
```

The command checks application/core versions and source hashes in `fomkyr/` first, then runs unit
tests, exact arithmetic, reserve and automatic memory checks, the 95-case mathematical matrix,
nine coefficient/structural comparisons, FK6 degrees 1–6, the short native
CLI/frontier/profile/Hilbert-authority regression profile, and Chromium/Firefox
interface (including full text ZIP export) and Pages-style hosting checks. It also checks checkpoint upgrades
when a previous engine exists under `local/baselines/`, or when supplied with
`--previous-root <engine-directory>`.

The inherited upstream suite and the longer native recovery/sanitizer audits are
available explicitly:

```sh
npm run release:check -- --full
```

Use it for broader core changes and periodic validation. Its shared arithmetic
and Wasm tests run against the production host once; the exact runner reuses that
evidence and runs its remaining property checks.

Run just the extended native audits with `npm run test:fomkyr:extended`. Routine
browser UI checks use FK6 degree 5 for complete counts/preview expansion and
degree 4 for independently checked verification downloads. Degree 9, 10 and 11
timings and the literature stress ladder have a separate
[benchmark entry point](BENCHMARKS.md); neither release profile starts that ladder.

## Quick patch release

For a patch whose solver changes have already passed their focused exact and
recovery audits during development:

```sh
npm run release:check -- --quick
```

This profile runs fresh units, native/Wasm row-growth properties, the 95-case
matrix, nine independent coefficient comparisons, FK6 degrees 1–6, the short
native regression suite including planner/frontier/streaming-audit checks, both browser interface/hosting checks and checkpoint
upgrades. Independent references use the same validated cache. It omits the
historical exact-arithmetic and automatic-retry audit group; use the routine or
full profile when those paths change. Its report explicitly records `quick`.
Packaging and preparation use that report without rerunning checks.

## Reuse and deadlines

Repeat the same check command after an interruption. Completed phases and
completed mathematical cases are reused only for the same source snapshot and
protocol. A changed snapshot gets a new release directory automatically; an
explicit `--out` directory refuses incompatible reuse.

Completed algebra phases can also be reused across snapshots when all checked
inputs and the protocol match. The coordinator and the standalone interface
test runner are excluded from algebra dependencies; changes to the interface
runner still require a new browser check. Reuse retains the original report,
its digest and recorded duration. Unit tests run for each new snapshot.

Changes to the standalone native CLI runner and its exclusive recovery deadlines invalidate its own phase. Generated source inventory is checked separately before every run; mathematical phases still hash the actual core sources and production binaries. The
arithmetic, matrix, FK6, browser and upgrade phases exclude that runner from
their input contract because they neither import nor execute it. Older
conservative contracts are accepted only after their exact digest and the
remaining checked inputs are verified. Multi-job CLI recovery scripts have
a 600-second aggregate limit; their individual calculations remain capped
at no more than 120 seconds.

Complete Bergman and Singular reference bases are cached by their input scripts
and actual oracle build identities. The key excludes the candidate Fomkyr build.
Every newly computed candidate still undergoes exact ideal-membership, leading
word and bounded critical-pair checks. The first cache miss computes and records
the reference. Failed jobs cannot create successful cache entries.

Serialized-basis Python certificates are reusable only when the output bytes,
presentation, field, degree, Hilbert prefix, checker sources and Python runtime
match. FK6 prefixes reuse existing validated Singular logs when available. A
recorded timeout remains censored and does not become a pass.

`--refresh-oracles` requests fresh independent calculations. Individual
independent mathematical jobs retain a maximum of 120 seconds; aggregate phases
have separate deadlines. Timing reports retain the original start time, every
attempt and its duration. Failed logs remain available after retries.

All caches, raw evidence and timing logs stay in ignored `local/` or `build/`
directories. Inspect `local/releases/latest.json` for the last completed release.

## Package and prepare

Stage new source files so the corresponding-source archive includes them:

```sh
git add <reviewed-source-files>
git commit
npm run release:package
npm run release:prepare
```

Commit before packaging: the source archives are built from `HEAD`, including
the reviewed cleanup. Packaging and preparation use the last completed check
report automatically, including its full/routine profile. Packaging and preparation require unchanged checked
sources and a clean working tree. It advances `publish/main` with a fast-forward
check and prepares `publish/gh-pages` as one parentless commit that replaces the
site branch. Publication builds the George and fomkyr source archives from the
commit; `release:package` writes local copies for serving and checks.

Publish those prepared refs with:

```sh
bash build/publication/publish.sh [ssh-key]
```

GitHub Pages deployment originates on `gh-pages`, matching its environment
protection rules. Publication verifies the deployed bytes after pushing.

The checkpoint-upgrade UI runner is bound to its own phase; editing its menu
interaction does not rerun unchanged algebra or native checks. Reused evidence
retains the original report and digest.

Native C CLI and its dashboard test are excluded from Wasm/algebra phase inputs.
Their edits rerun every native check that executes the CLI and rebuild its binary;
unchanged kernel properties retain their source-bound evidence. The native report
records the changed input list and previous report hashes. Native-only edits still
require a fresh source inventory and release snapshot.

## Performance comparisons

Benchmarks are separate from release correctness checks and run serially. To
measure the current Fomkyr while keeping a saved baseline:

```sh
npm run benchmark:fomkyr:update -- --baseline-report <completed-comparison-directory>
```

This mode checks the input, reported machine and measurement settings before
starting jobs. It measures the current engine only, audits both sets of outputs,
and produces linear plots. Reports distinguish saved measurements and their
original dates. Host load and elapsed time between sessions can affect speed
ratios.

Use `--baseline-root <saved-engine-directory>` for a fresh alternating comparison
of both engines. Neither benchmark mode launches Singular or Bergman.

## FK6 profile integration

Fomkyr 0.6.8 adds focused checks for profile byte binding, bounded independent
completion, all four assisted Wasm variants, native/Wasm checkpoint exchange,
profile refusal before mutation, and undefined-behaviour sanitization. The UI
checks verify opt-in defaults, result labelling and prime-field control disabling.
Public provenance omits private artifact names while retaining artifact digests;
the original upstream authority remains accepted for identical table values.
