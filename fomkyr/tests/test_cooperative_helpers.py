"""Exact helper-row parity and portable checkpoint replay under reserve pressure."""
import ctypes as C
import json
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tools'), str(ROOT / 'tests')]
from cooperative_engine import CooperativeEngine
from native import check
from oracle import normal, certify

fixture = json.loads((ROOT / 'fixtures/published/affine-q-serre-q3.json').read_text())
degree = 16


def engine(helpers=True):
    e = CooperativeEngine(fixture, degree, workers=4, budget=256 << 20,
                          scratch=6 << 20, row_reserve=64 << 20,
                          quantum=1, lookahead=64)
    for name, args, result in [
        ('gn_coop_helper_mode', [C.c_uint32], C.c_int),
        ('gn_frontier_export', [], C.c_uint64),
        ('gn_frontier_size', [], C.c_uint32),
        ('gn_frontier_restore', [C.c_uint32], C.c_int),
    ]:
        fn = getattr(e.lib, name)
        fn.argtypes, fn.restype = args, result
    check(e.lib.gn_coop_helper_mode(int(helpers)))
    return e


def capture(e):
    records = []
    for i in range(1, int(e.lib.gn_stat(0)) + 1):
        pointer = e.lib.gn_export_rule(i)
        assert pointer
        records.append(C.string_at(e.lib.host_pointer(pointer), e.lib.gn_export_size()))
    pointer = e.lib.gn_frontier_export()
    assert pointer
    cursor = C.string_at(e.lib.host_pointer(pointer), e.lib.gn_frontier_size())
    helpers = [int(e.lib.gn_coop_stat(600 + i)) for i in range(e.workers)]
    return records, cursor, helpers


def run(e, pause=False):
    with ThreadPoolExecutor(e.workers) as pool:
        while int(e.lib.gn_stat(3)) or int(e.lib.gn_stat(2)) < degree:
            d = int(e.lib.gn_stat(3))
            if not d:
                d = int(e.lib.gn_stat(2)) + 1
                for relation in fixture['relations']:
                    if relation['degree'] == d:
                        e.load(relation)
                check(e.lib.gn_start_degree(d))
            while True:
                n = e.lib.gn_coop_fill(e.lookahead)
                check(n if n < 0 else 0)
                if not n:
                    break
                readers = [pool.submit(e.lib.gn_coop_reduce, i)
                           for i in range(1, e.workers)]
                check(e.lib.gn_coop_reduce(0))
                check(e.lib.gn_coop_prepare_commit())
                for reader in readers:
                    check(reader.result())
                # Capture before commit, so completed helper outputs and all
                # unfinished rows still belong to the portable pending frontier.
                if pause and int(e.lib.gn_coop_stat(23)):
                    saved = capture(e)
                    e.lib.gn_cancel(1)
                    e.lib.gn_coop_discard()
                    assert not e.lib.gn_reserve_stat(0, 9)
                    return saved
                check(e.lib.gn_coop_commit())
            check(e.lib.gn_finish_degree())


started = time.monotonic()
e = engine(False)
run(e)
reference = e.basis()
e = engine()
records, cursor, parked_helpers = run(e, pause=True)
assert records and cursor
e = engine()
for record in records:
    C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()), record, len(record))
    check(e.lib.gn_restore_rule(len(record), 0))
C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()), cursor, len(cursor))
check(e.lib.gn_frontier_restore(len(cursor)))
assert e.lib.gn_stat(3)
run(e)
basis = e.basis()
assert all(not normal(p, reference) for p in basis)
assert all(not normal(p, basis) for p in reference)
compositions = certify(basis, fixture['relations'], degree)
report = dict(passed=True, degree=degree, basisSize=len(basis),
              checkpointRecords=len(records), parkedHelpers=parked_helpers,
              independentCompositions=compositions,
              helperFinished=int(e.lib.gn_coop_stat(23)),
              seconds=time.monotonic() - started)
destination = ROOT / 'results/0.7.0/cooperative-helpers.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2) + '\n')
print('HELPER_FRONTIER_EXACT_PARITY_PASSED', json.dumps(report), flush=True)
