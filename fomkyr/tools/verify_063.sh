#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.3
bash tools/verify_062.sh >results/0.6.3/full-suite.log 2>&1
clang -std=c11 -O2 -fsanitize=undefined -fno-sanitize-recover=all tests/radix_property_063.c -o dist/radix-property-063
dist/radix-property-063 >results/0.6.3/radix-property.json
python3 tests/test_063_native.py >results/0.6.3/fk-nearby.log
node --experimental-wasm-memory64 tests/test_063_wasm.mjs >results/0.6.3/reserve-tests.log 2>&1
node --experimental-wasm-memory64 tests/test_063_cancel_leased.mjs >results/0.6.3/cancel-leased.log 2>&1
node tests/test_063_controls.mjs >results/0.6.3/controls.log
printf '0.6.3 SUITE PASSED\n'
