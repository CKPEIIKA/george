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
five coefficient-heavy comparisons, FK6 degrees 1–9, native CLI/frontier/Hilbert authority and cooperative yield/recovery checks, and Chromium/Firefox
interface (including full text ZIP export) and Pages-style hosting checks. It also checks checkpoint upgrades
when a previous engine exists under `local/baselines/`, or when supplied with
`--previous-root <engine-directory>`.

The inherited upstream suite is available explicitly:

```sh
npm run release:check -- --full
```

Use it for broader core changes and periodic validation. Its shared arithmetic
and Wasm tests run against the production host once; the exact runner reuses that
evidence and runs its remaining property checks.

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
npm run release:package
git add web/sources/george-source.tar.gz
git commit
npm run release:prepare
```

Packaging and preparation use the last completed check report automatically,
including its full/routine profile. Preparation requires unchanged checked
sources, the packaged archive and a clean working tree. It advances the prepared
`publish/main` and `publish/gh-pages` refs with fast-forward checks.

Publish those prepared refs with:

```sh
bash build/publication/publish.sh [ssh-key]
```

GitHub Pages deployment originates on `gh-pages`, matching its environment
protection rules. Publication verifies the deployed bytes after pushing.

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
