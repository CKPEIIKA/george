# 0.7.1

- Optional shared whole-degree overlap/sparsity planning.
- Adopt legacy partial frontiers while retaining committed work.
- Frontier v2 supports deterministic native/Wasm replay and protects saved plans
  from rollback on insufficient memory.
- Retain budgeted large-row workspaces, helper reductions and native telemetry.
- Include the live terminal dashboard in the standalone source bundle.
- Add independent small-case planner tests and a bounded-memory canonicalizer.
- Expose planner settings in George and select overlap order in its FK6 example.
