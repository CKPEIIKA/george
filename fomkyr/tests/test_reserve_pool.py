"""Single-reserve parity and replay with two live exceptional row leases."""
import ctypes as C
import json
import time
from test_cooperative_helpers import engine, run, degree, ROOT
from native import check
from oracle import normal

start = time.monotonic()
reference_engine = engine(False, pool=1)
run(reference_engine)
reference = reference_engine.basis()
candidate = engine(pool=0)
observed = dict(active=0, admitted=0)


def two_leases(e):
    active = int(e.lib.gn_reserve_pool_stat(4))
    observed['active'] = max(observed['active'], active)
    observed['admitted'] = max(observed['admitted'], int(e.lib.gn_reserve_pool_stat(0)))
    return active >= 2


saved = run(candidate, pause=two_leases)
assert saved is not None, observed
records, cursor, helpers = saved
assert observed['active'] >= 2 and not candidate.lib.gn_reserve_pool_stat(4)
restored = engine(pool=0)
for record in records:
    C.memmove(restored.lib.host_pointer(restored.lib.gn_import_buffer()), record, len(record))
    check(restored.lib.gn_restore_rule(len(record), 0))
C.memmove(restored.lib.host_pointer(restored.lib.gn_import_buffer()), cursor, len(cursor))
check(restored.lib.gn_frontier_restore(len(cursor)))
run(restored)
basis = restored.basis()
assert all(not normal(p, reference) for p in basis)
assert all(not normal(p, basis) for p in reference)
assert restored.lib.gn_stat(4) <= restored.lib.gn_stat(5)
assert not restored.lib.gn_reserve_pool_stat(4)
report = dict(passed=True, degree=degree, basisSize=len(basis),
              checkpointRecords=len(records), liveAtCheckpoint=observed['active'],
              admittedAtCheckpoint=observed['admitted'],
              restoredWorkspaces=int(restored.lib.gn_reserve_pool_stat(0)),
              mutualExactIdealMembership=True, seconds=time.monotonic()-start)
destination = ROOT / 'results/0.7.0/reserve-pool.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2)+'\n')
print('RESERVE_POOL_EXACT_PARITY_PASSED', json.dumps(report), flush=True)
