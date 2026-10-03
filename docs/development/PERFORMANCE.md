# Performance measurement

Performance depends on the presentation, degree, coefficient growth, engine,
worker count, browser, available memory, storage and checkpoint state.
Benchmark results alone do not establish a general ordering of engines.

```sh
npm run benchmark:fk6
npm run benchmark:resources
```

The default benchmark measures the current fomkyr against retained baseline
results. Request all engines explicitly when refreshing those baselines.
Each run records its exact settings, output checks, wall time, CPU sampling,
allocated Wasm memory and process memory where available. Slow cases have a
120-second cap; censored cases remain distinguishable from completed runs.
Raw reports and process traces remain local and are excluded from source packages.
The curated [FK6 comparison](../benchmarks/README.md) publishes a compact figure,
settings and sanitized measurements for the README.

Fresh calculations and checkpoint resumes measure different amounts of work.
Use resume off for fresh-engine comparisons. Compare equal presentations,
fields, monomial orders and degree bounds, and certify outputs before comparing
timings. Warmup, repeated trials and spread are required for tuning conclusions.
Live Wasm allocation includes reserved workspace and differs from total browser RAM.

## Bergman regression checks

Preserve the three assets (`ecl.js`, `ecl.wasm`, `ecl.data`) from a checked
compiled C/ECL build in an ignored local directory. Compare that build with the
current build in fresh, alternating browser runs:

```sh
npm run benchmark:bergman:regression -- \
  --baseline-root local/baselines/bergman/engine
```

The default is three FK6 degree-6 pairs, a 4 GiB requested allowance (4095 MiB
for wasm32), pruning enabled and a 60-second deadline for each cold run.
`--degree 7` provides a longer check. Both versions use the same current host
adapter. Every completed basis must match the saved exact FK6 output. Startup
and computation are recorded separately. A median paired computation slowdown
greater than 15% fails the check; the threshold is configurable.

CPU frequency limits, governor, power source, RAM availability and swap activity
are recorded during each run. A change in power conditions, unmatched settings,
missing output, substantial swapping or excessive timing variation yields an
inconclusive result. Exit codes are 0 for a passed comparison, 1 for a measured
regression and 2 for an inconclusive comparison. Raw conditions remain local.
This check runs separately from release correctness suites and independent
oracles; it does not rerun Singular.

Older timing series did not record CPU power limits. Their absolute times can
reflect changing host conditions. The original and current compiled Bergman
builds were compared again with the same FK6 degree-7 input, heap, pruning and
stable power settings: both returned the same 695-element basis, and two
alternating trials showed approximately equal computation times. That check
supports parity for this workload; it does not establish performance for every
Bergman task. A separate three-pair degree-6 check passed with a median current /
original computation-time ratio of 0.952. Native heap and pruning controls are available in
`tools/diagnose-bergman-native.mjs`; their GC figures must be kept separate from
ordinary performance measurements.

## Runtime controls

More workers can distribute independent reductions; serial insertion and disk
operations limit scaling. Hash tables, scratch space, reducer caches and rewrite
caches trade memory for reduced lookup or reduction work. A larger memory
allowance permits larger jobs; it does not guarantee shorter runs. Engine help
explains the current controls. No universal tuning optimum is claimed.

## Comparing core updates

`node tools/benchmark-fomkyr-update.mjs --baseline-report <completed-comparison-directory>`
measures the current engine only and reuses the saved engine's timings and exact
outputs. Inputs, reported machine and measurement settings must match. Saved
measurements retain their dates; speed ratios can also reflect changes in host
load between sessions. Output audits run after measurement, and the plots use
linear axes.

`node tools/benchmark-fomkyr-update.mjs --baseline-root <saved-engine-directory>`
compares a saved production runtime with the current one. It alternates old/new
cold browser jobs on FK6, its invertibly scaled form, and two q-Serre presentations.
Degrees 1–9 are retained for the growing FK6 forms; coefficient-heavy cases use
selected bounds through 15. The highest bound has three trials in each browser.
Exact output audits run after all measurements. Plots use linear axes and keep
method notes in the reports. The comparison retains earlier unrelated baselines.
