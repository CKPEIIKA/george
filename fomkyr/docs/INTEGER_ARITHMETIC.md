# Exact integer arithmetic

The exact reducer uses binary GCD for magnitudes fitting in 64 bits and
conservative Lehmer batching for larger magnitudes. This implementation is shared
by native C and WebAssembly builds.

Lehmer batching normalizes the larger operand's leading window to 62 significant
bits, taking bits from up to three 32-bit limbs. Both operands use the same bit
shift. This preserves estimator precision when the highest limb is partly filled.
The window proposes a small integer matrix with determinant ±1, so applying it preserves the GCD.
The implementation evaluates its action at full precision and accepts it only
when both new magnitudes are nonnegative and strictly smaller than the previous
maximum. Otherwise it takes one ordinary Euclidean remainder step. Matrix
coefficients are bounded to prevent signed overflow.

Inputs and coefficient roots stay immutable. Two reusable slots hold live
operands. Both matrix rows are evaluated in one limb pass with exact signed
carries. Cancellation is checked during long calculations.

## Division and coefficient storage

Known-exact division strips the divisor's powers of two and computes quotient
limbs from low to high, using its inverse modulo 2^32. Cross-products outside
the known quotient window are unnecessary. Borrow propagation within that
window remains exact. This path requires divisibility, as all its solver callers
provide; general quotient and remainder queries use normalized long division.
Zero divisors are rejected.

When the known-exact quotient fits in one limb, its modular digit is returned
directly as an inline coefficient, without temporary arena allocations.

Addition and multiplication write directly into their final immutable coefficient
allocation. Multiplication initializes a scalar column then accumulates subsequent
columns, avoiding a full zero-fill and a second limb-array copy.

Normalized long division reads each immutable operand's limb array directly.
Native builds use the POSIX host's libc memory routines. Freestanding WebAssembly
builds retain their internal memory functions.

## Rational rewrite factors

The arbitrary-precision rational reducer divides the pivot by the reducer's
leading coefficient once per rewrite. Each tail term multiplies this shared
factor by its integer coefficient. The factor is an owned coefficient-pool
root and survives collection, workspace relocation and cooperative suspension.
The pending cursor records whether scaling has already occurred.

## Validation and comparison builds

For an arithmetic ablation, compile with `-DFOMKYR_GCD_EUCLID` to retain the previous
Euclidean GCD in both rational tiers. The conservative `gn_legacy_big_division(1)`
C API also retains the Euclidean path for arbitrary-precision coefficients.
For separate ablations, `FOMKYR_ARITH_BASELINE` retains the previous primitive
operations and matrix application; `FOMKYR_LIMB_BASELINE`,
`FOMKYR_MATRIX_BASELINE` and `FOMKYR_EXACTDIV_BASELINE` select individual previous
paths. `FOMKYR_VALIDATE_EXACTDIV` additionally checks nontrivial exact quotients
by multiplication. These switches preserve polynomial and checkpoint formats.

`FOMKYR_LEHMER_WINDOW_BASELINE` retains the preceding fixed two-limb estimate.
`FOMKYR_BYTE_MEMORY_BASELINE` retains the freestanding memory loops in native
builds for comparisons.

`FOMKYR_EXACTDIV_ALLOC_SMALL` and `FOMKYR_RATIONAL_TAIL_RATIO_BASELINE`
retain the preceding allocation and rational
paths for separate comparisons. Shared rewrite factors do not change durable
checkpoint records; an unfinished in-memory row still restarts from its saved
task descriptor when the executable changes.

Validation uses Python `math.gcd` and `Fraction`, signed and zero inputs, limb
boundaries, shared powers of two, nearby leading windows, highly unequal sizes,
and consecutive large Fibonacci numbers. See `tests/test_integer_gcd.py`,
`tests/test_big_division.py`, `tests/test_integer_arithmetic.py`,
`tests/test_integer_arithmetic_wasm.mjs` and `tests/test_big_fraction.py`.

Algorithm references: [binary GCD](https://gmplib.org/manual/Binary-GCD) and
[Lehmer batching](https://gmplib.org/manual/Lehmer_0027s-Algorithm) in the GMP manual.
Also see [known-exact division](https://gmplib.org/manual/Exact-Division) and
[basecase multiplication](https://gmplib.org/manual/Basecase-Multiplication).
The solver implementation is original; GMP code is not bundled.
