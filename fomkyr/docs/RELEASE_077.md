# Fomkyr 0.7.7

This release updates the native and browser engines with retained-row fixes
and homogeneous algebra series/resolution tasks.

- Compute exact associated-monomial Poincaré–Betti series in the shared C
  counter, with JSON/CSV exports and native `--poincare`.
- Construct actual right Anick differentials and graded Betti numbers over Q
  or a prime field, with full d² checks and exact augmentation ranks. George
  uses its existing Anick task; the native CLI adds `--anick`.
- Keep resolution construction bounded by internal degree and byte budgets;
  it currently runs serially after Gröbner completion.
- Grow retained rows into adjacent free workspace and revalidate exact normal
  forms after relocation.
- Keep node capacity consistent during coefficient and arithmetic growth, and
  align pair plans and reusable buffers for tagged coefficients.
- Recover parked rows with memory-aware cooperative admission before declaring
  workspace exhaustion.
- Grow reducer read buffers within the memory budget and reset the coordinator
  I/O lease when beginning a fresh calculation.
- Size default browser hash tables to fit the smallest supported memory budgets.
  Explicit table sizes and restored checkpoint settings retain their precedence.

The existing series and algebra Anick choices are now enabled for Fomkyr.
Reduction defaults and checkpoint formats are preserved. Unfinished in-memory rows restart from their saved descriptors when
switching executables. Imported dimension assumptions remain explicit. This
release establishes no new FK6 dimension or centrality result.
