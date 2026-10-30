#!/usr/bin/env python3
"""Bounded exact engine comparison on one saved minor; no full-job speed forecast."""
import argparse
import ctypes as C
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.records import read_minor, packed


def trial(task):
    # Each trial has fresh allocator/cache state; parsing and loading are outside
    # the native-call timing for every evaluator.
    meta, rows, cols = read_minor(Path(task['minor']))
    rank = min(task['rank'], len(rows))
    left = (C.c_uint64 * (2 * rank)).from_buffer_copy(packed(rows[:rank]))
    right = (C.c_uint64 * (2 * rank)).from_buffer_copy(packed(cols[:rank]))
    lib = C.CDLL(task['library'])
    for key in ['KIR_PAIR_STATE', 'KIR_PAIR_STATE_BINDING', 'KIR_MINOR_MAX_RANK', 'KIR_WORKER_BYTES']:
        os.environ.pop(key, None)
    os.environ.update(task.get('environment', {}))
    if task['kind'] == 'discovery':
        lib.kp_create.argtypes = [C.c_int, C.c_int, C.c_uint64]
        lib.kp_create.restype = C.c_void_p
        lib.kp_destroy.argtypes = [C.c_void_p]
        fn = lib.kp_minor_trie_wide
        fn.argtypes = [C.c_void_p, C.POINTER(C.c_uint64), C.c_int,
                       C.POINTER(C.c_uint64), C.c_int, C.c_int,
                       C.POINTER(C.c_int), C.POINTER(C.c_int), C.POINTER(C.c_int),
                       C.POINTER(C.c_uint64), C.c_double]
        fn.restype = C.c_int
        context = lib.kp_create(6, meta['prime'], 0)
        if not context:
            raise RuntimeError('cannot initialize discovery')
        indices, columns, stats = (C.c_int * rank)(), (C.c_int * rank)(), (C.c_uint64 * 6)()
        start, cpu = time.perf_counter(), time.process_time()
        try:
            rc = fn(context, left, rank, right, rank, meta['degree'], indices, columns, None, stats, 60.0)
        finally:
            wall, used = time.perf_counter() - start, time.process_time() - cpu
            lib.kp_destroy(context)
        if rc != rank:
            raise RuntimeError(f'discovery control lost rank: {rc} != {rank}')
        checksum = hashlib.sha256(bytes(indices) + bytes(columns)).hexdigest()
        result = {'rank': rc, 'selectionSHA256': checksum}
    else:
        fn = lib.kv_verify_compact128 if meta['degree'] > 20 else lib.kv_verify_compact
        fn.argtypes = [C.c_int, C.c_int, C.POINTER(C.c_uint64), C.POINTER(C.c_uint64),
                       C.c_int, C.c_int, C.c_int, C.c_int, C.POINTER(C.c_int32),
                       C.POINTER(C.c_int32), C.POINTER(C.c_uint64)]
        fn.restype = C.c_int
        determinant, stats = C.c_int32(), (C.c_uint64 * 2)()
        start, cpu = time.perf_counter(), time.process_time()
        rc = fn(6, meta['degree'], left, right, rank, meta['prime'], 1, 64,
                None, C.byref(determinant), stats)
        wall, used = time.perf_counter() - start, time.process_time() - cpu
        if rc:
            raise RuntimeError(f'independent verifier control failed: {rc}')
        result = {'rank': rank, 'determinant': determinant.value, 'entryStatistic': int(stats[1])}
    import resource
    return {**result, 'wallSeconds': wall, 'cpuSeconds': used,
            'peakRSSBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024}


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--trial':
        print(json.dumps(trial(json.loads(Path(sys.argv[2]).read_text()))))
        return
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--minor', type=Path, required=True)
    p.add_argument('--reference-pair', type=Path, required=True)
    p.add_argument('--reference-verifier', type=Path, required=True)
    p.add_argument('--rank', type=int, default=128)
    p.add_argument('--trials', type=int, default=5)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.rank < 1 or args.trials < 3:
        p.error('rank >=1 and at least 3 trials are required')
    minor, u, _ = read_minor(args.minor)
    variants = [
        ('discovery-reference', 'discovery', args.reference_pair, {}),
        ('discovery-candidate', 'discovery', ROOT / 'bin/libtriepair.so', {}),
        ('verify-reference', 'verify', args.reference_verifier, {}),
        ('verify-flat-sparse', 'verify', ROOT / 'bin/libverify.so',
         {'KIR_VERIFY_ACCUMULATOR': 'flat', 'KIR_VERIFY_DETERMINANT': 'sparse'}),
        ('verify-flat-blocked', 'verify', ROOT / 'bin/libverify.so',
         {'KIR_VERIFY_ACCUMULATOR': 'flat', 'KIR_VERIFY_DETERMINANT': 'blocked'}),
        ('verify-map-blocked', 'verify', ROOT / 'bin/libverify.so',
         {'KIR_VERIFY_ACCUMULATOR': 'reference', 'KIR_VERIFY_DETERMINANT': 'blocked'}),
    ]
    samples = {v[0]: [] for v in variants}
    with tempfile.TemporaryDirectory() as tmp:
        taskfile = Path(tmp) / 'task.json'
        for repeat in range(args.trials + 1):
            # Alternate order to reduce directional temperature/load drift.
            for name, kind, lib, env in variants[::1 if repeat % 2 else -1]:
                task = {'kind': kind, 'library': str(lib.resolve()), 'minor': str(args.minor.resolve()),
                        'rank': args.rank, 'environment': {'KIR_TRIE_CACHE_MB': '64', **env}}
                taskfile.write_text(json.dumps(task))
                run = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--trial', str(taskfile)],
                                     capture_output=True, text=True, timeout=90)
                if run.returncode:
                    raise RuntimeError(name + ': ' + run.stderr[-2000:])
                value = json.loads(run.stdout)
                if repeat:
                    samples[name].append(value)
    verify = [s['determinant'] for name, rows in samples.items() if name.startswith('verify') for s in rows]
    assert len(set(verify)) == 1, 'verifier determinants disagree'
    discovery = [s['selectionSHA256'] for name, rows in samples.items() if name.startswith('discovery') for s in rows]
    assert len(set(discovery)) == 1, 'discovery selections disagree'
    output = {'quantity': 'exact complementary derivative-pairing submatrix',
              'mode': 'single-thread native C++ call; cold process per trial',
              'scope': 'bounded saved-minor submatrix; not an overall degree-23 runtime estimate',
              'degree': minor['degree'], 'rank': min(args.rank, len(u)), 'trials': args.trials,
              'warmupTrials': 1, 'exactParityPassed': True,
              'sourceMinorSHA256': hashlib.sha256(args.minor.read_bytes()).hexdigest(),
              'librarySHA256': {name: hashlib.sha256(lib.read_bytes()).hexdigest() for name, _, lib, _ in variants},
              'results': {name: {'medianWallSeconds': statistics.median(s['wallSeconds'] for s in rows),
                                 'medianCPUSeconds': statistics.median(s['cpuSeconds'] for s in rows),
                                 'minWallSeconds': min(s['wallSeconds'] for s in rows),
                                 'maxWallSeconds': max(s['wallSeconds'] for s in rows),
                                 'peakRSSBytes': max(s['peakRSSBytes'] for s in rows),
                                 'samples': rows} for name, rows in samples.items()}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps({name: {k: v for k, v in row.items() if k != 'samples'} for name, row in output['results'].items()}, indent=2))


if __name__ == '__main__':
    main()
