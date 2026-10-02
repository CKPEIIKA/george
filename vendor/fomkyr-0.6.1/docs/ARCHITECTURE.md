# 0.5 architecture additions

See ARITHMETIC_AND_SIGNATURES.md for the Q-specific rational heap, modular factory,
reject-only verification and the research-only signature prototype. The architecture
below describes the retained 0.4 core. Signature-based production scheduling remains
unimplemented; the separate research reference is not that scheduler.

# Architecture and correctness boundaries

The 0.4.0 reducer/index/progress additions and proofs are documented in
[SPEED_AND_PROGRESS.md](SPEED_AND_PROGRESS.md). The persistence/representation
contracts below remain in force.

## Representation and reduction

`src/kernel.c` is freestanding C11. Words up to 31 letters have four bits per
generator in two 64-bit words; longer words are offset-based variable-length byte
arrays within the bounded allocator. Serialized long-word bytes use record-relative
offsets. Degree is a 32-bit index rather than a 20-word representation limit. The order is homogeneous
degree-left-lexicographic with later input generators larger. A shared rule index holds
leaders, degree, offsets and lengths. Full polynomial records can stay in OPFS. The
kernel retains exact coefficient arithmetic from 0.1.0, including compact small integers
and arbitrary-precision fallback; it does not approximate Q with one modular run.

The fast sparse reducer handles suitable short-word monic small-coefficient rows.
Long words use the general exact reducer. Pruning and the sparse-heap path can be
disabled independently; cache percentage and heap entry threshold are configurable. The fraction-free
path preserves ideal membership when this path is unsuitable. Primitive normalization
may rescale a row: this is valid for GB construction over a field, but is NOT an API for
returning an arbitrary physical operator's scalar-preserving normal form. No such query
API is advertised here. Monomial zero rules remove terms containing a proved zero word;
compositions of two monomial zero rules can be discarded. There is no heuristic deletion
of critical pairs on the basis of hashes or numerical smallness.

## Bounded parallel epochs

At each degree, the coordinator enumerates only relevant overlap/inclusion compositions.
`gn_batch_fill` puts up to 512 descriptors in fixed storage and fixes the current basis
snapshot. No unbounded future-pair queue is materialized. A shared atomic fetch-add index
assigns work to `gn_batch_reduce(lane)`. An optional stable cost-order permutation changes dispatch order only; descriptor/commit order stays unchanged. Lane 0 is the coordinator worker; other lanes run
in additional workers. There is one shared WASM memory, not a basis clone per worker.

Workers read the immutable basis and their own scratch/cache/stack. They serialize
nonzero remainders into bounded per-lane output arenas. A zero result consumes no output
payload. The coordinator waits for the epoch, then commits in descriptor order.
`gn_batch_commit` re-reduces every nonzero row using the now-current basis before append.
Thus two workers finding dependent remainders cannot both add them without the second
being checked against the first. Enumeration order/commit order do not depend on which
worker finishes first. Reducer-cache allocation is the main per-lane duplicated state.

If an output arena fills, the epoch is replayed using the earlier single-pair scheduler.
Committed valid relations remain usable. Additional scratch pressure can halve active
lanes. These paths are implemented, but the recorded small-scratch release case did not
trigger `BATCH_OUTPUT_FULL`; it is not a claimed full stress proof of that branch. Serial
commits, irregular task cost and cache contention still limit scaling; see measured data.

## Reducer cache

The former 16 equally sized cache slots were a poor fit for many short reducers. The new
per-lane cache stores variable-size serialized records in a byte-bounded ring. An
in-arena hash directory tracks rule ID, generation and payload offset. Ring wrapping
increments the generation, invalidating old entries without walking all records.
Checksums are checked on loading persistent records. Record pointers are consumed before
the next cache load on that lane. Payloads never exceed the reserved cache arena.
A positive divisor lookup can survive basis append when its referenced rule remains in
the snapshot. Negative cache results must still be invalidated when the basis changes.

## Persistence and identity

`web/storage.js` hashes the semantic input with its order and coefficient field. Degree,
worker count, memory budget and WASM32/64 width do not enter this hash. Equation ordering
currently does enter it; this is not canonicalization of algebra isomorphism classes.

There is one run lock per key. Web Locks prevents overlapping writers and protects UI
deletion; a separate exclusive sync handle gives an additional run-level lock. The basis
handle uses shared `readwrite-unsafe` access for worker reads when that capability
is actually probed. Otherwise an exclusive I/O-owner worker services fixed 64 KiB
mailboxes; compute lanes retain shared multicore execution. A single compute worker
can use the exclusive handle directly. Safety relies on the application rule: only the
coordinator appends, and no compute worker is reading during append.
Other same-origin code must not mutate these files outside this protocol.

At completed degrees, the coordinator flushes the basis prefix and writes one alternating
metadata slot with a SHA256 envelope. Opening a run checks ABI, identity, sizes and the
metadata digest, then restores individual binary records with their checksums. If the
latest slot fails, it tries the previous degree from a reset kernel. Only after a valid
prefix is restored is the uncommitted suffix truncated. If neither candidate works, the
run fails rather than erasing an existing nonempty basis. A caller may explicitly reset
with `resume:false`. Checkpoint checksums detect the tested corruptions; they are not
cryptographic authenticity guarantees or transactions across arbitrary external writes.

The kernel's binary format is pointer-width independent. Shared/unshared, 32/64-bit
and direct/broker/exclusive continuation is tested with the Node file adapter. ABI-3
readers also accept the old short-word ABI-2 checkpoint format.
Legacy ABI-1 namespace data remains separate. Cache hits still load index metadata; they
are not zero-cost. Restoring to a smaller requested degree retains the later completed
checkpoint and reports both values to avoid destructive rewinds.

`web/module-cache.js` caches only the small WASM modules in Cache API, validating SHA256
against `web/build-info.js`. This is independent of the large OPFS polynomial store.
Storage permission is requested on the page thread, not in a dedicated worker.

## Exact Hilbert prefix

For a homogeneous algebra A and a GB completed through D, a K-basis of A_d, d<=D, consists
of words that avoid the leading words of that GB. `src/hilbert.inc` builds an
Aho-Corasick prefix/failure automaton for these forbidden subwords. It then propagates
counts along allowed generator transitions. This is a normal-word *count*, not an
allocation of every word. Space scales with stored leading-word prefixes, not with h_D.
The implementation reserves an upper bound on states equal to 1 plus the sum of leader
lengths, so it is conservative rather than a minimal automaton.

Limb capacity is computed from h_D <= n^D, using a safe integer bit upper bound;
there is no fixed 128-bit counter ceiling. The free-16 example through degree 96
checks a 385-bit count. Array-size and decimal-output bounds are checked before
allocation. JS exports decimal strings; no count passes through an IEEE double. The method is field independent after the GB has been computed over the
chosen field. Changing characteristic can change the GB and Hilbert coefficients.

The automaton can in principle continue beyond D, but those numbers would describe the
currently known monomial relations, not necessarily the input algebra. The host forbids
that extrapolation unless unrestricted GB completion has been proved. After every
original relation has been loaded, completion through at least 2L-1, where L is the
greatest current leading-word degree, covers every inclusion and nontrivial overlap.
The bound is updated when rules are added. A degree with no new rules is not sufficient
on its own. A proved complete finite GB supports longer certified Hilbert prefixes. It reports a certified finite total dimension only after some h_d=0
for d>0: because the algebra is generated in degree 1, A_{d+1} is spanned by A_d A_1, so
all later components then vanish. No assumption of Koszulity is made.

Hilbert working arrays use the same bounded allocator with an additional caller-specified
cap. They are released logically afterwards; WASM linear memory's grown high-water mark
cannot be shrunk. Allocation failure leaves the already completed GB checkpoint intact.
The Hilbert pass itself is currently single-threaded. Multicore applies to GB reductions.

## Memory accounting

The 15,000,000,000-byte global cap and page-rounded WASM maximum bound shared linear memory.
Index blocks, arbitrary-precision data, per-lane scratch/cache/output, stacks and Hilbert
arrays use that budget. Host JS, compiled code, browser process data, kernel page caches
and other tabs do not. The allocator is bounded but this cannot rule out browser/OS OOM.

Some metadata, every input relation imported at once, and an individual active row must
fit the provided scratch space. There is no fully external-memory reduction of one
arbitrarily large intermediate polynomial. Disk quota can also stop the computation.
Streamed text export avoids a giant JS polynomial string but adds another disk copy.
Use `exportText:false` when only the binary basis/Hilbert output is needed during a run.

Future optimizations worth evaluating: degree-dependent batching, block decompression
only if I/O dominates, compact Hilbert automata, and scientifically justified graded
symmetries or signature criteria. None is silently enabled or claimed as implemented.

## Unshared execution and browser fallbacks

Separate `GN_SINGLE` builds contain no shared-memory requirement or atomic operations.
They execute on a dedicated coordinator worker with macro-task yields between bounded
epochs/degrees. Shared builds preserve the atomic work queue and cancellation flag.
A C deadline checks a host clock during long reductions in both modes. Manual messages
in the unshared mode cannot interrupt a synchronous C call immediately.

The host reports chosen capabilities, actual lanes, memory64 fallback, file access mode
and linear-memory high-water bytes. A memory64 fallback also reduces the effective
maximum; it does not pretend a 32-bit module can use a larger address space. Runtime
mailboxes and JS allocations are outside the C allocation ledger.

A scoped optional service worker supports static deployments; see
`BROWSER_COMPATIBILITY.md`. Real browser execution was blocked/unavailable here.
Node feature-negation tests are protocol tests, not Firefox conformance certification.
