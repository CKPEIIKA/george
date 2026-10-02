# Historical 0.2.0 benchmarks (not remeasured in 0.3.0)

The measurements below are retained for context. Their raw outputs now live in
`results/v0.2.0/`. The 0.3.0 release does not claim a new browser or large-degree
speedup factor; its current tests are correctness/compatibility checks.

# Bounded benchmark, fomkyr 0.2.0

FK6 through degree 8, Q, same generator order, 990 rules; three fresh runs per setting.
Real WASM32 plus shared worker threads in Node v22.16.0. Disk I/O goes through the Node
filesystem adapter, not browser OPFS. CPU reports AMD EPYC 9V74 80-Core Processor, 5 logical
CPUs visible to this container. Eight lanes therefore oversubscribe that visibility.
128 MiB kernel budget, 32 MiB scratch, hashBits=16, disk mode, no Hilbert or text export in
these timing trials. The elapsed timer covers computation after engine initialization;
it is not a cold browser startup/module-load benchmark.

| CPU lanes | Pairs/epoch | Median elapsed (ms) | Median parallel-reduction phase (ms) | RPC messages |
|---:|---:|---:|---:|---:|
| 4 | 0 (legacy) | 833.908 | 700.768 | 11493 |
| 1 | 8 | 866.386 | 844.592 | 0 |
| 2 | 16 | 544.298 | 489.721 | 962 |
| 4 | 32 | 404.853 | 284.792 | 1451 |
| 8 | 64 | 523.773 | 267.600 | 1703 |

Four lanes with batching are about 2.14x faster than one lane, and about 2.06x faster
than four lanes using the earlier single-pair scheduler in the *same current build*.
The RPC count decreases from 11,493 to 1,451 (about 7.9x). These comparisons do not isolate
every optimization, compare against Bergman/Singular, or predict degree-20 behavior.
Eight lanes are slower on this host; the default is therefore four, not all reported CPUs.
No statistically strong general scaling claim is made from three short repetitions.

The new small-scratch test completed degree 8 with 9,488,528 kernel-allocated bytes within
a 32 MiB budget and 4 MiB scratch; no scheduler fallback occurred in that particular test.
A separate native 6 MiB budget test stops safely during degree 9 with 6,290,328 allocated
bytes against 6,291,456 permitted. Browser total RSS is outside this allocator guarantee.

`results/fomkyr-benchmark.json` contains every trial, timings, work distribution, disk-read
counts and allocation counters. `tests/benchmark_fomkyr.mjs` reproduces the series.

## Validation boundary

Real WASM32/64 execution, cross-width resume, queue/legacy comparison, independent exact
Fraction checking through degree 4 (265 rules, 1,558 critical compositions), small Hilbert
examples, 80-bit counts, cache corruption recovery and cache lock semantics passed.
Node emulates OPFS and Web Locks. The attempted Chromium run was blocked by the host
navigation policy (`ERR_BLOCKED_BY_ADMINISTRATOR`), so actual browser OPFS, memory64 and
frontend behavior remain to be verified. Installer tests use source-shaped fixtures.
The native UBSan run covers the native reference path, not an instrumented browser or
all new batch/Hilbert branches. New full FK6 degree-10/20 runs were not performed.
Historical 0.1.0 degree-10 data is labelled and kept separately under `reference/0.1.0/`.
