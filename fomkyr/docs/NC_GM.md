# Noncommutative Gebauer–Möller filters

The homogeneous engine implements the multiply, leading-word and backward
criteria of [Kreuzer and Xiu](https://arxiv.org/abs/1302.3805), Propositions
3.6, 3.7 and 3.14. Select them independently:

```sh
fomkyr -i input.json -d 10 --gm off
fomkyr -i input.json -d 10 --gm multiply
fomkyr -i input.json -d 10 --gm leading-word
fomkyr -i input.json -d 10 --gm backward
fomkyr -i input.json -d 10 --gm all
```

The JavaScript option is `gmCriteria` with the same values. The default is
`off`. `--no-chain` disables the existing interior criterion for controlled
comparisons; normal calculations should keep that criterion enabled.

## Exact dependency checks

An occurrence records its rule ID and its interval in the actual ambiguity
word. The module order uses the rule ID and then the left-context order. Self
obstructions retain this orientation.

The multiply criterion requires a proper contextual multiple of a related
obstruction. The leading-word criterion checks both the rule-index and the
same-rule/context cases. The backward criterion requires both replacement
obstructions to have retained standard representations. An unfinished or
previously discarded pair is never assumed to have a zero normal form.

This engine accepts homogeneous relations and completes degrees consecutively.
Exact input and commit reduction keep the leading words an antichain. A third
leading occurrence in a proper overlap must therefore be strictly interior:
an occurrence meeting an endpoint would give an inclusion between leading
words. Each replacement overlap is shorter than the original ambiguity. Its
standard representation follows from completed-degree induction; disjoint
occurrences use the product identity. This supplies the retention check without
assuming any same-degree pending dependency. General nonminimal occurrence
geometry is covered separately by predicate tests.

The optional matcher can decline an allocation. Such candidates retain their
ordinary exact reduction. Telemetry distinguishes `unavailable` scans from
successful skips.

## FK6 degree-17 frontier

An exhaustive scan of a saved degree-16 leading snapshot found:

| Quantity | Count |
|---|---:|
| Lower-degree leading words | 27,795 |
| Raw degree-17 overlaps | 712,517 |
| Existing interior-chain candidates | 75,857 |
| Multiply-eligible candidates | 75,755 |
| Leading-word-eligible candidates | 28,579 |
| Backward-eligible candidates | 102 |
| Additional candidates removed beyond the interior criterion | **0** |

Individual criterion counts can overlap. Every leading occurrence was scanned;
the leading-word antichain check found no violations. These figures measure
obstruction geometry, and do not constitute full normal-form runtime timings.
They explain why enabling another scan provides no additional FK6 pruning at
this snapshot. No solver speedup is claimed.

Reproduce the scan on a saved packed basis:

```sh
cc -O3 -std=c11 tools/gm_frontier_bench.c -o /tmp/gm-frontier-bench
/tmp/gm-frontier-bench basis.gnb 17 27795
```

The audit reads leading record headers, preserves the basis, and supports
inline leading words through degree 31. A native compiler with 128-bit integer
support is required for this audit tool.

## Checkpoints and verification

Frontier version 6 persists the active GM mask until the current degree finishes.
A requested new mask takes effect at the next degree. Readers retain older
frontier versions, including the legacy version-4 reordering bitmap and the
version-4 gateword representation. Bitmap frontiers migrate to version 5 when
GM is disabled. Matching partial restore failures retain saved data and stop;
they cannot silently select an older completed degree. Use the matching reader
version to resume a GM frontier.

Pending descriptors are checked again before forming their S-polynomials.
An exact zero consequence follows ordinary commit accounting, so a replay skip
does not consume the same pair twice. `gm.pendingPruned` records these skips.
If the optional word matcher cannot fit, exact substring/hash lookup retains
the completed-degree criterion; longer unsupported fragments are left for
ordinary reduction. `gm.fallbackQueries` counts chain fallback queries and
`gm.unavailable` counts GM evaluations without the optional matcher.

The independent tests compare canonical bases and every bounded critical
composition over rational and finite fields, exercise all three filters in
both enumerators, and replay raw/planned/bitmap frontiers with changed worker
counts. Native/WASM partial checkpoints are checked in both directions.

```sh
python3 tests/test_gm.py
python3 tests/test_gm_kernel.py
python3 tests/test_gm_frontier.py
python3 tests/test_gm_wasm.py
```

Build the native executable with `make` and the four O3/LTO/PGO WASM variants with
`make wasm` before running these checks. The Python kernel harness uses the
shared library built by the WASM build script. Test outputs stay in `results/`.

The retained profile contains fresh browser branch counts for this kernel.
The build verifies source and profile hashes before enabling PGO.
