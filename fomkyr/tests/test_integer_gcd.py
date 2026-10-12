#!/usr/bin/env python3
"""Binary/Lehmer GCD against Python integers, including boundary matrices."""
from pathlib import Path
import ctypes as C
import json
import math
import random
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.native import Engine, U32

engine = Engine({'variables': ['x'], 'relations': []}, target=1,
                budget=64 << 20, scratch=32 << 20)
fn = engine.lib.gn_test_big
fn.argtypes = [U32, U32, U32, C.c_int, C.c_int]
fn.restype = C.c_int
ptr = engine.lib.host_pointer(engine.lib.gn_import_buffer())
rng = random.Random(71012)
cases = []
for bits in (1, 31, 32, 61, 62, 63, 64, 65, 95, 96, 97, 127,
             128, 255, 256, 511, 512, 1024, 2048, 4096):
    for _ in range(100):
        a, b = rng.getrandbits(bits), rng.getrandbits(bits)
        cases.extend(((a, b), (-a, b), (a, -b), (a, a),
                      (a, 0), (0, b), (a * 315, b * 315)))
    for delta in (-2, -1, 0, 1, 2):
        cases.extend(((2**bits + delta, 2**bits - 1),
                      (2**bits, 2**max(0, bits - 1))))
# Close high windows, highly unequal magnitudes, and large common powers of 2.
for limbs in range(3, 65):
    high = (2**62 - 1) << (32 * limbs - 62)
    low = rng.getrandbits(32 * limbs - 62)
    cases.extend(((high + low, high + low + 1),
                  (high + low, 2**64 - 1),
                  ((high + low) << 63, (high + low + 1) << 63)))
a, b = 0, 1
for n in range(1, 18001):
    a, b = b, a + b
    if n % 500 == 0:
        cases.append((a, b))
start = time.perf_counter()
for a, b in cases:
    na, nb = max(1, (abs(a).bit_length() + 31) // 32), max(1, (abs(b).bit_length() + 31) // 32)
    raw = abs(a).to_bytes(na * 4, 'little') + abs(b).to_bytes(nb * 4, 'little')
    C.memmove(ptr, raw, len(raw))
    code = fn(4, na, nb, -1 if a < 0 else 1, -1 if b < 0 else 1)
    assert code == 0, (code, a.bit_length(), b.bit_length())
    count = C.c_uint32.from_address(ptr).value
    sign = C.c_uint32.from_address(ptr + 4).value
    got = int.from_bytes(C.string_at(ptr + 8, count * 4), 'little')
    assert sign == 0 and got == math.gcd(a, b), (a, b, got)
print(json.dumps({'passed': True, 'cases': len(cases),
                  'oracle': 'Python math.gcd', 'seconds': time.perf_counter() - start}))
