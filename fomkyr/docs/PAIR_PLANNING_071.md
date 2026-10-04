# Whole-degree pair planning

## Selection

Fomkyr 0.7.1 can build a shared plan of the remaining proper overlaps in each
homogeneous degree. Every candidate retains its original enumeration ordinal.
The ordinary exact normal-form reducers and commit re-reduction process the
selected work.

| Policy | First priority | Tie breakers |
| --- | --- | --- |
| `legacy` | Original enumeration | Original enumeration |
| `overlap` | Longer shared factor | Smaller sum of input term counts; ordinal |
| `sparse` | Smaller sum of input term counts | Longer shared factor; ordinal |

The default is `legacy`. An enabled plan starts at degree 12 unless configured
otherwise. George's FK6 example selects `overlap`. Engine → Scheduling contains
the policy, first degree and memory allowance. Share links preserve all three.
Planning operates over Q and prime fields, with single or multiple workers.
The optional FK dimension gate requires separate authorization.

## Coverage

A proper overlap of degree d uses two basis rows of degrees strictly less than d.
The completed lower-degree basis fixes this candidate set while new degree-d rows
are added. The planner enumerates the same raw triples as the ordinary iterator,
then sorts them. Exact monomial and chain criteria are applied at dispatch.

For an adopted legacy partial cursor with S already visited raw candidates and
pending descriptors A, the plan contains A together with candidates whose
ordinal is at least S. Earlier committed and skipped ordinals remain retained.
The saved committed basis prefix stays intact. Each pending descriptor is checked
against the original enumeration and its immutable basis snapshot.

Budgeted overflow workspaces and helper reductions continue to operate. Plan
adoption requires a quiescent state with every overflow lease released.

## Checkpoints

Basis records retain ABI 3. Planned partial jobs use frontier version 2, recording
policy, cursor, adoption anchors and outstanding descriptors. The maximum frame
is 16,704 bytes, containing up to 512 anchors and 512 pending tasks. It contains
portable little-endian integers and checksums. On restore, the plan is regenerated
and every pending pair must belong to its already dispensed prefix.

An active restored plan keeps its saved policy through the current degree.
A requested policy change applies to later degrees. Changing workers, native/Wasm
execution or Wasm bitness preserves the interpretation of the saved cursor.

**Planned partial jobs require a 0.7.1 reader.** Keep a backup before upgrading;
older readers can reject the new frontier or select an earlier checkpoint.
Ordinary inactive jobs retain frontier version 1. Imported-dimension metadata
continues to require its original authorization.

## Memory

The default allowance is 64 MiB, further bounded by one eighth of the total engine
budget. Each candidate occupies 16 bytes in one shared array. Plan reservations
count against both the planner allowance and the kernel budget. Older reservations
remain allocated until reset.

If a new plan cannot fit, the degree uses legacy enumeration. Restoring an
already planned frontier requires enough memory to regenerate its ordered pool.
A refused restore preserves the saved basis and frontier. Increasing the plan or
total allowance can permit continuation. Zero allowance disables new plans.

Cancellation is polled during enumeration and sorting. Checkpoints retain the
committed prefix and pending descriptors; uncommitted reductions replay after a
process restart.

## Usage

```sh
./dist/fomkyr --resume /path/to/job -d 14 -j 4 --memory 4G \
  --pair-order overlap --plan-min-degree 12 --pair-plan-memory 64M --human
```

The same arguments work with `--wasm`.

```javascript
{ pairOrder: 'overlap', planMinDegree: 12, pairPlanBytes: 64 * 1048576 }
```

Native builds retain O3/LTO and optional host tuning/PGO. The browser build uses
O3/LTO with a fresh Chromium-trained profile for the merged kernel.

## Independent output comparison

`make audit-tools` builds the separate `packed-basis-audit` scanner. It checks
record checksums, word ordering, leading-word minimality and proper-subword
conditions. `tools/stream_canonical.py` normalizes tails using Python exact
integers/Fraction and a bounded private temporary cache. Its scope is the packed
word format through 31 letters.

Canonical equality validates agreement between computations. An independent
Gröbner certificate additionally requires bounded critical-composition and
ideal-membership checks. Imported FK dimensions remain explicitly conditional
until their external proof is independently verified.
