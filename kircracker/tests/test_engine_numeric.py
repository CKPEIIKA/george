"""Bounded exact controls for the optimized native engine."""
import ctypes as C
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest
import contextlib
import importlib.util
import io
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class NativeEngine(unittest.TestCase):
    def test_dashboard_reads_native_runner_events(self):
        spec = importlib.util.spec_from_file_location('pilot_dashboard_control', ROOT / 'tools/pilot_dashboard.py')
        dashboard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(dashboard)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'STATE.json').write_text(json.dumps({'pid': os.getpid(), 'stage': 'RUNNING',
                'startedUnix': time.time()-2, 'updatedUnix': time.time(), 'tasks': []}))
            (root / 'RESULT.json').write_text('{}')
            (root / 'events.jsonl').write_text(json.dumps({'type': 'block_started', 'elapsedSeconds': 1})+'\n')
            stream = io.StringIO()
            with contextlib.redirect_stdout(stream):
                dashboard.show_dashboard(root, once=True, color='never', search_log=None)
            self.assertIn('block started', stream.getvalue())

    def test_gmp_rational_upper_arithmetic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rel = root / 'wide.rel'
            # In the cyclic right module a=0 at the generator. Over Q this
            # nonzero even coefficient kills ba; over F2 it contributes no row.
            rel.write_text(f'2 3\n2 1\n1 0 0\n2 1\n1 1 1\n2 1\n{2**200+2} 1 0\n')
            def run(prime, extra=()):
                result = subprocess.run([str(ROOT / 'bin/kir-relative'), '--n', '3', '--degree', '5',
                    '--prime', str(prime), '--relations', str(rel), *extra],
                    capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
                return json.loads(result.stdout.splitlines()[-1])
            self.assertEqual(run(0)['relative'], [1, 1, 0, 0, 0, 0])
            self.assertEqual(run(2)['relative'], [1, 1, 1, 1, 1, 1])
            # An ungraded rational control: 2ca-3cb gives cb=(2/3)ca.
            rel.write_text('3 1\n2 2\n2 2 0\n-3 2 1\n')
            dump = root / 'rational.json'
            result = subprocess.run([str(ROOT / 'bin/kir-relative'), '--n', '4', '--degree', '2',
                '--prime', '0', '--ungraded', '--relations', str(rel), '--dump', str(dump)],
                capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            maps = json.loads(dump.read_text())
            self.assertIn('2/3', [c for row in maps['levels'][2]['rightActions'] for _, c in row])

    def test_partial_discovery_continues_its_journal(self):
        from app.records import packed, read_minor
        from app.worker import discover_task, verify_pending_task
        from app.scheduler import retain_verified_minor, discovery_complete
        from app.util import atomic_json, sha, json_hash, load
        m, u, v = read_minor(ROOT / 'data/minors/d13/block-01.kcb')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            left, right = root / 'left.bin', root / 'right.bin'
            left.write_bytes(packed(u)); right.write_bytes(packed(v))
            task = {'degree': 13, 'rows': len(u), 'duals': len(v), 'prime': 1000003,
                    'grade': m['grade'], 'transports': m['transports'],
                    'left': str(left), 'right': str(right), 'leftSHA256': sha(left),
                    'rightSHA256': sha(right), 'state': str(root / 'pivot.state'),
                    'output': str(root / 'audit.json'), 'minor': str(root / 'minor.kcb'),
                    'binding': 'a' * 64, 'fingerprint': 'numeric-test', 'seconds': 30}
            task['stateBinding'] = json_hash({k: task[k] for k in
                ['degree', 'rows', 'duals', 'prime', 'leftSHA256', 'rightSHA256']} |
                {'librarySHA256': sha(ROOT / 'bin/libtriepair.so')})
            with patch.dict(os.environ, KIR_MINOR_MAX_RANK='10'):
                first = discover_task(task)
            with patch.dict(os.environ, KIR_MINOR_MAX_RANK='20'):
                second = discover_task(task)
            self.assertEqual(first['candidateRank'], 10)
            self.assertEqual(second['candidateRank'], 20)
            self.assertGreater(second['nextColumn'], first['nextColumn'])
            audited = verify_pending_task({**task, **{k: second[k] for k in ['pending', 'pendingSHA256']}})
            atomic_json(Path(task['output']), audited)
            retained = retain_verified_minor(task, second, 'numeric-test')
            self.assertTrue(retained['acceptedAuditReused'])
            self.assertEqual(retained['additionalEntriesReplayed'], 0)
            self.assertEqual(load(task['output'])['rank'], 20)
            self.assertIsNone(retain_verified_minor(task, {**second, 'candidateRank': 21}, 'numeric-test'))
            self.assertFalse(retained['fullCandidateRank'])
            # A retained minor that already spans every candidate row is complete.
            full = retain_verified_minor({**task, 'rows': 20}, second, 'numeric-test')
            self.assertTrue(full['fullCandidateRank'])
            self.assertTrue(discovery_complete(full))

    def test_scheduler_reports_partial_discovery_incomplete(self):
        from app.records import packed, read_minor
        from app.scheduler import run_tasks, discovery_complete
        from app.util import sha, load
        m, u, v = read_minor(ROOT / 'data/minors/d13/block-01.kcb')

        class Runner:
            memory = 4 * 1024**3; jobs = 1; stopping = False; scratch = 1024**3
            def __init__(self, work):
                self.work = work; self.children = set(); self.events = []
            def event(self, kind, **data):
                self.events.append(kind)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            left, right = root / 'left.bin', root / 'right.bin'
            left.write_bytes(packed(u)); right.write_bytes(packed(v))
            task = {'degree': 13, 'rows': len(u), 'duals': len(v), 'prime': 1000003,
                    'grade': m['grade'], 'transports': m['transports'],
                    'left': str(left), 'right': str(right), 'leftSHA256': sha(left),
                    'rightSHA256': sha(right), 'output': str(root / 'lower/g.audit.json'),
                    'minor': str(root / 'lower/g.kcb'), 'binding': 'b' * 64,
                    'memoryBytes': 1024**3, 'seconds': 0, 'wallSeconds': 0}
            runner = Runner(root)
            # The rank cap stops the scan early, as a deadline or SIGTERM would.
            with patch.dict(os.environ, KIR_MINOR_MAX_RANK='10'):
                done, errors = run_tasks(runner, [task], 'discover')
            self.assertEqual(len(done), 1)
            self.assertEqual(done[0]['rank'], 10)
            self.assertTrue(load(task['output'])['passed'])
            self.assertEqual([e['error'] for e in errors], ['candidate columns not exhausted'])
            self.assertIn('block_incomplete', runner.events)
            # Without the cap the next run resumes the journal and finishes.
            done, errors = run_tasks(runner, [task], 'discover')
            self.assertEqual(errors, [])
            self.assertTrue(discovery_complete(done[0]))
            self.assertEqual(done[0]['rank'], len(u))

    def test_auto_memory_on_small_hosts(self):
        from app import util
        with patch.object(util, 'memory_state', return_value=(1024**3, 1024**3)):
            self.assertGreaterEqual(util.hardware()['recommendedMemoryBytes'], 256 * 1024**2)
        with patch.object(util, 'memory_state', return_value=(64 * 1024**3, 50 * 1024**3)):
            self.assertEqual(util.hardware()['recommendedMemoryBytes'], int(50 * 1024**3 - 64 * 1024**3 * .05))

    def test_partial_minor_is_not_a_completed_search(self):
        from app.scheduler import discovery_complete
        self.assertFalse(discovery_complete({'passed': True, 'rank': 24000, 'nextColumn': 40000}))
        self.assertFalse(discovery_complete({'passed': True, 'rank': 24000, 'candidateColumnsExhausted': False}))
        self.assertTrue(discovery_complete({'passed': True, 'candidateColumnsExhausted': True}))
        self.assertTrue(discovery_complete({'passed': True, 'fullCandidateRank': True}))

    def test_nonzero_degree23_24_prefix_parity(self):
        from app.native import libraries, verify_words
        from app.records import packed, code, MASK
        pair, _ = libraries()
        pair.kp_eval_wide.argtypes = [C.c_void_p, C.c_uint64, C.c_uint64,
                                      C.c_uint64, C.c_uint64, C.c_int]
        pair.kp_eval_wide.restype = C.c_int
        from app.records import unpacked
        # Degree 23 comes from the first pivot of an independently replayed
        # minor (SHA256 71a6fd10692f953b1a15f39fe5bdb6882a72de329bda340e7221bebb7330fc22).
        samples = {
            23: (unpacked(bytes.fromhex('5f595c595e599cceef59ec0f00000000'), 23)[0],
                 unpacked(bytes.fromhex('bfda4f81bf323d7271a3680a00000000'), 23)[0], 1000002),
            24: (bytes([5,15,14,12,5,9,14,15,12,14,9,12,5,9,5,14,5,9,5,12,5,9,5,15]),
                 bytes([13,10,6,8,10,3,7,1,7,2,3,13,3,2,11,15,8,1,4,15,13,10,11,15]), 1),
        }
        context = pair.kp_create(6, 1000003, 100000)
        self.assertTrue(context)
        try:
            for degree, (u, v, want) in samples.items():
                x, y = code(u), code(v)
                self.assertEqual(pair.kp_eval_wide(context, x & MASK, x >> 64,
                                                  y & MASK, y >> 64, degree), want)
                for accumulator in ['reference', 'flat']:
                    with patch.dict(os.environ, KIR_VERIFY_ACCUMULATOR=accumulator):
                        got = verify_words({'degree': degree, 'rank': 1, 'prime': 1000003},
                                           packed([u]), packed([v]))
                    self.assertEqual(got['determinant'], want)
        finally:
            pair.kp_destroy(context)

    def test_numeric_kernels_and_journal(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'numeric'
            command = [*shlex.split(os.environ.get('CXX', 'g++')), '-std=c++20', '-O1',
                       '-fsanitize=undefined', '-fno-sanitize-recover=undefined',
                       '-I', str(ROOT / 'src'), str(ROOT / 'tests/engine_numeric.cpp'), '-o', str(target)]
            built = subprocess.run(command, capture_output=True, text=True, timeout=90)
            self.assertEqual(built.returncode, 0, built.stderr)
            ran = subprocess.run([str(target), tmp], capture_output=True, text=True, timeout=60)
            self.assertEqual(ran.returncode, 0, ran.stderr)
            self.assertEqual(json.loads(ran.stdout)['determinantCases'], 260)

    def test_prefix_accumulator_and_determinant_modes(self):
        from app.native import libraries, buffer, verify_words, P64
        from app.records import packed, read_minor
        _, verifier = libraries()
        verifier.kv_matrix_wide.argtypes = [C.c_int, C.c_int, P64, C.c_int, P64, C.c_int,
                                            C.POINTER(C.c_int64), C.c_int]
        verifier.kv_matrix_wide.restype = C.c_int
        m, u, v = read_minor(ROOT / 'data/minors/d13/block-01.kcb')
        rank = 33
        left, right = packed(u[:rank]), packed(v[:rank])
        raw = (C.c_int64 * (rank * rank))()
        self.assertEqual(verifier.kv_matrix_wide(6, 13, buffer(left), rank, buffer(right), rank, raw, 1), 0)
        expected = (C.c_int32 * (rank * rank))(*(x % 1000003 for x in raw))
        answers = []
        for accumulator in ['reference', 'flat']:
            for determinant in ['sparse', 'blocked']:
                for threads in [1, 2]:
                    with patch.dict(os.environ, KIR_VERIFY_ACCUMULATOR=accumulator,
                                    KIR_VERIFY_DETERMINANT=determinant):
                        value = verify_words({'degree': 13, 'rank': rank, 'prime': 1000003},
                                             left, right, expected=expected, threads=threads)
                        answers.append(value['determinant'])
        self.assertEqual(len(set(answers)), 1)


if __name__ == '__main__':
    unittest.main()
