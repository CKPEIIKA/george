#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.7
bash tools/build.sh >results/0.6.7/build-wasm.log 2>&1
make native >results/0.6.7/build-native.log 2>&1
bash tools/verify_066.sh >results/0.6.7/retained-suite.log 2>&1
python3 tests/test_cooperative_067.py >results/0.6.7/cooperative-native-matrix.log 2>&1
node --experimental-wasm-memory64 tests/test_cooperative_wasm_067.mjs >results/0.6.7/cooperative-wasm.log 2>&1
node --experimental-wasm-memory64 tests/test_cooperative_pressure_067.mjs >results/0.6.7/cooperative-pressure.log 2>&1
node --experimental-wasm-memory64 tests/test_cooperative_reserve_067.mjs >results/0.6.7/cooperative-reserve.log 2>&1
clang -std=c11 -O2 -fsanitize=undefined -fno-sanitize-recover=all tests/radix_property_063.c -o dist/radix-property-067
./dist/radix-property-067 cache >results/0.6.7/queue-cached.json
printf '0.6.7 CHECKS PASSED\n'
