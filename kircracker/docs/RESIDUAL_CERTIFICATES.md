# Residual certificate workflow

Automatic candidate-family expansion stops above degree 22. It writes
`residual/dDD/REQUEST.json` with the missing dependencies and preserves accepted
lower witnesses. Explicit `--dual-mode prepend` or `both` still selects a finite
sampling experiment. Exhaustion of that experiment establishes no exact dimension.

The residual solver is not implemented yet. Its first required input is a common,
hash-bound component chart: original spanning words, proved relation rows, and the
accepted lower primal vectors expressed in that chart. A pairing rank from a
different component or boundary convention cannot be subtracted from a chart size.

The next input is a degree-minus-one Nichols zero-or-witness oracle with certified
coverage of every reachable derivative component. A saved scalar dimension is not
such an oracle. Neither is a coordinate model for FK6/(Q14) which retains Q22.
Relative-module inputs also require their checked lift/projector and pairing
annihilator; derivatives cannot be applied after an arbitrary boundary filter.

Each accepted decision must decrease the bound gap in the same component:

- A relation identity, replayed in the intended ideal, decreases the upper bound.
- An independently replayed detecting functional increases the lower rank.
- A missing map or coverage certificate stops that direction with a named
  dependency. Timeouts and modular zero results remain unknown.

Degree-17 relation banks can first be row-reduced by exact sparse elimination when
every term is normal under the same immutable lower-degree basis. Retain the row
operations and input hashes. Select contextual consequences using unresolved
chart words; do not expand every two-sided context. A new leading pivot is not
itself a new dimension bound and may already be supplied by adopted rows.

Nichols relations and original-algebra relations have separate namespaces. In
particular a Nichols zero witness must not be adopted as an FK6 relation, and Q22
centrality is not an input to this workflow.

## Retaining partial reductions and accepted coordinates

A reduction slice may return its complete pending polynomial together with the
already processed terms. Its contextual rewrite trace proves equivalence to the
input, even when reduction is unfinished. Such a polynomial can participate in
exact linear elimination. A resource limit never makes it a zero relation.

Seed a continuation with accepted remainder pivots and skip completed source
queries. Keep large unfinished rows outside the active pivot bank when necessary;
retain their full state or a replayable trace. Publish only independently checked
relations which add rank beyond the adopted relation space in the same chart.

Independent replay can save the exact monic seed pivots in a compressed cache.
`tools/remainder_cache.py` reads that cache only with an explicitly supplied,
previously accepted receipt hash and input binding. This avoids repeating seed
reconstruction. It certifies no new rank, quotient equality, or Nichols coverage.

A verifier may publish a checked prefix before the complete campaign finishes.
Each receipt must identify the verified records, bind the immutable discovery
artifacts, and count only relations justified by those records. Later timeouts
do not revoke an already accepted prefix or close its unverified remainder.
