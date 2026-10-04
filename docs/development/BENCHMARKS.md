# Free-algebra benchmark suites

Correctness regressions and performance measurements have separate entry points.
Routine release checks use FK6 degrees 1–6 and small structural guards. Long FK6
degree 9, 10 and 11 runs belong to the benchmark catalog. Extended recovery and
sanitizer audits remain correctness tests under `release:check --full`.

## Catalog

The literature ladder follows [f4ncgb, Section 8 and Table 3](https://arxiv.org/html/2505.19304v1).
Inputs are pinned to the [authors' repository](https://gitlab.sai.jku.at/f4ncgb/f4ncgb/-/tree/f152bb0d040d7947d4296f9d68ca849ee135629c/test_inputs)
and retain its MIT license. The field is Q, the order is degree lexicographic,
and the bound includes ambiguities of the stated degree. Generator priorities
follow the MS headers; Singular's `Dp` variable list is reversed, as in the
upstream exporter. Published timings are external observations, not measurements
of Fomkyr.

| Case | Degree | Suite |
|---|---:|---|
| 4nilp5s | 10 | priority, stress |
| braid3 | 16 | priority, stress |
| braidX | 18 | stress |
| braidXY | 12 | stress |
| lp1 | 15 | priority, stress |
| serre-e6 | 17 | priority, stress |
| serre-ha11 | 17 | stress |
| lv2d10 | 100 | stress |
| holt_G3562h | 17 | overnight |
| malle_G12h | 100 | unsupported by Fomkyr; Singular can run it |

The original `malle_G12h` fixture treats `a1` and `a2` as generators, with mixed
word lengths in its Hecke relations. It is retained verbatim and produces an
explicit unsupported result for the homogeneous engine. A rational
specialization would define a different benchmark.

`physics` contains four-dimensional Sklyanin at (2,3,-5/7), a homogeneous cubic
down-up algebra, and the two four-generator examples from
[Gateva-Ivanova, Examples 2.10 and 2.11](https://arxiv.org/html/1011.6520).
Example 2.10 is a non-PBW quantum-binomial algebra whose associated map fails
YBE; Example 2.11 satisfies YBE and requires completion in our chosen order.
Tests check YBE on all triples and the non-PBW assertion for all 24 permutations.
Sklyanin has the independent dimension oracle
`dim A_d = binomial(d+3,3)`; down-up has series `1/((1-t)^2*(1-t^2))`.
The presentations follow the [Macaulay2 constructor](https://macaulay2.com/doc/Macaulay2/share/doc/Macaulay2/NCAlgebra/html/_four__Dim__Sklyanin.html)
and [Benkart–Roby](https://arxiv.org/html/math/9803159).

The inhomogeneous [BMW A3 example](https://gap-packages.github.io/gbnp/doc/chapA_mj.html)
is deferred. Its quotient dimension 105 is not an oracle for a presentation
obtained by simply homogenizing its relations.

## Commands

Run from the George repository root, after building the native executable:

```sh
make -C fomkyr
npm run benchmark:stress -- --list
npm run benchmark:stress -- --suite priority --smoke --check
npm run benchmark:stress -- --suite fk6 --engines fomkyr,chromium,firefox
npm run benchmark:stress -- --cases lp1 --timeout-seconds 600 --check
```

`--smoke` selects small degree bounds to check input handling; it does not
substitute those bounds for the hard acceptance targets. Default measurements
have a 120-second cap and 4096 MiB allowance. Workers, degree, timeout and memory
are explicit options. `--engines singular` requests fresh timed Singular runs;
`--check` instead reuses successful independent references whenever possible.
Audits run after all timed computations and have their own deadline.
`--acceptance` enables checks and exits unsuccessfully if any selected run is
unfinished, unsupported, or lacks a passing independent audit. If a reference
hits its deadline, other engines on that identical input do not repeat the
failed oracle calculation in the same session.

The published large-run protocol uses 30,000,000,000 bytes and 12 hours. An
explicit comparable native budget is `--memory-mib 28611 --timeout-seconds 43200`.
Browser runs retain a separate allowance of at most 15360 MiB. Those memory
controls cover different allocations; the reports record both allowances.
Starting this profile is a deliberate long-run action:

```sh
npm run benchmark:stress -- --suite stress --memory-mib 28611 --timeout-seconds 43200
npm run benchmark:stress -- --suite overnight --memory-mib 28611 --timeout-seconds 43200
```

Each measurement records wall seconds, CPU core-seconds, sampled peak PSS,
GNU-time peak RSS where available, degree, workers, input/build digests and full
output paths. Successful native exits use GNU time for CPU and peak RSS. After
a forced or failed exit the report uses process-tree samples, records their
source, and marks sampled peaks as lower bounds. Native wall time includes process startup and durable export;
browser wall time includes engine startup and result delivery. Browser PSS
includes its processes. Wasm allocation capacity is a separate quantity.

Reports distinguish computation completion, independent audit success, timeout,
OOM, unsupported input and incomplete audit. An audit mismatch is a failure.
`performancePassed` requires every selected computation to complete within its
cap. It is separate from `acceptancePassed`, which also requires independent
audits. A reference timeout does not change a completed Fomkyr timing.
Computation timeouts, OOMs, and engine errors return a failing exit status even
without `--acceptance`.
Large checks compare exact bounded leading ideals and mutual ideal membership
with Singular; exhaustive composition certificates are added through degree 6.
Imported FK/Hilbert dimension assumptions are disabled for these measurements.

Raw measurements, hardware diagnostics, outputs and caches stay in ignored
`local/benchmarks/` and `local/oracle-cache/`. `--resume` requires identical inputs,
builds and run settings. Existing rows keep their original measurements; they
are not reported as fresh timings.
