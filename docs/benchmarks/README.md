# Fomkyr 0.6.6: native C and browsers

![FK6 time and physical RAM](fomkyr-0.6.6-native-browser.svg)

[SVG](fomkyr-0.6.6-native-browser.svg) · [PDF](fomkyr-0.6.6-native-browser.pdf) ·
[PNG](fomkyr-0.6.6-native-browser.png) · [Protocol and measurements](fomkyr-0.6.6-native-browser.json)

FK6 over ℚ uses its original 15-generator order and 100 quadratic relations.
Native C, Chromium and Firefox use four workers, a 4 GiB kernel allowance,
automatic workspace, monomial pruning, 128-pair batches and ordinary exact
completion. Each point starts a fresh job; no cached computation or Hilbert
closure is used. A 120-second deadline applies to every run. All runs finished.

Native C uses GCC O3/LTO, local instruction-set tuning and PGO. Its training
cases are FK6 through degree 8, affine q-Serre q=2 through degree 14, and
homogenized Weyl through degree 7. Degrees 9–10 extend beyond the FK6 training
bound. Wasm64 uses Clang O3/LTO. Builds and measurements run serially; portable
and tuned GCC/Clang candidates were measured separately before selecting PGO.

Time includes parsing/initialization, completion, checkpoints and full text
export. Browser launch is excluded. Native has three trials per degree;
browsers have one through degree 7 and three for degrees 8–10. Curves use medians
and bands show the complete time range. Host load affects wall time.
Native RAM is OS peak RSS. Browser RAM is process-tree PSS sampled every 250 ms,
including the browser and proportionally counted shared pages. Brief browser
peaks can be missed. The allocation allowance is separate from physical RAM.

All 62 outputs matched exact leading words, input membership and mutual ideal
membership against saved FK6 references. Degree prefixes through 9 reuse
archived independent results; degree 10 uses historical Fomkyr consistency
records with verified identity and hashes. Distinct bases through degree 4
also pass independent critical-pair certificates. Singular was not rerun.
The comparison describes these engine workflows and this presentation.

# Historical 0.6.4 comparison

![Elapsed time and peak physical RAM](fk6-0.6.4.svg)

[SVG](fk6-0.6.4.svg) · [PDF](fk6-0.6.4.pdf) · [PNG](fk6-0.6.4.png) ·
[CSV measurements](fk6-0.6.4.csv) · [Settings and engine hashes](fk6-0.6.4.json)

## Setup

The input is [the FK6 fixture](../../test/fixtures/fomin-kirillov-user.json):
15 generators, 100 homogeneous quadratic relations, exact rational arithmetic,
degree followed by left lexicographic order. Every degree 1–10 was measured
separately, with fresh engine state, no checkpoint reuse and Hilbert counting off.
Degree 1 measures the empty linear prefix and primarily reflects startup costs.

There are 50 serial measurements: ten degrees in each of two browser Bergman
addressing modes, browser Fomkyr, native Bergman/SBCL and Singular/Letterplace.
Each configuration has one cold run per degree. Browser runs use Chromium 153.
CPU power limits were not recorded in this series. Later controlled checks
found that changing power conditions can shift both browser and native times
substantially. Use these measurements as observations of the recorded runs;
use the [paired Bergman check](../development/PERFORMANCE.md#bergman-regression-checks)
to investigate code regressions.
Both Bergman hosts use George's fixed bergman 1.001 port.
Fomkyr 0.6.4 uses memory64, four workers, automatic memory, batches of 128 pairs
and its default reduction optimizations. Bergman uses monomial pruning and quick
low-term handling. Singular 4.4.1 uses `redSB` and `intStrategy`.

Both C/ECL O3 + LTO modes were measured. The plot selects the faster completed
mode at each degree and takes RAM from that same run. Wasm32 was faster through
degree 8; both modes reached the cap at degrees 9 and 10, where the figure shows
the wasm32 observations. The CSV retains both modes.

## Time and RAM

Elapsed time includes cold engine startup, calculation and text export.
Browser launch and page rendering are excluded. The full-output reread used
for auditing a truncated browser preview is also excluded from elapsed time.
All completed outputs, including large bases, were retained and checked.

Physical RAM is the peak sum of proportional set size (PSS) across each
process tree. Shared pages are proportionally counted. This includes browser
and runtime memory; Wasm's reserved linear memory capacity is a separate
quantity. Browser RAM was sampled every 250 ms and native RAM every 20 ms,
so brief peaks can be missed. CPU seconds in the CSV use process-tree sampling
for browser and interrupted native runs, and GNU time for completed native runs.

Each run has a 120-second cap and a 2 GiB allowance. Browser kernel/Lisp heap,
SBCL dynamic space and Singular virtual address space constrain different
allocations. Crosses represent timeouts or heap exhaustion. Their RAM values
are partial observations. Native SBCL exhausted its heap at degree 9 and
reached the time cap at degree 10; higher degree bounds can follow different
allocation and collection paths.

At degree 8:

| Engine | Elapsed time (s) | Peak PSS (MiB) |
|---|---:|---:|
| Browser Bergman C/ECL | 53.21 | 775.4 |
| Native Bergman/SBCL | 17.21 | 854.5 |
| Singular/Letterplace | 28.17 | 13.3 |
| Browser Fomkyr 0.6.4, four workers | 2.50 | 502.9 |

Fomkyr completed degree 9 in 2.79 s and degree 10 in 8.85 s, producing 1,451
and 2,155 basis elements respectively. Other engines did not finish those
degrees within the chosen limits. Fomkyr's exports have primitive coefficients
and retain earlier polynomial tails; Bergman and Singular export reduced monic
bases. This comparison measures the complete engine workflows with these output
conventions. Parallel worker count, browser overhead, one-run variability and
the presentation affect the ratios.

## Output checks

All 42 completed runs passed exact leading-word comparisons, input membership
and mutual ideal membership checks. Fresh C/ECL, SBCL and Singular outputs
supply cross-engine references through degree 8. Degree 9 uses the recorded FK6
reference. Degree 10 uses historical Fomkyr 0.3 records, with presentation
identity and SHA-256 checks and independent Python record decoding.

Distinct bases through degree 4 also pass independent critical-pair certificates.
Higher-degree checks provide consistency evidence. The degree-10 historical
comparison does not supply an independent Gröbner certificate. Exact normal-word
counts are checked after measurement.

The fresh Singular outputs at degrees 2–8 also match the previously saved
Singular leading words and the complete saved FK6 polynomial bases exactly.
Earlier Singular timings used a fallback arithmetic path: every saved run
warned that `p_Procs_FieldQ.so` was unavailable. The current runs load the pinned
rational-arithmetic module. For example, the older degree-8 run took 78.12 s,
whereas the current run took 28.17 s. The figure uses the fresh timings throughout.

## Reproduce

The benchmark tools require Linux `/proc`, Chromium, a prepared native SBCL
Bergman build and the pinned Singular installation described in
[performance measurement](../development/PERFORMANCE.md). Run the phases
serially; output checking and plotting follow measurement.

```sh
node tools/benchmark-backend-resources.mjs \
  --out local/benchmarks/fk6-current \
  --input-file test/fixtures/fomin-kirillov-user.json \
  --degrees 1,2,3,4,5,6,7,8,9,10 \
  --configs compiled,memory64,fomkyr \
  --memory-mib 2048 --timeout-seconds 120 --trials 1

node tools/benchmark-native-resources.mjs \
  --out local/benchmarks/fk6-current --timeout-seconds 120 \
  --sbcl-root build/sbcl-reference

node tools/audit-backend-resources.mjs local/benchmarks/fk6-current/report.json
python3 tools/plot-fk6-comparison.py local/benchmarks/fk6-current/report.json
```

Use `--resume` for an interrupted browser phase only while the input, engine
files and measurement settings remain identical. Raw reports, process traces
and machine identifiers remain in ignored local directories. The public data
contains the settings, measurements and engine hashes needed to interpret the
figure.
