#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6.6
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.6.6/$name.log" 2>&1; echo "PASS $name"; }
run retained bash tools/verify_065.sh
run hilbert-native python3 tests/test_hilbert_closure.py
run hilbert-wasm node --experimental-wasm-memory64 tests/test_hilbert_closure_wasm.mjs
run hilbert-resume python3 tests/test_hilbert_closure_resume.py
run hilbert-authority python3 tests/test_hilbert_authority_edges.py
printf '0.6.6 SUITE PASSED\n'
