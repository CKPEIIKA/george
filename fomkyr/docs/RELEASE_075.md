# Fomkyr 0.7.5

This version prepares the five-generator FK6 star route and improves cooperative
row handling. General pair order remains `legacy`; imported dimension shortcuts
require explicit opt-in. No new speedup is claimed without matched benchmarks.

## Five-generator inputs

The fixtures under `fixtures/star/` contain the saved 247-relation presentation
of `S` and the 248-relation presentation of `T=S/(Q)`. They preserve the original
integer coefficients and generator order `a1,...,a5`.

```sh
./dist/fomkyr -i fixtures/star/fk6-star-S.json -d 18 -j 4 --memory auto \
  --pair-order word --plan-min-degree 12 --workdir star-S --human
```

For whole-degree closure with derived external dimensions:

```sh
./dist/fomkyr -i fixtures/star/fk6-star-T.json -d 18 -j 4 --memory auto \
  --pair-order word --plan-min-degree 12 --workdir star-T --human \
  --assume-hilbert fixtures/star/fk6-star-T-hilbert-through20.json
```

The scalar profiles are derived by exact series division from the imported FK6
profile using `H_A=H_S H_FK5` and `H_T=(1-t^14)H_S`. They are external assumptions,
not independent recomputations. Identification of the finite presentation with
the actual star in all degrees uses a separate ideal-generation theorem. The
saved seed previously established faithfulness through degree 16; its scope and
digest are retained in `fixtures/star/PROVENANCE.json`. This release does not
replay the all-degree theorem or certify any new high-degree dimension.

Exhausting completion without a dimension gate computes the presented algebra
independently of these profiles. Identifying it with the FK6 star still uses the
presentation theorem. If a complete star basis is required, the compatible
block-basis construction combines it with the finite FK5 basis and the 50
quadratic cross rules; this release does not synthesize that combined export.

## External permutation-sector policy

Native `--assume-sectors FILE` accepts a policy bound to the exact
input/order/field identity. It requires:

- `schema: 1`, `kind: "external-dimensions"`, and `modulus: 0`;
- `groupOrder: "S6-lex-parity-v1"`;
- a distinct transposition `[a,b]`, `1<=a<b<=6`, for each generator in
  `generatorEdges`, in the fixture's generator order;
- consecutive positive degrees through at most 30 in `entries`;
- `dimension` and 360 `sectorDimensions` in every entry.

Group indices enumerate six-letter permutations lexicographically, keeping
only the parity of the degree. Products use right appending: for permutation
arrays `g,h`, `(g h)[i]=g[h[i]-1]`. Counts refer to individual group grades.
Use decimal strings for large integers. Class totals are not sector dimensions.

The kernel checks completeness of the loaded table, unsigned 64-bit sums, and
group homogeneity of original inputs and restored rules. Counts are rebuilt
from actual leading words. A count below the imported target is rejected;
counter resource exhaustion disables that shortcut rather than producing zero.
The existing checked 32-bit automaton cells can return a representation limit;
sector and class totals use 64-bit arithmetic, and scalar counts use wider limbs.

Checkpoint metadata records the exact policy hash. Resume requires the same
policy and mode. The profile does not broaden the built-in FK6 identity match.
Past built-in authorities remain accepted on their unchanged overlapping degrees.

The WebAssembly engine exposes the same kernel APIs. Programmatic consumers use
`sectorGate: true` together with `hilbertClosure: {assume: policy}`. George does
not yet offer a generic sector-policy upload control.

## Deriving star sectors

`tools/derive-star-sectors.py` inverts the degree-graded group convolution
`A=S*FK5`. It needs complete, independently supplied individual FK5 grade data
for every requested degree; it never divides corresponding class entries.
The optional quotient step subtracts the neutral degree-14 shifted star profile.

```sh
python3 tools/derive-star-sectors.py \
  --ambient fk_gate/profiles/fk6-exact-through20.json \
  --fk5 fk_gate/profiles/fk5-exact-grades-through20.json \
  --fixture fixtures/star/fk6-star-T.json --quotient --through 20 \
  --out star-T-sectors.json
```

The FK5 input uses the same `groupOrder` and `entries` format, or a complete
`dimensionsPerClass` profile with six-vertex cycle types. Its nonzero grades
must fix vertex 6. Missing degrees are rejected. Derived sectors remain
conditional on their input data and the stated structural theorems.
The packaged FK5 grade data comes from the existing exact finite-factor
construction, with source digests retained. Both derived star sector policies
are included beside the scalar policies:

```sh
./dist/fomkyr -i fixtures/star/fk6-star-T.json -d 18 -j 4 --memory auto \
  --pair-order gateword --plan-min-degree 12 --workdir star-T-sectors --human \
  --assume-sectors fixtures/star/fk6-star-T-sectors-through20.json
```

These targets provide sector closure conditional on the same imported
dimensions. They do not add an independent FK6 dimension certificate.

## Cooperative resources and builds

Retained sparse rows can request larger storage at joined barriers. Resource
pressure no longer automatically halves the cooperative worker count. Helpers
receive bounded turns around large primary rows, and commits have a private
reserve. See [resource ownership and limitations](COOPERATIVE_RESOURCES.md).

Native and Wasm builds use O3 and LTO. Profile-guided builds require training
against the exact source snapshot. Compiler/profile metadata must distinguish
trained builds from builds where a stale profile was rejected.

These changes do not migrate or interrupt an already running solver. Pending
durable tasks replay after a restart; in-memory row states are not checkpoints.
