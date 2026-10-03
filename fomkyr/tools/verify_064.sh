#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/{0.5,0.6,0.6.1,0.6.2,0.6.3,0.6.4}
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.6.4/$name.log" 2>&1; echo "PASS $name"; }
run retained-063-suite bash tools/verify_063.sh
run memory-planner node tests/test_memory_policy.mjs
run automatic-controls node tests/test_memory_controls.mjs
run retry-oracle python3 tests/test_064_native.py
run retry-ubsan bash tools/test_064_ubsan.sh
run automatic-wasm node --experimental-wasm-memory64 tests/test_064_wasm.mjs
run automatic-wasm-oracle python3 tests/verify_062_wasm.py results/0.6.4/auto-wasm-manifest.json results/0.6.4/auto-wasm-oracle.json
run cancellation node --experimental-wasm-memory64 tests/test_064_cancel.mjs
run large-row-restore node --experimental-wasm-memory64 tests/test_064_restore.mjs
run small-budget node --experimental-wasm-memory64 tests/test_064_small_budget.mjs
printf '0.6.4 SUITE PASSED\n'
