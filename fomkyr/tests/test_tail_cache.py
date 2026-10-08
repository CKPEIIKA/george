#!/usr/bin/env python3
"""Bounded exact cache parity, private invariants and optional Wasm replay."""
import argparse
import ctypes as C
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tools'), str(ROOT / 'tests')]
from canonical_audit import records, canonicalize
from field_oracle import ModularOracle
import oracle

TINY = {'variables': list('abc'), 'relations': [
    {'degree': 2, 'terms': [{'word': [2, 2], 'coefficient': '1'},
                           {'word': [1, 1], 'coefficient': '-1'},
                           {'word': [0, 0], 'coefficient': '-1'}]},
    {'degree': 2, 'terms': [{'word': [1, 1], 'coefficient': '1'},
                           {'word': [0, 0], 'coefficient': '-1'}]},
]}

def run(args, **kw):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                       timeout=120, **kw)
    assert p.returncode == 0, (args, p.stdout, p.stderr)
    return p

def main():
    ap = argparse.ArgumentParser(__doc__)
    ap.add_argument('--wasm', action='store_true')
    ap.add_argument('--binary', type=Path, default=ROOT / 'dist/fomkyr')
    args = ap.parse_args()
    binary = args.binary.resolve()
    report = []
    with tempfile.TemporaryDirectory(prefix='fomkyr-tail-cache-') as folder:
        tmp = Path(folder)
        library = tmp / 'properties.so'
        run(shlex.split(os.environ.get('CC', 'cc')) + [
            '-std=c11', '-O2', '-fPIC', '-shared', '-fvisibility=default',
            'tests/test_tail_cache.c', 'tests/host.c', '-o', str(library)])
        lib = C.CDLL(str(library))
        lib.host_init.argtypes = [C.c_uint64, C.c_char_p]
        assert lib.host_init(256 << 20, None)
        for name, params in [('test_tail_cache_budget', ()),
                             ('test_pair_replay_fallback', ()),
                             ('test_tail_cache_generation', (0,)),
                             ('test_tail_cache_generation', (1,))]:
            fn = getattr(lib, name)
            fn.argtypes = [C.c_uint32] * len(params)
            fn.restype = C.c_int
            result = fn(*params)
            assert result == 0, (name, params, 'failing C line', result)
            report.append({'property': name, 'parameters': params, 'passed': True})
        fixture = tmp / 'tiny.json'
        fixture.write_text(json.dumps(TINY))
        cases = [(fixture, 6), (ROOT / 'fixtures/pair-plan-fk4.json', 6),
                 (ROOT / 'fixtures/fk6.json', 5),
                 (ROOT / 'fixtures/big-coefficients.json', 5)]
        for i, (file, degree) in enumerate(cases):
            f = json.loads(file.read_text())
            for prime in ([0] if i == 3 else [0, 2, 101]):
                ref = oracle if prime == 0 else ModularOracle(prime)
                expected = canonicalize(ref.complete(f['relations'], degree), prime)[0]
                for scheduler in ['barrier', 'cooperative']:
                    for cache in ['off', '64M']:
                        job = tmp / f'job-{i}-{prime}-{scheduler}-{cache}'
                        p = run([str(binary), '-i', str(file), '-d', str(degree),
                                 '-j', '2', '--memory', '256M', '--field', str(prime),
                                 '--workdir', str(job), '--quiet', '--export',
                                 '--scheduler', scheduler, '--quantum-ms', '1',
                                 '--reducer-tail-cache', cache, '--pair-order', 'word',
                                 '--plan-min-degree', '2'])
                        result = json.loads(p.stdout)
                        raw = next((job / 'fomkyr').glob('alg-*/basis.gnb'))
                        basis = list(records(raw, degree, len(f['variables'])))
                        assert canonicalize(basis, prime)[0] == expected
                        compositions = ref.certify(basis, f['relations'], degree)
                        if i == 0 and cache != 'off':
                            assert result['reducerTailCache']['built'] > 0
                            assert result['reducerTailCache']['hits'] > 0
                        report.append({'case': file.name, 'degree': degree,
                                       'prime': prime, 'scheduler': scheduler,
                                       'cache': cache, 'criticalCompositions': compositions,
                                       'passed': True})
                print('PASS', file.name, prime, flush=True)
        if args.wasm:
            manifest = tmp / 'wasm.json'
            run(['node', 'tests/test_tail_cache_wasm.mjs', str(tmp / 'wasm'),
                 str(fixture), str(manifest)])
            for row in json.loads(manifest.read_text())['cases']:
                prime = row['prime']
                ref = oracle if prime == 0 else ModularOracle(prime)
                actual = list(records(Path(row['record']), 6, 3))
                assert canonicalize(actual, prime)[0] == canonicalize(
                    ref.complete(TINY['relations'], 6), prime)[0]
                ref.certify(actual, TINY['relations'], 6)
                report.append({k: v for k, v in row.items() if k != 'record'})
            report.append({'wasmPropertiesAndResume': True, 'passed': True})
    destination = ROOT / 'results/tail-cache/tests.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({'passed': True, 'cases': report}, indent=2) + '\n')
    print('TAIL CACHE PASS', len(report), flush=True)

if __name__ == '__main__':
    main()
