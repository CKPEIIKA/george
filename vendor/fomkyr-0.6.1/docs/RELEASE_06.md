# fomkyr 0.6.0: direct exact computation and compiled short-context rewrites

## Release decision

Direct exact arithmetic remains the production default. The useful new algorithmic
idea is to compile small, exactly proved context rewrites from the already computed
low-degree basis and reuse them inside later reductions. This is neither a modular
approximation nor a signature/F5 scheduler. The original compact integer, rational
and arbitrary-precision reduction tiers remain available.

The supplied 15-generator, 100-relation presentation exactly matches `fixtures/fk6.json`,
including the variable sequence `a,b,c,d,e,f,g,h,k,m,n,p,q,r,s` and relation order.
All FK6 measurements below use that order, degleftlex and Q. There is no variable
reordering, coefficient-field substitution or change of the mathematical input.

The slower modular mode and prime controls have been removed from George's normal
controls, including a reset of a previously saved modular selection to direct exact.
The explicit `modular-verified` API and prior research files are retained for compatibility,
not enabled or described as a current performance improvement. No new signature engine
or cover-based verifier is claimed.

## Matched measurements

Three independent fresh processes per configuration, sequential trials with alternating
old/new order for the main comparisons. Both sources were rebuilt with the same
Clang 17 `-O3 -flto` toolchain. Actual shared-memory WASM32, four CPU lanes,
Node v22.16.0, filesystem adapter for OPFS. Host reports five logical CPUs on an
AMD EPYC 9V74. Kernel budget 128 MiB, reduction scratch 32 MiB, hashBits 16.
Initialization, module/worker startup, rewrite compilation and degree checkpoints are
included. Hilbert, text export and detailed progress are off except the named ablation.
These are not browser timings. No other test workload ran during the benchmarks.

| Presentation | Through degree | 0.5.0 direct median | 0.6.0 direct median | Ratio |
|---|---:|---:|---:|---:|
| Supplied FK6 | 9 | 1.309 s | 0.871 s | 1.50x |
| Supplied FK6 | 10 | 6.880 s | 3.978 s | 1.73x |
| P6 coefficient stress | 12 | 0.231 s | 0.227 s | No meaningful change |

FK6 degree-10 ranges are 6.817-6.904 s for 0.5.0 and 3.752-4.357 s for 0.6.0.
P6 is an algebraic coefficient-stress fixture, not another physical theory.
The three outputs within every configuration are byte-identical. New versus old FK6
outputs are **not** byte-identical: their leading words agree, but 9 unreduced tails
at degree 9 and 49 at degree 10 differ. Both directions of exact ideal reduction passed.
The P6 outputs and the cache-only ablation are byte-identical to the old engine.

Raw trials, serialized bases and differential checks are under
`results/0.6/benchmarks/`. Exploratory timings in `results/0.6/exploratory/` are not the
release measurements. The older 0.5 report is historical; its absolute timings are
not substituted for the newly rebuilt, same-session baseline.

### Mechanism ablations

FK6 through degree 10, same current build, three fresh processes per mode:

| Mode | Median | Range |
|---|---:|---:|
| Shared reducer cache only; compiled rewrites off | 6.441 s | 6.409-6.819 s |
| Compiled rewrites only; shared reducer cache off | 3.890 s | 3.728-4.164 s |
| Both, normal defaults | 3.978 s | 3.752-4.357 s |
| Both, detailed progress enabled | 3.635 s | 3.594-3.748 s |

Most of the measured gain comes from compiled rewrites. Once those are enabled, an
additional wall-time improvement from the shared cache is not resolved by this sample.
Its reduction of storage reads is directly measured, but it is not advertised as a
universal additional speedup. Progress trials were run later, not as alternated matched
on/off pairs: their smaller median does not establish negative or zero reporting cost.
All progress-on outputs match the normal new output exactly.

## 1. A bounded shared copy of immutable reducers

Old workers could reread the same immutable disk records independently. A byte-bounded
shared arena now retains one copy, indexed by rule metadata. Workers reuse it without
copying whole bases. The coordinator adds records only at the existing commit barriers;
workers never read a partially published rule. Records that do not fit use the existing
per-worker cache and storage path. RAM-only runs need no duplicate pin cache.

This is only a cache. It does not discard old relations, alter serialization, change
commit order or introduce new cross-origin/browser requirements. In the representative
FK6 degree-10 runs the instrumented reducer disk-read count falls from 108,935 to zero.
This counter excludes checkpoint restoration, export and unrelated host I/O.

## 2. Compile proved local identities instead of replaying them

A long polynomial often contains the same short word many times. The old engine can
replay several elementary reductions each time. After the relevant low-degree basis
has completed, 0.6 compiles a table of exact derived identities for words of length 4
by default. Lookup then replaces a block in one sparse-heap operation.

For example, in the homogenized oscillator

    ab - ba = t^2,  at = ta,  bt = tb,

the exact consequence

    a^2 b^2 = b^2 a^2 + 4 t^2 ba + 2 t^4

can be reused inside every left/right context. This is an illustration of the mechanism,
not a claim that oscillator blocks occur in FK6. The table is rebuilt from each
presentation's actual relations and coefficient field.

For FK6 the default table contains 46,534 entries. A further 260 candidates were
declined by the conservative entry conditions. The table occupies 1,819,872 bytes,
including its directory. Partial tables remain correct; declined entries use ordinary
reduction. Eight terms per intermediate/stored rewrite is the default expansion limit.

The integer/prime-field heap can use these blocks. The rational and arbitrary-precision
fallback paths remain intact; unsupported coefficients or long-word fast-path cases
fall back from the unchanged original polynomial. The local length 4 is a cache tuning
parameter, **not** a new maximum computation degree. Arbitrary-length word storage and
blank/null-target completion requests are retained.

### Correctness argument

Let G be an actually computed basis snapshot, and let a chosen monic relation be

    g = u + sum_v c_v v,   with v < u.

For every surrounding context a,b, the ideal contains

    a g b = a u b + sum_v c_v a v b.

Consequently the block rewrite

    a u b  ->  -sum_v c_v a v b

is an exact ideal consequence, and every resulting word is smaller than the source
under the unchanged admissible order. Table entries are built in ascending fixed-length
word order. Substituting an earlier table entry therefore preserves both exact ideal
membership and strict decrease, by induction.

Only actual monic divisors are compiled. Every coefficient addition and product is
checked; finite-field operations are performed in the stated field. Non-unit pivots,
noncompact coefficients, overflow, support growth and cache exhaustion decline the
entry rather than truncate or approximate it. A declined subentry is left unchanged.
Zero entries are used only when the user's monomial-pruning option permits them.
The audit API `gn_local_rule(key)` exports the identity `w - image(w)` for checking.

Each compiled leading word is already divisible by an existing basis leading word.
The cached identities thus enlarge neither the ideal nor its leading ideal; they are
redundant, decreasing reductions. Later snapshots retain their source relations.
The normal completion procedure still processes the same scheduled pairs and checks
new results against the updated basis before committing them. Tail normal forms can
differ, but exact ideal equivalence and the truncated Groebner property are preserved.

The cache is immutable during worker reductions and is not trusted across unrelated
runs. On resume it is rebuilt from the verified restored basis, not loaded from an
unverified rewrite-cache artifact. Cache settings do not affect the algebra identity.

### What the counters show

Representative FK6 degree-10 output:

| Counter | 0.5.0 | 0.6.0 |
|---|---:|---:|
| Basis rules | 2,155 | 2,155 |
| Stored terms | 78,021 | 77,662 |
| Scheduled overlap pairs | 44,078 | 44,078 |
| Instrumented reduction-loop iterations | 55,948,278 | 31,264,758 |
| Successful rational-heap calls | 44 | 3 |
| Compiled rewrite uses | Not present | 27,762,122 |
| Reducer disk reads | 108,935 | 0 |
| Kernel allocated bytes | 41,805,680 | 58,608,560 |

A compiled block counts as one loop iteration even when it replaces multiple older
steps. The counter is therefore operational evidence, not an invariant count of the
same algebraic operations. Wall-time comparisons are the primary performance evidence.

## 3. Small rational-arithmetic fast paths

Checked same-denominator addition, multiplication by plus/minus one and trivial gcd
cases avoid unnecessary arithmetic inside the existing rational heap. The independent
10,000-case Fraction arithmetic suite passes. No separate speedup is attributed to these
microchanges: the ablations support the compiled-rewrite change as the main improvement.

Early rational preconditioning and a shadow tail-interreduction experiment did not
provide a convincing gain. They are not included in the production path. Larger local
expansion limits were explored, but the default remains length 4 and support 8.

## Options and memory

The normal direct engine defaults include:

```javascript
{
  arithmeticMode: 'exact',
  rationalHeap: true,
  compiledRewrites: true,
  rewriteDegree: 4,
  rewriteSupport: 8,
  // Automatic per-run defaults:
  // rewriteBudgetBytes = min(kernelBudget / 16, 8 MiB)
  // sharedReducerCacheBytes = min(kernelBudget / 16, 64 MiB)
}
```

George has controls for compiled rewrites, local word length, expansion limit and both
cache budgets. Its rewrite-budget field defaults to 8 MiB; the kernel still clamps the
request to a bounded fraction of its total budget. Zero disables the respective cache.
`compiledRewrites:false` returns to the old reduction scheduling without macro lookup.
For a stricter old-path ablation, also set `sharedReducerCacheBytes:0`.

At the benchmark budget each cache reserves 8 MiB; the actual populated payloads are
about 1.82 MB and 1.93 MB. They are **one shared copy**, not multiplied by worker count.
The increased allocated memory in the table includes reserved arena capacity and rule
metadata, not just populated payload bytes. Optional allocation failure declines the
cache and retains exact computation; it does not grant memory outside the kernel budget.

The 15,000,000,000-byte kernel ceiling remains, with smaller WASM32 limits. This is not
a limit on whole-browser RSS. A reducer row and basis metadata must still fit RAM, and
browser/OS OOM cannot be excluded by the C allocator. All previous field/order, worker,
monomial-pruning, sparse-heap, deadline, Hilbert and storage controls remain available.

## Validation

The full existing release suite was rerun with the new defaults: native tests, the
37 algebra/field combinations checked from actual WASM outputs, all four shared/unshared
WASM32/WASM64 variants, storage/capability fallbacks, resume, Hilbert, progress, installer
fixtures and UndefinedBehaviorSanitizer. The expanded direct tests add:

* 44 edge/physics-algebra checks with an independent exact oracle, including fields,
  nonmonic and large coefficients, small/zero caches, different local lengths/supports,
  pruning disabled and random mixed-degree inputs. Across these checks, 8,927 compiled
  identities are individually checked. These counts overlap the existing matrix.
* An independent FK6 completion through degree 5, including 3,100 critical compositions,
  plus **all 46,534** default compiled identities checked individually with Fraction.
* 17 actual-WASM cache/compatibility checks; 12 serialized outputs independently checked.
  These exercise the macro path in all four WASM variants, prime fields, portable
  exclusive-owner I/O, disabled caches and shared/unshared 32/64-bit resume.
* The rational arithmetic/case suites and explicit modular API compatibility tests.

Final FK6 degree-9/10 results are differentially checked against the rebuilt 0.5.0:
equal leading words and exact reduction in both directions for the changed tails.
This is not a fresh independent completion at degrees 9 or 10. Repeated runs within
a configuration are byte-identical. Results continue to declare `reduced:false`.

No actual Firefox or current live GitHub Pages execution was performed this turn.
Browser fallbacks are exercised through the Node test harness; that is not browser
conformance certification. The actual remote George repository/site was not modified.
FK6 through degrees 15-20 was not run. No extrapolated degree-20 runtime is claimed.
The tested matrix concerns the underlying graded algebras, not experimental physics or
a complete EFT gauge/Lorentz/trace-redundancy pipeline.

## Progress and algorithmic scope

The existing sampled worker activity and per-degree overlap-count panel remain.
Compilation takes place in the indexing phase and checks cancellation/deadlines while
building. Cache statistics are read at reporting boundaries, not by scanning the basis.
No new mandatory high-frequency worker messages are introduced.

Overlap completion is explicitly not a percentage of total job runtime. Estimates can
be withdrawn when costs vary too much. The run with detailed progress has the same
exact binary output; the present timing sample does not resolve its marginal overhead.
Repeated local work is cheaper, but combinatorial growth at higher degrees remains.

This is ordinary exact completion with redundant local rewrites, not noncommutative F5.
The prior signature reference and modular experiments remain research material. A full
signature scheduler needs signature-safe reduction and compatible ordered commits;
calling cached word rewrites 'signatures' would not implement those requirements [1,2].
The release makes no claim of a novel published algebraic algorithm.

## Install, build and reproduce

From the unpacked `fomkyr/` directory:

```bash
python3 tools/install.py /absolute/path/to/george --dry-run
python3 tools/install.py /absolute/path/to/george
```

Publish the complete updated JS and all four WASM files together. The installer uses
`.before-fomkyr-0.6.0` backups, preserves existing isolation setup and rejects unsupported
source shapes. Tests use old/current-style executable fixtures, not the live checkout.
ABI-3 checkpoint records and their mathematical content keys are unchanged.
For a fresh comparison, disable checkpoint reuse; otherwise a completed cache can bypass
the very computation being timed. Existing completed runs need not be discarded for use.

```bash
bash tools/build.sh
bash tools/verify_direct.sh
FOMKYR_BASELINE=/path/to/pristine-rebuilt/fomkyr-0.5.0 python3 tests/benchmark_direct.py
```

Run benchmarks separately from test workloads. The baseline path must point to the
unmodified 0.5 source rebuilt with the same compiler. The benchmark runner writes actual
serialized outputs and a machine-readable summary with trial conditions and hashes.
`results/0.6/release-validation.json` records the release evidence and binary hashes.

## Primary references for the retained research boundary

[1] C. Hofstadler and T. Verron, Signature Groebner bases, bases of syzygies and cofactor
reconstruction in the free algebra. https://arxiv.org/html/2107.14675v2

[2] C. Hofstadler and V. Levandovskyy, Modular Algorithms For Computing Groebner Bases
in Free Algebras (2025). https://arxiv.org/html/2502.11606v1
