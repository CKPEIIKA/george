# Delayed rank updates and projected relation charts

These optional tools accelerate pairing discovery and derive stronger relation
bounds. They do not establish a new Hilbert coefficient by themselves.

## Delayed modular arithmetic

`KIR_RANK_MODE=delayed` selects a 64-bit accumulator that postpones modular
remainders between pivot updates. The default is `reference`.

For prime `p`, the accumulator adds `(p-c)*pivot[j]` in place of subtracting
`c*pivot[j]`. It reduces each pivot coordinate before making a decision and
reduces every returned coordinate. A flush bound derived from `UINT64_MAX`
prevents integer overflow. The extra accumulator uses eight bytes per row.

Discovery still needs the existing independent integer-prefix and determinant
replay before a new lower bound can be accepted. The journal format is unchanged,
but its library hash changes after rebuilding. Import a consistent saved journal
and all its chunks into a new destination with `tools/import_pair_state.py` and
the actual old library. Candidate words and their order must remain identical.
Changing the row family requires a fresh discovery journal.

The supplied bridge package reports synthetic rank-kernel speedups of 2.7–5.0.
Whole-worker improvement depends on derivative cost and matrix fill; a faster
scan does not resolve an insufficient candidate pool.

## Exact projection onto a spanning chart

Build the optional tool with:

```sh
make projection-pilot
```

Let `W` be words already proved to span the intended rational component. A
relation context can also contain auxiliary words `X` outside that chart. The
tool eliminates `X` over the rationals, retaining only combinations supported
entirely in `W`. It never treats missing words or even coefficients as zero.

For example, `x-a=0` and `x-b=0` yield the in-chart relation `a-b=0` on
`W={a,b}`. Neither input relation alone is contained in that chart.

After exact auxiliary cancellation, a nonzero minor modulo two certifies that
the resulting integer relations are independent over the rationals. If there
are `r` such relations, the component has dimension at most `|W|-r`.
The remaining words span; their independence needs a separate lower bound.

```sh
python3 tools/projected_chart.py discover \
  --frame /path/to/frame.krm --relations /path/to/integer-relations.rel \
  --binding FRAME_BINDING --group GROUP_INDEX \
  --namespace PRESENTATION_NAMESPACE \
  --seconds 120 --memory-bytes 2147483648 \
  --max-aux-pivots 20000 --max-aux-words 20000 --max-depth 1 \
  --out /new/projected-chart

python3 tools/projected_chart.py replay \
  --manifest /new/projected-chart/MANIFEST.json \
  --receipt /new/projected-chart/receipt.json
```

Use the original frame binding and actual permutation-group index. The frame
must be action-free. Its spanning property and the input relations' validity in
the named quotient remain external proof dependencies. A replay receipt checks
the derived relations and their rank; it does not prove those dependencies.

Some older action-free charts have a zero checksum footer. Import such a chart
into a new file using its SHA256 from the retained input certificate:

```sh
python3 tools/import_legacy_chart.py --source /path/to/legacy.krm \
  --expected-sha256 TRUSTED_SOURCE_SHA256 --out /new/checksummed.krm
```

This preserves every header and word-record byte and writes an import receipt
binding both files. Use the new chart for discovery and replay, and retain the
original certificate and import receipt together. Ordinary readers continue to
reject incorrect checksums. Importing changes no mathematical proof dependency.

The default boundary mask is zero. `--prefix-kill-mask 15` is appropriate only
for a certified cyclic right module whose first four letters kill its generator.
It must not be used for an algebra chart or a module with an opposite boundary.
The Q14 quotient and the Nichols quotient have distinct mathematical namespaces.

Discovery is bounded by time, auxiliary counts, depth and logical allocation
guards. Apply an operating-system process limit as well when running a pilot.
An interrupted or unreplayed result is a candidate, not an accepted upper bound.
The tool does not modify a running controller or merge scalar bounds automatically.

## Focused controls

```sh
bash tools/verify_degree23_bridge.sh
```

Outputs go to the ignored `results-local/` directory. The controls compare the
reference and delayed modes, replay projected relations independently, and check
bounded pairing problems. To also compare a retained older discovery library,
set `KIR_BRIDGE_BASELINE_LIBRARY` to that library before running the script.
Historical proof-store checks require their separately supplied certificate data.
