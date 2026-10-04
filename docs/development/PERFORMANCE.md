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

## Fomkyr native and browser execution

`tools/diagnose-fomkyr-wasm.mjs` compares addressing modes, cold engines and
warmed engines in Chromium and Firefox without a debugger. Timed calculations
start with fresh algebra; warm-up calculations are discarded. Full text bases
must agree exactly. Each browser job has an external 120-second watchdog, and
the raw report records source hashes, CPU time, sampled PSS and local power
conditions. Use matching, stable conditions when comparing configurations.

```sh
node tools/diagnose-fomkyr-wasm.mjs --degree 10 --trials 2 \
  --workers 4 --memory-mib 3584 --out local/benchmarks/fomkyr-diagnostics
```

An optional `--configs FILE` accepts a JSON array of configurations with `id`,
`browser` (`chromium` or `firefox`), `options` and an optional `warmup` flag.
`--engine-url` chooses the coordinator; `options.wasmURL` can select a saved
kernel while retaining that coordinator. Native comparisons use
`tools/benchmark-fomkyr-native.mjs` with the same presentation and settings.
Builds, correctness checks and timed runs execute separately.

The [packed word measurements](../benchmarks/fomkyr-packed-words.json) cover
FK6 through degree 10 with four workers and a 3584 MiB allowance. Profiling
identified row insertion, zero pruning and radix-heap access as major costs.
The kernel now scans words of length at most 16 using their single 64-bit
representation. Longer words retain the general implementation. Boundary
properties, exact field arithmetic and oracle parity checks cover both paths.

This optimization also benefits native C. Native results use O3, LTO, profile
training and host instruction tuning, while browser code generation is handled
by the browser. The measurements do not isolate each compiler or runtime cost.
Wasm32 used less CPU for this case at an allowance that fits its address space.
The FK6 preset uses automatic addressing; allowances exceeding the Wasm32 limit
select Wasm64. High-degree speed and memory behavior require separate evidence.

### Wasm profile-guided compilation

The browser build also uses a retained frontend profile collected from real
Wasm execution. Training covers FK6, a q-Serre presentation, homogenized Weyl,
large coefficients and two prime fields. Shared and single-thread function
hashes are retained. Native builds keep their separate build procedure.

```sh
LLVM_PROFDATA=llvm-profdata-23 WASM_PGO=1 npm run wasm:build:fomkyr
```

`WASM_PGO=1` requires matching source checksums, compiler major version and
`llvm-profdata`. `WASM_PGO=0` builds ordinary O3 + LTO. The default `auto` enables
PGO when these requirements are met and reports a fallback otherwise. Every
profile function must match during compilation. The build manifest records
whether PGO was actually used and the text profile checksum.

The [Wasm PGO measurements](../benchmarks/fomkyr-wasm-pgo.json) keep the native
executable fixed. Matched FK6 degree-10 pairs show approximately 12% lower
elapsed time in Chromium and 6% in Firefox with Wasm32; corresponding Wasm64
observations show approximately 11% and 9%. Power changes exclude several
pairs, leaving one or two pairs per configuration. These are local observations
with limited samples. A substantial browser/native gap remains.

Multivalue calls, broader inlining, alternative nibble scans, explicit unrolling
and unit-coefficient specializations did not produce a consistent additional
gain and were left out of the shipped kernel.

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

The [Bergman Wasm PGO experiment](../benchmarks/bergman-wasm-pgo.json) applies
frontend profiles to the same compiled Bergman C functions, with the ECL runtime
unchanged. Three alternating FK6 degree-7 pairs returned the saved exact
695-element basis in both browsers. Cold elapsed time fell by approximately 9%
in Firefox and rose by 3% in Chromium. The candidate module was 3% smaller.
The production Bergman assets remain unchanged; a profile trained on this one
presentation is insufficient to justify a general default. Broader inlining
was abandoned during compilation and has no runtime result.

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
