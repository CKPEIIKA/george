# Bounded sector finishing

Use the native `--pair-order gateword` policy with the imported FK6 component
profile. `--replan-remaining` explicitly changes the unfinished part of a saved
word plan. Committed rules and completed pair identities remain retained.
The general default is unchanged; other presentations use ordinary word ordering.

The policy considers sectors within one to five independent leaders of their
imported target. It ranks them by remaining eligible candidates divided by the
deficit and mean input support. This is a cost proxy, not measured CPU time.
Known monomial and interior-chain zeros are excluded from the selection score.

A front burst supplies eight small candidate rows. Cooperative execution reserves
at most two lanes for the selected sector while ordinary work remains. Other
lanes continue their ordinary work; existing unfinished normal forms keep their
arenas and snapshots. If only target-sector work remains, idle lanes can help.
After 32 completed attempts without a new leader, the target cools down for 256
global commits. The candidate pool is refreshed after eight target completions
or 128 global commits. These choices affect scheduling only. Mathematical skips
still require the existing imported-dimension equality check.

## Durable coverage

Dynamic promotions invalidate a saved positional cursor. Frontier version **7**
stores the exact bitmap of finished raw overlap ordinals and an explicit list of
pending descriptors. Resume reconstructs the remaining set, puts the pending
rows in a declared prefix and ranks the unissued tail anew. It does not infer
finished identities from a priority order. The bitmap popcount must equal
`seen - pending`; all pending identities must remain outside that bitmap.

The exporter builds this information in its I/O buffer. It does not reorder live
queues, change task indices, or alter retained row state. Polynomial records keep
ABI 3. Process restart replays unfinished reductions from their descriptors.

Readers retain older word, cost and raw frontiers. An older `gateword` frontier
with a finished promoted prefix is refused: its missing identity information
cannot be recovered from a cursor. A wholly pending prefix remains recoverable.
Keep an updated reader for version-7 checkpoints; older readers cannot resume it.

## Observability and checks

Native status includes `sectorFinisher` (target, deficit, lane limit, attempt and
success counts, cooldowns, selected/held rows) and all 360 `sectorDeficits` when
component counts are available. Adaptive statistics are scoped to the current
degree and restart; they are not mathematical proof data.

Run `python3 tests/test_sector_finisher.py` for descriptor-set parity after
promotion, GM-mask persistence, 512 legacy anchors plus 512 pending rows,
cooperative coverage/flow and cooldown checks. The synthetic monomial fixture
has exact zero critical compositions; seeded dimensions test routing only.
Separate validation checks actual FK6 partial resumes and independent rational
and prime-field small cases. No speedup follows from these correctness checks.
