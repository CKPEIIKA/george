# Exact coefficient storage and row caches

`src/exact_rational_storage.hpp` provides storage helpers for exact rational
relation searches. They do not change the algebra or certify a rank themselves.

## Coefficient interning

`ExactRationalPool` assigns an index to each canonical GMP rational. It hashes
the numerator and denominator limbs directly, avoiding a decimal-string copy of
every stored coefficient. Hash collisions are resolved by exact rational
comparison. Indices 0, 1 and 2 represent zero, one and minus one.

Callers must supply canonical rationals. Stored coefficients are immutable.
The reported byte charge excludes allocator overhead and unused GMP capacity;
process RSS remains the resource-admission measure.

## Rebuildable integer rows

A rational pivot can also be represented as an integer row and a common
denominator. Keeping every such conversion duplicates the original row bank and
can consume the entire workspace.

`ExactRowCache` retains these conversions under a caller-supplied byte budget,
evicting the least recently used row. The original pivot and its proof identity
are preserved. A later access reconstructs the conversion exactly. An individual
row larger than the cache budget uses one temporary row; it is not retained in
the cache.

The returned reference is valid until the next cache access. A reduction must
finish using that row before requesting another. The caller supplies a storage
charge covering its row representation and coefficient limbs. This logical
budget supplements an operating-system memory limit.

Useful diagnostics are cache bytes, hits, misses, evictions, oversized rows,
coefficient bytes and process RSS. A bounded cache fixes unbounded duplication;
its effect on speed depends on the working set.

## Recovery and mathematical acceptance

Cache contents are disposable. Persist the original coefficients, pivot IDs,
relation provenance and committed journal offsets. Eviction must not discard an
accepted relation, change its order, or turn an unfinished computation into zero.
Final zero identities and new rank witnesses still require independent replay.
