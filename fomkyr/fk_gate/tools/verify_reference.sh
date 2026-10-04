#!/usr/bin/env bash
set -euo pipefail
MODULE=$(cd "$(dirname "$0")/.." && pwd)
SOURCE=$(cd "${1:?Pass an explicitly selected, built fomkyr 0.6.5 checkout with this adapter installed}" && pwd)
cd "$MODULE"
bash tools/build.sh
python3 tools/test_installer.py "$SOURCE"
node --experimental-wasm-memory64 tests/test_wasm_reference.mjs "$SOURCE" "$MODULE/evidence"
bash tools/test_sanitized_reference.sh "$SOURCE"
echo 'Reference tests passed. Real browser tests and high-degree parity with external engines are separate.'
