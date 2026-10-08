# Release history

## 0.7.4

- Updated Fomkyr with exact pending-pair filtering, matcher fallback and an
  optional canonical reducer cache (disabled by default).
- FK6 preset uses ambiguity-word scheduling and automatic worker/workspace
  selection with pruning and exact sparse reducers enabled.
- Refreshed O3/LTO and browser-trained PGO for all four Wasm variants.
- Shorter user documentation; standalone proof and Nichols tools stay outside
  the browser engine.

- Selectable dimension sources, including FK6 totals through degree 20.
- Explicit remaining-pair replanning on checkpoint resume; migrated frontiers
  preserve committed pairs and need the updated reader.
- FK-gate dashboard ETA based on average deficit reduction.

## 0.7.2

- Fomkyr 0.7.2 with ambiguity-word scheduling and optional delta commit reduction.
- Exact monic, tail-reduced result export and standalone Kircracker subproject.
- Native and browser correctness checks are separated from long benchmarks.

See the [Fomkyr release notes](../fomkyr/docs/RELEASE_072.md) for engine details.

## 0.7.1 and earlier

George **0.7.1** includes fomkyr **0.7.1**, configurable multicore execution,
disk checkpoints and full result downloads. Unsupported tasks and settings
are disabled for this backend. Live allocated Wasm memory appears beside
the computation status, alongside degree progress and elapsed seconds.
Mathematical options appear in **More settings**; runtime controls are in the separate
**Engine** submenu. Settings have expanded EN/RU help under “?”. New fomkyr
jobs enable its reduction optimizations and pruning, with optional Hilbert
counting off. The default is Bergman memory64 with a 15.7 GiB allowance.
Parsed relations can be folded, and relations and basis results share compact
rows grouped by term count. Mathematical copying preserves plain-text powers. Basis totals and degree counts
come from engine metadata; previews can be expanded from the saved full result.
The elapsed counter stays in seconds. Engine settings include the radix word queue
and shared overflow workspace, with automatic defaults and help for each control.
New fomkyr jobs use batches of 128 pairs. Automatic memory reserves 4/7 of
the effective allowance for scratch and up to 1/7 for exceptional rational rows;
manual mode accepts explicit workspace sizes. Workspace capacities appear
under **Engine**, and live memory help uses the actual run's values.

Fomkyr 0.7.0 preserves unfinished exact reductions across cooperative slices
and commits ready rows after reduction against the updated basis. Checkpoints
can advance while a long row remains pending. The engine menu includes the
legacy barrier scheduler, slice duration, pending work window and radix cache.
Native progress reporting remains active while waiting for workers. Version 0.7.0
adds an optional FK6 dimension profile under mathematical settings. Assisted
results are explicitly conditional on the imported dimensions; its external
proof package is not replayed here. The option is off by default.

George 0.5 added the **C / ECL O3 + LTO (memory64)** engine, allowances up to
16 GiB and a **No heap cap** setting. It also adds optional monomial pruning
and raises the largest 32-bit heap allowance to 4095 MiB. The 32-bit C backend
is available as the fallback; memory64 now defaults to 15.7 GiB. Wider pointers
can increase memory use.

George 0.4 adds a computation engine selector in **More settings**. It keeps
the same Bergman algorithms, with Lisp / ECL O2, Lisp / ECL O3 + LTO and
**C / ECL O3 + LTO** selected by default. ECL compiles existing Lisp functions
to C; some auxiliary functions still use bytecode. The selected engine is saved and shared with the
presentation. Backend parity is checked on reproducible Latin hypercube
samples of inputs and settings.

George 0.3 added compact share links, computation times in seconds and the
selectable memory allowance up to 3.5 GiB. It includes the persistent Lisp
console introduced in 0.2: command completion, history,
original Bergman help, and session files. Missing files or unavailable keyboard
input now report errors in the engine without restarting the session. The
reader and streams recover after errors; variables and files remain available.
