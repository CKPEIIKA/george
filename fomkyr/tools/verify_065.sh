#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.5
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.6.5/$name.log" 2>&1; echo "PASS $name"; }
run retained-suite bash tools/verify_064.sh
run native-build make native
run native-frontier python3 tests/test_frontier_native_065.py
run wasm-frontier node --experimental-wasm-memory64 tests/test_frontier_wasm.mjs
run cli python3 tests/test_cli_065.py
run cli-edges python3 tests/test_cli_edges_065.py
run native-platform python3 tests/test_native_platform_065.py
printf '0.6.5 SUITE PASSED\n'
