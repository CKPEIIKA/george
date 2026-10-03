#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.2
bash tools/verify_061.sh >results/0.6.2/previous-suite.log 2>&1
python3 tests/test_big_division.py >results/0.6.2/big-division.json
python3 tests/test_big_fraction.py >results/0.6.2/big-fraction.json
python3 tests/test_062_presentations.py >results/0.6.2/presentation-regressions.log
node --experimental-wasm-memory64 tests/test_062_wasm.mjs >results/0.6.2/wasm-exact.log 2>&1
printf '0.6.2 SUITE PASSED\n'
