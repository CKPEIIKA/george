# Browser backends

| Engine | Implementation | Optimization | Addressing |
|---|---|---|---|
| Lisp / ECL O2 | Bergman interpreted Lisp | O2 | wasm32 |
| Lisp / ECL O3 + LTO | Bergman interpreted Lisp | O3, LTO | wasm32 |
| C / ECL O3 + LTO | Bergman Lisp compiled to C | O3, LTO | wasm32 |
| C / ECL O3 + LTO (memory64) | Bergman Lisp compiled to C | O3, LTO | memory64 |
| fomkyr | Independent sparse C kernel | O3, LTO | wasm32 or memory64; shared or single |

Bergman engines support the complete form and Lisp console. The default is
Bergman memory64 with a 16077 MiB allowance, with a wasm32 fallback.
Fomkyr accepts homogeneous noncommutative presentations with 1–16 generators,
unit weights, degree/left lexicographic order, and rational or prime-field
coefficients. Unsupported controls are disabled. Exact Hilbert counting is optional.

Fomkyr 0.6.3 kernel binaries are unchanged upstream binaries. The source
inventory and original archive digest are in
[the source inventory](../../vendor/fomkyr-0.6.3/SOURCE.json).
The adapted browser coordinator uses real workers and browser disk storage;
Firefox uses a portable I/O owner. Checkpoints preserve exact polynomial data.
The basis has primitive coefficients and may retain unreduced tails.

Engine manifests in `web/engine/` record compiler settings and asset hashes.
Build with `tools/build-backends.sh`, `tools/build-memory64-backend.sh`, and
`tools/build-fomkyr-backend.sh`. These scripts retain build dependencies locally.
See [validation](VALIDATION.md), [performance](PERFORMANCE.md), and
[source review](SOURCE-REVIEW.md) for mathematical scope and reproduction.

The 0.6.2 core adds exact sparse arbitrary-precision rational reduction, normalized
large-integer division, and in-place compact-rational table growth. Each has a
separate switch in Engine and defaults on. Record ABI 3 and checkpoint identity
remain compatible. New host JS and all four matching kernel binaries are required.

The 0.6.3 core adds a monotone radix queue and a shared, budgeted overflow
workspace with in-place row promotion. Their switches default on. New George
fomkyr jobs use a 3584 MiB fallback allowance, 2048 MiB scratch space, an automatic
512 MiB reserve and batches of 128 pairs. Larger selected allowances are retained;
automatic workspaces scale down for smaller allowances. Explicit saved choices
remain authoritative. Checkpoint record ABI and mathematical identity are unchanged.
