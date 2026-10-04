# Fomkyr 0.7.1

## Integrated changes

- Optional shared whole-degree overlap and sparsity planning.
- Legacy partial-cursor adoption with retained committed work.
- Frontier version 2 with deterministic native/Wasm replay and minimum reader 0.7.1.
- Refusal of insufficient memory for an existing plan while preserving saved data.
- A separate bounded-memory exact canonical-output comparison tool.

The integration retains budgeted large-row workspaces, helper reductions,
configurable native workspace budgets, atomic telemetry and the terminal
dashboard. George exposes the planner in Engine → Scheduling and Share links.
General pair-order defaults remain legacy; the FK6 example selects overlap.

See [planning and resume](PAIR_PLANNING_071.md) for the coverage invariant,
checkpoint contract and memory behavior.

## Imported measurement evidence

The incoming release report records one continuation of an archived original-order
FK6 degree-14 checkpoint in native C and one in shared Wasm32 using Node's
filesystem adapter. Both explicitly accepted the same imported FK dimension
profile. Reported completion times were 181.575 s native and 215.646 s Wasm,
with h14 = 346,652,740 and equal canonical outputs. Legacy runs remained incomplete
at their 180-second configured deadline, so their completion-time ratios are
unknown.

These observations concern the incoming portable build and that conditional
checkpoint continuation. The merged optimized build and real browser OPFS have
separate validation. The imported high-degree evidence checks agreement and normal
word counts; external dimension proofs and full high-degree compositions were
outside its scope.

The incoming rotating-order, gate-off physics comparison reported gains for
q-Serre with overlap planning and small adverse legacy differences. Performance
claims should retain their case, policy, runtime and censoring information.

## Reproduction

The new tests cover independent small-case completion over Q/F2/F101,
maximum-sized frontier replay, forged pending descriptors, all four Wasm
variants, native/Wasm exchange, optional plan-allocation refusal, saved-plan
memory refusal, planner/gate combinations and independent streaming normalization.
`tools/verify_071.sh` lists the upstream reproduction checks. George's quick
release profile includes the focused planner checks alongside its existing
bounded regression matrix and browser checks.

Raw imported research experiments and measurement logs remain local development
artifacts. Corresponding sources contain the promoted implementation and tests.
