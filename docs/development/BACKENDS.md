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

Fomkyr 0.6.1 kernel binaries are unchanged upstream binaries. The source
inventory and original archive digest are in
[the source inventory](../../vendor/fomkyr-0.6.1/SOURCE.json).
The adapted browser coordinator uses real workers and browser disk storage;
Firefox uses a portable I/O owner. Checkpoints preserve exact polynomial data.
The basis has primitive coefficients and may retain unreduced tails.

Engine manifests in `web/engine/` record compiler settings and asset hashes.
Build with `tools/build-backends.sh`, `tools/build-memory64-backend.sh`, and
`tools/build-fomkyr-backend.sh`. These scripts retain build dependencies locally.
See [validation](VALIDATION.md), [performance](PERFORMANCE.md), and
[source review](SOURCE-REVIEW.md) for mathematical scope and reproduction.
