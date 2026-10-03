#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.1
bash tools/verify_direct.sh >results/0.6.1/full-direct-suite.log 2>&1
python3 tests/test_audit.py >results/0.6.1/audit-tests.log 2>&1
node tests/test_oracle_format.mjs >results/0.6.1/oracle-format.log 2>&1
node --experimental-wasm-memory64 tests/test_deep_polish_wasm.mjs >results/0.6.1/deep-polish-wasm.log 2>&1
printf '0.6.1 SUITE PASSED\n'
