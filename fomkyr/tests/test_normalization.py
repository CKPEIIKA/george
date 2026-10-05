#!/usr/bin/env python3
"""Independent Fraction/Fp checks of the parallel exact export normalizer."""
import ctypes as C
import json
import os
from pathlib import Path
import random
import struct
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tools'), str(ROOT / 'tests')]
from native import Engine, check, decode_record
from physics_cases import cases, case, rel
from field_oracle import ModularOracle
import oracle


def apis(e):
    for name, args, result in [
        ('gn_normalize_prepare', [], C.c_int),
        ('gn_normalize_rule', [C.c_uint32, C.c_uint32], C.c_uint64),
        ('gn_normalize_status', [C.c_uint32], C.c_uint32),
        ('gn_monic_coefficient', [C.c_uint32, C.c_uint32], C.c_uint64),
    ]:
        fn = getattr(e.lib, name)
        fn.argtypes, fn.restype = args, result


def monic(p, prime):
    head = max(p)
    if prime:
        inv = pow(p[head], -1, prime)
        return {w: c * inv % prime for w, c in p.items()}
    return {w: Fraction(c, p[head]) for w, c in p.items()}


def expected(basis, prime):
    # Deliberately use the slow independent subword reducer, not the engine's
    # matcher or a triangular shortcut. This also exercises proper subwords.
    o = ModularOracle(prime) if prime else oracle
    out = {}
    for p in basis:
        head = max(p)
        tail = o.normal({w: c for w, c in p.items() if w != head}, basis)
        q = monic({**tail, head: p[head]}, prime)
        out[head] = q
    return out


def coefficient(e, encoded):
    if encoded & 1:
        p = e.lib.host_pointer(encoded & ~7)
        n = C.c_uint32.from_address(p).value
        v = int.from_bytes(C.string_at(p + 8, n * 4), 'little')
        return -v if encoded & 2 else v
    return (encoded if encoded < 1 << 63 else encoded - (1 << 64)) >> 1


def normalize(e, prime, workers):
    check(e.lib.gn_normalize_prepare())
    out = {}
    with ThreadPoolExecutor(workers) as pool:
        for first in range(1, int(e.lib.gn_stat(0)) + 1, workers):
            ids = list(range(first, min(first + workers, int(e.lib.gn_stat(0)) + 1)))
            offsets = list(pool.map(lambda x: e.lib.gn_normalize_rule(*x), enumerate(ids)))
            for lane, (rid, offset) in enumerate(zip(ids, offsets)):
                if not offset:
                    check(e.lib.gn_normalize_status(lane))
                    raise AssertionError(('missing normalized row', rid))
                p = e.lib.host_pointer(offset)
                size = C.c_uint32.from_address(p + 4).value
                row = decode_record(C.string_at(p, size))
                q = monic(row, prime)
                for i, word in enumerate(row):
                    ratio = e.lib.gn_monic_coefficient(lane, i)
                    assert ratio, (rid, i, e.lib.gn_normalize_status(lane))
                    n, d = struct.unpack('<QQ', C.string_at(e.lib.host_pointer(ratio), 16))
                    assert Fraction(coefficient(e, n), coefficient(e, d)) == q[word]
                out[max(row)] = q
    return out


def main():
    reports = []
    matrix = [f for f in cases() if not f['name'].startswith('FK6')]
    matrix.append(case('rational-tail-chain', ['x', 'y'], [
        rel(((1, 1), 3), ((0, 1), 2)),
        rel(((0, 1), 1), ((0, 0), -1)),
    ], 4))
    rng = random.Random(739)
    for n in range(6):
        rs = [rel(*[(tuple(rng.randrange(3) for _ in range(2)), rng.choice([-5, -1, 1, 3])) for _ in range(3)]) for _ in range(4)]
        matrix.append(case(f'random-quadratic-{n}', ['x', 'y', 'z'], rs, 3))
    with tempfile.TemporaryDirectory(prefix='fomkyr-normalize-') as tmp:
        for f in matrix:
            degree = f['testDegree'] if f['testDegree'] > 31 else min(f['testDegree'], 4)
            for prime in ([0] if degree > 31 else [0, 2, 101]):
                for disk in [None, str(Path(tmp) / 'basis.gnb')]:
                    if disk:
                        Path(disk).write_bytes(b'')
                    e = Engine(f, degree, workers=4, budget=128 << 20, scratch=32 << 20, modulus=prime, disk=disk)
                    apis(e)
                    e.run()
                    raw = list(e.records())
                    basis = [decode_record(b) for b in raw]
                    ref = expected(basis, prime)
                    begin = time.monotonic()
                    actual = normalize(e, prime, 4)
                    assert actual == ref, (f['name'], prime, disk, 'normal form')
                    assert list(e.records()) == raw, 'normalization changed checkpoint records'
                    assert normalize(e, prime, 1) == actual, 'parallel/serial normalization differ'
                    if basis:
                        e.lib.gn_cancel(1)
                        assert not e.lib.gn_normalize_rule(0, 1)
                        assert e.lib.gn_normalize_status(0) == 5
                        e.lib.gn_cancel(0)
                        assert normalize(e, prime, 4) == ref, 'retry after cancellation'
                    reports.append(dict(case=f['name'], degree=degree, field=prime, disk=bool(disk), rows=len(actual), seconds=time.monotonic()-begin))
                    print('NORMALIZE', f['name'], degree, prime, bool(disk), len(actual), flush=True)
    # Portable packed record with coefficients beyond the former text limit.
    # This separately tests native monic denominator formatting arithmetic.
    f = dict(variables=['x', 'y'], relations=[])
    e = Engine(f, 2, workers=4, budget=128 << 20, scratch=32 << 20)
    apis(e)
    e.run()
    a = (1 << 131104) + 1
    values = [a, a + 2]
    data = bytearray(80)
    for i, value in enumerate(values):
        off = len(data)
        limbs = (value.bit_length() + 31) // 32
        data.extend(struct.pack('<II', limbs, 0) + value.to_bytes(limbs * 4, 'little'))
        data.extend(b'\0' * (-len(data) % 8))
        struct.pack_into('<QQQ', data, 32 + i * 24, 17 if i == 0 else 0, 0, off | 1)
    checksum = 1469598103934665603
    for byte in data[32:]:
        checksum = ((checksum ^ byte) * 1099511628211) & ((1 << 64) - 1)
    struct.pack_into('<IIIIQQ', data, 0, 0x31424e47, len(data), 2, 2, checksum, 0)
    C.memmove(e.lib.host_pointer(e.lib.gn_import_buffer()), bytes(data), len(data))
    check(e.lib.gn_restore_rule(len(data), 0))
    assert normalize(e, 0, 4) == {(1, 1): {(1, 1): Fraction(1), (0, 0): Fraction(a + 2, a)}}
    reports.append(dict(case='large-native-coefficient', bits=131105, passed=True))
    result = dict(passed=True, independentOracle='Python Fraction and Fp subword reduction', cases=reports)
    if os.environ.get('FOMKYR_NORMALIZER_REPORT'):
        Path(os.environ['FOMKYR_NORMALIZER_REPORT']).write_text(json.dumps(result, indent=2) + '\n')
    print('NORMALIZATION PASS', len(reports))


if __name__ == '__main__':
    main()
