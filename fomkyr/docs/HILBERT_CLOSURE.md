# fomkyr 0.6.6: optional Hilbert-guided degree closure

## Decision and scope

Direct exact completion remains the default. Version 0.6.5 only displayed the
FK6 normal-word gap; it did not close a degree from a dimension target. This
release implements optional Hilbert-guided degree closure,
in the production C kernel, native pthreads coordinator and four WASM builds.
The relative-module computation and symmetry-sector oracle are NOT ported.
No modular/signature engine is made automatic.

There are two intentionally different authorities:

* `--hilbert-certificate FILE`: replay explicit integer covectors against all
  contexts of the ORIGINAL relations, then verify their independent pivot minor.
* `--assume-hilbert FILE`: explicitly accept an external dimension statement.
  This is not a replayable mathematical certificate. All outputs and checkpoints
  are labelled `conditionalOnExternalDimensions:true` with its document hash.

Both modes are opt-in. Published dimension fixtures are not automatically loaded
by the ordinary solver, and the existing passive FK6 reference never stops work.
The feature is not uniformly faster: it can avoid a long zero-reduction tail,
while counting, evidence replay, and changed batching can cost time elsewhere.
Measure ordinary and assisted modes separately for each presentation.

## Mathematical condition

Let F=K<x_1,...,x_n>, I the homogeneous input ideal, and G a set of exact
consequences of the input. Fix an admissible order and let N_d(G) be the length-d
words not containing any leading word of G. Each reduction replaces a word by
smaller words, so it terminates. Because G is contained in I, the images of N_d(G)
span (F/I)_d even if G is not yet a Groebner basis. Therefore

    dim_K(F/I)_d <= U_d := |N_d(G)|.

If an independent argument supplies L_d <= dim_K(F/I)_d and L_d=U_d, these spanning
words are linearly independent. Any degree-d critical composition belongs to I;
a terminal remainder is a linear combination of N_d(G) representing zero, hence
is the zero polynomial. All still-unprocessed compositions of that degree may
be bypassed. Lower degrees must already be complete and all original relations
of the current degree must have been loaded. Nothing follows about degree d+1.

Membership of generated G in I is preserved by the production engine's exact
construction, as in ordinary mode. The lower-bound replay is not a separate
proof-assistant verification of every kernel instruction or derived polynomial.

This is NOT the invalid argument using ranks of original relations modulo p:
rank over F_p <= rank over Q gives an UPPER bound on a rational quotient dimension.
The implemented covectors instead annihilate the original relation space and have
an independent nonzero minor, giving the required LOWER bound.

## Exact lower-bound replay format

`tools/hilbert_certificate.py` independently constructs small witnesses using
Python Fraction elimination of all original relation contexts. It does not read
the production basis. The C checker enumerates the same original contexts without
using that elimination code. It verifies, for each integer functional phi_i,

    phi_i(a f_j b)=0    for every |a|+deg(f_j)+|b|=d.

On designated distinct pivot words, the evaluation matrix must be diagonal with
nonzero diagonal entries. Thus the functionals are independent on the quotient.
Over Q the arithmetic uses checked exact two-limb signed-128 sums of signed-64
products. Overflow is a rejected witness, never rounding or modular acceptance.
In a prime field the same identities and nonzero minor are checked in that field.

The certificate is tied to the exact original presentation, ordered generator
list, field and semantic order identifier by the algebra identity. The prototype
format caps JSON at 64 MiB, one dense replay vector's workspace at 64 MiB, degree
at 32 and free-word column indices at uint32. These are certificate-format limits,
NOT computation-degree or coefficient-precision limits of the direct solver.
Its independent builder deliberately refuses more than 20,000 free-word columns.
It is NOT a scalable FK6-degree-14 lower-bound construction.

The schema is 1, with `kind:"integer-duals"`, `identity`, `modulus`, `source`, and
ordered `entries`. An entry contains `degree`, decimal-string `dimension`, sorted
`pivots`, and sparse `vectors` of `[wordColumn, "integerValue"]` pairs. Entries may
cover only a finite prefix or selected degrees; other degrees run normally.

For `kind:"external-dimensions"`, entries contain only degree and dimension.
Neither the `source` string, a matching hash, nor a user-entered known coefficient
is treated as a replayed proof. The explicit `--assume-hilbert` flag is required.
An obviously inconsistent dimension greater than U is rejected. A plausible but
incorrect external value need not be detectably wrong, hence the conditional label.

## Counting and scheduling

The count uses the existing forbidden-word automaton at a reader-free degree or
restored frontier. When all lower degrees are complete, each newly committed
current-degree leading word is distinct and removes exactly one current-degree
normal word. A cheap counter then tracks U without rescanning the basis at every
polynomial reduction. Before closing, the full automaton count is recomputed;
closure requires exact agreement with both the incremental count and the bound.

The optional gate supports uint64 bounds and uses at most 256 MiB of its logical
counting workspace, further bounded by remaining kernel budget. If the count is
too large or workspace is unavailable, that gate is declined and ordinary exact
completion continues. Default Hilbert counting still uses its arbitrary-size
counters; no new global degree limit is imposed.

A bound-aware lookahead optionally shortens a near-complete batch:

    batch_limit = min(requested_limit, max(active_workers, 2*(U_d-L_d))).

This reduces speculative work likely to be discarded after equality is reached.
It is enabled only with the opt-in Hilbert mode. Disable it with
`--hilbert-fixed-batch`, or `hilbertClosureBatching:false` in JS. Ordered commit and
exact re-reduction against the updated basis remain in place. A different batch
size can change unreduced tails, so compare canonical results, not only raw bytes.

Events distinguish `notYetEnumerated` from `scheduledNotCommitted`.
`overlapsBypassed` is their sum. A scheduled result may already have been computed
before closure; do NOT interpret all bypassed overlaps as avoided reductions.
Native/WASM work counters and wall time are recorded separately. The gap U-L is
not a runtime percentage or an ETA; it is an exact missing-leader count only when
L is the exact dimension and lower degrees are complete. With a mere lower bound,
it is an upper bound on that deficit.

## Persistence and trust

Binary basis records remain ABI 3 and partial cursors remain frontier ABI 1.
Checkpoint metadata is bounded at 1 MiB, including up to 1,024 closure events.
Assisted CHECKPOINT METADATA uses ABI 4 and stores the evidence document SHA256,
authority mode, conditional flag and closure events. Every resume revalidates
that authority; replayable witnesses are replayed again. Missing or changed
authority is rejected BEFORE the job's basis file can be truncated or reused.
Policy files are copied into the job as `hilbert-evidence.json`, but resume still
requires explicit authorization, rather than inferring user consent from a file.

The native and JS supplied evidence documents hash identically and exchange
checkpoints in the tests. Keep the SAME evidence JSON: this is a strict document
hash contract, not an attempt to identify every equivalent JSON spelling.

IMPORTANT: do not open ABI-4 assisted jobs with 0.6.5 or older. Older software may
ignore the unknown assisted metadata and fall back to an earlier ordinary degree,
losing progress. This release cannot retroactively make an older executable reject
new files. Use separate job directories or copies, not in-place downgrades.

A closed degree is finished before publishing its checkpoint. Active polynomial
heaps are still not serialized; committed work survives, uncommitted tasks replay.
Native/WASM cross-mode and cross-bitness resume remain supported, subject to the
same explicit evidence and the ordinary memory/field/order requirements.

## User interface and examples

The native CLI and JavaScript API accept optional Hilbert evidence. George's
current form uses ordinary exact completion. Its RAM, workers, pruning, order,
field, deadline, degree and storage controls remain authoritative.

```sh
make -j4

# Ordinary exact completion: no dimensional assumption.
./dist/fomkyr -i fixtures/published/sklyanin-1-2-3.json \
  -d 12 -j 4 --memory 512M --workdir sklyanin-ordinary

# Explicit external theorem/number assumption; conditional output is labelled.
./dist/fomkyr -i fixtures/published/sklyanin-1-2-3.json \
  -d 12 -j 4 --memory 512M --workdir sklyanin-assisted \
  --assume-hilbert fixtures/hilbert/sklyanin-hilbert.json

# Replay an actual small independent witness.
./dist/fomkyr -i fixtures/fk3.json -d 7 -j 4 --memory 128M \
  --workdir fk3-proved --hilbert-certificate fixtures/hilbert/fk3-duals.json

# Native or WASM resumption: preserve the same authority document.
./dist/fomkyr --wasm --resume sklyanin-assisted -d 12 -j 4 \
  --memory 512M --assume-hilbert fixtures/hilbert/sklyanin-hilbert.json
```

JS options are `hilbertClosure:{certificate: JSON_OBJECT}` or
`hilbertClosure:{assume: JSON_OBJECT}`. Omit the option, or set it to `false`, for
ordinary completion. Only the first supplies a replayable certificate.
Deploy matching JS and all four WASM binaries together. Install with the retained
`tools/install.py`. Real Firefox/OPFS/GitHub Pages execution is not newly verified.

## What is deliberately not claimed

No relative H^+ boundary module engine, no tensor-product algebra isomorphism,
no free S6 orbit pruning for a fixed lexicographic basis, no new signature method,
no degree-14 completion merely because its gap is small, and no new Singular or
Bergman comparison. The exact lower-bound construction is scalable only on the
small test cases at present. A compact high-degree independent lower-bound witness
would improve the authority/performance balance; it is not part of this release.

## Sources

Published input presentations and dimension policies retain their precise field
and provenance. A relative boundary-module solver remains outside this implementation.

* Kirillov, RIMS-1817, Appendix IV, printed p.122, FK6 prefix through degree 15;
  footnote 35 attributes degree 12-15 computations to Backelin, Lundqvist and Roos
  using aalg. https://www.kurims.kyoto-u.ac.jp/preprint/file/RIMS1817.pdf
* Terwilliger, The algebra U_q^+ and its alternating central extension, section 4,
  PBW basis. The odd/even root-vector degrees give the Hilbert product used in the
  exact q=2,3 specializations. https://arxiv.org/html/2106.14884v1
* Iyudu and Shkarin, Sklyanin algebras and a cubic root of 1, Theorem 1.1 and its
  nondegeneracy hypotheses. https://arxiv.org/html/2108.06290
* Blasiak, Liu and Mészáros, Subalgebras of the Fomin-Kirillov algebra, free-module
  and complementary-subgraph results. https://arxiv.org/html/1310.4112v2
  These motivate the separate module proposal, not an implemented solver path.
