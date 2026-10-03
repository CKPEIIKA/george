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
Reports and plots are generated locally and are excluded from source packages.

Fresh calculations and checkpoint resumes measure different amounts of work.
Use resume off for fresh-engine comparisons. Compare equal presentations,
fields, monomial orders and degree bounds, and certify outputs before comparing
timings. Warmup, repeated trials and spread are required for tuning conclusions.
Live Wasm allocation includes reserved workspace and differs from total browser RAM.

## Runtime controls

More workers can distribute independent reductions; serial insertion and disk
operations limit scaling. Hash tables, scratch space, reducer caches and rewrite
caches trade memory for reduced lookup or reduction work. A larger memory
allowance permits larger jobs; it does not guarantee shorter runs. Engine help
explains the current controls. No universal tuning optimum is claimed.

## Comparing core updates

`node tools/benchmark-fomkyr-update.mjs --baseline-root <saved-engine-directory>`
compares a saved production runtime with the current one. It alternates old/new
cold browser jobs on FK6, its invertibly scaled form, and two q-Serre presentations.
Degrees 1–9 are retained for the growing FK6 forms; coefficient-heavy cases use
selected bounds through 15. The highest bound has three trials in each browser.
Exact output audits run after all measurements. Plots use linear axes and keep
method notes in the reports. The comparison retains earlier unrelated baselines.
