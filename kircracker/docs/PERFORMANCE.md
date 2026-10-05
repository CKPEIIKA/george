# Performance and storage design

## Implemented changes relative to the degree-18 research scripts

1. Generalized degree selection through the verifier's proved limit 20. Paths,
   metadata, seed catalogs and original/Nichols namespaces are no longer hard-coded
   to degree 18. Degree20 can extend the degree19 run in the same workspace.
2. The native builder uses packed 128-bit words rather than a heap allocation for
   each `vector<uint32_t>` word. Its mathematical row recurrence is unchanged.
3. Immutable per-degree binary checkpoints store action maps and words. The previous
   multi-gigabyte map JSON is not written or parsed. GF2 action records omit coefficients
   known to be one. Restoring a degree checks input binding, counts, word/group grades,
   term ordering, checksums and the prior-level shape.
4. Upper grade jobs are dispatched by estimated size, without changing operations
   within a grade or the global free-coordinate order. Both fields and serialization
   are checked against the old native implementation at small degrees.
5. Candidate words are streamed from the native files. Only orbit representatives
   enter the lower search; the full set of multiplication maps never enters Python.
   Candidate bookkeeping is logically budgeted. Unsupported blocks remain incomplete.
6. Verified lower certificates store selected words, grade transports and a determinant,
   **not** enormous dense matrix JSON. The matrix is independently recomputed on replay.
7. Prefix verification constructs its trie once and uses narrow exact-integer tiles.
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

These are implementation facts, not claims of a measured total speedup at degree 19/20.

## 32 GB planning

Use an SSD and retain at least several tens of GB of free disk space for high-degree
checkpoints, proof replay and logs. The exact disk consumption depends on generated
map sparsity. Monitor `du -sh ~/fk6-work`. A disk-full failure leaves the prior immutable
checkpoint; it does not complete the active degree.

24 GiB leaves approximately 8 GiB of physical RAM outside the selected process budget.
This is a planning choice, not a guarantee that every degree20 row fits or that the OS
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
* One discovery block supports up to 10,000 candidate rows in the inherited kernel.
  Exceeding that bound produces an incomplete result, not a dimension claim. The code
  and scheduling limits would need a tested extension if degree20 exceeds it.
* Checkpointing is at native degree boundaries and at verified minor-block boundaries,
  not at arbitrary arithmetic instructions.
* Caches bind code/data and avoid repeating successful work, but a previously saved
  number alone is never used as a native matrix result or a derivative minor.

No guarantee of “overnight” completion follows from the degree18 timings. The new
frontier may need more computation or a new structural/certificate idea.

## Primary algorithm and platform references

Blasiak, Liu and Mészáros, *Subalgebras of the Fomin-Kirillov algebra*:
https://arxiv.org/html/1310.4112v2

Linux cgroup-v2 resource-controller documentation:
https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html

GCC x86 code-generation options (`-march=native` portability warning):
https://gcc.gnu.org/onlinedocs/gcc/x86-Options.html

The upstream paper does not contain this project's later nonzero-Q proof or the
new numeric degree18 profile. Those remain explicit inherited research dependencies.
