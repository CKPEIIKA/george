# Cooperative row resources

The cooperative scheduler retains unfinished sparse rows in memory between
waves. Their original basis snapshots, pivots, tail cursors, normal prefixes,
word queues and exact coefficient roots remain attached to those rows.

## Memory pressure

A row that cannot store its next term enters `GN_ROW_WAIT`. Other lanes continue
working. At the next joined barrier, the coordinator can grow that row's storage
within the configured budget. A larger idle worker lease can be exchanged with
a smaller lease; released allocation ranges are reused.

Before requesting another whole arena, a packed-word row can reuse its current
arena. The coordinator sizes its node reserve to the current table and growth
headroom, moves initialized queue indices through operation scratch, and copies
coefficient roots into reclaimed space. Every copy is checked for capacity and
source overlap before the layout changes. Table expansion can first stage roots
in the existing higher coefficient semispace. The pivot and unfinished tail
cursor stay attached to the same exact row.

An additional worker lease can be admitted at the waiting row's estimated
replacement size. Refusing another lease at the initial large-reserve size does
not prevent admitting a smaller lease that fits. Both admission and layout
changes occur with all workers joined and remain within the memory budget.

If a row still waits for space, the coordinator can repack a different retained
large lease around its current table and live coefficient roots. It leaves
coefficient and arithmetic headroom, then returns the unused suffix to the shared
arena allocator. The waiting row can borrow that range in the same joined wave.
The repacked row keeps its pivot, queue order and unfinished tail cursor. This
reuses budgeted storage; it does not promise an immediate decrease in process RSS.

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

Native per-row diagnostics also expose `memoryPressureKind` (`1` coefficients,
`2` table capacity, `3` arithmetic scratch), `rowWorkspaceBytes`,
`liveCoefficientRootBytes`, `minimumRowWorkspaceBytes`, and `rowRelayouts`.
The coefficient and minimum-workspace fields describe the most recent pressure
check. The latter estimates a replacement layout with growth headroom; it is
not a lower bound on the memory needed by the current row. Overflow coefficient
buffers are accounted separately from `rowWorkspaceBytes`. Before discarding
live rows after a workspace-limit stop, the native host saves these diagnostics
to `row-workspace-limit.json` beside its checkpoints.

From the George repository root, `npm run test:fomkyr:row-growth` checks in-place
coefficient growth, subsequent table expansion, smaller-lease admission, budget
refusal, and exact cursor/queue preservation under binary and radix queues,
natively and in all Wasm variants. It also completes a suspended normal form
with large exact coefficients and checks every resulting term.
The lease-sharing checks also overwrite returned storage and complete an exact
normal form after shrinking and subsequently regrowing its table.

A retained reserve row can grow into a free adjacent suffix. This needs only
the additional workspace plus temporary storage for initialized queue indices
and live coefficients, rather than two complete node tables. Allocation refusal
leaves its original lease and exact cursor intact. The row-growth checks cover
both queues, refused staging allocations and poisoning of returned staging memory.
Only table-capacity pressure requests doubled node capacity. Coefficient and
arithmetic-scratch pressure reuse the current capacity, avoiding unnecessary
multi-gigabyte node arrays.

Memory-parked rows do not consume the scheduler's active sector-finisher slots.
A pending task counts as runnable helper work only when a free helper can read
its reducer records. Pending oversized or previously deferred tasks cannot mask
an all-parked workspace limit by keeping the coordinator in a busy loop.

## Large reducer records

The rule-read buffer grows independently of row arithmetic scratch. Before each
cooperative wave, primary and commit buffers must hold the largest accepted
record, including records loaded from a checkpoint. Growth uses the same memory
budget and occurs with every reader joined. It preserves retained row state.
Small helper buffers remain bounded and defer reducers they cannot read.

This prevents a checkpoint restored with a temporary smaller worker count from
failing after returning to the requested concurrency. An actual budget refusal
is reported as `MEMORY_BUDGET`; it preserves the old buffer and saved frontier.

Durable frontiers still save pending pair descriptors. In-memory row retention
does not extend across a process restart. Accepted rules and completed-pair
identities remain durable.

The legacy barrier scheduler retains its separate batch-retry policy. These
retained-row and fair-helper rules apply to cooperative execution.
