# Large-row parallelism

This is a source review and an implementation plan. The scheduler changes below
have not been applied to the solver.

## Current Fomkyr bottleneck

The shared exceptional-row workspace has one owner. In
[`brow_promote()`](../../fomkyr/src/big_rational_nf.inc), a reduction that cannot
acquire `S.reserve_lock` keeps its exact continuation and returns `GN_YIELD`.
The owner retains the lock across cooperative yields because its live nodes,
coefficient pools and pending rewrite occupy that workspace.

[`gn_coop_reduce()`](../../fomkyr/src/cooperative.inc) resumes the task in
`C.assigned[lane]` before taking another descriptor. A lane waiting for the
reserve therefore cannot execute a fresh pair, even when ready descriptors
remain. The elastic window expands when lanes exhaust ready work; assigned
reserve waiters do not meet that condition.

Consequently, one large exact reduction can keep the remaining lanes waiting
for memory. Rewrite counters can continue increasing while committed overlaps
and component counts stay unchanged. The degree display alone cannot
distinguish this state from an inactive calculation.

The node capacity is already budget-driven and configurable through
`--big-row-max-terms`. Increasing its ceiling permits larger rows but does not
create additional independent workspaces. Increasing lookahead also leaves
the reserve ownership constraint in place.

## What f4ncgb does

Reviewed repository: [dmg-lab/f4ncgb](https://github.com/dmg-lab/f4ncgb), commit
`333bcbf6b3c977a5a68f2ec99ba5a47dfd01b652`, branch `bl/portability`.
This is a fork; the [authors' repository](https://gitlab.sai.jku.at/f4ncgb/f4ncgb)
and the pinned benchmark inputs are identified separately in
[BENCHMARKS.md](BENCHMARKS.md).

- [`gauss_elim()`](https://github.com/dmg-lab/f4ncgb/blob/333bcbf6b3c977a5a68f2ec99ba5a47dfd01b652/src/linear_algebra.cpp#L470)
  uses a thread-local dense `int64_t` buffer for each worker. Rows enter a shared
  thread-pool queue. New pivots are published atomically; a competing row
  continues reducing if another task has already installed its pivot.
- [`reduction()` and `symbolic_preprocessing()`](https://github.com/dmg-lab/f4ncgb/blob/333bcbf6b3c977a5a68f2ec99ba5a47dfd01b652/src/f4.hpp#L518)
  assemble shared monomial columns and reducer rows for a batch. This makes
  array-based matrix arithmetic possible.
- [`multimodular_gauss_elim()`](https://github.com/dmg-lab/f4ncgb/blob/333bcbf6b3c977a5a68f2ec99ba5a47dfd01b652/src/linear_algebra.cpp#L591)
  performs matrix elimination modulo several primes, combines images with CRT,
  and reconstructs rational entries. It retries with more primes when
  reconstruction or its height-based verification fails.

These mechanisms explain a concrete architectural difference: modular rows
use bounded-size coefficients and independent worker buffers. Adopting them
requires an F4 matrix path. The shared queue itself would not remove Fomkyr's
exclusive reserve ownership. f4ncgb also waits for all row tasks at the end of
an elimination phase, so a final expensive row can still leave a parallel tail.

The paper's [Sections 6.1–6.2](https://arxiv.org/html/2505.19304v1#S6) explain the
parallel elimination and matrix-local rational reconstruction. The optional
tracer skips rows that vanished modulo the first prime; the authors explicitly
state that this makes correctness probabilistic. An exact Fomkyr path must
disable that shortcut or certify every skipped dependency. Proofs of output
ideal membership alone do not certify that all required ambiguities vanished.

## Changes to implement first

1. **Separate parked continuations from execution lanes.** Keep every waiting
   row's nodes, coefficients, cursor, pivot and pending rewrite intact. A lane
   can then take ready work using a separate bounded helper workspace. Never
   reset the arena containing a parked row to start another task.
2. **Provide budgeted independent exceptional workspaces.** Admit additional
   large rows only when structural arrays, coefficient pools and arithmetic
   scratch all fit the configured budget. Preserve sufficient space for the
   current largest row. A fixed equal split can make that row stop fitting.
3. **Make reserve pressure a scheduling state.** Track ready tasks, running
   tasks, workspace waiters and output waiters separately. Extend the window
   when executable work is exhausted, and stop expanding when memory or the
   descriptor limit prevents useful work. Avoid repeatedly retrying the same
   unavailable lock at a high rate.
4. **Preserve exact commit semantics.** Helper reductions use an immutable
   basis snapshot. Commit remains ordered, with exact re-reduction against
   newly committed rules. An unfinished descriptor remains unfinished in a
   checkpoint. Imported component dimensions retain their explicit assumption
   status.

The native and Wasm engines share this code. Workspace admission must use the
actual configured budget in each build; browser address-space limits remain
part of admission. The automatic capacity policy and explicit term ceiling
must continue to work in both builds.

## Larger algorithmic candidate

An optional exact modular F4 path could reduce repeated rational coefficient
work and share symbolic preprocessing across pairs. Its reconstruction boundary
should be each finite matrix, with a verified reconstruction criterion. A
whole free-algebra basis reconstructed from a few modular runs needs a separate
correctness argument. Dense buffer memory is proportional to the shared column
count per worker, and must be included in the budget.

## Acceptance evidence required for a scheduler patch

- A small deterministic reproduction with one reserve owner, several reserve
  waiters and executable cheap pairs. Demonstrate completed helper work while
  the original row retains its continuation.
- Equal completed bases and exact composition checks across worker counts,
  uninterrupted execution and checkpoint/resume. Include cancellation while
  a row is parked and while a helper output awaits commit.
- Tight-memory cases with multiple large rows: bounded total memory, no live
  arena reuse, correct fallback, and no claim that an unfinished row completed.
- Native, Wasm32 and memory64 checks. Keep long FK6 bounds in the benchmark
  suite and use the nilpotent, braid and Serre families to check generality.
- Measure worker occupancy, reserve-wait time, completed speculative tasks,
  committed overlaps, row peak terms and peak process memory. Higher CPU use
  counts as an improvement only when useful progress and wall time improve.
