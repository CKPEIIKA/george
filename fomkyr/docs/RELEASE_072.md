# Fomkyr 0.7.2

This release integrates the pref4.2 pair planner and commit reducer with the
existing cooperative scheduler, large-row growth, helper lanes and FK gate.

## Optional execution choices

- `--pair-order word` sorts critical-pair descriptors by the actual ambiguity
  word, ascending in the existing degree/left lexicographic order. Ties retain
  their original enumeration order. The pair set and polynomial reduction order
  are unchanged.
- `--commit-reduction delta` uses the newly committed rules for eligible results
  computed against an immutable snapshot. Snapshot provenance and degree checks
  guard this path; unsupported cases use full exact reduction.
- Both options are available in George's engine settings. General defaults are
  `legacy` and `full`; these choices need workload-specific measurements.

## Output

Text exports are monic and tail-reduced by the exact C normalizer, with stable
row ordering. Small exports use one lane; larger exports can use multiple lanes.
Packed checkpoint records keep their primitive integer representation.
Use `--export --raw-export` to export those original rows instead.

## Checkpoint compatibility

Original frontiers (v1) and overlap/sparse plans (v2) remain readable. Word plans
use v3 and require 0.7.2. A saved active plan retains its recorded ordering on
resume. New optional plans may fall back to enumeration when their budget is
insufficient; restoring an existing plan requires enough memory to reproduce it.
Keep a checkpoint backup before changing readers.

## Builds and validation

Native builds use O3/LTO, with host tuning and profile-guided builds available
through `make check`. The four Wasm variants use O3/LTO and a source-bound profile
collected from actual Wasm execution. Bounded exact tests cover queue orders,
delta/full commit parity, prime fields, checkpoint portability, memory refusal
and normalized output. Longer stress cases remain in the benchmark suite.
