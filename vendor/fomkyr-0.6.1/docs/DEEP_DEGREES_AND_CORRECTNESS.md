# fomkyr 0.6.1: high-degree direct reduction and result auditing

## Release scope

This stays on the 0.6.x direct-exact branch. It does not introduce a signature
scheduler, a new modular algorithm, floating-point coefficients, or a different
presentation/order. The supplied FK6 input has 15 generators and 100 relations;
all deep runs use its original order, degleftlex, unit generator degrees and Q.

The main change is deliberately small: the compiled exact local identities already
used by the compact integer heap can now be used by the compact rational heap.
The general arbitrary-precision reducer remains the correctness fallback. The
new option `rationalRewrites` defaults to true; false supplies a direct ablation.
`compiledRewrites:false` disables both integer and rational uses of that table.

## What changed at degree 12

The expensive behavior was not explained by rule count alone. The original 0.6.0
path reached degree 11, then stalled on an early degree-12 reduction after leaving
the compact rational tier. A single arbitrary-precision reduction held the batch
barrier while the other lanes were idle. The measured row continued growing.

The new path reduces some of that coefficient/support growth before it triggers
fallback. It uses the exact existing integer identity w = sum(c_i v_i), with the
same left/right context and multiplies each c_i by the active exact rational
coefficient. Each multiplication and addition is checked. Unsupported coefficients,
space exhaustion or overflow discard the attempted fast reduction and restart from
the unchanged original row. No term is dropped because it is inconvenient.

In particular, this does not mean arbitrary precision is unnecessary: other inputs
and higher degrees may still require it. No guarantee is made for degrees 13-20.
The unchanged local table degree (four by default) is not a computation-degree cap.

## Recorded high-degree outcome

| Final sequential same-checkpoint trial | Outcome | Wall time |
|---|---|---:|
| 0.6.1 with rational compiled rewrites disabled | Deadline in degree 12; 3,104 / 53,542 overlaps resolved | 240.238 s (censored) |
| 0.6.1 with rational compiled rewrites enabled | Degree 12 completed | 132.563 s |

Both restore the identical old 0.6.0 degree-11 record prefix. This is one trial per
setting, not a median. The disabled path's completion time is unknown; no exact
speedup ratio is asserted. The original, separately profiled 0.6.0 also failed to
complete degree 12 within 900 seconds, but that exploratory run had CPU contention.

The completed degree-12 output has **4,872 rules**, **790,423 stored terms**,
and **19,126,056 record bytes**. The kernel allocated 185,411,824 bytes within its
536,870,912-byte budget. There were 3,373 rational attempts, all successful,
with zero general fallbacks, and 14,312 rational table-growth retries. The
last counter includes restarted work and identifies remaining avoidable cost; it
is not a count of distinct mathematical reductions.

Independent canonicalization of two completed degree-12 outputs obtained from
canonically equivalent but byte-different degree-11 checkpoints gives the same
exact canonical stream (SHA256
`622bfae0312c262eeab7319f5e9ebd4daf7e811a489cc71aa2ab663224ee72b9`).
Both sides' proper-subword irreducibility/minimal-leader preconditions passed. This
is independent normalization and differential equality, not an external full
Gröbner computation through degree 12.

The C and independently implemented Python Hilbert counters agree on the computed
basis through degree 12:

    1, 15, 125, 765, 3831, 16605, 64432, 228855,
    755777, 2347365, 6916867, 19468980, 52632322

These are invariants derived from the computed leading ideal, not a second proof
of its Gröbner property. See `results/0.6.1/deep-hilbert.json`.

A separate degree-13 diagnostic probe stopped at its 120.289-second deadline,
with 3,200 / 89,834 overlaps resolved. One general fallback was again holding the
batch (internal rules 48 and 4842, overlap length 1). Only degree 12 is completed;
the 6,169 temporarily stored rules are **not** a completed degree-13 basis. The
probe overlapped independent audit work and is not a clean timing benchmark. No
runtime extrapolation to degree 20 is made.

## Correctness argument for the extension

Suppose an existing compiled identity has w - sum(c_i v_i) in I, with every v_i < w.
For a rational coefficient q and words a,b,

    q a w b - sum(q c_i a v_i b) is in I.

The same admissible order makes every replacement smaller. Rational arithmetic is
exact and checked. Hence the additional reductions preserve the ideal and strict
word decrease; they are redundant shortcuts, not assumptions about FK algebras.
The table is immutable during each batch, rebuilt from the restored exact basis,
and never loaded from an unverified rewrite-cache artifact. Compiled reduction is
not used while excluding a rule for canonical tail reduction (`skip_rule`).

The preexisting independent checks of all 46,534 default FK6 table identities were
rerun. Dedicated arithmetic tests force the new rational path in shared/unshared
WASM32/WASM64 builds; they do not merely test that the new switch is accepted.

## Timing protocol and evidence

See `results/0.6.1/isolated-d12/summary.json` for the final sequential trial(s).
The trial harness preserves reports on timeouts. A timeout is right-censored, not
a completed time and not a basis certified through the requested degree.

The isolated comparison uses the final four-worker shared-memory WASM32 build,
Node 22, the filesystem OPFS adapter, 512 MiB kernel budget, 128 MiB aggregate
scratch, detailed progress every five seconds, no Hilbert computation and no text
export. Each side restores the same 0.6.0 degree-11 checkpoint. Initialization,
restoration, table rebuilding, degree-12 computation and checkpoint writing are
included; the already completed degrees 1-11 are excluded. No test workload runs
concurrently. The switch `rationalRewrites:false/true` is the only algorithmic
ablation. This is not a browser timing and not a many-trial median.

Earlier directories `baseline-d12`, `rational-macros-d12-exploratory` and
`rational-macros-d12-resume` are exploratory. The original run hit its 900-second
deadline in degree 12; the revised exploratory resume completed degree 12. Those
runs overlapped in CPU use and are not used to assert a speedup ratio. The initial
modified resume used a different, canonically equal, degree-11 checkpoint. Final
isolated trials instead use identical old checkpoint bytes.

## What different tails do and do not mean

Primitive integer rows with unreduced tails are not a canonical presentation of a
Groebner basis. Changing an exact reduction route can alter those tails. The
following checks must not be confused:

1. Equal rule counts, leading words or Hilbert coefficients alone do not prove
   equal ideals. For example, <x> and <x-y> have the same leading ideal for x > y.
2. Exact mutual reductions establish the two inclusions of the generated ideals
   when the reductions succeed. They do not by themselves prove a Groebner basis.
3. Input membership plus all critical overlap/inclusion compositions through D
   establishes the bounded Groebner property for homogeneous data (provided the
   output's membership in the input ideal is established separately, by an oracle,
   derivation, or independent construction).
4. Monic, fully tail-reduced canonical rows should match in the same field and
   order. This is much stricter than comparing the raw primitive rows or hashes.

`tools/canonical_audit.py` is independent of the C matcher and arithmetic. It reads
and checks serialized records, verifies minimal leading words and that every tail
has no reducible proper subword, and then performs exact triangular same-degree
normalization. If those preconditions fail, it refuses the shortcut; it does not
silently produce an incomplete normal form. Two outputs are compared as exact
canonical byte streams. SHA256 values are retained for provenance, not used in
place of that equality check.

This tool explicitly reports `independentGroebnerCertificate:false`: normalization
is not a proof that all critical compositions vanish. The test suite includes a
counterexample which passes normalization but fails an independent composition
check. It also rejects a different ideal with the same leading words.

The old/new FK6 degree-11 outputs canonically agree. Degree-12 results are audited
separately. These high-degree comparisons do not substitute for an independent
Singular/Bergman computation through degree 12. The engine continues to export
`reduced:false` unless a separately requested canonical artifact is produced.

## A genuine test-harness correction

`tests/test_physics_matrix.py` previously iterated p=0,2,101, but its native Engine
calls did not receive `modulus=prime`. That invalidated the intended native
cross-field coverage; it is not evidence that the kernel itself used the wrong
field on normal API calls. George's validator already fixed this in its staging
copy [1]. The correction is now in this branch, with an explicit assertion of the
kernel's actual characteristic. A characteristic-sensitive fixture prevents a
future all-Q substitution from passing accidentally. The corrected 37 native
algebra/field combinations pass. Actual WASM field tests are separate checks.

Do not retroactively read the earlier native-matrix count as verified coverage of
all three fields. The corrected fresh results are in this release's manifest.

## Singular, Bergman and the actual verification boundary

George's upstream fixture contains 30 presentations across Q,F2,F5 [2,3]. Only
seven are homogeneous, noncommutative and unit-weight, the current scope of this
engine. They are the Letterplace simple, monomial, exterior and braid examples.
Their mathematical inputs were adapted with explicit variable-order conventions
and are tested here in 21 case/field combinations. Braid bounds are the bounded
George adaptation, not a claim to run the original degree-11 Singular test.

These 21 cases pass independent exact completion, all bounded critical
compositions, mutual reduction and canonical comparison. Homogenized oscillator,
Clifford, sl2 and other physics-oriented fixtures remain in the larger matrix.
These are tests of algebraic machinery, not validation against experiments.

**Neither a live Singular executable nor George's compiled Bergman runtime was
available in this environment. No fresh external-engine agreement is claimed.**
George publishes its own validation evidence [3,4], but it belongs to the engines
and hashes recorded there, not automatically to fomkyr 0.6.1.

`tools/check_george_oracles.mjs` runs this release against those actual external
engines on an initialized George checkout. It compares original-input membership,
both ideal inclusions, bounded compositions, Hilbert coefficients and canonical
monic rows. Singular uses the free-algebra/Letterplace interface, not an ordinary
commutative polynomial ring. Reversed generator declarations match its Dp order
to fomkyr's last-variable-largest degree-left-lex convention. Coefficients are
parsed as exact integers/fractions without eval. Field and degree are recorded.

Missing tools return exit 77 and `externalVerified:false`. An error, timeout,
nonzero remainder or canonical mismatch is a failure, not a skipped pass. The
runner's format/parser/preflight have tests; its full external invocation remains
unexecuted here. Source/engine manifests are recorded when that invocation runs.

## Diagnostics and cancellation

The sampled live snapshot now includes each active lane's arithmetic tier, active
row size, fallback count, and critical-pair rule IDs/overlap. It is published at
existing sparse safe points; the UI does not copy active polynomials or scan the
basis. Allocation, coefficient/arithmetic misses and rational table retries
are aggregated after worker barriers, not polled as racing non-atomic counters.
These diagnostic categories are not an exhaustive partition of fallback reasons;
in particular a table-growth limit can be reached without an allocation attempt.

Current-degree overlap counts remain counts, not percentages of total runtime.
Historical degree forecasts are withdrawn if the current degree outgrows them or
its observed costs become too heterogeneous. They must not keep displaying an
89-second scenario while one unresolved reduction has already consumed minutes.
Cancellation drains already dispatched reductions before checkpoint/error cleanup
in the normal local-cancellation path. The last completed degree, not partial new
rules, determines the resumable/certified construction boundary.

## Reproduce

    bash tools/build.sh
    bash tools/verify_061.sh

    python3 tests/benchmark_deep.py --degree 12 --seconds 900 --trials 1 \
      --baseline /path/to/pristine/rebuilt/fomkyr-0.6.0 \
      --out results/my-deep-comparison

A same-checkpoint ablation can instead use:

    python3 tests/benchmark_deep.py --degree 12 --seconds 900 \
      --resume-storage /path/to/degree11/storage \
      --ablate-rational-rewrites --out results/my-ablation

For external engines, first initialize George's own oracle packages and compiled
Bergman runtime using its setup documentation. From this fomkyr directory:

    node --experimental-wasm-memory64 tools/check_george_oracles.mjs \
      --george /absolute/path/to/george --fk-degree 5 \
      --out results/external-parity

A higher `--fk-degree` is explicit; do not label bounded degree-5 external evidence
as degree-12 parity. The tool accepts `--singular /path/to/Singular` where required.

Install with `tools/install.py` as before. Deploy JS and all four WASM binaries
together. ABI-3 basis/checkpoint records are unchanged; new diagnostics and options
require the matching JS/module pair. The original pruning, memory, worker, field,
degree, Hilbert and browser-storage controls remain. Direct exact is the default;
slower research mechanisms are not introduced into that default.

## Sources and limitations

[1] https://raw.githubusercontent.com/CKPEIIKA/george/main/tools/validate-fomkyr.mjs
[2] https://raw.githubusercontent.com/CKPEIIKA/george/main/test/fixtures/upstream-cases.json
[3] https://raw.githubusercontent.com/CKPEIIKA/george/main/docs/development/UPSTREAM-TESTS.md
[4] https://raw.githubusercontent.com/CKPEIIKA/george/main/docs/development/validation/upstream.json

Real Firefox/OPFS/GitHub Pages end-to-end execution was not performed in this
release. The four real WASM builds and capability fallbacks were exercised in
Node. The kernel's 15,000,000,000-byte ceiling is not a browser-process RSS limit;
an individual active row and basis metadata must still fit the budget. Public
site/repository files were not modified. No degree-20 runtime is extrapolated.
