# Fomkyr 0.7.7

This maintenance release updates the native and browser engines with the
retained-row fixes developed after 0.7.6.

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

Browser controls and defaults are unchanged. Durable checkpoint formats are
unchanged; unfinished in-memory rows restart from their saved descriptors when
switching executables. Imported dimension assumptions remain explicit. This
release establishes no new FK6 dimension or centrality result.
