#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.5
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.5/$name.log" 2>&1; echo "PASS $name"; }
run rational-arithmetic python3 tests/test_rational_arithmetic.py
run rational-cases python3 tests/test_rational_cases.py
run modular-tests node --experimental-wasm-memory64 tests/test_modular.mjs
run modular-matrix node --experimental-wasm-memory64 tests/test_modular_matrix.mjs
run signature-reference-tests python3 tests/test_signature_reference.py
run physics-wasm-matrix node --experimental-wasm-memory64 tests/test_physics_wasm.mjs
run progress-integration node --experimental-wasm-memory64 tests/test_progress_integration.mjs
run static-host node tests/test_static_host.mjs
run installer python3 tests/test_installer.py
run installer-modern python3 tests/test_installer_modern.py
run ubsan bash tools/test_ubsan.sh
