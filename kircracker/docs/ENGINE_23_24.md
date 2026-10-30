# Native engine for degrees 23–24

The native word encodings, checked integer-prefix verifier and CLI accept degrees
through 24. Every result still requires its own independently closed bounds and
input prefix. A completed discovery block supplies a lower-bound candidate until
independent replay succeeds.

## Recovery and storage

For exact rational relation searches, see [coefficient storage and bounded row
caches](EXACT_STORAGE.md).

Pairing discovery writes `FKPAIR02` manifests and immutable pivot chunks in the
adjacent `.parts/` directory. New checkpoints append new pivots and publish a
small manifest containing the cursor. Established pivots are stored once. Time limits and interrupt requests also
yield inside derivative traversal and elimination; the unfinished column is
retried from the last committed cursor.
Zstandard compression is enabled when `pkg-config` finds `libzstd`; builds without
it write raw chunks. A compressed journal requires a Zstandard-enabled reader.

Keep the manifest and its entire `.parts/` directory together. Selected `.kcb`
minor files, their accepted audit receipts and their source dependencies are the
mathematical evidence. Recovery journals remain discovery workspace.

Import a saved legacy state into a separate destination:

```sh
python3 tools/import_pair_state.py \
  --source previous.state --source-library /path/to/previous/libpair.so \
  --destination continued.state --task selected-task.json
```

The task supplies the degree, field, candidate counts, file paths and SHA256
bindings. Import validates the old input/library binding, checksum, indices and
normalized triangular rows. It records the new library binding and preserves the
source. The same importer can migrate a bound `FKPAIR02` journal. The imported
state still needs independent minor replay to support any dimension claim.

`--scratch` sets the run's discovery-checkpoint allowance (default 48 GiB), split
among the requested blocks after accounting for existing journals. Disk exhaustion preserves the last published generation.
The allowance covers the new journal payloads; retained inputs, existing evidence
and unrelated workspaces have their own storage lifetimes.

## Scheduling and memory

Discovery and independent verification run in separate processes. Discovery
saves a `.pending.kcp` candidate before returning. The scheduler then admits its
verification using a fresh budget that accounts for the modular square matrix
and polynomial workspace. A failed audit leaves the previous accepted minor and
the pending candidate intact. A candidate's discovery rank is never promoted
when its replay fails.

A partial accepted minor does not complete a search. Repeating discovery
continues at its saved column cursor. If a scan makes no rank gain, the scheduler
retains the accepted witness without replaying the same minor again. Only a
spanned candidate row set or exhausted candidate columns can reuse a completed
search receipt. Completion of a sampled candidate set does not certify the
dimension of the full algebra component.

### Expanding an exhausted sample

`tools/expand_pair_candidates.py` creates a larger candidate pool from a
verified minor and a saved relation-elimination free-word file. The verified
minor's rows and columns come first; extra rows are selected reproducibly from
the whole free-word pool. The tool checks word reversal, permutation grades,
the boundary-preserving S4 transport, and input hashes. Its manifest records
the source evidence and the size of the available union.

```sh
python3 tools/expand_pair_candidates.py \
  --task previous-task.json --audit previous.audit.json \
  --free-words relation-chart/free-words.bin \
  --output expanded-pool --rows 65000
```

Run the resulting task with a **new** discovery journal. Changing the row
stream changes every pivot's coordinates: padding an old journal with zeros
does not give a valid continuation. Keep the previous minor and audit while
the new journal reconstructs their pivot prefix. Only independent replay can
promote an improved rank. The free-word pool need not be independent, and
exhausting it still supplies only a lower bound unless an independently
certified upper bound agrees.

The optional verified-LU cache stores about `4*r*r + 32*r + 32` bytes for a
rank-`r` prefix. A cache budget smaller than this retains only a truncated
prefix; subsequent audits repeat the uncached part. Increase
`KIR_VERIFY_CACHE_BYTES` and the scratch allowance together when that repeated
work dominates. Budget space for both the current and staged cache generation.

The global `-j` and `-m` limits govern both stages; each verifier initially uses
one CPU thread. Fewer concurrent large audits can use more memory per audit.
Candidate inputs use file mappings, and dual words are prepared as they are
consumed. Saved pivots use sparse index/value rows or contiguous dense tails.

## Arithmetic and controls

Optional delayed rank updates and exact elimination of auxiliary chart words
are described in [DEGREE23_BRIDGE.md](DEGREE23_BRIDGE.md).

- Modular suffix discovery and exact integer-prefix replay retain distinct
  derivative recurrences.
- Prefix coefficients use checked signed 128-bit addition. The degree-24 entry
  bound is `24! < 2^80`; the packed words occupy fewer than 128 bits.
- Generation-tagged contiguous accumulators reuse storage between derivatives.
- Finite-field determinant replay chooses sparse updates or blocked panel
  elimination. All reductions are exact modulo the recorded prime.
- Exact rational upper calculations use GMP rational arithmetic. Sparse row
  assembly reuses a thread-local buffer. Native upper checkpoints buffer their
  serialized bytes while preserving the existing format.

Advanced controls:

| Variable | Default | Meaning |
| --- | --- | --- |
| `KIR_TRIE_CACHE_MB` | 64 | Budget for cached short-word deletions per discovery process |
| `KIR_TRIE_CACHE_MAX_DEGREE` | 10 | Longest words admitted to that cache |
| `KIR_DENSE_THRESHOLD` | 0.55 | Convert a pivot to a dense tail above this fill fraction; 1 keeps sparse rows |
| `KIR_POLY_MAX_TERMS` | 0 | Explicit accumulator-term ceiling; 0 uses the allocation budget and index-width limit |
| `KIR_VERIFY_ACCUMULATOR` | `flat` | `flat` or the retained `reference` prefix accumulator |
| `KIR_VERIFY_DETERMINANT` | `auto` | `auto`, `sparse` or `blocked`; auto uses observed matrix density |

These are initial engineering defaults. Performance depends on derivative
support and matrix fill. No total runtime reduction is implied by a successful
build. Discovery progress includes derivative, elimination and checkpoint times,
checkpoint bytes and accounted allocation capacity. Actual RSS is a separate
operating-system measurement.

## Mathematical namespaces

The FK and Nichols presentations retain separate bindings and upper models.
An additional certified Nichols relation may tighten the Nichols model while
representing a nonzero element in the FK algebra. Importing such a relation
requires its own certificate integration; the new kernel does not infer new
relations or dimension targets from a conjectured Hilbert series.

## Focused upper charts

The native `kir-relative` executable accepts `--target-grades g0,g1,...`, using
lexicographic permutation indices (0 is identity). It builds the backward
sector-dependency mask for the requested final degree. Wrong-parity and
unreachable targets are rejected. Every relation is checked for homogeneous
permutation degree before sector elimination.

Scoped modular checkpoints use the distinct `KKRSCOP1` magic and a persistent
scope descriptor. They resume only with the same final targets and degree. The
normal whole-degree assembler rejects that checkpoint type; a focused chart
requires its own scope-aware certificate aggregation. The standard CLI upper
pipeline continues to request all sectors.

A private GMP development prefix can be supplied as `make GMP_PREFIX=/path/to/gmp`.
It must contain the matching headers and libraries under `include/` and `lib/`.
`make check` accepts the same setting. System packages remain the default.

## Reduce the chart before expanding pairing pools

A saved spanning chart can contain generators already killed by certified
lower-degree rewrite rules. A bounded normalization pass can detect these cheaply:
record every successful zero's contextual rewrite identity, and replay it exactly
before changing a bound. Time, support and rule-size limits leave a word unresolved.
An incomplete nonzero normal form supplies no independence certificate.

If the existing replayed relation matrix has known echelon pivot columns, distinct
zero words in its free-column set give additional independent unit rows. This
reduces the quotient upper bound without rebuilding a pairing matrix. Preserve
word direction and module boundary when reusing a normalizer. The validity of its
input rules remains a separate certificate dependency.

The dashboard can display a separately replayed upper certificate through
`VERIFIED_UPPER_OVERLAY.json` in a run directory. Its adoption pointer contains
`path` and `sha256`; the certificate uses schema `kir-certified-bound-overlay-1`,
`passed: true`, the matching `degree`, and integer `B6.upper` and `FK6.upper`.
This presentation layer pins an already approved certificate; it does not replace
its verifier or update the running solver's internal bounds.

### Exact remainder dependencies

A successful rewrite proof gives `word = remainder` in the module even when the
rewrite rules are incomplete. Equal or proportional nonzero remainders therefore
give certified binomial relations between chart words. Exact sparse elimination
can also detect dependencies involving several remainders. Every accepted zero
residual must retain its contextual rewrite trace and exact elimination factors.

Process each source word once per pass. If a zero residual depends only on earlier
accepted source words, its relation has coefficient one on a new source column.
These distinct newest columns prove independence over Q. Combining different
passes requires rank accounting: duplicate constraints must not be added twice.
Unit and binomial constraints can be combined conservatively using a weighted
forest; general relations require exact elimination or taking the strongest
independently established bound.

Use bounded discovery phases, independent replay, explicit resource-limit states,
and a finite queue of changed inputs or methods. An exhausted pairing family
must stay closed until a richer family or stronger bound is supplied. A moving
column cursor is not evidence that the certified interval is shrinking. Completed
queues must be shown as completed rather than as a live or stalled controller.

Saved higher-degree rules can strengthen a partial normalizer without completing
a new basis. Admit only individually proved rules, bind their provenance and raw
record hashes, and preserve the immutable lower-degree foundation. This does not
certify completeness of the larger obstruction set.
