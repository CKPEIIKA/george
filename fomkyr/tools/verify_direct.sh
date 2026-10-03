#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/0.6
run(){ local name="$1"; shift; echo "RUN $name"; "$@" >"results/0.6/$name.log" 2>&1; echo "PASS $name"; }
run core-suite bash tools/verify_release.sh
run compiled-edge-tests python3 tests/test_compiled_rewrites.py
run compiled-fk6-certificate python3 tests/test_compiled_rewrites.py --fk6
run compiled-wasm-tests node --experimental-wasm-memory64 tests/test_compiled_wasm.mjs
run direct-controls node tests/test_direct_controls.mjs
run rational-arithmetic python3 tests/test_rational_arithmetic.py
run rational-cases python3 tests/test_rational_cases.py
run modular-compatibility node --experimental-wasm-memory64 tests/test_modular.mjs
python3 - <<'PYEND'
from pathlib import Path
import shutil
for name in ('rational-arithmetic-tests.json','rational-cases.json','modular-tests.json'):
    shutil.copy2(Path('results/0.5')/name,Path('results/0.6')/name)
PYEND
printf 'DIRECT RELEASE SUITE PASSED\n'
