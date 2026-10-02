# Degree completion and tuning, 0.3.0

## No arbitrary degree-20 limit

A finite integer target D requests degree-by-degree completion through D. `target:null`,
and George's blank maximal-degree field, request no user-selected bound. The finite
word-storage limit has been removed: <=31 letters remain packed, and longer words use
budgeted variable-length byte arrays referenced by offsets. The long representation is
shared-memory/pointer-width independent and serializes into checked records.

The API still uses u32 indices and rejects values above 4,294,967,294. Record byte counts
and several table indices are u32 as well. This is not literally infinite storage.
Under the 15 GB memory policy these representation limits are normally much less relevant
than intermediate basis growth, an active row, scratch and disk quota. Long-word prefix
construction can be expensive; the optimized short-word heap reducer does not handle long
words yet. No claim of unchanged performance at large word lengths is made.

The text parser preflights expanded words against a host input budget instead of letting
`a^4294967294` attempt a multi-gigabyte JS allocation. This is a tunable byte budget,
not a newly disguised algebraic degree-20 ceiling. A direct fixture is already allocated
by its caller; the library cannot retroactively bound that caller's allocations.

## What “complete” proves

`complete:true` means the requested bounded computation finished. It is **not** by itself
proof that the whole unbounded Gröbner basis is complete. That separate flag is
`unrestrictedBasisComplete`.

After all original relation degrees have been loaded, let L be the greatest leading-word
length of the current basis. Every inclusion composition has length <=L and every
nontrivial overlap has length <=2L-1. If the exact degreewise completion has processed
through at least 2L-1 without increasing that necessary bound, no unprocessed critical
ambiguities remain. This is the conservative stopping certificate used here. For no
relations, the free algebra is already complete at degree 0.

If another basis rule is introduced, L and the required bound are recomputed. One degree
with no new rules is NOT treated as completion. Input relations of a later degree are
not discarded simply because current critical pairs have run out. The implementation
can therefore prove completion on simple finite-GB examples, but a problem with infinite
GB can continue until cancellation or a resource/representation limit.

## Hilbert extension

Dynamic integer-limb capacity is bounded using h_d <= n^d for n generators. There is no
fixed 128-bit count limit. The host reconstructs exact BigInts and exports decimal
strings. For example, the tested free algebra with 16 generators gives h_96=2^384,
a 385-bit integer.

Before unrestricted completion is proved, requesting coefficients above the completed
GB degree is not valid. Optional Hilbert failure reports `available:false` and preserves
the completed GB; `hilbertRequired:true` instead reports an error. Once completion is
proved, a higher finite Hilbert prefix can be counted from the same leading-word
avoidance automaton. No rational-series extrapolation is inferred from sample numbers.
The automaton and integer arrays use a separate budget within kernel memory; decimal
export has a conservative host output budget (32 MiB by default).

## George controls

| Existing control | fomkyr meaning |
|---|---|
| Native workers | CPU lanes, including coordinator; 0=automatic, up to 32 |
| Monomial pruning | Exact zero-word and zero-pair shortcuts, optionally disabled |
| Memory limit | Kernel budget; capped and reduced if a WASM32 fallback is necessary |
| Time limit | Worker cancellation plus a C deadline; not a promise of instant interruption |
| Maximal degree | Integer bound, or blank for completion without a user bound |
| Series degree | Exact Hilbert prefix requested; must be certified |
| Coefficient field | Q or a supported prime characteristic, never an implicit substitution |
| Reverse variables | Changes generator order and therefore leading words/cache identity |
| Unit weights | Blank or one `1` per generator |
| Low-terms quick/safe | Equivalent for homogeneous input; no lower-degree terms exist |

Bergman's pruning checkbox originally emits SETREDUCTIVITY to manage Lisp monomial
storage. The installer prevents those commands for fomkyr and passes the actual boolean
to its separate exact pruning implementation. It does not delete old reducers merely
because a degree has finished. Irrelevant/unimplemented modes are rejected.

## Advanced controls / API options

| Option | Default | Valid range / interpretation |
|---|---:|---|
| `execution` | `auto` | `auto`, `single`, `multicore` (strict isolation requirement) |
| `bits` | `auto` | `auto`, 32, 64; auto keeps 32-bit for budgets in its range |
| `ioMode` | `auto` | probe direct handles, or force `broker`; `direct` falls back if unsupported |
| `heapReduction` | true | enable short-word sparse heap path; general exact fallback retained |
| `heapThreshold` | 16 | 1..1,048,576 terms before attempting that fast path |
| `cachePercent` | 12 | 0..40 percent of each lane's workspace |
| `hashBits` | 18 | 8..26; larger lookup tables consume memory up front |
| `batchPairs` | lanes × 8 | 1..512; 0 uses the lower-memory per-pair scheduler |
| `scratchBytes` | min(budget/3, 512 MiB) | >=1 MiB per lane and strictly below kernel budget |
| `hilbertBudgetBytes` | 256 MiB | extra allowed Hilbert workspace, clipped to remaining kernel budget |
| `hilbertOutputBudgetBytes` | 32 MiB | conservative maximum decimal prefix output |
| `inputBudgetBytes` | min(32 MiB, budget/16) | host parser expansion budget; integer strings/word arrays |
| `exportText` | true | false avoids a separate text copy; binary basis remains in OPFS |
| `storageFallback` | true | false fails instead of using RAM when OPFS cannot initialize |
| `strictCapabilities` | false | reject memory64/worker initialization performance fallbacks |
| `resume` | `auto` | auto reuse; true requires a valid cache; false explicitly resets that key |

More lanes divide available scratch more thinly and can hurt uneven reductions. Larger
batches reduce messaging but retain more nonzero outputs until commit. More cache reduces
I/O misses at the cost of less row workspace. There is no universal fastest setting;
start with defaults and examine reported cache reads, lane load and fallback counters.

The API supports additional host safeguards such as `diskLimitBytes`, preview byte limits
and I/O timeout; not all are exposed as original George fields. No F4/F5/signature pruning,
GPU path, weighted order, general inhomogeneous completion or full external-memory row
reduction is claimed by these options.
