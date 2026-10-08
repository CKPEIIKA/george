# Reordering an unfinished degree

An ordinary resume preserves the checkpoint's pair order. An explicit native
`--resume JOB --pair-order word --replan-remaining` changes the order of the
unfinished portion of that degree. It preserves all committed basis records and
all completed or exactly skipped pair identities. Uncommitted rows are replayed,
as with any checkpoint resume.

The migration requires a quiescent restored frontier. It enumerates each raw
proper overlap with its original stable ordinal and records a bitmap of consumed
ordinals. It retains the union of the unissued tail and outstanding descriptors,
then sorts that union using the requested ordering and the original ordinal as
a deterministic tie breaker. The relation set and the monomial order are unchanged.

Frontier version 4 extends the 40-word header: field 38 is the bitmap byte length,
field 39 is its set-bit count, and field 37 is the cursor in the newly sorted
remaining plan. Pending descriptors precede the bitmap. The invariants are:

- `seen = consumed-bit count + cursor`;
- `scheduled = committed + pending`;
- `seen = scheduled + monomial skips + chain skips`;
- all pending descriptors occur uniquely in the dispensed plan prefix.

Restoration validates the checksum, bitmap padding and popcount, reconstructs the
same raw enumeration, filters consumed ordinals, regenerates the requested sort,
and validates pending membership. Versions 1, 2 and 3 remain readable. New degrees
start with an ordinary plan and no consumed bitmap. Binary basis records stay ABI 3.

Migrated jobs require the patched `0.7.2-replan1` reader or a later reader supporting
frontier version 4. Keep a pre-migration checkpoint and binary for rollback; older
readers can reject the migrated frontier and fall back to an earlier checkpoint.
