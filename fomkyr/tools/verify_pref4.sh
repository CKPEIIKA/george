#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/pref4
memory64_flags=()
if [[ $(node --v8-options) == *--experimental-wasm-memory64* ]]; then memory64_flags+=(--experimental-wasm-memory64); fi
python3 tests/test_pref4_delta.py >results/pref4/delta-native.log
node "${memory64_flags[@]}" tests/run_pref4_state.mjs >results/pref4/state.log
python3 tests/test_pair_plan.py >results/pref4/planner.log
python3 tests/test_pair_plan_gate.py >results/pref4/planner-gate.log
node "${memory64_flags[@]}" tests/test_pref4_wasm.mjs >results/pref4/wasm.log
node tests/test_pref4_controls.mjs >results/pref4/controls.log
python3 tests/test_pref4_matrix_driver.py >results/pref4/driver-safety.log
printf 'PREF4 BOUNDED SUITE PASSED\n'
