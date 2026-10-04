#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.7.1 results/0.6.5 results/0.6.7 results/0.6.8
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.7.1/$name.log" 2>&1; echo "PASS $name"; }
run retained-fk-cooperative bash tools/verify_068.sh
run retained-cooperative-wasm node --experimental-wasm-memory64 tests/test_cooperative_wasm_067.mjs
run retained-frontier python3 tests/test_frontier_native_065.py
run planner-native python3 tests/test_pair_plan.py
run planner-large-frontier python3 tests/test_pair_plan_frame.py
run planner-wasm node --experimental-wasm-memory64 tests/test_pair_plan_wasm.mjs
run planner-cross-runtime python3 tests/test_pair_plan_cross.py
run planner-gate python3 tests/test_pair_plan_gate.py
run planner-memory-guard python3 tests/test_pair_plan_budget.py
run planner-ubsan bash tools/test_plan_ubsan.sh
run audit-tools make audit-tools
run stream-audit python3 tests/test_stream_canonical.py
run planner-controls node tests/test_pair_plan_controls.mjs
run installer python3 tests/test_installer.py
run modern-installer python3 tests/test_installer_modern.py
printf '0.7.1 CHECKS PASSED\n'
