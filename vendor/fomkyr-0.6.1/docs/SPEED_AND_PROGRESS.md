# fomkyr 0.4.0: exact speed changes and measured progress

This release changes reduction/indexing/scheduling, not the coefficient field or the
requested algebra. It remains a homogeneous, degree-left-lexicographic two-sided
Gröbner-basis enumerator with exact Q or exact prime-field coefficients. It is not F4,
F5, a modular reconstruction algorithm, or a polynomial-time algorithm for FK6.

## What changed

### Leading-word matcher

`src/matcher.inc` builds an immutable Aho-Corasick index from current leading words at a
degree barrier. Dense transitions use at most 16 generator symbols. A query selects
the shortest divisor and then its leftmost occurrence, preserving the previous
length/position lookup convention. The first occurrence of a globally shortest
leader allows an early exit. Exact word equality remains mandatory for hashed paths.

Rules appended after the index snapshot are still searched through the exact index.
An index from a later snapshot is never used for an earlier snapshot. An optional
index memory limit cannot delete mathematics: retain the older immutable index and
check the unindexed rules, or use the original exact hash search. The allocation
ledger includes abandoned geometric-growth buffers. Matcher and chain criterion
can be disabled independently.

### Lower-degree chain criterion: why a pair may be skipped

Write the degree-D ambiguity word as W = LM(f) r = l LM(g), and divide the two
contextual polynomials by their leading coefficients to obtain monic contextual
polynomials F and G. If another leading word LM(h) occurs strictly inside W, write
its corresponding monic contextual polynomial as H. Then

    F - G = (F - H) + (H - G).

The joint support intervals of LM(f) and this interior occurrence of LM(h) omit the
last letter of W. The intervals for LM(h) and LM(g) omit its first letter. Therefore,
each interacting ambiguity is in a proper substring of W, of degree below D; disjoint
reductions commute. All lower degrees have already been completed. Their resolved
compositions have representations using words strictly below the corresponding
ambiguity; multiplying by the omitted contexts preserves that strict inequality.
Thus the degree-D composition already has a standard representation and may be
omitted. Occurrences touching the endpoints are excluded by construction.

This is a sufficient homogeneous chain criterion. It is not a heuristic based on a
hash, a floating-point residual, a same-degree duplicate, or the commutative LCM
criterion. In the tested FK6 case it skips only a modest fraction of pairs; most of
the speed gain comes from the reducer rather than a spectacular pair-count reduction.

### Exact simplification before heap insertion

Only proved relations are used. A known square x_i^2 = 0 immediately kills words
containing adjacent equal generators. More generally x_i u x_i is zero if every
letter of u is known to skew-commute with x_i by a nonzero field scalar: move x_i
through u and use x_i^2 = 0. Unknown commutators are never assumed zero.

Known monic quadratic binomials are oriented in the chosen order and applied before
inserting terms into the sparse heap. They strictly lower the word. Coefficient
multiplication is checked; overflow of the immediate representation does not wrap
and is not rounded. Stop the shortcut at the still-equivalent term, and use the
existing arbitrary-precision/fraction-free path when needed. Nonmonic relations do
not use the monic shortcut. This can change the unreduced tails of stored basis
polynomials. Therefore correctness tests compare ideals by exact mutual reduction,
not only byte hashes or rule counts. The exported basis still says `reduced:false`.

### Parallel dispatch

Leading-word prefix buckets now include the target rule degree. The shared queue
remains bounded by 512 descriptors. Inside a batch, larger input records are scheduled
first by a stable bounded sort; commits remain in original descriptor order. This is
only a load-balancing heuristic, not an algebraic criterion. A nonzero worker result
is still re-reduced by the coordinator against all already committed relations.
The option is `costScheduling`; disable it to compare dispatch strategies. Sorting
is omitted with a single lane.

Larger batches sometimes improve occupancy, but can increase output-buffer pressure.
The default stays at eight descriptors per lane, with the existing bounded fallback.
The actual largest active row can dominate a whole batch; extra idle workers cannot
split that row in this implementation.

### Additional memory is not automatically additional speed

`wordCacheEntries` configures a per-lane exact word-to-divisor cache (power of two,
256..1048576). It does not cache approximate coefficients or arbitrary normal forms.
All extra cache memory is budgeted and limited to budget/16, with smaller-table
fallback. Exploratory 16384/65536-entry FK6 runs did not beat the small cache, so
**the default remains 256**. Do not confuse this cache with the serialized-polynomial
reducer cache controlled by `cachePercent`. The default matcher budget is
min(total budget/16, 64 MiB).

## Progress without inventing total completion

The kernel tracks the current degree's raw overlap count using degree-keyed prefix
bucket populations. This visits suffix/prefix groups, not a second list of all pairs.
The denominator includes pairs later proved redundant by monomial/chain criteria.
A resolved overlap is either committed (including a zero remainder) or validly pruned.
At degree completion the kernel verifies seen == total and committed == scheduled.
A same-degree rule cannot introduce a new proper degree-D overlap, so the denominator
is fixed for the completed lower-degree snapshot. Replay explicitly resets the pass.

There is no whole-job percentage derived from currentDegree/target. The current count
fraction is NOT a fraction of remaining runtime: pair costs are highly unequal, and
future degrees can be much harder. UI text labels the bar as overlap count.

Sampled counters provide activity while a large reduction has not finished. Each lane
publishes a small cache-line-aligned snapshot (atomic in shared-memory builds), normally every 256 reduction
iterations. The coordinator polls these snapshots; it never walks another lane's
mutable polynomial. Clock/JS pulses are sampled sparsely. This can report progress
while a synchronous WASM reduction is running. A single unusually long operation can
still delay an update; there is no real-time latency guarantee.

A publication callback acknowledges whether it emitted a sample; this prevents the host
and engine throttles from starving live updates after a forced phase event. Actual
unshared WASM calls are covered by a regression test, not only timer simulations.

Defaults are one live update per second, plus bounded phase/degree transitions. Event
payloads are small and contain counters, not basis copies. The main-thread panel
replaces its previous text; it does not append unbounded per-pair logs. The option
`progress:false` removes live telemetry and the count-preparation pass. A bad progress
callback is caught and recorded as `progressError`, not allowed to invalidate a
successful algebra computation.

Current-degree timing estimates require a warm-up and recent resolved-overlap samples.
The displayed range is a heuristic scenario, NOT a statistical confidence interval or
an upper bound. It is withdrawn after a long unresolved batch or when observed
per-overlap costs differ too much (greater than eightfold). Zero pair work does not
mean checkpoint/export work is finished. The phase says input, indexing, reducing,
committing, checkpoint, Hilbert, export or done.

Whole-job ETA remains unknown. After at least three consecutive nontrivial measured
degrees, the event payload may include a *conditional* projection at most two degrees
ahead. It never extrapolates degree 10 to degree 20 and never estimates an unbounded
request. History contains at most eight degree timings. This is intentionally less
confident than an attractive but unjustified countdown.

### API example

```js
const engine = new FomkyrEngine({
  workers: 4,
  wordMatcher: true,
  chainCriterion: true,
  eagerPruning: true,
  quadraticRewrite: true,
  costScheduling: true,
  wordCacheEntries: 256,
  progress: true,
  progressIntervalMs: 1000,
  onEvent(event) {
    if (event.type === 'progress') {
      // All count strings remain exact beyond Number.MAX_SAFE_INTEGER.
      const {phase, currentDegree, completedThroughDegree, overlaps,
             activity, eta} = event;
      renderOneProgressPanel({phase, currentDegree, completedThroughDegree,
                             overlaps, activity, eta});
    }
  }
});
```

`renderOneProgressPanel` is the caller's renderer; the George installer connects the
included `progress-view.js` renderer automatically. Null ETA means unknown, not zero.
Progress APIs are not exact scalar-preserving normal-form APIs for arbitrary physical
operators: basis rows may be rescaled to primitive form during GB construction.

## Correctness matrix and evidence levels

The machine-readable results distinguish native exact tests, serialized actual WASM
output checked independently in Python, and larger old/new differential checks.
The physical algebra test matrix includes:

- polynomial algebra in four commuting generators and exterior algebra in six;
- one/two-mode homogenized Weyl algebras, with a central degree-one t;
- homogenized Euclidean Clifford algebra on four generators, g_i^2=t^2;
- homogenized sl2, [h,e]=2te, [h,f]=-2tf, [e,f]=th;
- q-oscillator examples, including large coefficient and nonmonic stress identities;
- FK3, complete FK4, the user's original FK6 order, a homogeneous braid relation;
- words beyond the old packed length, prime characteristics 2 and 101, and random
  mixed-degree presentations as additional algorithmic checks.

There is no identification of these finite algebra tests with experimental validation,
complete EFT counting, gauge/trace/IBP projection, or a proof of FK6 through degree 20.
The matrix derives expected PBW Hilbert coefficients by counting the chosen ordered
monomials, and checks completion/critical compositions with separate Fraction/modular
implementations. Prime-field calculations are separate exact algebras, never used as
an uncertified replacement for Q.

## Compatibility and upgrade

Four O3/LTO modules remain: shared/unshared WASM32/WASM64. No new browser API or external
service is required. Existing cross-origin-isolation and OPFS/broker/RAM fallbacks
remain. ABI-3 binary records and input identity semantics are unchanged; valid older
checkpoints can be restored. Performance controls and the progress model are not part
of the algebra identity. Update JS and WASM together. A stale service-worker asset is
rejected by the WASM checksum instead of silently mixing builds.

The published site has not been changed by this package. The installer validates
recognized source shapes and provides a dry run. Real Firefox/browser deployment must
not be inferred from the Node filesystem adapter. See BROWSER_COMPATIBILITY.md for the
previous browser-environment restrictions and release-validation.json for this run.

## What still requires a different scale of algorithm

The current improvements remove avoidable work but do not change the potential growth
of a noncommutative Gröbner basis. To address substantial rational coefficient swell,
a future implementation should compare signature-assisted modular reconstruction plus
exact verification against the direct exact path. A single prime is insufficient.
Noncommutative signatures also require substantially more than adding a commutative
F5 check: their overhead and potentially infinite signature bases matter. Neither
signatures nor modular reconstruction are implemented in this release.

Primary research consulted:

- Hofstadler and Verron, *Signature Gröbner bases, bases of syzygies and cofactor
  reconstruction in the free algebra*, arXiv:2107.14675v2 (2021).
  https://arxiv.org/html/2107.14675v2 . Their prototype illustrates that reducing more
  pairs does not alone guarantee a faster implementation.
- Hofstadler and Levandovskyy, *Modular Algorithms For Computing Gröbner Bases in Free
  Algebras*, arXiv:2502.11606v1 (2025), https://arxiv.org/html/2502.11606v1 . The paper
  specifically addresses why the ordinary commutative modular recipe does not simply
  transfer to potentially infinite free-algebra bases.

These references motivate the research directions, not the numerical benchmark values.
All timings in BENCHMARKS.md come from the bundled executable trials.
