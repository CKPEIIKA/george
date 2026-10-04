#!/usr/bin/env bash
# Focused release verification; not a claim to replay the imported high-degree proof.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tests/test_fk_profile_identity_068.py
python3 tests/test_fk_gate_068.py
node tests/test_fk_gate_wasm_068.mjs
python3 tests/test_fk_gate_cli_068.py
python3 tests/test_cooperative_067.py
bash tools/test_gate_ubsan_068.sh
