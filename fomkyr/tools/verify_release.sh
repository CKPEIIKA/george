#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results
run(){ local log="$1"; shift; printf 'RUN %s\n' "$log"; "$@" >"results/$log.log" 2>&1; printf 'PASS %s\n' "$log"; }
run build bash tools/build.sh
run native-tests python3 tests/test_native.py
run extra-tests python3 tests/test_extra.py
run optimizer-edge-tests python3 tests/test_optimizer_edges.py
run physics-matrix python3 tests/test_physics_matrix.py
run wasm-tests node --experimental-wasm-memory64 tests/test_wasm.mjs
run fomkyr-tests node --experimental-wasm-memory64 tests/test_fomkyr.mjs
run compatibility-tests node --experimental-wasm-memory64 tests/test_compatibility.mjs
run integration-tests node --experimental-wasm-memory64 tests/test_integration.mjs
run physics-wasm-matrix node --experimental-wasm-memory64 tests/test_physics_wasm.mjs
run progress-unit-tests node tests/test_progress.mjs
run progress-integration-tests node --experimental-wasm-memory64 tests/test_progress_integration.mjs
run static-host-unit-tests node tests/test_static_host.mjs
run installer-tests python3 tests/test_installer.py
run installer-modern-tests python3 tests/test_installer_modern.py
run ubsan-tests bash tools/test_ubsan.sh
printf 'CORE RELEASE SUITE PASSED\n'
