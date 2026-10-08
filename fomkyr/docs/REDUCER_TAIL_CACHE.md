# Optional canonical reducer cache

Enable with `--reducer-tail-cache 256M`, or **Engine → Caches → Canonical
reducer cache** in George. The default is `off` / `0`. Enabled allocations must
be at least 16 MiB and remain inside the total memory allowance.

The ordinary record caches retain original reducer polynomials. This cache
stores derived reducers whose tails have been exactly normalized against the
completed lower-degree basis. A smaller or simpler tail can avoid repeated
rewrites during later normal forms. The leading word, rule ID, original record
and checkpoint identity stay unchanged. Cached leading coefficients are used
in the exact rewrite ratio.

Half the allocation stores immutable derived records; half provides a separate
preparation workspace. Automatic memory planning leaves room for both. Requests
are bounded and demand driven. The coordinator attempts one requested reducer
between reader waves, with a soft 20 ms reduction slice. Oversized, unfinished,
nonminimal or growing representations are declined. Ordinary exact reduction
continues. Preparation cannot borrow a parked row's workspace or reserve.

Each normal form pins the cache publication generation. A suspended rewrite
therefore sees the same reducer and tail cursor after it resumes. Preparation
uses an otherwise unused lane; the cache is available with up to 31 computation
workers and declines with 32. No worker is removed to enable it.

The cache is ephemeral. It is rebuilt on resume, so changing its allocation or
disabling it needs no checkpoint conversion. Original saved polynomials remain
available for verification and export. Candidate certification uses original
records.

Result/progress metadata under `reducerTailCache` reports the requested and
admitted bytes, storage/workspace sizes, hits, misses, attempted/built/declined
reducers, saved terms/bytes and preparation time. Native time counters in this
object are integer microseconds; normal elapsed-time displays use seconds.

No general speedup is established. Compare elapsed time and useful completion
progress with the cache off and on from the same saved checkpoint. A cache can
reduce tail work while leaving less memory for active rows. Start with a modest
allocation and inspect `built`, `hits` and preparation time before increasing it.

## Checks

`python3 tests/test_tail_cache.py` builds native kernel properties and compares
cache off/on against the independent exact oracle over ℚ, F₂ and F₁₀₁. It
checks immutable raw records, publication during a parked rewrite, both sparse
queues, optional memory refusal and pending-pair filtering without a matcher.
`python3 tests/test_tail_cache.py --wasm` additionally checks all four Wasm
variants and cross-runtime partial resume. Each solver case has a 120-second
deadline; these checks do not recompute high-degree FK₆.
