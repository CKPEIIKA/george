# Performance and storage design

The updated pairing engine, journal format, degree-24 arithmetic bounds and
separate audit processes are described in [ENGINE_23_24.md](ENGINE_23_24.md).
The implementation history below describes the preceding degree-22 engine;
its former limits and checkpoint granularity are superseded where specified.

## Implemented changes relative to the degree-18 research scripts

1. Generalized degree selection through the verifier's proved limit 22. Paths,
   metadata, seed catalogs and original/Nichols namespaces are no longer hard-coded
   to degree 18. Degree22 can extend degrees 19--21 in the same workspace.
2. The native builder uses packed 128-bit words rather than a heap allocation for
   each `vector<uint32_t>` word. Its mathematical row recurrence is unchanged.
3. Immutable per-degree binary checkpoints store action maps and words. The previous
   multi-gigabyte map JSON is not written or parsed. GF2 action records omit coefficients
   known to be one. Restoring a degree checks input binding, counts, word/group grades,
   term ordering, checksums and the prior-level shape.
4. Upper grade jobs are dispatched by estimated size, without changing operations
   within a grade or the global free-coordinate order. Both fields and serialization
   are checked against the old native implementation at small degrees.
5. Candidate words are streamed from the native files, and representative left rows are
   written directly to fixed-width binary shards instead of retained as Python objects.
   Only orbit representatives enter the lower search; the full set of multiplication maps
   never enters Python. Candidate bookkeeping is logically budgeted.
6. Discovery now returns only selected row/column indices and does **not** retain its dense
   selected matrix. Verified lower certificates store selected words, grade transports and
   a determinant. The independent prefix verifier reconstructs every accepted entry and
   determinant from scratch.
7. Prefix verification constructs its trie once and uses narrow exact-integer tiles. Degrees
   21--22 use signed 128-bit exact coefficients; 22! < 2^71 is the audited growth bound.
   Only the modular square matrix needed for the determinant is retained. Elimination
   updates the nonzero positions of each pivot row instead of scanning zero terms.
   This does not change the determinant or acceptance condition.
8. Independent blocks use memory-weighted scheduling and no nested all-core pools.
   Each worker has a POSIX address-space guard. The upper process is isolated and
   sequential with respect to the lower phase. Resource failure never supplies a zero.
9. Exact group-graded finite-factor convolution is in native C++, with overflow checks
   in 128-bit accumulators. No approximate arithmetic is used for dimension totals.
10. Native CPU compilation, separate process/degree logs, cache fingerprints, interruption,
    and a refusal to overwrite another active run are exposed through the CLI.

These are implementation facts, not claims of a measured total speedup at degree 21/22.

## 32 GB planning

Use an SSD and retain at least several tens of GB of free disk space for high-degree
checkpoints, proof replay and logs. The exact disk consumption depends on generated
map sparsity. Monitor `du -sh ~/fk6-work`. A disk-full failure leaves the prior immutable
checkpoint; it does not complete the active degree.

24 GiB leaves approximately 8 GiB of physical RAM outside the selected process budget.
This is a planning choice, not a guarantee that every degree22 row fits or that the OS
will never kill a process. `doctor` reports the actual detected limits and currently
available memory; `-m auto` also reduces the budget on a busy system. Swapping can ruin
performance long before a numerical algorithm fails; do not allocate all 32 GB blindly.

`-j auto` leaves one available logical CPU when unconstrained, but respects tighter
cgroup/affinity quotas. On a six-core CPU, compare six and eleven workers on the same
saved input. Hyperthreads are not additional full cores, and all-core multiplication
of child pools is deliberately avoided. Native memory bandwidth and block density can
make the fastest worker count smaller than the available hardware-thread count.

Limits that can still block progress:

* The original native relation library may yield an upper space larger than the true
  relative module; the current tool does not invent new identities to close that gap.
* The candidate dual family can be rank-deficient; `--dual-mode both` is one extension,
  not proof of completeness of the search.
* One discovery block supports up to 50,000 candidate rows. Its scheduler accounts for
  quadratic modular-verification storage and refuses a block whose estimate does not fit
  the selected budget. Candidate duals are capped at two million. Exceeding either bound
  produces an incomplete result, not a dimension claim.
* Checkpointing is at native degree boundaries and at verified minor-block boundaries,
  not at arbitrary arithmetic instructions.
* Caches bind code/data and avoid repeating successful work, but a previously saved
  number alone is never used as a native matrix result or a derivative minor.

No guarantee of “overnight” completion follows from the degree18 timings. The new
frontier may need more computation or a new structural/certificate idea.

## Reusing independent verification

Long pairing continuations can set `KIR_VERIFY_ENTRY_CACHE=1`. A successful
independent integer audit then saves a hash-bound, exact modular LU minor. When
the next candidate contains those row and column words, verification computes
the added blocks and their Schur complement. Word permutations and determinant
signs are accounted for explicitly. Missing, incompatible or damaged caches
cause a full replay. Discovery checkpoints never supply verification entries.

The first audit must build the cache. `KIR_VERIFY_CACHE_BYTES` defaults to 3 GiB
per block; a larger minor retains a nonsingular pivot prefix that fits. One
current matrix generation is retained, together with small provenance receipts.
The scheduler budgets both current and replacement cache generations alongside
discovery journals. Accepted minor files contain the original words and exact
modular determinant, so `KIR_VERIFY_ENTRY_CACHE=0` permits full independent replay
without the cache.

Admission reserves the dense matrix plus 1.5 GiB for workspaces, increasing the
reservation from observed process high-water memory. The process hard limit
retains more headroom. When available host memory falls below half the slack
left outside the worker budget (between 256 MiB and 2 GiB), and more than one
worker is active, the newest discovery worker yields to its journal. It is
resumed with backoff once memory allows, and at most three times per block;
admission also waits for real free memory. `KIR_VERIFY_WORKSPACE_BYTES`
can increase the admission allowance for unusually large derivative supports.

Cached LU uses exact integer arithmetic modulo the selected prime. Its `auto`
mode observes fill during elimination and switches from sparse updates to
blocked updates. `KIR_VERIFY_LU_MODE=sparse` or `blocked` allows a controlled
comparison. The dashboard distinguishes entry replay from factorization.

Enable the cache in the controller's environment before launching workers.
The scheduler also sets the worker flag explicitly when a task receives a
cache allocation. Already-running audits keep their original verification path;
their first successor audit builds the cache before later extensions can reuse it.

The dashboard places audited Hilbert and Nichols gaps above the worker table.
It records bound changes and minute samples in `audited-gap-history.jsonl` in
the selected run directory. The display includes gap reductions over ten minutes
and one hour, total reduction from the first saved observation, and provisional
rank gains awaiting audit. Missing historical samples are shown explicitly.
Gap reduction percentages describe the bound interval; they do not measure the
fraction of computation completed or supply an ETA.

An optional [relation pilot](RELATION_PILOT.md) eliminates defining-relation
consequences contained in a saved word chart before further pairing work.
It records replayable modular relation minors and counts omitted contexts.
Its verified result supplies an upper bound within the retained spanning-chart
certificate chain; it does not assert a complete basis or exact dimension.

## Primary algorithm and platform references

Blasiak, Liu and Mészáros, *Subalgebras of the Fomin-Kirillov algebra*:
https://arxiv.org/html/1310.4112v2

Linux cgroup-v2 resource-controller documentation:
https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html

GCC x86 code-generation options (`-march=native` portability warning):
https://gcc.gnu.org/onlinedocs/gcc/x86-Options.html

The upstream paper does not contain this project's later nonzero-Q proof or the
new numeric degree18 profile. Those remain explicit inherited research dependencies.
