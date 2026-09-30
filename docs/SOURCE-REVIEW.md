# Source review: Bergman and OCaml Bergman

Reviewed 2026-09-30. Paths below refer to the unmodified upstream sources,
not generated engine files.

## Sources and scope

- `vendor/bergman-1.001`: Bergman 1.001, August 2007, Standard Lisp,
  approximately 29,000 lines. The Common Lisp/CLISP build is the porting base.
- [smimram/ocaml-alg](https://github.com/smimram/ocaml-alg), revision
  `365708af85d2faa50250414247179b3bc2bd13df` (2026-07-05). The inspected
  checkout is `build/oracles/ocaml-alg`; the web interface is in
  `tools/bergman/bergmanjs.ml`. This is an independent implementation.
- Singular 4.4.1, including its free algebra/Letterplace and Plural facilities,
  provides an independent ideal-membership oracle. Its monomial order and
  truncation bound must agree with the comparison being made.

## Original Bergman

`src/main.sl` implements degreewise and itemwise critical-pair processing.
`src/coeff.sl`, `char0.sl`, `char2.sl`, `odd.sl`, and `logodd.sl` provide exact
characteristic-zero arithmetic and prime-field arithmetic. The optional
modules cover Hilbert and Poincaré–Betti series, Anick resolutions, module
and factor-algebra homology, Hochschild computations, homogenization and
alternative strategies.

Relevant details found in the sources:

1. `CLEARRING` in `auxil/topproc.sl` does not restore all modes. In particular,
   degree limits and processing strategy can survive a calculation. George
   therefore gives each form computation a fresh worker/session.
2. `NCPBHDED` computes a PB series but its file remains empty when
   `IMMEDIATEASSOCRINGPBDISPLAY` is off. That is also the behavior of the
   bundled 2007 CLISP results. The default overlay enables the display
   temporarily; legacy mode preserves the empty file.
3. The two itemwise kernels in `src/main.sl` omit a pending-work degree-bound
   check, although some critical-pair generators already apply a bound.
   Default mode now stops before processing the next degree above MAXDEG;
   legacy mode retains the original control flow.
4. `stableMaybeReduceRedor` contains `(MONLESSP (APol2Lpmon ap pm))` instead
   of `(MONLESSP (APol2Lpmon ap) pm)`. `instableMaybeReduceRedor` puts the
   final two arguments of `LPUT!-LGET` inside `Maplst`. The build copy has
   corrected branches in default mode and original branches in legacy mode.
   The corrected traversal also guards an exhausted polynomial tail.
   `safenoncommMonTimes` fails for `left * 1 * right`: its three-word helper
   inserts the unit's terminator inside the product. Default mode joins the
   left and right words directly. The symmetric-group example exposed this
   defect, and now passes independent critical-pair and Singular checks.
5. Itemwise processing does not call the degree-end Anick update. Its
   degree-output file can be empty. An itemwise computation must export the
   final basis explicitly. A resolution must then be constructed from the
   completed basis using the degreewise resolution machinery.
   Fresh factor-algebra and Hochschild jobs also need their resolution group
   loaded before setting additional-relation callbacks. The old sequential
   suite already loaded it in earlier cases; isolated form-preset checks
   exposed the missing initialization, now explicit in the session builder.
6. The historical Betti routine groups chains by internal degree. For a
   nonhomogeneous differential this misses degree-lowering scalar terms.
   For example, after shifting the monoid relation x²−1, the differential
   contains 2x. George calculates ungraded homology by exact matrix ranks,
   checks that successive augmented differentials compose to zero, and
   saves those results separately in `homology.json`.
7. The header of `MINRESOLUTION` itself warns that it gives incorrect results
   or errors. This is distinct from `MINR`, which is included in the
   historical regression list. Passing that list does not validate every
   experimental routine in the distribution.

The CLISP and PSL historical files are not identical specifications. Known
platform/history differences include signs of linear relations, the printed
MAXDEG comment, inherited elimination-mode settings, and the PB display
change. Exact legacy comparisons use the supplied **2007 CLISP run**, with
older PSL files retained as additional historical evidence.

## ECL portability findings

The original build cannot simply compile native `.fas` files and put them in
Wasm: those files contain host machine code. George uses ECL portable
bytecode, retaining Bergman's filenames. Its loader reads serialization with
ECL's reader but executes each decoded form using Bergman's package and
readtable. ECL's default bytecode loader uses its serialization context for
both operations, which breaks dynamic `INTERN` and case-sensitive symbols.

Other adapters are explicit and applied only to build copies:

- Standard input must be bound to a stream, not NIL.
- Closed output streams need the CLISP-compatible terminal fallback.
- An extensionless group such as `hseries` must take precedence over its
  single-module `hseries.fas` file.
- Autoload macros return a copy of their expansion, allowing ECL to expand
  the newly loaded definition rather than treating the unchanged form as a
  function call.
- The invalid legacy Maplst call is deferred until execution; ECL's bytecode
  compiler otherwise rejects the entire function before it can be loaded.
- ECL's column query gets a real stream when Bergman passes NIL.
- Timing diagnostics use elapsed time because browser CPU-usage syscalls are
  unavailable. These diagnostics are not compared as algebraic results.

## OCaml implementation

The browser uses `Field.Float` (`bergmanjs.ml`), so its arithmetic is not an
exact oracle for general rational coefficients. The native Anick examples
use `Field.Int`, whose inverse operation only accepts +1 and −1. Comparisons
with those examples use their exact supported coefficients.

`tools/bergman/parser.mly` accepts single-character generators and numeric
coefficients 0 and 1, with negation and integer exponents. Its interface's
maximum degree is read after Buchberger completion and bounds the resolution,
not completion itself. The callback performs the calculation synchronously.
These are important differences from George's worker and its algebraic
degree limit; equally named controls are not interchangeable specifications.

`src/algebra.ml` completes presentations by exploring overlap ambiguities.
Its resolution code assumes a convergent/reduced presentation. It supports
both the augmentation sending generators to 0 and the augmentation sending
them to 1. For the latter, George uses the change of variables x = u + 1,
retains the original basis, and labels resolution generators as shifted.

`src/field.ml` also contains a fractions functor with independent defects:

- Canonicalization derives the denominator from the already-divided
  numerator instead of the original denominator.
- Addition uses denominator c·d instead of b·d.
- Multiplication likewise uses c·d instead of b·d.

For instance, its raw multiplication sends (1/2)(1/3) to 1/3, and its raw
addition sends 1/2+1/3 to 5/3. This module is not the browser's Float path.
Its output must not be treated as a rational-arithmetic reference.

The upstream dune file registers 24 test aliases, spanning categories,
rewriting, automata and other subjects as well as algebra. Running all of
those tests validates that reference checkout; it does **not** mean George
implements those unrelated APIs. The directly relevant examples include
`anick0` (exterior algebra on three generators), `anick1` (chains for aaa),
`anick2` (the cubic x³+y³+z³−xyz), `anick3` (x²−1 with monoid augmentation),
and `mirai` (a nonhomogeneous contraction example). Commented presentations
and the six UI families are inventoried separately in the validation tools.

## Limits of the evidence

Regression equality, independent ideal-membership checks, critical-pair
reductions, known Hilbert dimensions and differential checks provide
complementary evidence. They are not a proof of correctness for every
presentation, coefficient field, order or experimental Bergman procedure.
A bounded basis is labelled partial. George's added nonhomogeneous/monoid
resolution and homology adapter currently requires single-letter generators.
Original Bergman supports longer names: `bnminout.sl` describes names such
as `x1`, `y1`, `D1` and `D2`, and chains internally use monomial indices.
Its default `PRINTCHAIN` in `chrecord.sl` joins printed vertices without an
edge separator. George reconstructs these chains as character strings in
`web/src/homology.js`, so the restriction belongs to our adapter. A general
solution needs unambiguous generator tokens or a structural chain export.
All counts and timings
belong in `docs/VALIDATION.md`, with the exact build hashes recorded there.
