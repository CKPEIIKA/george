> Historical 0.5.0 document. In 0.6.0 the ordinary George UI exposes only direct exact arithmetic; the experimental modular API remains available. Current tests and measurements are in `DIRECT_REWRITE_CACHE.md` and `results/0.6/`.

# fomkyr 0.5.0: exact arithmetic experiments and signature research

## Release decision

Keep the degree-wise exact algorithm as the default. Add a checked compact-rational
heap as a second tier after the compact-integer heap, before the original arbitrary-
precision reducer. This is the useful speed change found in this investigation.

The optional modular route is operational and deterministically checked, but it did
not beat direct exact calculation on the measured FK6 cases. A separate bounded
Python signature algorithm is included as a research reference, not as a production
WASM scheduler. No F5/cover-criterion implementation is claimed in the browser kernel.

Final measurements and the exact run conditions are in
`../results/0.5/benchmarks-final/summary.json`. Earlier `benchmarks/` data and the two
`fk6-degree*-modular/` folders are exploratory, pre-release measurements. They must
not be substituted for the final release timings.

## 1. Why a handful of rows matter

In the matched FK6 degree-10 profile, the compact integer heap declines 44 rows out
of 33,581 attempts. Extending that heap to 256-bit integer magnitudes only completes
one of those 44. Its source is retained as an uncompiled experiment in
`research/wide_heap_nf_experiment.inc`; it is not an enabled backend option.

Most of these rows need division by a non-unit leading coefficient, not just a
larger integer register. The old heap requires monic integer reducers. Otherwise it
returns to fraction-free reduction, which repeatedly constructs and normalizes
whole sparse polynomials. The new rational tier performs local coefficient updates
inside the same kind of sparse term queue.

For a coefficient c at the reducible word u LM(g) v, with leading coefficient l,
the update to another term of g is exactly -c*g_j/l. The rational tier stores each
coefficient as a reduced pair n/d, with d positive. No floating-point arithmetic
enters algebraic decisions.

Multiplication cross-cancels numerator/denominator gcds before checked products.
Addition uses the gcd of the denominators, reduces the new numerator by its common
factor with that gcd, and checks every addition and multiplication for overflow.
Numerators and denominators must fit the compact tagged-coefficient magnitude range.
A declined operation discards the attempted fast row and restarts from the unchanged
original polynomial using arbitrary-precision reduction. It never truncates a
coefficient, changes the field, or throws away a nonzero residual.

After a successful row reduction, denominators are cleared once and the result is
made primitive. This is equivalent over Q to the original fraction-free calculation.
The active row and coefficient table use already budgeted lane arenas. They do not
allocate unbounded per-update rational objects. Long-word and large-coefficient
cases continue to have the original exact fallback.

The option is `rationalHeap` (default true) and appears in George's advanced tuning.
Setting it false restores the old integer-heap -> general-reducer path. Finite-field
computations do not enter this Q-specific tier. Statistics expose
`rationalHeapAttempts`, `rationalHeapSuccesses`, and `rationalHeapFallbacks`.

This does NOT remove exponential growth of the underlying completion problem.
It reduces the cost of a particular expensive class of reductions. No degree-15--20
FK6 speedup has been measured or extrapolated.

## 2. The degree-bounded modular backend

Select `arithmeticMode: 'modular-verified'` through the engine factory or George.

```js
import {createEngine} from './modular-engine.js';
const engine = createEngine({
  workers: 4,
  budgetBytes: 512 * 1048576,
  rationalHeap: true,
  arithmeticMode: 'modular-verified',
  modularMinPrimes: 2,
  modularMaxPrimes: 8,
  modularFallback: true,
  resume: 'auto'
});
try {
  const result = await engine.compute(fixture, 10, 0);
  console.log(result.certification ?? result.arithmeticMode);
} finally {
  await engine.close();
}
```

Each prime runs in the existing multicore engine, sequentially with respect to other
primes. Thus the implementation does not multiply the worker count by the number of
primes or retain multiple active WASM linear memories. Shared/unshared and 32/64-bit
capability fallbacks are unchanged.

Each modular basis is tail-reduced before reconstruction. Images are grouped by an
exact ordered list of leading words, not only a digest. The Chinese remainder step
uses the union of supports; a missing term contributes residue zero. Integer CRT and
rational reconstruction use JavaScript BigInt outside the C reduction loop. A
reconstructed row is cleared to primitive integer coefficients for the C verifier.
Returned records use `tailReduced:true`, `reduced:false`: dividing each primitive row
by its leading coefficient gives the monic reduced Q representation. The earlier raw
benchmark metadata predates this bookkeeping correction; binary polynomials and the
arithmetic/timings are unchanged.

The default tries two matching primes before checking a lift. One prime is permitted
as an experiment: the result is still exact ONLY if the full deterministic certificate
passes. Agreement at one, two, or any number of primes is never by itself acceptance.
Rejected lifts cause additional primes or an explicit exact fallback. Custom primes
must be distinct and pass the existing prime-field kernel validation.

### Exact homogeneous certificate

Let F be the original integer homogeneous input, I_Q its ideal over Q, and I_p the
ideal of its reduction modulo an internally computed witness prime p. Let G be the
lifted candidate and J_Q=<G>. Fix a finite degree bound D.

The implementation checks over Q that every input relation of degree <=D reduces to
zero by G and that all critical compositions through D resolve. Leading words are
checked for inclusion/duplication before this test. It uses the existing proven
monomial and lower-degree chain criteria where enabled. The verifier is reject-only:
a nonzero remainder rejects the candidate rather than becoming a new relation.

It additionally checks that the leading-word list of G equals the leading-word list
of the actual modular basis computed from F through D. For each d<=D, consider the
finite integer matrix whose rows are all homogeneous context multiples u*f_i*v of
degree d. This is a proof device; the implementation does not construct that matrix.
Specialization cannot increase its rank. Consequently,

    rank(I_p,d) <= rank(I_Q,d).

Input membership gives I_Q,d subset J_Q,d, hence

    rank(I_Q,d) <= rank(J_Q,d).

Because both checked bases have exactly the same leading words through D, counting
normal words gives rank(J_Q,d) = rank(I_p,d). The inequalities force equality.
Therefore I_Q,d = J_Q,d for every d<=D. This proves ideal equality and the requested
truncated Gröbner property without reconstructing all derivation cofactors.

The argument is specific to homogeneous degree-bounded computation. It is not a
claim that the ordinary modular strategy works for arbitrary inhomogeneous free
algebras or infinite bases. See Hofstadler--Levandovskyy [1], especially its discussion
of the homogeneous exception and its stronger signature-based verification method.

`certification.json` records the method, witness prime, leading-word digest, degree
and check statistics. It is audit metadata, not a self-contained cryptographic proof
object: replay still needs F, G, a modular witness calculation and exact checks.
The lower-level `checkCandidate` alone proves input containment and the Gröbner
property, not equality with the input ideal. The public modular wrapper supplies the
internally generated rank witness required for equality.

### Failure, storage and resource semantics

Prime-field checkpoints are content-keyed with the actual prime and can resume across
matching requests. The rational candidate is loaded in a separate quarantine run.
No rational checkpoint is published until all checks pass. Failed quarantine data
are removed when safe cache deletion is available; otherwise they have no usable
checkpoint. A completed rational result has a normal ABI-3 checkpoint and can be
continued by the exact engine using its returned run key.

The modular wrapper does not currently reuse a previous completed Q candidate to
skip its final certificate; it primarily reuses prime checkpoints. It also does not
resume inside a partially completed CRT merge or verification stage.

A null/unbounded target retains the exact engine with a message: this modular route
needs a finite window. An explicitly selected finite field is computed in that field,
not lifted. Resource failure/prime exhaustion either reports `MODULAR_UNCERTIFIED`
when fallback is disabled or reports `exact-fallback` and uses the ordinary engine.
Cancellation and deadline errors are not disguised as successful fallbacks.

The WASM budget remains unchanged. CRT has a separate logical workspace limit
(default min(64 MiB, half the requested kernel budget)). Support unions, shape history,
actual coefficient sizes and denominator clearing are checked against it. Allocation
and GC overhead in the JS runtime are not covered by a hard process-RSS guarantee.
The original limit on an individual active row also remains. Deadlines/cancellation
are cooperative, not a guarantee of preemption inside every integer operation.

### Progress semantics

During a prime calculation, its degree is a field-specific milestone, not a Q result.
Events carry `arithmeticStage`, `prime`, and a field-completed degree. The public
rational-certified degree remains zero until verification succeeds; untrusted modular
progress cannot produce a Q checkpoint or an overall completion percentage. The
wrapper does not infer a final ETA before it knows the required number of primes and
verification cost. Exact fallback returns to the original degree progress semantics.

## 3. Signature research reference

`research/signature_reference.py` implements exact Fraction arithmetic with actual
bimodule signatures u*e_i*v. The fair order is weighted total degree, generator
position, left degree-lex order, then right degree-lex order. It permits only regular
reductions (strictly smaller induced signature), processes signatures in order,
handles overlaps/inclusions, and uses known-zero signature divisibility plus singular
criteria. Syzygy screening can be disabled for an ablation.

This is an executable research implementation, not a fast C port, not a full F5
implementation, and not the cover-criterion verifier from [1]. It does not claim to
compute all homological information or export complete cofactor certificates. Twelve
small physical/algebraic presentations are checked against independently completed
ordinary Fraction bases and all critical compositions through their stated bounds.

`results/0.5/signature-reference-tests.json` compares the same signature algorithm
with and without zero-signature screening. For FK4 through degree 5, regular
reductions fall from 1516 to 692; for the homogenized Clifford case through degree 5,
from 1046 to 464. Those are not comparisons with the production ordinary kernel.
The signature implementation also stores extra labelled rules and pays indexing/order
costs. For FK6 through degree 3 it avoids no regular reductions at all. These results
are evidence about where the criteria act, not a forecast of production speedup.

Before replacing the degree scheduler, the next implementation needs a bounded
bimodule divisibility index, explicit regular-reduction checks in each worker, and
signature-ordered commit/rewriting rules. Reusing the current arbitrary degree-batch
scheduler and merely marking some pairs with labels would not implement that algorithm.
A true labelled computation would also make the cover-style verification in [1]
possible, avoiding this release's expensive exact S-composition verification.

## 4. Reproducing the checks

```bash
bash tools/build.sh
bash tools/verify_release.sh
bash tools/verify_experimental.sh
# Separate benchmarks from tests and other heavy processes.
FOMKYR_BASELINE=/path/to/pristine/fomkyr-0.4.0 python3 tests/benchmark_modular.py
```

The tests include independent Fraction checks of 10,000 compact rational operations;
old/new reducer comparisons and ordinary independent completion; deliberately wrong
and unlucky modular reconstructions; all four WASM variants; and the bounded
signature ablations. Actual browser OPFS/Firefox deployment and FK6 degrees 15--20
were not tested in this release.

The native arithmetic test hook is excluded from WASM binaries. New functions add
kernel control/verification APIs but do not change serialized ABI-3 records. Deploy
all JS and all four WASM files together; no remote site or repository was modified.

## References and implementation boundaries

[1] C. Hofstadler, V. Levandovskyy. *Modular Algorithms For Computing Gröbner Bases in
Free Algebras* (2025). https://arxiv.org/html/2502.11606v1 . The unrestricted signature
modular algorithm and cover verifier in this paper are NOT claimed as implemented.
The degree-bounded homogeneous route above uses the applicable classical rank argument.

[2] C. Hofstadler, T. Verron. *Signature Gröbner bases, bases of syzygies and cofactor
reconstruction in the free algebra*. https://arxiv.org/html/2107.14675v2 . Source for
regular signature reduction and screening criteria; the included Python reference is
an independent bounded implementation, not copied SageMath source.

[3] M. Heisinger, C. Hofstadler. *f4ncgb: High Performance Gröbner Basis Computations
in Free Algebras*. https://arxiv.org/html/2505.19304v2 . Sparse matrix batching is
another relevant way to share reduction work. This release does not implement or
benchmark f4ncgb, nor claim superiority over it.
