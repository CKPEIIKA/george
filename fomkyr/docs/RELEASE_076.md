# Fomkyr 0.7.6

This release combines the cooperative resource and star-profile additions in
[0.7.5](RELEASE_075.md) with the updated exact arithmetic implementation.

## Exact arithmetic

- Binary machine-word GCD and conservative Lehmer batches for larger integers.
- Fused full-precision matrix application, with positivity/decrease checks.
- Direct immutable coefficient allocations and modular-inverse exact division.
- Allocation-free exact quotients fitting in one limb.
- One canonical pivot/leading-coefficient factor shared across each rational
  rewrite, retained across suspension, collection and workspace relocation.

See [arithmetic details](INTEGER_ARITHMETIC.md) and
[resource ownership](COOPERATIVE_RESOURCES.md). Native and all four WebAssembly
variants use the same portable C implementation, with O3/LTO and profiles trained
against the corresponding source snapshot.

## Performance evidence

One isolated completed degree-17 row required the same 24,732,361 rewrites and
returned exact zero in every tested arithmetic generation. Recorded native times
went from 90.15 s before the GCD changes to 46.75 s after GCD changes and 30.79 s
after fused matrix/allocation/division changes: approximately 2.9x for that row.
These were separate sessions; machine load and build configuration matter.

The latest shared-factor/short-quotient candidate used 105.46 s versus 113.47 s
across three fixed prefixes of eight million complete rewrites each, a 7.1%
reduction in aggregate sampled time. Logical word/fraction checksums agreed.
Those are partial normal-form benchmarks taken alongside another computation.
They do not establish a whole-job or browser speedup; their ratios should not
be multiplied to predict a full Gröbner calculation.

## Joined-wave memory handling

Newly parked rows receive their free or resizable reserve leases before the
host declares that no work can progress. This fixes a premature
`ROW_WORKSPACE_LIMIT` with spare budget. The bounded regression now completes
degree-16 Q-Serre with four workers, 6 MiB scratch, three 64 MiB worker reserves
and the separate commit reserve within a 256 MiB engine allowance.

## Correctness and compatibility

Focused checks cover exact Python integer/Fraction oracles, independent small
Q/F2/F101 algebra computations, and native/Wasm retained-row growth, non-monic
rational tails, cooperative suspension, helpers and serial commit continuation.
The release also checks that both JavaScript generator mappings match the
canonical C edge table. Required source helpers, fixtures and linked documents
are included in the source distribution.

Durable polynomial/checkpoint formats are unchanged. Resume keeps accepted
records and durable pending descriptors. An unfinished in-memory row restarts
from its descriptor after an executable switch. Imported dimension assumptions
remain explicit; this release supplies no new FK6 dimension proof.
