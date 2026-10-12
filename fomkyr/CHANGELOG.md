# 0.7.6

- Service retained row memory at a joined barrier before reporting terminal
  workspace exhaustion; preserve exact cursors when every lane parks together.

- Refreshed native and browser PGO for exact arithmetic changes.
- Added canonical edge-table cross-checks and included required source, fixture
  and documentation files in the release.
- Added mixed fraction and non-monic retained-tail regressions.
- Includes the arithmetic and cooperative resource changes described below.

# 0.7.5

- Use binary machine-word GCD and conservative Lehmer batching for exact rational coefficients; retain a Euclidean comparison build.
- Fuse Lehmer matrix updates, allocate coefficient results once, and use modular-inverse division for known-exact quotients; retain primitive-level comparison builds.
- Return one-limb exact quotients inline and share the pivot/leading-coefficient
  factor across each arbitrary-precision rational rewrite, retaining it across
  cooperative suspension and workspace relocation.

- Extend the explicitly imported FK6 total and sector profile through degree 20.
- Use 64-bit class totals, including classes whose totals exceed 2^32.
- Include separate exact integer fixtures for the 247-relation star and its
  degree-14 quotient, with derived external scalar profiles and provenance.
- Accept identity-bound external S6 sector policies for labelled presentations;
  derive star policies using graded group-convolution inversion.
- Retain sparse rows on cooperative memory pressure, grow at joined barriers,
  schedule cheap helper turns, and isolate commit reserve storage.
- Preserve existing durable pair descriptors and explicit profile dependencies.
- Keep selected sector-finisher priority during retained-row helper turns.
- Restore the requested native worker count after loading oversized checkpoint
  records with a temporary larger import buffer.
- Retire extended result arenas after each completed worker reduction and exact
  commit, preserving independent ownership when the next row changes arenas.

# 0.7.1

- Optional shared whole-degree overlap/sparsity planning.
- Adopt legacy partial frontiers while retaining committed work.
- Frontier v2 supports deterministic native/Wasm replay and protects saved plans
  from rollback on insufficient memory.
- Retain budgeted large-row workspaces, helper reductions and native telemetry.
- Include the live terminal dashboard in the standalone source bundle.
- Add independent small-case planner tests and a bounded-memory canonicalizer.
- Expose planner settings in George and select overlap order in its FK6 example.
