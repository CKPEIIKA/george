# Cooperative row resources

The cooperative scheduler retains unfinished sparse rows in memory between
waves. Their original basis snapshots, pivots, tail cursors, normal prefixes,
word queues and exact coefficient roots remain attached to those rows.

## Memory pressure

A row that cannot store its next term enters `GN_ROW_WAIT`. Other lanes continue
working. At the next joined barrier, the coordinator can grow that row's storage
within the configured budget. A larger idle worker lease can be exchanged with
a smaller lease; released allocation ranges are reused.

For coefficient pressure, the coordinator can copy the live coefficient roots
into an overflow arena and combine the original coefficient pools. The node
table and pending rewrite remain in place. This avoids allocating a second large
node table solely to obtain more coefficient space. A borrowed worker lease
stays locked until its owning normal form finishes.

Completed normal forms can retain their output while their serialization buffer
grows. Buffer references in the pending queue are updated only at joined barriers.

Cooperative capacity failures do not automatically halve the workers. Optimized
inline rows do not fall back to the whole-row-copy reducer after sparse storage
is exhausted. Large rows with words beyond the inline representation return a
representation limit instead of entering an unbounded expensive fallback.

If every usable task is waiting and the bounded helper window offers no further
work, the host saves a partial checkpoint and reports `ROW_WORKSPACE_LIMIT`.
This is an incomplete computation. Increasing memory or changing the workspace
profile permits a later continuation; no dimension is inferred from exhaustion.

## Cheap work and reserve deferral

Helpers receive a scheduled quarter-slice when pending work is available, even
when each primary lane owns a large row. Primary rows retain their arenas during
helper turns. Both run sequentially on the existing worker threads.

During these turns, pending work is ordered by small input cost. With sector
priority enabled, the smallest imported sector deficits come first. Input cost
is a scheduling estimate; it does not bound the eventual normal-form size.
An exact operation may overrun its quantum before reaching a safe boundary.

Newly started pending tasks use the current committed basis. Suspended tasks
retain their original snapshots. A compact-rational task that defers for a
reserve retries directly in the reserve tier; it does not repeat the ordinary
integer and rational tiers on each wait.

## Private commit reserve

The commit lane owns a separate reserve. Ordinary workers cannot acquire it.
Its automatic size is the smaller of the initial row-reserve size and one
thirty-second of the total budget. Its allocation counts toward that budget.

The native option is:

```text
--commit-row-reserve auto|SIZE
```

Explicit `0` disables isolation and permits the shared-reserve behavior.
The browser engine option is `commitReserveBytes`; omitting it selects automatic
sizing. These options concern cooperative execution.

Commit growth is serviced before primary growth. A parked commit pins its basis
snapshot; other completed zero remainders can still be retired because they do
not append a basis rule.

## Progress fields

Native status and browser scheduler statistics expose:

- `memoryWaitingRows`, `rowWorkspaceGrowths`, and `fairHelperTurns`;
- `commitRowWorkspaceBytes` / `commitReserveBytes` and `commitReserveActive`;
- per-row `memoryWaitReason`, `requestedWorkspaceBytes`, and `workspaceGrowths`.

Wait reasons are `1` for a reserve lease, `2` for sparse-row growth, `3` for
normal-form output space, and `4` for a serialized batch-output buffer.
Workspace totals include the private commit reserve. The configured worker
reserve limit applies to worker leases; the private commit lease is additional.

Durable frontiers still save pending pair descriptors. In-memory row retention
does not extend across a process restart. Accepted rules and completed-pair
identities remain durable.

The legacy barrier scheduler retains its separate batch-retry policy. These
retained-row and fair-helper rules apply to cooperative execution.
