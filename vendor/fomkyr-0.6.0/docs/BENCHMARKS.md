# fomkyr 0.4.0: measured speed and reporting cost

These are matched **actual shared WASM32** computations, not native-to-WASM
comparisons, browser measurements or timings of Bergman/Singular. Each entry is the
median of three fresh runs, in alternating sequential processes on the same host.
Both source trees were built with the same Clang `-O3 -flto` toolchain.

## FK6 over Q

The original ordered 15-generator / 100-relation presentation is unchanged.
Timings are cumulative through the degree in the first column.

| Through degree | Lanes | 0.3.0, seconds | 0.4.0 with live progress, seconds | Ratio old/new |
|---:|---:|---:|---:|---:|
| 9 | 1 | 6.060 | 3.398 | 1.78x |
| 9 | 4 | 2.133 | 1.147 | 1.86x |
| 10 | 4 | 18.501 | 11.702 | 1.58x |

Host: AMD EPYC 9V74, five logical CPUs visible to the container, Node v22.16.0.
128 MiB kernel budget, 32 MiB reduction scratch, `hashBits=16`, default batch
`8 * workers`, word cache 256 entries. Node's filesystem adapter emulates OPFS.
Compilation/worker startup precedes the timed section. No Hilbert or text export;
degree checkpoints are included. The benchmark listener collects progress events,
not DOM rendering. Browser CPU/OPFS/JIT costs and a user's renderer can differ.

The comparison includes all default optimizations together. It is not a separate
causal timing experiment for each individual feature. Three repetitions provide
limited noise information, not confidence intervals or a universal speedup guarantee.

## Live instrumentation is not literally free

Both rows below use 0.4.0, four lanes, otherwise identical options.

| Through degree | Progress on median, s | Progress off median, s | Median difference | Observed on range, s | Observed off range, s |
|---:|---:|---:|---:|---:|---:|
| 9 | 1.147 | 1.072 | +7.0% | 1.133–1.179 | 1.068–1.074 |
| 10 | 11.702 | 12.512 | -6.5% | 11.354–12.292 | 11.874–12.982 |

A negative difference is **not** evidence that telemetry accelerates algebra: the
measurement includes scheduling/host variation. Do not interpret these limited
trials as a hard upper bound on instrumentation cost. The degree-9 slowdown is
measurable in this round. `progress:false` removes live snapshots and overlap-total
preparation; degree-completion events remain. The produced degree-10 binary bases
with reporting on/off were compared byte-for-byte and are identical.

The default live interval is 1000 ms. It limits event/renderer work, not all kernel
accounting; increasing the interval alone does not eliminate snapshot overhead.

## Where the work remains

Through degree 10 the new kernel produces 2,155 rules and still executes
56,010,668 general-reducer steps. The old path records 158,835,429
steps. The new pre-rewriter performs separately counted exact operations, so these
are not total arithmetic-operation counts. Only 928 overlaps
were removed by the new chain criterion; it is not the whole explanation of the
speedup. In this trial reduction phases took 12.071 s
and serial commits 0.036 s. The reduction timer also
contains I/O and worker synchronization; it is not a cycle-accurate CPU profile.

At degree 9/10, old and new outputs have the same 1,451/2,155 leading words.
One/fifteen unreduced tails differ; both directions of ideal reduction are verified
using separate Python Fraction arithmetic. This is larger-case differential
verification, **not** an independently recomputed complete FK6 basis to degree 10.
Independent construction/composition checks for the original FK6 presentation reach
degree 4; additional algebra/field cases are listed in `physics-matrix.json`.

The maximum-degree representation improvements from 0.3.0 remain. They do not
remove the combinatorial and coefficient growth of this problem. FK6 through
degrees 15–20 was not run. No measured time for those degrees is claimed.

## Reproduce

Unpack `reference/fomkyr-0.3.0-source.zip` into a separate directory, locate its
`fomkyr/` root and rebuild both versions with the same toolchain. Then run:

```bash
bash tools/build.sh
bash tools/verify_release.sh
python3 tests/benchmark_speed.py --baseline /path/to/pristine-0.3.0/fomkyr --repeats 3
python3 tests/benchmark_degree10.py --baseline /path/to/pristine-0.3.0/fomkyr --repeats 3
```

Do not run timing trials concurrently with tests or other compute-heavy work.
`results/speed/` retains raw trials, binary bases, actual event traces, summarized
measurements and exact differential checks. `results/exploratory-speed/` contains
older trial rounds and cache/batch probes; they are not the final benchmark table.

See `SPEED_AND_PROGRESS.md` for the chain-criterion justification, settings, progress
semantics and the signature/modular research directions that are not yet implemented.
